/* Sersimo – Simulator brad (v1.2.3)
 * Datele vin din window.SSB_CONFIG (injectat de plugin, vezi includes/class-ssb-frontend.php):
 * { family, name, current, sizes:[{id,h,d,price,priceText,url,cartUrl,inStock,cutout,baseX}],
 *   ajaxUrl, brand, buttonText }
 */
(function () {
  'use strict';
  const CFG = window.SSB_CONFIG;
  if (!CFG || !CFG.sizes || !CFG.sizes.length) return;

  /* ---------- polyfill roundRect (Safari < 16) ---------- */
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.max(0, Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    };
  }

  const PRODUCT = { family: CFG.family, name: CFG.name, sizes: CFG.sizes };
  let sizeIdx = Math.max(0, Math.min(CFG.current | 0, PRODUCT.sizes.length - 1));
  const TOPPER = 10; // cm liberi recomandați deasupra vârfului
  const isTouch = matchMedia('(pointer:coarse)').matches;

  /* ---------- tracking ---------- */
  function track(ev, extra) {
    const s = PRODUCT.sizes[sizeIdx];
    try {
      if (CFG.ajaxUrl) {
        const fd = new FormData();
        fd.append('action', 'ssb_event'); fd.append('event', ev); fd.append('product', s.id);
        if (!(navigator.sendBeacon && navigator.sendBeacon(CFG.ajaxUrl, fd))) fetch(CFG.ajaxUrl, { method: 'POST', body: fd, keepalive: true, credentials: 'same-origin' });
      }
    } catch (e) {}
    try {
      const data = Object.assign({ event: 'simulator_brad', simulator_action: ev, product_id: s.id, tree_height: s.h, tree_family: PRODUCT.family }, extra || {});
      (window.dataLayer = window.dataLayer || []).push(data);
    } catch (e) {}
  }
  function onceFlag(key) { // true o singură dată pe zi / browser
    try {
      const k = 'ssb_' + key, today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(k) === today) return false;
      localStorage.setItem(k, today); return true;
    } catch (e) { return false; }
  }
  function markUsed() { document.cookie = 'ssb_used=1; max-age=' + 60 * 60 * 24 * 30 + '; path=/; SameSite=Lax'; }

  /* ---------- markup ---------- */
  const root = document.createElement('section');
  root.id = 'ssb-sim'; root.className = 'ssb-sim';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Simulator brad');
  root.innerHTML = `
  <div class="ssb-top"><div class="ssb-t" data-ssb="title"></div><button type="button" class="ssb-x" data-ssb="close"><span aria-hidden="true">×</span> Întoarce-te la produs</button></div>
  <div class="ssb-body">
    <div class="ssb-stage" data-ssb="stage">
      <canvas class="ssb-cv"></canvas>
      <div class="ssb-hint" data-ssb="hint">${isTouch ? 'Trage bradul cu degetul · 2 degete pentru zoom' : 'Trage bradul ca să-l muți · rotița pentru zoom'}</div>
      <div class="ssb-tools">
        <button type="button" class="ssb-tool" data-ssb="zin" title="Zoom in">+</button>
        <button type="button" class="ssb-tool" data-ssb="zout" title="Zoom out">−</button>
        <button type="button" class="ssb-tool" data-ssb="reset" title="Resetează">⟲</button>
        <button type="button" class="ssb-tool" data-ssb="shot" title="Salvează / trimite imaginea">📷</button>
      </div>
    </div>
    <aside class="ssb-panel">
      <h3>Camera</h3>
      <div class="ssb-chips ssb-rooms" data-ssb="rooms"></div>
      <div class="ssb-photo-tools ssb-hidden" data-ssb="emptyTools">
        <div class="ssb-presets" data-ssb="presets"></div>
        <div class="ssb-hidden ssb-custom" data-ssb="custom">
          <h4>Camera</h4>
          <label>Lățime (cm) <input type="number" data-c="w" min="250" max="1000"></label>
          <label>Adâncime (cm) <input type="number" data-c="d" min="250" max="1000"></label>
          <label>Înălțimea tavanului (cm) <input type="number" data-c="h" min="200" max="450"></label>
          <h4>Ușa</h4>
          <label>Pe peretele <select data-c="door.wall"><option value="left">din stânga</option><option value="back">din față</option><option value="right">din dreapta</option><option value="none">fără ușă</option></select></label>
          <label>Poziție <input type="range" data-c="door.at" min="0" max="100"></label>
          <label>Lățime (cm) <input type="number" data-c="door.w" min="60" max="250"></label>
          <label>Înălțime (cm) <input type="number" data-c="door.h" min="180" max="300"></label>
          <h4>Fereastra</h4>
          <label>Pe peretele <select data-c="win.wall"><option value="left">din stânga</option><option value="back">din față</option><option value="right">din dreapta</option><option value="none">fără fereastră</option></select></label>
          <label>Poziție <input type="range" data-c="win.at" min="0" max="100"></label>
          <label>Lățime (cm) <input type="number" data-c="win.w" min="50" max="600"></label>
          <label>Înălțime (cm) <input type="number" data-c="win.h" min="50" max="300"></label>
          <label>De la podea (cm) <input type="number" data-c="win.sill" min="0" max="150"></label>
          <h4>Culori</h4>
          <div class="ssb-swatches" data-ssb="wallSw"></div>
          <div class="ssb-swatches" data-ssb="floorSw"></div>
          <label class="ssb-check">Canapea <input type="checkbox" data-c="sofa"></label>
        </div>
      </div>
      <div class="ssb-photo-tools ssb-hidden" data-ssb="photoTools">
        <div class="ssb-row2">
          <button type="button" class="ssb-btn" data-ssb="snap">📷 Fă o poză</button>
          <button type="button" class="ssb-btn ssb-btn-ghost" data-ssb="pick">🖼 Din galerie</button>
        </div>
        <p class="ssb-privacy">🔒 Poza rămâne pe ${isTouch ? 'telefonul' : 'calculatorul'} tău. Nu o trimitem și nu o salvăm nicăieri.</p>
        <input type="file" data-ssb="file" accept="image/*" class="ssb-hidden">
        <input type="file" data-ssb="fileCam" accept="image/*" capture="environment" class="ssb-hidden">
        <p data-ssb="photoTip">Stai la 3–4 m de locul bradului și ține telefonul <b>drept</b> (nu înclinat în sus sau în jos), la nivelul pieptului. Prinde în poză podeaua din locul bradului.</p>
        <div class="ssb-hidden" data-ssb="photoSteps">
          <div class="ssb-seg" data-ssb="toolSeg">
            <button type="button" data-tool="move">1 · Bradul</button>
            <button type="button" data-tool="ref">2 · Calibrare</button>
            <button type="button" data-tool="mask">3 · În față</button>
          </div>
          <div data-pane="move">
            <p>Trage bradul unde vrei să stea — <b>baza</b> lui trebuie să fie pe podea. Linia aurie e nivelul telefonului: dacă l-ai ținut drept, e deja la locul ei.</p>
            <label>Telefonul era la (cm de la podea) <input type="number" data-ssb="camH" min="40" max="250" value="140"></label>
            <label>Înălțimea tavanului (cm) <input type="number" data-ssb="ceil" min="200" max="600" value="260"></label>
          </div>
          <div data-pane="ref" class="ssb-hidden">
            <p>Pentru o scară mai precisă: potrivește cele două capete ale liniei verzi pe un obiect cu înălțime cunoscută, <b>aproape de locul bradului</b> (ideal tocul ușii).</p>
            <div class="ssb-chips" data-ssb="refPresets">
              <button type="button" class="ssb-chip" data-refh="205">Ușă 205</button>
              <button type="button" class="ssb-chip" data-refh="90">Blat 90</button>
              <button type="button" class="ssb-chip" data-refh="75">Masă 75</button>
            </div>
            <label>Înălțimea obiectului (cm) <input type="number" data-ssb="refH" min="20" max="400" value="205"></label>
            <p class="ssb-ok ssb-hidden" data-ssb="refInfo"></p>
            <button type="button" class="ssb-btn ssb-btn-ghost" data-ssb="refOff">Renunță la calibrare</button>
          </div>
          <div data-pane="mask" class="ssb-hidden">
            <p>Pictează peste obiectele care stau <b>în fața</b> bradului (canapea, masă, fotoliu) — bradul va apărea în spatele lor. Mărește cu 2 degete pentru margini precise.</p>
            <div class="ssb-seg" data-ssb="brushSeg">
              <button type="button" data-brush="add">🖌 Pensulă</button>
              <button type="button" data-brush="erase">⌫ Radieră</button>
            </div>
            <label>Mărime pensulă <input type="range" data-ssb="brushSize" min="6" max="80" value="24"></label>
            <div class="ssb-row2">
              <button type="button" class="ssb-btn ssb-btn-ghost" data-ssb="undo">↶ Anulează</button>
              <button type="button" class="ssb-btn ssb-btn-ghost" data-ssb="maskClear">Șterge tot</button>
            </div>
          </div>
        </div>
      </div>
      <h3>Înălțime</h3>
      <div class="ssb-sizes" data-ssb="sizes"></div>
      <h3 class="ssb-dims-h">Dimensiuni reale</h3>
      <div class="ssb-dims">
        <div class="ssb-dim"><small>Înălțime</small><b data-ssb="dH"></b></div>
        <div class="ssb-dim"><small>Diametru la bază</small><b data-ssb="dD"></b></div>
      </div>
      <div class="ssb-warn ssb-hidden" data-ssb="warn"></div>
      <h3>Afișare</h3>
      <label class="ssb-toggle">Cote (înălțime și diametru)<input type="checkbox" data-ssb="tDims" checked></label>
      <label class="ssb-toggle">Compară cu celelalte înălțimi<input type="checkbox" data-ssb="tCmp"></label>
      <label class="ssb-toggle">Siluetă om 1,70 m (referință)<input type="checkbox" data-ssb="tPerson"></label>
      <div class="ssb-cta">
        <a class="ssb-btn ssb-btn-cart" data-ssb="cart"></a>
        <small data-ssb="cartNote"></small>
      </div>
    </aside>
  </div>`;
  document.body.appendChild(root);
  const $ = k => root.querySelector('[data-ssb="' + k + '"]');

  /* ---------- camere ---------- */
  /* Livingul are mobila poziționată fix → dimensiuni fixe.
     „Bloc / Casă” = cameră construită din preseturi (sau Custom). Unități: cm.
     Camera e privită de lângă peretele din spate: x stânga/dreapta, z în adâncime (ZN = aproape), y = înălțime.
     Pereți: left (x = XL), back (z = ZB, „din față” pentru client), right (x = XR).
     door/win.at = poziția centrului pe perete, 0–100 % (de la stânga, cum se vede pe ecran). */
  const ZN = 30;
  let ROOM_W = 500, ROOM_H = 270, XL = -250, XR = 250, ZB = 650;
  const WALL_COLORS = [['Alb', '#eceae6'], ['Crem', '#e8dcc6'], ['Gri', '#d6d6d3'], ['Salvie', '#d3dbcb'], ['Bej', '#ddc9b0']];
  const FLOORS = [
    ['Parchet deschis', { floor: '#cfb48f', plank: 20 }],
    ['Parchet închis', { floor: '#8d6646', plank: 19 }],
    ['Parchet gri', { floor: '#b3aca3', plank: 20 }],
    ['Gresie', { floor: '#cdc8bf', tile: 60 }],
  ];
  const PRESETS = [
    { id: 'bloc1', name: 'Bloc vechi', sub: 'sufragerie ~18 m²',
      w: 360, d: 500, h: 255, wall: 1, floor: 0, sofa: true, radiator: true,
      door: { wall: 'left', at: 72, w: 80, h: 205 }, win: { wall: 'back', at: 42, w: 180, h: 140, sill: 85 } },
    { id: 'bloc2', name: 'Bloc vechi, cameră mică', sub: '~14 m²',
      w: 320, d: 430, h: 255, wall: 0, floor: 0, sofa: true, radiator: true,
      door: { wall: 'left', at: 70, w: 80, h: 205 }, win: { wall: 'back', at: 50, w: 150, h: 140, sill: 85 } },
    { id: 'nou', name: 'Bloc nou', sub: 'living ~24 m²',
      w: 420, d: 580, h: 270, wall: 2, floor: 2, sofa: true, radiator: false,
      door: { wall: 'left', at: 75, w: 90, h: 210 }, win: { wall: 'back', at: 40, w: 240, h: 215, sill: 0 } },
    { id: 'casa', name: 'Casă', sub: 'living ~30 m²',
      w: 520, d: 600, h: 280, wall: 1, floor: 1, sofa: true, radiator: true,
      door: { wall: 'left', at: 72, w: 90, h: 210 }, win: { wall: 'back', at: 40, w: 200, h: 150, sill: 80 } },
  ];
  const CUSTOM_ID = 'custom';
  let presetId = 'bloc1';
  const custom = JSON.parse(JSON.stringify(PRESETS[3])); custom.id = CUSTOM_ID; custom.name = 'Custom'; custom.sub = 'casa ta, cu măsurile tale';
  const roomCfg = () => presetId === CUSTOM_ID ? custom : PRESETS.find(p => p.id === presetId);
  const LIVING_DIMS = { w: 500, d: 620, h: 270 }; // ZB = 650, ca în v1
  function roomDims() {
    const d = room.id === 'empty' ? roomCfg() : LIVING_DIMS;
    ROOM_W = d.w; ROOM_H = d.h; XL = -d.w / 2; XR = d.w / 2; ZB = ZN + d.d;
    return d;
  }
  // Unde stă bradul la început: lângă fereastră, spre colțul din stânga-spate.
  function presetStart() {
    roomDims();
    return { x: XL + ROOM_W * .3, z: ZB - Math.min(110, (ZB - ZN) * .3) };
  }
  // Mobila din camera „Bloc / Casă” (amprentă pe podea, pentru coliziune + desen).
  function presetItems() {
    const c = roomCfg(), out = [];
    if (c.sofa) { // canapea pe peretele din dreapta, în colțul din spate; măsuța în fața ei
      const len = clamp((ZB - ZN) * .4, 160, 220), z1 = ZB - 4, z0 = z1 - len;
      out.push({ kind: 'sofa', x0: XR - 92, x1: XR - 2, z0, z1 });
      out.push({ kind: 'table', x0: XR - 92 - 35 - 55, x1: XR - 92 - 35, z0: z0 + len * .28, z1: z1 - len * .28 });
    }
    return out;
  }
  const ROOMS = [
    { id: 'living', name: 'Living', hc: 140, start: { x: window.innerWidth < 820 ? 55 : 135, z: 440 },
      blocks: [[-230, -30, 570, 650], [40, 220, 605, 650], [200, 240, 585, 625]] },
    { id: 'empty', name: 'Bloc / Casă', hc: 140, start: { x: 0, z: 420 }, blocks: [] },
    { id: 'photo', name: '📷 Camera ta', photo: true },
  ];
  let room = ROOMS[0];
  const pos = { living: { ...ROOMS[0].start }, empty: null, photo: { u: .5, v: .85 } };
  // Poza e redusă la max 2048 px. horizon/ref sunt în fracțiuni din înălțimea/lățimea pozei.
  // O poză făcută cu telefonul drept are orizontul la mijloc (0.5).
  const photo = { img: null, mask: null, front: null, frontDirty: true, strokes: [], horizon: .5, hc: 140, ceil: 260, ref: null, refH: 205 };
  let tool = 'move', brush = 'add', brushSize = 24;
  const opt = { dims: true, cmp: false, person: false };
  const view = { s: 1, ox: 0, oy: 0 };
  const ceilingOf = () => room.photo ? photo.ceil : roomDims().h;

  /* ---------- canvas + imagini ---------- */
  const cv = root.querySelector('.ssb-cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, cam = null, exporting = false;
  const imgCache = {};
  function cutoutOf(s) {
    const src = s.cutout; if (!src) return null;
    if (!imgCache[src]) { const im = new Image(); im.decoding = 'async'; im.onload = draw; im.src = src; imgCache[src] = im; }
    const im = imgCache[src]; return im.complete && im.naturalWidth ? im : null;
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    draw();
  }
  function setupCam() {
    if (room.photo) {
      if (!photo.img) { cam = null; return; }
      const iw = photo.img.width, ih = photo.img.height, sc = Math.min(W / iw, H / ih);
      const w = iw * sc, h = ih * sc, x = (W - w) / 2, y = (H - h) / 2;
      cam = { photo: true, x, y, w, h, hy: y + photo.horizon * h, hc: photo.hc, f: Math.max(w, h) * 0.85 };
    } else {
      roomDims();
      if (room.id === 'empty' && !pos.empty) pos.empty = presetStart();
      // pe ecran îngust (telefon) încadrăm mai strâns, ca bradul să nu pară mic
      const f = W < H * 1.2 ? Math.max(0.78 * W, 0.86 * H) : Math.max(0.78 * W, 0.62 * H);
      cam = { cx: W / 2, hy: H * 0.40, f, hc: room.hc };
    }
  }
  const P = (x, y, z) => [cam.cx + cam.f * x / z, cam.hy - cam.f * (y - cam.hc) / z];

  /* ---------- utilitare desen ---------- */
  function poly(pts, fill, stroke) {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function shade(hex, k) {
    let r, g, b;
    if (hex[0] === '#') { const n = parseInt(hex.slice(1), 16); r = n >> 16; g = n >> 8 & 255; b = n & 255; }
    else [r, g, b] = hex.match(/\d+/g).map(Number); // acceptă și rgb(...) (shade aplicat de două ori)
    const t = k < 0 ? 0 : 255, a = Math.abs(k);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return `rgb(${r},${g},${b})`;
  }
  function box(x0, x1, y0, y1, z0, z1, col) {
    if (x0 > 0) poly([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], shade(col, -.22));
    if (x1 < 0) poly([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], shade(col, -.22));
    if (y1 < cam.hc) poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], shade(col, .12));
    if (y0 > cam.hc) poly([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], shade(col, -.3));
    poly([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], col);
  }
  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

  /* ---------- arhitectura camerei ---------- */
  function drawShell(c) {
    poly([P(XL, ROOM_H, ZN), P(XR, ROOM_H, ZN), P(XR, ROOM_H, ZB), P(XL, ROOM_H, ZB)], c.ceil);
    const [, by0] = P(XL, ROOM_H, ZB), [, by1] = P(XR, 0, ZB);
    let g = ctx.createLinearGradient(0, by0, 0, by1); g.addColorStop(0, shade(c.wall, .06)); g.addColorStop(1, shade(c.wall, -.06));
    poly([P(XL, 0, ZB), P(XR, 0, ZB), P(XR, ROOM_H, ZB), P(XL, ROOM_H, ZB)], g);
    const [lx0] = P(XL, 0, ZN), [lx1] = P(XL, 0, ZB);
    g = ctx.createLinearGradient(lx0, 0, lx1, 0); g.addColorStop(0, shade(c.wall, c.leftLight ? .1 : -.12)); g.addColorStop(1, shade(c.wall, -.04));
    poly([P(XL, 0, ZN), P(XL, 0, ZB), P(XL, ROOM_H, ZB), P(XL, ROOM_H, ZN)], g);
    const [rx0] = P(XR, 0, ZN), [rx1] = P(XR, 0, ZB);
    g = ctx.createLinearGradient(rx0, 0, rx1, 0); g.addColorStop(0, shade(c.wall, -.2)); g.addColorStop(1, shade(c.wall, -.1));
    poly([P(XR, 0, ZN), P(XR, 0, ZB), P(XR, ROOM_H, ZB), P(XR, ROOM_H, ZN)], g);
    const [, fy0] = P(0, 0, ZB);
    g = ctx.createLinearGradient(0, fy0, 0, H); g.addColorStop(0, shade(c.floor, -.08)); g.addColorStop(1, shade(c.floor, .06));
    poly([P(XL, 0, ZN), P(XR, 0, ZN), P(XR, 0, ZB), P(XL, 0, ZB)], g);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(60,35,15,.13)';
    const R = rng(7);
    if (c.tile) { // gresie: rețea pătrată
      for (let x = XL; x <= XR; x += c.tile) { ctx.beginPath(); ctx.moveTo(...P(x, 0, ZN)); ctx.lineTo(...P(x, 0, ZB)); ctx.stroke(); }
      for (let z = ZB; z > ZN; z -= c.tile) { ctx.beginPath(); ctx.moveTo(...P(XL, 0, z)); ctx.lineTo(...P(XR, 0, z)); ctx.stroke(); }
    } else for (let x = XL; x < XR; x += c.plank) {
      ctx.beginPath(); let a = P(x, 0, ZN), b = P(x, 0, ZB); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      for (let z = ZN + R() * 120; z < ZB; z += 110 + R() * 70) { a = P(x, 0, z); b = P(x + c.plank, 0, z); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
      ctx.fillStyle = `rgba(${R() < .5 ? '255,240,220' : '80,50,20'},${R() * .06})`;
      poly([P(x, 0, ZN), P(x + c.plank, 0, ZN), P(x + c.plank, 0, ZB), P(x, 0, ZB)], ctx.fillStyle);
    }
    const pl = shade(c.wall, .1);
    poly([P(XL, 0, ZB), P(XR, 0, ZB), P(XR, 8, ZB), P(XL, 8, ZB)], pl);
    poly([P(XL, 0, ZN), P(XL, 0, ZB), P(XL, 8, ZB), P(XL, 8, ZN)], shade(c.wall, 0));
    poly([P(XR, 0, ZN), P(XR, 0, ZB), P(XR, 8, ZB), P(XR, 8, ZN)], shade(c.wall, -.15));
  }

  const LIVING = { wall: '#e8e2d8', ceil: '#f1ede6', floor: '#b7895e', plank: 19, leftLight: true };
  function livingBack() {
    drawShell(LIVING);
    const w = [P(XL, 85, 240), P(XL, 85, 500), P(XL, 245, 500), P(XL, 245, 240)];
    const g = ctx.createLinearGradient(w[0][0], 0, w[1][0], 0); g.addColorStop(0, '#eef4f7'); g.addColorStop(1, '#cfdde6');
    poly(w, '#f7f5f0'); poly([P(XL, 92, 250), P(XL, 92, 490), P(XL, 238, 490), P(XL, 238, 250)], g);
    ctx.lineWidth = 3; ctx.strokeStyle = '#f7f5f0';
    ctx.beginPath(); ctx.moveTo(...P(XL, 92, 370)); ctx.lineTo(...P(XL, 238, 370)); ctx.stroke();
    poly([P(XL, 0, 250), P(XL, 0, 500), P(-60, 0, 560), P(-20, 0, 300)], 'rgba(255,244,220,.16)');
    poly([P(-180, 125, ZB), P(-80, 125, ZB), P(-80, 195, ZB), P(-180, 195, ZB)], '#2b2f2c');
    const [ax, ay] = P(-176, 191, ZB), [bx, by] = P(-84, 129, ZB);
    const ag = ctx.createLinearGradient(ax, ay, bx, by); ag.addColorStop(0, '#c9a45c'); ag.addColorStop(.5, '#e8dcc4'); ag.addColorStop(1, '#7f8c7e');
    poly([P(-176, 129, ZB), P(-84, 129, ZB), P(-84, 191, ZB), P(-176, 191, ZB)], ag);
    poly([P(-210, 0, 400), P(60, 0, 400), P(60, 0, 560), P(-210, 0, 560)], '#d9d2c4');
    poly([P(-200, 0, 410), P(50, 0, 410), P(50, 0, 550), P(-200, 0, 550)], '#cfc6b5');
  }
  const LIVING_ITEMS = [
    { z: 570, draw() {
      const c = '#8d8f8a';
      box(-230, -30, 8, 44, 575, 650, c); box(-226, -34, 0, 8, 580, 600, '#3a2d22');
      box(-230, -30, 44, 88, 622, 650, shade(c, -.05));
      box(-230, -208, 8, 64, 575, 650, shade(c, .02)); box(-52, -30, 8, 64, 575, 650, shade(c, .02));
      box(-200, -160, 44, 74, 605, 622, '#b5643a'); box(-110, -72, 44, 72, 606, 622, '#d8c9a6');
    } },
    { z: 605, draw() {
      box(40, 220, 12, 55, 605, 650, '#6b4a33'); box(46, 52, 0, 12, 610, 616, '#222'); box(208, 214, 0, 12, 610, 616, '#222');
      poly([P(70, 95, 644), P(190, 95, 644), P(190, 165, 644), P(70, 165, 644)], '#121314');
      const [x0, y0] = P(74, 161, 644), [x1, y1] = P(186, 99, 644);
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#2a2e33'); g.addColorStop(.45, '#14171a'); g.addColorStop(1, '#0c0d0e');
      poly([P(74, 99, 644), P(186, 99, 644), P(186, 161, 644), P(74, 161, 644)], g);
      box(95, 165, 55, 60, 618, 636, '#c7b79a');
    } },
    { z: 585, draw() {
      box(204, 236, 0, 46, 589, 621, '#d8d2c7');
      const R = rng(3);
      for (let i = 0; i < 26; i++) {
        const a = R() * Math.PI * 2, rr = R() * 24, y = 50 + R() * 80;
        const [px, py] = P(220 + Math.cos(a) * rr, y, 605 + Math.sin(a) * rr * .6);
        ctx.fillStyle = `hsl(${105 + R() * 30},${30 + R() * 20}%,${22 + R() * 16}%)`;
        ctx.beginPath(); ctx.ellipse(px, py, 9 * cam.f / 600, 4 * cam.f / 600, a, 0, Math.PI * 2); ctx.fill();
      }
    } },
  ];

  /* ---------- camera „Bloc / Casă” ---------- */
  // Punct pe perete: s = cm de la capătul din stânga (cum se vede pe ecran), y = înălțime, dep = cm în fața peretelui.
  const wallLen = w => w === 'back' ? ROOM_W : ZB - ZN;
  function WP(w, s, y, dep = 0) {
    return w === 'left' ? P(XL + dep, y, ZN + s) : w === 'back' ? P(XL + s, y, ZB - dep) : P(XR - dep, y, ZB - s);
  }
  function wallRect(w, s0, s1, y0, y1, fill, dep = 0) { poly([WP(w, s0, y0, dep), WP(w, s1, y0, dep), WP(w, s1, y1, dep), WP(w, s0, y1, dep)], fill); }
  function wallBox(w, s0, s1, y0, y1, dep, col) {
    if (w === 'left') box(XL, XL + dep, y0, y1, ZN + s0, ZN + s1, col);
    else if (w === 'back') box(XL + s0, XL + s1, y0, y1, ZB - dep, ZB, col);
    else box(XR - dep, XR, y0, y1, ZB - s1, ZB - s0, col);
  }
  function opening(o) { // [s0, s1] pe perete, limitat ca să încapă
    const L = wallLen(o.wall), half = Math.min(o.w, L - 30) / 2;
    const c = clamp(o.at / 100 * L, half + 12, L - half - 12);
    return [c - half, c + half];
  }
  function drawDoor(d) {
    if (d.wall === 'none') return;
    const [s0, s1] = opening(d), h = Math.min(d.h, ROOM_H - 8);
    wallRect(d.wall, s0 - 7, s1 + 7, 0, h + 7, '#f7f6f3');
    wallRect(d.wall, s0, s1, 0, h, '#d8d1c3');
    const m = 9; // panouri
    wallRect(d.wall, s0 + m, s1 - m, h * .55, h - m, '#cfc7b7'); wallRect(d.wall, s0 + m, s1 - m, m + 8, h * .5, '#cfc7b7');
    const [hx, hy] = WP(d.wall, s1 - 9, 102); ctx.fillStyle = '#8f8a80'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(2, 3 * cam.f / 600), 0, 7); ctx.fill();
    tag(WP(d.wall, (s0 + s1) / 2, h + 20), 'ușă ' + d.h + ' cm');
  }
  function drawWindow(o, radiator) {
    if (o.wall === 'none') return;
    const [s0, s1] = opening(o), y0 = clamp(o.sill, 0, ROOM_H - 40), y1 = Math.min(y0 + o.h, ROOM_H - 6);
    wallRect(o.wall, s0 - 6, s1 + 6, y0 - 6, y1 + 6, '#f8f7f4');
    const a = WP(o.wall, s0, y1), b = WP(o.wall, s1, y0);
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, '#e9f1f5'); g.addColorStop(.6, '#c9dbe6'); g.addColorStop(1, '#b5cad8');
    wallRect(o.wall, s0, s1, y0, y1, g);
    ctx.strokeStyle = '#f8f7f4'; ctx.lineWidth = Math.max(2, 5 * cam.f / 600);
    const panes = Math.max(1, Math.round((s1 - s0) / 90));
    for (let i = 1; i < panes; i++) { const sx = s0 + (s1 - s0) * i / panes; ctx.beginPath(); ctx.moveTo(...WP(o.wall, sx, y0)); ctx.lineTo(...WP(o.wall, sx, y1)); ctx.stroke(); }
    if (y0 > 20) wallBox(o.wall, s0 - 8, s1 + 8, y0 - 5, y0, 14, '#f1efea'); // pervaz
    if (radiator && y0 >= 60) {
      const rw = Math.min(s1 - s0, 160), c = (s0 + s1) / 2, r0 = c - rw / 2, r1 = c + rw / 2, top = Math.min(y0 - 12, 75);
      wallBox(o.wall, r0, r1, 14, top, 7, '#efeeea');
      ctx.strokeStyle = 'rgba(0,0,0,.09)'; ctx.lineWidth = 1;
      for (let x = r0 + 6; x < r1 - 3; x += 6) { ctx.beginPath(); ctx.moveTo(...WP(o.wall, x, 17, 7)); ctx.lineTo(...WP(o.wall, x, top - 3, 7)); ctx.stroke(); }
    }
  }
  function drawSofa(it) {
    const { x0, x1, z0, z1 } = it, c = '#8d8f8a';
    box(x0, x1, 8, 64, z1 - 20, z1, shade(c, .02));            // braț spate
    box(x0 + 4, x1 - 4, 0, 8, z0 + 24, z1 - 24, '#3a2d22');    // bază
    box(x1 - 24, x1, 44, 90, z0, z1, shade(c, -.05));        // spătar (lângă perete)
    box(x0, x1 - 24, 8, 46, z0 + 20, z1 - 20, c);              // șezut
    box(x1 - 34, x1 - 24, 46, 76, z1 - 70, z1 - 30, '#b5643a'); // perne
    box(x1 - 34, x1 - 24, 46, 74, z0 + 30, z0 + 68, '#d8c9a6');
    box(x0, x1, 8, 64, z0, z0 + 20, shade(c, .02));            // braț față
  }
  function drawTable(it) {
    const { x0, x1, z0, z1 } = it, w = '#6b4a33', l = 4;
    [[x0, z1 - l], [x1 - l, z1 - l], [x0, z0], [x1 - l, z0]].forEach(([x, z]) => box(x, x + l, 0, 38, z, z + l, shade(w, -.15)));
    box(x0, x1, 38, 43, z0, z1, w);
  }
  function emptyBack() {
    const c = roomCfg(), wall = WALL_COLORS[c.wall][1];
    drawShell(Object.assign({ wall, ceil: '#f4f3f1' }, FLOORS[c.floor][1]));
    drawWindow(c.win, c.radiator);
    drawDoor(c.door);
    const sofa = presetItems().find(i => i.kind === 'sofa');
    if (sofa) poly([P(sofa.x0 - 150, 0, sofa.z0 + 10), P(sofa.x0 - 10, 0, sofa.z0 + 10), P(sofa.x0 - 10, 0, sofa.z1 - 10), P(sofa.x0 - 150, 0, sofa.z1 - 10)], 'rgba(235,228,214,.75)'); // covor
  }
  const emptyItems = () => presetItems().map(it => ({ z: (it.z0 + it.z1) / 2, draw: () => it.kind === 'sofa' ? drawSofa(it) : drawTable(it) }));

  function tag(p, text, align = 'center', dark = true) {
    ctx.font = '500 13px Oswald,"Arial Narrow",system-ui,sans-serif';
    const w = ctx.measureText(text).width + 14, h = 22;
    const x = align === 'right' ? p[0] - w : align === 'left' ? p[0] : p[0] - w / 2, y = p[1] - h / 2;
    ctx.fillStyle = dark ? 'rgba(22,22,22,.86)' : 'rgba(255,255,255,.94)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 11); ctx.fill();
    ctx.fillStyle = dark ? '#ffffff' : '#c31c72'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7, y + h / 2 + .5);
  }

  /* ---------- bradul ---------- */
  function treeScreen() {
    if (room.photo) {
      const p = pos.photo, X = cam.x + p.u * cam.w, Y = cam.y + p.v * cam.h;
      return { X, Y, k: (Y - cam.hy) / cam.hc, flat: (Y - cam.hy) / cam.f };
    }
    const p = pos[room.id], [X, Y] = P(p.x, 0, p.z);
    return { X, Y, k: cam.f / p.z, flat: cam.hc / p.z };
  }
  // Decupajul e tăiat strâns: înălțimea = vârf→picioare, lățimea = cea mai lată ramură = diametrul.
  function treeRect(t, s) {
    const h = s.h * t.k, w = s.d * t.k;
    return { x: t.X - (s.baseX ?? .5) * w, y: t.Y - h, w, h };
  }
  function drawShadow(t, s) {
    const rx = s.d * 0.55 * t.k, ry = Math.max(rx * t.flat, 3);
    const g = ctx.createRadialGradient(t.X, t.Y, 0, t.X, t.Y, rx);
    g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(.55, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(t.X, t.Y); ctx.scale(1, ry / rx); ctx.translate(-t.X, -t.Y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.X, t.Y, rx, 0, 7); ctx.fill(); ctx.restore();
  }
  // part: 'body' = brad + umbră + siluetă (pot fi acoperite de obiectele din față), 'over' = cote/etichete, altfel ambele.
  function drawTree(part) {
    const s = PRODUCT.sizes[sizeIdx], img = cutoutOf(s);
    if (!img) return;
    const t = treeScreen();
    if (part !== 'over') {
      if (opt.cmp) {
        PRODUCT.sizes.forEach(o => {
          const oi = cutoutOf(o) || img;
          if (o.h > s.h) { const r = treeRect(t, o); ctx.globalAlpha = .2; ctx.drawImage(oi, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
        });
      }
      drawShadow(t, s);
      const r = treeRect(t, s);
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
      if (opt.person) drawPerson(t, s);
    }
    if (part === 'body') return;
    if (opt.cmp) {
      PRODUCT.sizes.forEach(o => {
        if (o === s) return; const y = t.Y - o.h * t.k;
        ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(240,140,190,.95)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(t.X - o.d * .45 * t.k, y); ctx.lineTo(t.X + o.d * .45 * t.k, y); ctx.stroke(); ctx.setLineDash([]);
        tag([t.X - o.d * .45 * t.k - 4, y], o.h + ' cm', 'right');
      });
    }
    if ((room.photo || room.id === 'empty') && !exporting) drawCeiling(t, s);
    if (opt.dims) drawDims(t, s);
  }
  function drawCeiling(t, s) { // linia tavanului deasupra bradului, ca utilizatorul să verifice calibrarea
    const ceil = ceilingOf(), y = t.Y - ceil * t.k, half = s.d * .6 * t.k;
    const tight = s.h + TOPPER > ceil;
    ctx.setLineDash([4, 4]); ctx.strokeStyle = tight ? 'rgba(230,90,70,.95)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(t.X - half, y); ctx.lineTo(t.X + half, y); ctx.stroke(); ctx.setLineDash([]);
    tag([t.X + half + 4, y], 'tavan ' + ceil + ' cm', 'left', !tight);
  }
  function drawDims(t, s) {
    const k = t.k, top = t.Y - s.h * k, x = t.X + (s.d / 2 + 18) * k;
    ctx.strokeStyle = '#e0479a'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, t.Y); ctx.lineTo(x, top);
    ctx.moveTo(x - 7, t.Y); ctx.lineTo(x + 7, t.Y); ctx.moveTo(x - 7, top); ctx.lineTo(x + 7, top); ctx.stroke();
    tag([x + 6, (t.Y + top) / 2], s.h + ' cm', 'left');
    const rx = s.d / 2 * k, ry = Math.max(rx * t.flat, 2);
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(t.X, t.Y, rx, ry, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    tag([t.X, t.Y + ry + 14], 'Ø ' + s.d + ' cm');
  }
  function drawPerson(t, s) {
    const k = t.k, bx = t.X - (s.d / 2 + 45) * k, by = t.Y;
    const Y = v => by - v * k, X = v => bx + v * k;
    ctx.fillStyle = 'rgba(28,34,40,.62)';
    ctx.beginPath(); ctx.arc(X(0), Y(158), 11 * k, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(-21), Y(145), 42 * k, 62 * k, 12 * k); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(-27), Y(143), 9 * k, 58 * k, 5 * k); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(18), Y(143), 9 * k, 58 * k, 5 * k); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(-17), Y(88), 15 * k, 88 * k, 6 * k); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(2), Y(88), 15 * k, 88 * k, 6 * k); ctx.fill();
    tag([X(0), Y(178)], '1,70 m');
  }

  /* ---------- desen principal ---------- */
  function draw() {
    if (!W) return;
    setupCam();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0d110e'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * view.ox, DPR * view.oy);
    if (room.photo) { drawPhotoRoom(); }
    else {
      room.id === 'living' ? livingBack() : emptyBack();
      const items = room.id === 'living' ? LIVING_ITEMS : emptyItems();
      const tz = pos[room.id].z;
      items.filter(i => i.z > tz).forEach(i => i.draw());
      drawTree();
      items.filter(i => i.z <= tz).forEach(i => i.draw());
      vignette();
    }
  }
  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .5, Math.max(W, H) * .75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,8,4,.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawPhotoRoom() {
    if (!cam) {
      ctx.fillStyle = '#b5b5b5'; ctx.font = '16px Oswald,"Arial Narrow",system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(isTouch ? 'Atinge aici ca să faci o poză a camerei' : 'Click aici ca să încarci o poză a camerei', W / 2, H / 2); ctx.textAlign = 'start';
      return;
    }
    ctx.drawImage(photo.img, cam.x, cam.y, cam.w, cam.h);
    drawTree('body');
    if (photo.strokes.length) ctx.drawImage(frontLayer(), cam.x, cam.y, cam.w, cam.h); // obiectele din față acoperă bradul
    if (!exporting && tool === 'mask' && photo.strokes.length) {
      ctx.globalAlpha = .45; ctx.drawImage(photo.mask, cam.x, cam.y, cam.w, cam.h); ctx.globalAlpha = 1;
    }
    if (tool !== 'mask' || exporting) drawTree('over');
    if (exporting) return;
    if (tool === 'move') {
      ctx.setLineDash([8, 6]); ctx.strokeStyle = '#e0479a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cam.x, cam.hy); ctx.lineTo(cam.x + cam.w, cam.hy); ctx.stroke(); ctx.setLineDash([]);
      tag([cam.x + 10, cam.hy], 'nivel telefon · ' + photo.hc + ' cm' + (photo.ref ? ' (din calibrare)' : ' (trage)'), 'left');
    }
    if (tool === 'ref' && photo.ref) drawRef();
  }

  /* ---------- calibrare cu obiect de referință ----------
     Telefon ținut drept ⇒ un obiect vertical de înălțime H are scara k = (Yjos − Ysus)/H (px/cm),
     iar orizontul (nivelul telefonului) e la Yjos − hc·k. Lângă obiect scara e corectă chiar dacă hc e aproximativ. */
  function refScreen() {
    const r = photo.ref;
    return { X: cam.x + r.x * cam.w, Yb: cam.y + r.yb * cam.h, Yt: cam.y + r.yt * cam.h };
  }
  function applyRef() {
    const r = photo.ref; if (!r) return;
    if (r.yb - r.yt < .02) r.yt = r.yb - .02;
    const k = (r.yb - r.yt) / photo.refH;
    photo.horizon = clamp(r.yb - photo.hc * k, .01, .97);
    clampPhotoTree();
    const info = $('refInfo');
    info.textContent = '✓ Calibrat: ' + photo.refH + ' cm. Bradul se scalează după acest obiect.';
    info.classList.remove('ssb-hidden');
  }
  function drawRef() {
    const { X, Yb, Yt } = refScreen(), R = 9 / view.s;
    ctx.lineWidth = 3 / view.s; ctx.strokeStyle = '#3ddc84';
    ctx.beginPath(); ctx.moveTo(X, Yb); ctx.lineTo(X, Yt); ctx.stroke();
    ctx.lineWidth = 2 / view.s;
    [[Yb], [Yt]].forEach(([y]) => {
      ctx.beginPath(); ctx.moveTo(X - 16 / view.s, y); ctx.lineTo(X + 16 / view.s, y); ctx.stroke();
      ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.arc(X, y, R, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.strokeStyle = '#3ddc84';
    });
    tag([X + 14 / view.s, (Yb + Yt) / 2], photo.refH + ' cm', 'left', false);
  }
  function refHit(sx, sy) {
    const { X, Yb, Yt } = refScreen(), R = 24 / view.s;
    if (Math.hypot(sx - X, sy - Yt) < R) return { type: 'refTop' };
    if (Math.hypot(sx - X, sy - Yb) < R) return { type: 'refBot' };
    if (Math.abs(sx - X) < 18 / view.s && sy > Yt && sy < Yb) return { type: 'refMove', dx: sx - X, dy: sy - Yb };
    return null;
  }
  function ensureRef() {
    if (photo.ref) return;
    const u = clamp(pos.photo.u - .22, .08, .92);
    photo.ref = { x: u, yb: clamp(pos.photo.v, .5, .95), yt: clamp(pos.photo.v - .45, .05, .5) };
    applyRef();
  }

  /* ---------- mască „obiecte în față” (pictată în pixelii pozei) ---------- */
  function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function paintStroke(st, from) {
    const m = photo.mask.getContext('2d'), pts = st.pts;
    m.globalCompositeOperation = st.mode === 'erase' ? 'destination-out' : 'source-over';
    m.strokeStyle = m.fillStyle = '#e0503c'; m.lineCap = m.lineJoin = 'round'; m.lineWidth = st.r * 2;
    const i0 = from || 0;
    if (i0 === 0) { m.beginPath(); m.arc(pts[0][0], pts[0][1], st.r, 0, 7); m.fill(); }
    if (pts.length > 1) {
      m.beginPath(); m.moveTo(...pts[Math.max(0, i0 - 1)]);
      for (let i = Math.max(1, i0); i < pts.length; i++) m.lineTo(...pts[i]);
      m.stroke();
    }
    m.globalCompositeOperation = 'source-over';
    photo.frontDirty = true;
  }
  function rebuildMask() {
    photo.mask.getContext('2d').clearRect(0, 0, photo.mask.width, photo.mask.height);
    photo.strokes.forEach(st => paintStroke(st));
    photo.frontDirty = true;
  }
  function frontLayer() {
    if (!photo.frontDirty) return photo.front;
    const f = photo.front.getContext('2d');
    f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, photo.front.width, photo.front.height);
    f.drawImage(photo.mask, 0, 0);
    f.globalCompositeOperation = 'source-in'; f.drawImage(photo.img, 0, 0);
    f.globalCompositeOperation = 'source-over';
    photo.frontDirty = false;
    return photo.front;
  }
  const toImg = (sx, sy) => [(sx - cam.x) / cam.w * photo.img.width, (sy - cam.y) / cam.h * photo.img.height];
  const brushR = () => brushSize / view.s * photo.img.width / cam.w;

  /* ---------- interacțiune ---------- */
  const pointers = new Map();
  let drag = null, pinch = null, movedOnce = false;
  const toScene = (px, py) => [(px - view.ox) / view.s, (py - view.oy) / view.s];
  function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (room.photo && !photo.img) { $(isTouch ? 'fileCam' : 'file').click(); return; } // fără poză: atingerea deschide camera / alegerea fișierului
    const p = local(e); pointers.set(e.pointerId, p); hideHint();
    if (pointers.size === 2) {
      if (drag && drag.type === 'paint') { photo.strokes.pop(); rebuildMask(); } // al doilea deget = zoom, nu pictură
      const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s, ox: view.ox, oy: view.oy, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; draw(); return;
    }
    const [sx, sy] = toScene(...p);
    const pan = { type: 'pan', px: p[0], py: p[1], ox: view.ox, oy: view.oy };
    if (room.photo && cam && tool === 'mask' && e.button === 0) {
      const st = { mode: brush, r: brushR(), pts: [toImg(sx, sy)] };
      photo.strokes.push(st); paintStroke(st); drag = { type: 'paint', st }; draw();
    } else if (room.photo && cam && tool === 'ref') {
      drag = refHit(sx, sy) || pan;
    } else if (room.photo && cam && !photo.ref && Math.abs(sy - cam.hy) < 14 / view.s) { drag = { type: 'horizon' }; }
    else if (cam && hitTree(sx, sy)) { const t = treeScreen(); drag = { type: 'tree', dx: sx - t.X, dy: sy - t.Y }; }
    else drag = pan;
    cv.classList.add('ssb-dragging');
  });
  cv.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e); pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      // zoom + deplasare cu 2 degete: punctul de sub degete rămâne sub degete
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, s = clamp(pinch.s * d / pinch.d, 1, 4);
      const qx = (pinch.mx - pinch.ox) / pinch.s, qy = (pinch.my - pinch.oy) / pinch.s;
      view.s = s; view.ox = mx - qx * s; view.oy = my - qy * s; clampView(); draw(); return;
    }
    if (!drag) return;
    const [sx, sy] = toScene(...p);
    if (drag.type === 'paint') { const n = drag.st.pts.length; drag.st.pts.push(toImg(sx, sy)); paintStroke(drag.st, n); }
    else if (drag.type === 'refTop' || drag.type === 'refBot' || drag.type === 'refMove') {
      const r = photo.ref, u = clamp((sx - cam.x) / cam.w, 0, 1), v = clamp((sy - cam.y) / cam.h, 0, 1);
      if (drag.type === 'refTop') { r.x = u; r.yt = Math.min(v, r.yb - .02); }
      else if (drag.type === 'refBot') { r.x = u; r.yb = Math.max(v, r.yt + .02); }
      else { const hgt = r.yb - r.yt; r.x = clamp((sx - drag.dx - cam.x) / cam.w, 0, 1); r.yb = clamp((sy - drag.dy - cam.y) / cam.h, hgt, 1); r.yt = r.yb - hgt; }
      applyRef(); drag.moved = true;
    }
    else if (drag.type === 'horizon') { photo.horizon = clamp((sy - cam.y) / cam.h, .05, .9); clampPhotoTree(); }
    else if (drag.type === 'tree') { moveTree(sx - drag.dx, sy - drag.dy); if (!movedOnce) { movedOnce = true; track('move'); } }
    else if (view.s > 1) { view.ox = drag.ox + p[0] - drag.px; view.oy = drag.oy + p[1] - drag.py; clampView(); }
    draw();
  });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, e => {
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      if (drag && drag.type === 'paint' && onceSession('mask')) track('photo_mask');
      if (drag && drag.moved && drag.type.startsWith('ref') && onceSession('calib')) track('photo_calibrate');
      if (drag && drag.type === 'paint') draw();
      drag = null; cv.classList.remove('ssb-dragging');
    }
  }));
  cv.addEventListener('wheel', e => { e.preventDefault(); hideHint(); const p = local(e); zoomAt(p[0], p[1], view.s * Math.exp(-e.deltaY * .0015)); draw(); }, { passive: false });

  function hitTree(sx, sy) {
    const r = treeRect(treeScreen(), PRODUCT.sizes[sizeIdx]);
    return sx > r.x + r.w * .1 && sx < r.x + r.w * .9 && sy > r.y && sy < r.y + r.h + 10;
  }
  function moveTree(X, Y) {
    if (room.photo) { pos.photo.u = (X - cam.x) / cam.w; pos.photo.v = (Y - cam.y) / cam.h; clampPhotoTree(); return; }
    if (Y < cam.hy + 4) Y = cam.hy + 4;
    let z = cam.f * cam.hc / (Y - cam.hy), x = (X - cam.cx) * z / cam.f;
    const s = PRODUCT.sizes[sizeIdx], r = s.d / 2 * .75, p = pos[room.id];
    const zMin = cam.f * cam.hc / (H * 0.97 - cam.hy);
    z = clamp(z, zMin, ZB - r); x = clamp(x, XL + r, XR - r);
    if (!blocked(x, z, r)) { p.x = x; p.z = z; }
    else if (!blocked(x, p.z, r)) p.x = x;
    else if (!blocked(p.x, z, r)) p.z = z;
  }
  function blocked(x, z, r) {
    const bl = room.id === 'empty' ? presetItems().map(i => [i.x0, i.x1, i.z0, i.z1]) : (room.blocks || []);
    return bl.some(([x0, x1, z0, z1]) => {
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return dx * dx + dz * dz < r * r;
    });
  }
  function clampPhotoTree() { const p = pos.photo; p.u = clamp(p.u, 0, 1); p.v = clamp(p.v, photo.horizon + .04, 1); }
  function zoomAt(px, py, s, base = view) {
    s = clamp(s, 1, 4);
    const [sx, sy] = [(px - base.ox) / base.s, (py - base.oy) / base.s];
    view.s = s; view.ox = px - sx * s; view.oy = py - sy * s; clampView(); draw();
  }
  function clampView() { view.ox = clamp(view.ox, W - W * view.s, 0); view.oy = clamp(view.oy, H - H * view.s, 0); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- UI ---------- */
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderUI() {
    const s = PRODUCT.sizes[sizeIdx];
    $('title').innerHTML = esc(PRODUCT.family) + ' <small>' + s.h + ' cm · ' + esc(s.priceText) + '</small>';
    const cart = $('cart');
    if (s.inStock) { cart.href = s.cartUrl; cart.textContent = 'Adaugă în coș · ' + s.priceText; cart.classList.remove('ssb-disabled'); cart.removeAttribute('aria-disabled'); }
    else { cart.href = s.url; cart.textContent = 'Stoc epuizat · vezi produsul'; cart.classList.add('ssb-disabled'); cart.setAttribute('aria-disabled', 'true'); }
    $('cartNote').textContent = s.name || (PRODUCT.family + ' ' + s.h + ' cm');
    $('dH').textContent = s.h + ' cm'; $('dD').textContent = s.d + ' cm';
    $('sizes').innerHTML = PRODUCT.sizes.map((o, i) => `<button type="button" class="ssb-size" data-i="${i}" aria-pressed="${i === sizeIdx}"><b>${o.h} cm</b><span>${esc(o.priceText)}</span></button>`).join('');
    $('rooms').innerHTML = ROOMS.map(r => `<button type="button" class="ssb-chip" data-r="${r.id}" aria-pressed="${r === room}">${r.name}</button>`).join('');
    $('photoTools').classList.toggle('ssb-hidden', !room.photo);
    $('emptyTools').classList.toggle('ssb-hidden', room.id !== 'empty');
    if (room.id === 'empty') renderRoomPanel();
    $('photoSteps').classList.toggle('ssb-hidden', !photo.img);
    $('photoTip').classList.toggle('ssb-hidden', !!photo.img);
    $('pick').textContent = photo.img ? '🖼 Altă poză' : (isTouch ? '🖼 Din galerie' : 'Încarcă o poză a camerei');
    root.querySelectorAll('[data-refh]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.refh === photo.refH));
    // avertisment tavan
    const ceil = ceilingOf(), free = ceil - s.h, warn = $('warn');
    if (free < TOPPER) {
      warn.textContent = free < 0
        ? `Bradul de ${s.h} cm este mai înalt decât tavanul (${ceil} cm).`
        : `Rămân doar ${free} cm până la tavan — prea puțin pentru un vârf/steluță. Alege o înălțime mai mică.`;
      warn.classList.remove('ssb-hidden');
    } else warn.classList.add('ssb-hidden');
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-i],[data-r]'); if (!b) return;
    if (b.dataset.i) { sizeIdx = +b.dataset.i; track('size'); }
    if (b.dataset.r) { room = ROOMS.find(r => r.id === b.dataset.r); resetView(); track('room_' + room.id); }
    renderUI(); draw();
  });
  $('tDims').onchange = e => { opt.dims = e.target.checked; draw(); };
  $('tCmp').onchange = e => { opt.cmp = e.target.checked; if (opt.cmp) track('compare'); draw(); };
  $('tPerson').onchange = e => { opt.person = e.target.checked; draw(); };
  $('zin').onclick = () => zoomAt(W / 2, H / 2, view.s * 1.3);
  $('zout').onclick = () => zoomAt(W / 2, H / 2, view.s / 1.3);
  function resetView() { view.s = 1; view.ox = 0; view.oy = 0; }
  $('reset').onclick = () => {
    resetView();
    if (room.photo) { pos.photo = { u: .5, v: .85 }; clampPhotoTree(); } else pos[room.id] = room.id === 'empty' ? presetStart() : { ...room.start };
    draw();
  };
  $('cart').addEventListener('click', e => {
    const s = PRODUCT.sizes[sizeIdx];
    track(s.inStock ? 'cart' : 'cart_oos');
    try { // eveniment standard GA4
      if (s.inStock) (window.dataLayer = window.dataLayer || []).push({ event: 'add_to_cart', ecommerce: { currency: CFG.currency || 'RON', value: s.price, items: [{ item_id: String(s.id), item_name: s.name, price: s.price, quantity: 1, item_variant: s.h + ' cm', item_list_name: 'Simulator brad' }] } });
    } catch (err) {}
  });

  /* ---------- captură (cu branding) + trimitere ---------- */
  $('shot').onclick = async () => {
    exporting = true; draw();
    const s = PRODUCT.sizes[sizeIdx];
    const out = document.createElement('canvas'), bar = Math.round(44 * DPR);
    out.width = cv.width; out.height = cv.height + bar;
    const o = out.getContext('2d');
    o.drawImage(cv, 0, 0);
    o.fillStyle = '#c31c72'; o.fillRect(0, cv.height, out.width, bar);
    o.font = `500 ${Math.round(16 * DPR)}px Oswald,"Arial Narrow",system-ui,sans-serif`; o.textBaseline = 'middle';
    o.fillStyle = '#ffffff'; o.fillText(PRODUCT.family + ' · ' + s.h + ' cm · Ø ' + s.d + ' cm', 14 * DPR, cv.height + bar / 2);
    o.textAlign = 'right'; o.fillStyle = '#ffffff'; o.fillText(CFG.brand || location.hostname, out.width - 14 * DPR, cv.height + bar / 2);
    exporting = false; draw();
    track('shot');
    const name = 'brad-' + s.h + 'cm-' + room.id + '.png';
    const blob = await new Promise(r => out.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], name, { type: 'image/png' });
    const touch = matchMedia('(pointer:coarse)').matches;
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: PRODUCT.family + ' ' + s.h + ' cm', text: s.url }); track('share'); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* ---------- modul poză: încărcare + pași ---------- */
  const sessFlags = new Set();
  const onceSession = k => !sessFlags.has(k) && !!sessFlags.add(k);
  if (!isTouch) { $('snap').classList.add('ssb-hidden'); $('pick').textContent = 'Încarcă o poză a camerei'; }
  $('snap').onclick = () => $('fileCam').click();
  $('pick').onclick = () => $('file').click();
  function loadPhoto(f, src) {
    if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      // reducem la max 2048 px: memorie mai mică pe telefon și mască mai rapidă
      const M = 2048, sc = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight));
      const c = newCanvas(Math.round(im.naturalWidth * sc), Math.round(im.naturalHeight * sc));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      Object.assign(photo, { img: c, mask: newCanvas(c.width, c.height), front: newCanvas(c.width, c.height), frontDirty: true, strokes: [], ref: null, horizon: .5 });
      $('refInfo').classList.add('ssb-hidden');
      pos.photo = { u: .5, v: .85 }; clampPhotoTree(); resetView(); setTool('move');
      $('hint').textContent = 'Trage bradul pe podea, unde vrei să stea'; $('hint').style.opacity = 1;
      clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 4500);
      renderUI(); draw(); track('photo_upload', { photo_source: src });
    };
    im.onerror = () => { URL.revokeObjectURL(url); alert('Nu am putut citi poza. Încearcă o imagine JPG sau PNG.'); };
    im.src = url;
  }
  $('file').onchange = e => { loadPhoto(e.target.files[0], 'gallery'); e.target.value = ''; };
  $('fileCam').onchange = e => { loadPhoto(e.target.files[0], 'camera'); e.target.value = ''; };

  function setTool(t) {
    tool = t;
    if (t === 'ref' && photo.img) ensureRef();
    root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
    root.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('ssb-hidden', p.dataset.pane !== t));
    cv.classList.toggle('ssb-paint', t === 'mask');
    draw();
  }
  function setBrush(b) { brush = b; root.querySelectorAll('[data-brush]').forEach(x => x.setAttribute('aria-pressed', x.dataset.brush === b)); }
  setBrush('add'); setTool('move');
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tool]'); if (t) setTool(t.dataset.tool);
    const b = e.target.closest('[data-brush]'); if (b) setBrush(b.dataset.brush);
    const r = e.target.closest('[data-refh]');
    if (r) { photo.refH = +r.dataset.refh; $('refH').value = photo.refH; ensureRef(); applyRef(); renderUI(); draw(); }
  });
  $('refH').oninput = e => { photo.refH = clamp(+e.target.value || 205, 20, 400); if (photo.ref) applyRef(); renderUI(); draw(); };
  $('refOff').onclick = () => { photo.ref = null; photo.horizon = .5; clampPhotoTree(); $('refInfo').classList.add('ssb-hidden'); setTool('move'); };
  $('brushSize').oninput = e => { brushSize = +e.target.value; };
  $('undo').onclick = () => { if (photo.strokes.pop()) { rebuildMask(); draw(); } };
  $('maskClear').onclick = () => { if (photo.strokes.length) { photo.strokes = []; rebuildMask(); draw(); } };
  $('camH').oninput = e => { photo.hc = clamp(+e.target.value || 140, 40, 250); if (photo.ref) applyRef(); draw(); };
  $('ceil').oninput = e => { photo.ceil = clamp(+e.target.value || 260, 200, 600); renderUI(); draw(); };

  /* ---------- camera „Bloc / Casă”: preseturi + Custom ---------- */
  const fmtM = v => (v / 100).toLocaleString('ro-RO', { maximumFractionDigits: 2 });
  function renderRoomPanel() {
    const all = PRESETS.concat([custom]);
    $('presets').innerHTML = all.map(p => `<button type="button" class="ssb-preset" data-preset="${p.id}" aria-pressed="${p.id === presetId}"><b>${esc(p.name)}</b><span>${esc(p.sub)}</span><small>${p.id === CUSTOM_ID ? 'toate setările' : fmtM(p.w) + ' × ' + fmtM(p.d) + ' m · tavan ' + fmtM(p.h) + ' m'}</small></button>`).join('');
    $('custom').classList.toggle('ssb-hidden', presetId !== CUSTOM_ID);
    $('wallSw').innerHTML = '<span>Pereți</span>' + WALL_COLORS.map(([n, c], i) => `<button type="button" class="ssb-sw" data-wallc="${i}" title="${n}" aria-label="${n}" aria-pressed="${custom.wall === i}" style="background:${c}"></button>`).join('');
    $('floorSw').innerHTML = '<span>Podea</span>' + FLOORS.map(([n, f], i) => `<button type="button" class="ssb-sw" data-floor="${i}" title="${n}" aria-label="${n}" aria-pressed="${custom.floor === i}" style="background:${f.floor}"></button>`).join('');
  }
  const getC = k => k.split('.').reduce((o, p) => o[p], custom);
  function setC(k, v) { const ks = k.split('.'), last = ks.pop(); ks.reduce((o, p) => o[p], custom)[last] = v; }
  function fillCustomInputs() {
    root.querySelectorAll('[data-c]').forEach(i => { const v = getC(i.dataset.c); if (i.type === 'checkbox') i.checked = !!v; else i.value = v; });
  }
  function roomChanged(resetTree) {
    roomDims();
    const p = pos.empty;
    if (resetTree || !p) pos.empty = presetStart();
    else { // bradul rămâne în cameră dacă aceasta s-a micșorat
      const r = PRODUCT.sizes[sizeIdx].d / 2 * .75;
      p.x = clamp(p.x, XL + r, Math.max(XL + r, XR - r)); p.z = clamp(p.z, ZN + 60, Math.max(ZN + 60, ZB - r));
    }
    renderUI(); draw();
  }
  function customEdited() { if (onceSession('custom')) track('room_custom'); }
  root.addEventListener('click', e => {
    const p = e.target.closest('[data-preset]');
    if (p) {
      if (p.dataset.preset === CUSTOM_ID && presetId !== CUSTOM_ID) {
        // Custom pornește de la presetul curent, ca să nu înceapă de la zero
        const base = roomCfg(); Object.assign(custom, JSON.parse(JSON.stringify(base)), { id: CUSTOM_ID, name: 'Custom', sub: 'casa ta, cu măsurile tale' });
      }
      presetId = p.dataset.preset; fillCustomInputs(); resetView();
      track('room_preset', { room_preset: presetId });
      roomChanged(true); return;
    }
    const w = e.target.closest('[data-wallc]'); if (w) { custom.wall = +w.dataset.wallc; customEdited(); roomChanged(); return; }
    const f = e.target.closest('[data-floor]'); if (f) { custom.floor = +f.dataset.floor; customEdited(); roomChanged(); }
  });
  // „input” = redesenare live când valoarea e în limite; „change” = corectăm valoarea din câmp după limite
  function onCustom(e, final) {
    const i = e.target, k = i.dataset && i.dataset.c; if (!k) return;
    let v;
    if (i.type === 'checkbox') v = i.checked;
    else if (i.tagName === 'SELECT') v = i.value;
    else {
      v = Math.round(+i.value); const lo = +i.min, hi = +i.max;
      if (!final && !(v >= lo && v <= hi)) return;
      v = clamp(isNaN(v) ? getC(k) : v, lo, hi); if (final) i.value = v;
    }
    setC(k, v); customEdited(); roomChanged();
  }
  root.addEventListener('input', e => onCustom(e, false));
  root.addEventListener('change', e => onCustom(e, true));
  fillCustomInputs();

  /* ---------- deschidere / închidere ---------- */
  let hintTimer;
  function hideHint() { $('hint').style.opacity = 0; }
  function open() {
    root.classList.add('ssb-open'); document.documentElement.classList.add('ssb-lock');
    $('hint').style.opacity = 1; clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 4500);
    requestAnimationFrame(resize);
    markUsed(); track('open'); if (onceFlag('open_' + PRODUCT.sizes[sizeIdx].id)) track('open_unique');
  }
  function close() { root.classList.remove('ssb-open'); document.documentElement.classList.remove('ssb-lock'); }
  $('close').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('ssb-open')) close(); });
  new ResizeObserver(() => { if (root.classList.contains('ssb-open')) resize(); }).observe($('stage'));
  document.addEventListener('click', e => { if (e.target.closest('.ssb-open-btn')) { e.preventDefault(); open(); } });

  // preîncarcă decupajul curent; „view” = vizualizare pagină cu buton (pentru rata de utilizare)
  cutoutOf(PRODUCT.sizes[sizeIdx]);
  if (document.querySelector('.ssb-open-btn')) track('view');
  window.SSB = { open, close };
  renderUI();
})();
