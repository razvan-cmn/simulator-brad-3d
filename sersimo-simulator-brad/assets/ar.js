/* Sersimo – Simulator brad: vederea 3D + AR live (cu camera telefonului).
 * Modul încărcat la cerere de simulator.js (import dinamic), doar când se deschide vederea „3D · AR”.
 *  - calculator / telefon: bradul 3D, rotit cu degetul / mouse-ul;
 *  - Android (ARCore / WebXR): AR propriu — atingi podeaua ca să-l pui, tragi cu degetul, + / −, 100 %, rotire, blocare,
 *    ascundere în spatele oamenilor (dacă telefonul are senzor de adâncime);
 *  - iPhone: AR Quick Look (aplicația Apple), cu fișierul .usdz al înălțimii alese;
 *  - calculator: cod QR care deschide pagina pe telefon.
 * Bibliotecile (three.js) sunt în assets/vendor — nimic nu se încarcă de pe alte servere.
 */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const UA = navigator.userAgent;
const isIOS = /iP(hone|ad|od)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(UA);
const isTouch = matchMedia('(pointer:coarse)').matches;
const quickLookOK = (() => { try { return document.createElement('a').relList.supports('ar'); } catch (e) { return false; } })();
let xrOK = false;
const xrCheck = (async () => {
  try { xrOK = !!(window.isSecureContext && navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { xrOK = false; }
})();

const gltfCache = {};
const loadGltf = url => (gltfCache[url] = gltfCache[url] || new GLTFLoader().loadAsync(url));
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// modelul e făcut exact la h × d ale unei înălțimi; pentru celelalte îl scalăm
const fit = s => new THREE.Vector3(s.d / (s.glbD || s.d), s.h / (s.glbH || s.h), s.d / (s.glbD || s.d));

function shadowMesh() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .002;
  return m;
}

/**
 * @param {HTMLElement} host  containerul din scena simulatorului
 * @param {{track:Function, cart:Function, sizes:Function, qrJs:string}} api
 */
export async function mount(host, api) {
  host.innerHTML = `
    <div class="ssb-3d-cv"></div>
    <div class="ssb-3d-hint">${isTouch ? 'Rotește bradul cu degetul' : 'Trage ca să rotești bradul · rotița pentru zoom'}</div>
    <div class="ssb-3d-load">Se încarcă bradul 3D…</div>
    <div class="ssb-3d-cta"></div>`;
  const q = c => host.querySelector('.ssb-3d-' + c);
  const cvHost = q('cv');

  /* ---------- vederea 3D ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  cvHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, dampingFactor: .08, autoRotate: true, autoRotateSpeed: .9,
    minPolarAngle: THREE.MathUtils.degToRad(35), maxPolarAngle: THREE.MathUtils.degToRad(96) });
  controls.addEventListener('start', () => { controls.autoRotate = false; q('hint').style.opacity = 0; });
  const holder = new THREE.Group(); scene.add(holder);
  const floorShadow = shadowMesh(); scene.add(floorShadow);

  let size = null, visible = false, loadToken = 0;
  function frame() {
    const s = size; if (!s) return;
    const h = s.h / 100, d = s.d / 100, w = cvHost.clientWidth || 1, hh = cvHost.clientHeight || 1;
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const dist = Math.max((h * .66) / Math.tan(vf), (d * .7) / Math.tan(hf)) + d / 2;
    controls.target.set(0, h * .45, 0);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, .12, 1);
    camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(dist));
    controls.minDistance = dist * .45; controls.maxDistance = dist * 1.6;
    floorShadow.scale.setScalar(d * 1.25);
    controls.update();
  }
  function resize() {
    const w = cvHost.clientWidth, h = cvHost.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); frame();
  }
  new ResizeObserver(resize).observe(cvHost);
  function loop() { controls.update(); renderer.render(scene, camera); }

  async function setSize(s) {
    const first = !size;
    size = s; renderCta();
    if (!s.glb) return;
    const tok = ++loadToken;
    q('load').style.display = '';
    try {
      const g = await loadGltf(s.glb);
      if (tok !== loadToken) return;
      holder.clear();
      holder.add(g.scene.clone(true));
      holder.scale.copy(fit(s));
      q('load').style.display = 'none';
      if (first) camera.position.set(0, 1, 6);
      resize();
    } catch (e) {
      console.error('SSB 3D', e);
      q('load').textContent = 'Bradul 3D nu s-a putut încărca.';
    }
  }
  function show() { if (visible) return; visible = true; resize(); renderer.setAnimationLoop(loop); }
  function hide() { visible = false; renderer.setAnimationLoop(null); }

  /* ---------- butonul AR (sau QR pe calculator) ---------- */
  await xrCheck;
  function arMode(s) {
    if (xrOK && s.glb) return 'xr';
    if (isIOS) return !quickLookOK ? 'ios-app' : (s.usdz ? 'ios' : 'ios-missing');
    if (isAndroid && s.glb && s.glbH === s.h) return 'scene'; // Android fără WebXR: Scene Viewer (Google), fișierul propriu
    return isTouch ? 'none' : 'qr';
  }
  function renderCta() {
    const s = size, m = arMode(s), el = q('cta');
    if (m === 'xr' || m === 'ios' || m === 'scene') {
      el.innerHTML = `<button type="button" class="ssb-ar-btn" data-ar>📱 Pune bradul în camera ta</button>
        <small>Se deschide camera · bradul apare la mărimea reală (${s.h} cm)</small>`;
    } else if (m === 'ios-missing') {
      const ok = api.sizes().filter(o => o.usdz).map(o => o.h + ' cm');
      el.innerHTML = `<small class="ssb-ar-note">Pe iPhone, AR live e disponibil ${ok.length ? 'la: <b>' + ok.join(', ') + '</b>' : 'în curând'}.</small>`;
    } else if (m === 'ios-app') {
      el.innerHTML = '<small class="ssb-ar-note">Pentru AR live deschide pagina în <b>Safari</b> (⋯ → Deschide în browser).</small>';
    } else if (m === 'qr') {
      el.innerHTML = `<div class="ssb-qr"><div class="ssb-qr-img" data-qr></div><div><b>Vezi-l live în camera ta</b>
        <span>Scanează codul cu telefonul: se deschide camera și pui bradul în cameră, la mărimea reală.</span></div></div>`;
      drawQr(el.querySelector('[data-qr]'));
    } else el.innerHTML = '';
  }
  let qrTracked = false;
  function drawQr(box) {
    const url = location.href.split('#')[0] + '#ssb-ar';
    const paint = () => {
      try {
        const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
        if (!qrTracked) { qrTracked = true; api.track('ar_qr'); }
      } catch (e) { box.closest('.ssb-qr').remove(); }
    };
    if (window.qrcode) return paint();
    const sc = document.createElement('script'); sc.src = api.qrJs; sc.onload = paint; sc.onerror = () => box.closest('.ssb-qr').remove();
    document.head.appendChild(sc);
  }
  host.addEventListener('click', e => {
    if (!e.target.closest('[data-ar]')) return;
    const s = size, m = arMode(s);
    if (m === 'xr') { api.track('ar_android'); startXR(s).catch(err => { console.error(err); alert('AR nu a pornit: ' + err.message); }); }
    else if (m === 'ios') { api.track('ar_ios'); quickLook(s, e.target.closest('[data-ar]')); }
    else if (m === 'scene') { api.track('ar_android', { ar_viewer: 'scene' }); sceneViewer(s); }
  });

  /* ---------- iPhone: AR Quick Look ---------- */
  let qlLink = null;
  function quickLook(s, btn) {
    const p = ['allowsContentScaling=1'];
    if (s.inStock) { // banner Apple jos, cu buton de coș
      p.push('callToAction=' + encodeURIComponent('Adaugă în coș'), 'checkoutTitle=' + encodeURIComponent(api.title() + ' ' + s.h + ' cm'),
        'checkoutSubtitle=' + encodeURIComponent('Ø ' + s.d + ' cm · mărime reală'), 'price=' + encodeURIComponent(s.priceText));
    }
    if (qlLink) qlLink.remove();
    qlLink = document.createElement('a');
    qlLink.rel = 'ar'; qlLink.href = s.usdz + '#' + p.join('&'); qlLink.style.display = 'none';
    qlLink.appendChild(document.createElement('img'));
    qlLink.addEventListener('message', ev => { if (ev.data === '_apple_ar_quicklook_button_tapped') api.cart(); });
    document.body.appendChild(qlLink);
    qlLink.click();
    if (btn) { const t = btn.textContent; btn.textContent = 'Se deschide camera…'; setTimeout(() => { btn.textContent = t; }, 3500); }
  }

  /* ---------- Android fără WebXR: Scene Viewer ---------- */
  function sceneViewer(s) {
    const file = new URL(s.glb, location.href).href;
    const back = location.href.split('#')[0];
    location.href = 'intent://arvr.google.com/scene-viewer/1.0?file=' + encodeURIComponent(file) + '&mode=ar_preferred&resizable=false&title=' + encodeURIComponent(api.title() + ' ' + s.h + ' cm')
      + '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=' + encodeURIComponent(back) + ';end;';
  }

  /* ================= Android: AR propriu cu WebXR ================= */
  let xr = null; // creat la primul AR
  async function startXR(s) {
    if (!xr) xr = createXR();
    await xr.start(s);
  }
  function createXR() {
    const ov = document.createElement('div');
    ov.id = 'ssb-xr';
    ov.innerHTML = `
      <div class="ssb-xr-top ssb-xr-ui">
        <div class="ssb-xr-size" data-x="size"></div>
        <button type="button" class="ssb-xr-exit" data-x="exit">✕ Ieșire</button>
      </div>
      <div class="ssb-xr-msg" data-x="msg"></div>
      <div class="ssb-xr-bottom ssb-xr-ui">
        <div class="ssb-xr-row">
          <button type="button" class="ssb-xr-round" data-x="rotL" aria-label="Rotește spre stânga">⟲</button>
          <button type="button" class="ssb-xr-round" data-x="minus" aria-label="Micșorează">−</button>
          <button type="button" data-x="real">100%</button>
          <button type="button" class="ssb-xr-round" data-x="plus" aria-label="Mărește">+</button>
          <button type="button" class="ssb-xr-round" data-x="rotR" aria-label="Rotește spre dreapta">⟳</button>
        </div>
        <div class="ssb-xr-row">
          <button type="button" class="ssb-xr-main" data-x="place">Pune bradul aici</button>
          <button type="button" data-x="lock">🔓 Blochează</button>
          <button type="button" class="ssb-xr-main" data-x="cart">🛒 În coș</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const $ = k => ov.querySelector('[data-x="' + k + '"]');

    let r, sc, cam, tree, model, reticle, session, refSpace, hitSrc, touchSrc, cur;
    let placed = false, locked = false, dragging = false, scale = 1, rotY = 0, occlusionOK = false, occFailed = false, lastErr = '';
    const base = new THREE.Vector3(1, 1, 1);

    /* Ocluzie (ARCore Depth): părțile bradului aflate în spatele unui obiect real nu se desenează. */
    const occ = { uOccDepth: { value: null }, uOccUv: { value: new THREE.Matrix4() }, uOccRaw: { value: .001 }, uOccVp: { value: new THREE.Vector2(1, 1) }, uOccOn: { value: 0 } };
    let depthTex = null;
    function addOcclusion(mat) {
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, occ);
        sh.vertexShader = 'varying float vOccZ;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vOccZ = -mvPosition.z;');
        sh.fragmentShader = 'varying float vOccZ;\nuniform sampler2D uOccDepth; uniform mat4 uOccUv; uniform float uOccRaw; uniform vec2 uOccVp; uniform float uOccOn;\n'
          + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uOccOn > 0.5) {
    vec2 nv = gl_FragCoord.xy / uOccVp; nv.y = 1.0 - nv.y;
    vec2 duv = (uOccUv * vec4(nv, 0.0, 1.0)).xy;
    vec2 la = texture2D(uOccDepth, duv).rg;
    float real = (la.x * 255.0 + la.y * 65280.0) * uOccRaw;
    if (real > 0.0 && real < vOccZ - 0.05) discard;
  }`);
      };
      mat.customProgramCacheKey = () => 'ssb-occ';
      mat.needsUpdate = true;
    }
    function updateDepth(f) {
      if (session.depthUsage !== 'cpu-optimized') return;
      const pose = f.getViewerPose(refSpace); if (!pose) return;
      let d = null;
      try { d = f.getDepthInformation(pose.views[0]); } catch (e) { return; }
      if (!d) { occ.uOccOn.value = 0; return; }
      const bytes = new Uint8Array(d.data);
      if (!depthTex || depthTex.image.width !== d.width || depthTex.image.height !== d.height) {
        depthTex = new THREE.DataTexture(new Uint8Array(bytes.length), d.width, d.height, THREE.RGFormat); // RG8 (LuminanceAlpha nu merge în WebGL2)
        depthTex.magFilter = depthTex.minFilter = THREE.NearestFilter;
        occ.uOccDepth.value = depthTex;
      }
      depthTex.image.data.set(bytes); depthTex.needsUpdate = true;
      occ.uOccUv.value.fromArray(d.normDepthBufferFromNormView.matrix);
      occ.uOccRaw.value = d.rawValueToMeters;
      const bl = r.xr.getBaseLayer() || session.renderState.baseLayer;
      const w = bl && (bl.framebufferWidth || bl.textureWidth), h = bl && (bl.framebufferHeight || bl.textureHeight);
      if (!w || !h) throw new Error('mărimea imaginii AR necunoscută');
      occ.uOccVp.value.set(w, h);
      occ.uOccOn.value = 1;
    }

    function msg(t) { $('msg').textContent = t; $('msg').style.display = t ? '' : 'none'; }
    function ui() {
      $('size').innerHTML = Math.round(cur.h * scale) + ' cm <small>· ' + Math.round(scale * 100) + '%</small>';
      $('real').classList.toggle('on', Math.abs(scale - 1) < .001);
      $('place').style.display = placed ? 'none' : '';
      $('lock').style.display = placed ? '' : 'none';
      $('cart').style.display = placed && cur.inStock ? '' : 'none';
      $('lock').textContent = locked ? '🔒 Blocat' : '🔓 Blochează';
      $('lock').classList.toggle('on', locked);
      ['minus', 'plus', 'real', 'rotL', 'rotR'].forEach(k => { $(k).disabled = !placed || locked; });
      if (tree) { tree.scale.copy(base).multiplyScalar(scale); tree.rotation.y = rotY; }
    }
    function showErr(where, e) {
      const t = where + ': ' + (e && e.message ? e.message : e);
      if (t !== lastErr) { lastErr = t; console.error(t, e); msg('⚠ ' + t); setTimeout(() => { if ($('msg').textContent === '⚠ ' + t) msg(''); }, 6000); }
    }

    async function prepare(s) {
      if (!r) {
        r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        r.setPixelRatio(Math.min(devicePixelRatio, 2));
        r.setSize(innerWidth, innerHeight);
        r.xr.enabled = true;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.domElement.className = 'ssb-xr-cv';
        document.body.appendChild(r.domElement);
        sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
        cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .01, 50);
        reticle = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc31c72 }));
        reticle.matrixAutoUpdate = false; reticle.visible = false; sc.add(reticle);
        tree = new THREE.Group(); tree.visible = false; sc.add(tree);
      }
      if (!model || model.userData.src !== s.glb) {
        const g = await loadGltf(s.glb);
        if (model) tree.remove(model);
        model = g.scene.clone(true);
        model.userData.src = s.glb;
        // materiale proprii (cu ocluzie), ca să nu atingem vederea 3D din pagină
        model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); addOcclusion(o.material); } });
        const sh = shadowMesh(); sh.scale.setScalar(1.6); model.add(sh);
        tree.add(model);
        try {
          tree.visible = true; r.compile(sc, cam); tree.visible = false;
          model.traverse(o => { if (o.isMesh && o.material.map) r.initTexture(o.material.map); });
        } catch (e) { console.warn('pregătire model', e); tree.visible = false; }
      }
      cur = s; base.copy(fit(s));
    }

    async function start(s) {
      if (session) return;
      // sesiunea trebuie cerută imediat după atingere; modelul e deja în cache din vederea 3D
      const req = navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'depth-sensing'], domOverlay: { root: ov },
        depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha'] },
      });
      await prepare(s);
      session = await req;
      ov.classList.add('on');
      hide(); // vederea 3D din pagină nu mai trebuie desenată cât suntem în AR
      r.xr.setReferenceSpaceType('local');
      await r.xr.setSession(session);
      refSpace = await session.requestReferenceSpace('local');
      const viewer = await session.requestReferenceSpace('viewer');
      hitSrc = await session.requestHitTestSource({ space: viewer });
      try { touchSrc = await session.requestHitTestSourceForTransientInput({ profile: 'generic-touchscreen' }); } catch (e) { touchSrc = null; }
      placed = false; locked = false; dragging = false; scale = 1; rotY = 0; tree.visible = false; occ.uOccOn.value = 0;
      occlusionOK = session.depthUsage === 'cpu-optimized'; occFailed = false; lastErr = '';
      msg('Îndreaptă telefonul spre podea și mișcă-l puțin…'); ui();
      session.addEventListener('selectstart', () => { if (placed && !locked) dragging = true; });
      session.addEventListener('selectend', () => { dragging = false; });
      session.addEventListener('select', () => { if (!placed) place(); });
      session.addEventListener('end', () => {
        session = null; hitSrc = touchSrc = null; ov.classList.remove('on');
        r.setAnimationLoop(null);
        show();
      });
      r.setAnimationLoop(xrFrame);
    }
    function place() {
      try {
        if (!reticle.visible) return;
        tree.position.setFromMatrixPosition(reticle.matrix);
        tree.visible = true; placed = true; reticle.visible = false;
        api.track('ar_place');
        msg(occlusionOK ? 'Trage cu degetul ca să muți bradul' : 'Trage cu degetul ca să muți bradul · telefonul nu suportă ascunderea în spatele oamenilor');
        setTimeout(() => { if (placed && !dragging) msg(''); }, 4500);
        ui();
      } catch (e) { showErr('plasare', e); }
    }
    function xrFrame(t, f) {
      // o eroare aici ar opri bucla și imaginea ar îngheța → prindem tot și mergem mai departe
      try { frameInner(f); } catch (e) { showErr('AR', e); }
      try { r.render(sc, cam); } catch (e) { showErr('desen', e); }
    }
    function frameInner(f) {
      if (!f) return;
      if (!placed && hitSrc) {
        const hits = f.getHitTestResults(hitSrc);
        if (hits.length) {
          reticle.visible = true;
          reticle.matrix.fromArray(hits[0].getPose(refSpace).transform.matrix);
          msg('Atinge ecranul ca să pui bradul aici');
        } else reticle.visible = false;
      }
      if (placed && dragging && !locked && touchSrc) { // bradul merge unde e degetul pe podea
        for (const res of f.getHitTestResultsForTransientInput(touchSrc)) {
          if (res.results.length) { const p = res.results[0].getPose(refSpace).transform.position; tree.position.set(p.x, p.y, p.z); break; }
        }
      }
      if (placed && occlusionOK && !occFailed) {
        try { updateDepth(f); } catch (e) { occFailed = true; occ.uOccOn.value = 0; showErr('ocluzie oprită', e); }
      }
    }

    // atingerile pe butoane nu mută bradul
    ov.querySelectorAll('.ssb-xr-ui').forEach(el => el.addEventListener('beforexrselect', e => e.preventDefault()));
    const step = d => { scale = Math.min(2, Math.max(.5, Math.round((scale + d) * 10) / 10)); ui(); };
    $('minus').onclick = () => step(-.1);
    $('plus').onclick = () => step(.1);
    $('real').onclick = () => { scale = 1; ui(); };
    $('rotL').onclick = () => { rotY += Math.PI / 12; ui(); };
    $('rotR').onclick = () => { rotY -= Math.PI / 12; ui(); };
    $('place').onclick = () => place();
    $('lock').onclick = () => {
      locked = !locked; dragging = false;
      msg(locked ? 'Bradul e blocat pe loc' : 'Trage cu degetul ca să muți bradul');
      setTimeout(() => msg(''), 2000); ui();
    };
    $('exit').onclick = () => session && session.end();
    $('cart').onclick = () => { const go = () => api.cart(); if (session) { session.end().then(go, go); } else go(); };
    return { start };
  }

  return { setSize, show, hide };
}
