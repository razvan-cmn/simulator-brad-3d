"""Brad 3D procedural (.glb) la scară reală, pentru AR (model-viewer / Scene Viewer / Quick Look).

Cum e construit (ca brazii din jocuri):
  - trunchi + picioare de suport;
  - „etaje” de crengi în jurul trunchiului, de jos până sus; fiecare creangă = 3 plăci în cruce cu textura de ramură;
  - textura de ramură e desenată de script (ace, vârfuri albe, bobițe), cu culorile luate din poza bradului;
  - umbrire falsă (crengi mai închise spre trunchi și jos), ca să aibă adâncime fără lumini.

Exemplu:
  python tools/make_tree3d.py --h 220 --d 135 --palette prototip/assets/tree.webp --frost 0.55 --berries 0.35 -o ar/frasin-220-3d.glb
"""
import argparse
import io
import json
import math
import random
import struct

from PIL import Image, ImageDraw


# ---------------------------------------------------------------- culori

def palette_from(path, n=6):
    """Nuanțele de verde ale bradului din poză (fără umbre negre și fără alb), puțin luminate."""
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = [im.getpixel((x, y))[:3] for y in range(int(H * .15), int(H * .9), 3) for x in range(0, W, 3) if im.getpixel((x, y))[3] > 200]
    q = Image.new('RGB', (len(px), 1)); q.putdata(px)
    q = q.quantize(12, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    cols = []
    for c, i in sorted(q.getcolors(), reverse=True):
        r, g, b = pal[i * 3:i * 3 + 3]
        lum = .3 * r + .59 * g + .11 * b
        if 40 < lum < 130 and g >= r * 0.98:  # doar verdele (nu umbre, nu maro, nu vârfuri albe)
            k = 1.3  # poza e în interior, puțin întunecată
            r, b = r * .92, b * .9  # ușor mai verde
            cols.append(tuple(min(255, int(v * k)) for v in (r, g, b)))
    return cols[:n] or [(70, 80, 50), (85, 92, 60), (60, 68, 42)]


# ---------------------------------------------------------------- textura de ramură

def branch_texture(greens, frost, berries, seed=1, variants=4, w=1024, row=256):
    """Atlas cu `variants` ramuri diferite, una pe rând. u = de la trunchi (stânga) spre vârf (dreapta)."""
    S = 2  # desenăm la dublu și micșorăm (margini mai fine)
    img = Image.new('RGBA', (w * S, row * variants * S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    frost_col = (226, 228, 218)
    twig_col = (74, 58, 40)

    def needle(x, y, ang, L, width):
        x2, y2 = x + math.cos(ang) * L, y + math.sin(ang) * L
        g = rnd.choice(greens)
        g = tuple(max(0, min(255, v + rnd.randint(-12, 12))) for v in g)
        if rnd.random() < frost:  # vârf alb (brad „nins”)
            xm, ym = x + math.cos(ang) * L * .62, y + math.sin(ang) * L * .62
            dr.line([(x, y), (xm, ym)], fill=g + (255,), width=width)
            dr.line([(xm, ym), (x2, y2)], fill=frost_col + (255,), width=width)
        else:
            dr.line([(x, y), (x2, y2)], fill=g + (255,), width=width)

    def twig(x0, y0, ang, length, scale):
        # crenguță cu ace pe ambele părți, mai scurte spre vârf
        steps = int(length / (3.2 * S))
        cx, cy = x0, y0
        for i in range(steps):
            t = i / max(1, steps - 1)
            cx = x0 + math.cos(ang) * length * t
            cy = y0 + math.sin(ang) * length * t + math.sin(t * 3.1) * 3 * S
            L = (34 + 26 * rnd.random()) * S * scale * (0.45 + 0.55 * min(1, (1 - t) * 2.2 + .25))
            for side in (-1, 1):
                a = ang + side * math.radians(35 + 30 * rnd.random())
                needle(cx, cy, a, L, max(2, int(4 * S * scale)))
        dr.line([(x0, y0), (cx, cy)], fill=twig_col + (255,), width=max(2, int(4 * S * scale)))

    for k in range(variants):
        oy = (k * row + row / 2) * S
        # crenguțe laterale (dau lățime), apoi tulpina principală peste ele
        x = 90 * S
        while x < (w - 170) * S:
            for side in (-1, 1):
                if rnd.random() < .85:
                    ln = (150 + 90 * rnd.random()) * S * (1 - x / (w * S) * .55)
                    twig(x, oy, side * math.radians(28 + 18 * rnd.random()), ln, .8)
            x += (70 + 50 * rnd.random()) * S
        twig(12 * S, oy, 0, (w - 30) * S, 1.0)
        # bobițe roșii
        if rnd.random() < berries * 2:
            for _ in range(rnd.randint(1, 3)):
                bx, by = rnd.uniform(.35, .85) * w * S, oy + rnd.uniform(-45, 45) * S
                for _ in range(rnd.randint(3, 6)):
                    r = rnd.uniform(7, 11) * S
                    ex, ey = bx + rnd.uniform(-14, 14) * S, by + rnd.uniform(-12, 12) * S
                    dr.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(170, 22, 32, 255))
                    dr.ellipse([ex - r * .4, ey - r * .55, ex - r * .05, ey - r * .2], fill=(235, 120, 120, 255))
    img = img.resize((w, row * variants), Image.LANCZOS)
    # alpha binar curat (MASK), fără margini semi-transparente negre
    a = img.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    img.putalpha(a)
    return img


# ---------------------------------------------------------------- geometrie

def norm(v):
    L = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / L for c in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def add(a, b, k=1.0):
    return tuple(x + y * k for x, y in zip(a, b))


def rot(v, axis, ang):
    """Rotește v în jurul axei (Rodrigues)."""
    c, s = math.cos(ang), math.sin(ang)
    d = sum(x * y for x, y in zip(v, axis))
    cr = cross(axis, v)
    return tuple(v[i] * c + cr[i] * s + axis[i] * d * (1 - c) for i in range(3))


class Mesh:
    def __init__(self, textured):
        self.P, self.N, self.T, self.C, self.I = [], [], [], [], []
        self.textured = textured

    def quad(self, a, b, c, d, n, uv=None, col=((1, 1, 1),) * 4):
        base = len(self.P)
        self.P += [a, b, c, d]
        self.N += [n] * 4
        if self.textured:
            self.T += uv
        self.C += [tuple(x) + (1.0,) for x in col]
        self.I += [base, base + 1, base + 2, base, base + 2, base + 3]

    def box(self, p0, p1, col):
        (x0, y0, z0), (x1, y1, z1) = p0, p1
        c4 = (col,) * 4
        self.quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (0, 0, 1), col=c4)
        self.quad((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (0, 0, -1), col=c4)
        self.quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), (-1, 0, 0), col=c4)
        self.quad((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (1, 0, 0), col=c4)
        self.quad((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), (0, 1, 0), col=c4)


LIGHT = (0.35, 0.8, 0.48)


def lit(col, n):
    """Umbrire „coaptă” în culoare (materialul e fără lumini): partea de sus/față mai luminoasă."""
    k = .42 + .58 * max(0, sum(a * b for a, b in zip(norm(n), norm(LIGHT))))
    return tuple(min(1, c * k) for c in col)


def ellipsoid(mesh, center, axis, length, radius, col, rings=7, seg=8, scales=False):
    """Elipsoid (bobiță dacă length == 2*radius; con de brad dacă e alungit, cu „solzi” mai deschiși)."""
    axis = norm(axis)
    side = norm(cross(axis, (0, 0, 1) if abs(axis[2]) < .9 else (1, 0, 0)))
    side2 = cross(axis, side)
    pts = []
    for i in range(rings + 1):
        t = i / rings
        a = math.pi * t
        rr = math.sin(a) * radius * ((.75 + .25 * (1 - t)) if scales else 1)  # conul se îngustează spre vârf
        ring = []
        for j in range(seg):
            b = 2 * math.pi * j / seg
            off = add(add(axis, side, 0), side, 0)
            n = add(add(tuple(x * -math.cos(a) for x in axis), side, math.sin(a) * math.cos(b)), side2, math.sin(a) * math.sin(b))
            p = add(add(add(center, axis, -math.cos(a) * length / 2), side, rr * math.cos(b)), side2, rr * math.sin(b))
            ring.append((p, n))
        pts.append(ring)
    for i in range(rings):
        c = col
        if scales and i % 2:
            c = tuple(min(1, x * 1.35) for x in col)
        for j in range(seg):
            (p0, n0), (p1, n1) = pts[i][j], pts[i][(j + 1) % seg]
            (p2, n2), (p3, n3) = pts[i + 1][(j + 1) % seg], pts[i + 1][j]
            nn = norm(add(add(add(n0, n1), n2), n3))
            mesh.quad(p0, p1, p2, p3, nn, col=(lit(c, n0), lit(c, n1), lit(c, n2), lit(c, n3)))


def build_tree(h_cm, d_cm, seed, variants, density, aspect=.45, cones=0.0, berries=0.0):
    rnd = random.Random(seed)
    H, R = h_cm / 100, d_cm / 200
    leaves, wood = Mesh(True), Mesh(False)
    up = (0, 1, 0)

    def card(base, direc, length, width, twist, variant, shade_in, shade_out):
        """Placă de creangă: de la base în direcția direc; twist = rotația plăcii în jurul crengii."""
        w = norm(cross(direc, up)) if abs(direc[1]) < .97 else (1, 0, 0)
        w = rot(w, direc, twist)
        n = norm(cross(w, direc))
        tip = add(base, direc, length)
        hw = width / 2
        v0, v1 = variant / variants, (variant + 1) / variants
        a, b = add(base, w, -hw * .55), add(tip, w, -hw)  # mai îngustă la trunchi
        c, d = add(tip, w, hw), add(base, w, hw * .55)
        ci, co = (shade_in,) * 3, (shade_out,) * 3
        leaves.quad(a, b, c, d, n, uv=[(0, v1), (1, v1), (1, v0), (0, v0)], col=(ci, co, co, ci))

    # --- etaje de crengi
    y0, ytop = H * .10, H * .93
    layers = max(8, int((ytop - y0) / (0.085 / density)))
    for li in range(layers):
        f = li / (layers - 1)  # 0 jos, 1 sus
        y = y0 + (ytop - y0) * f + rnd.uniform(-.01, .01)
        radius = R * (1 - f) ** 0.92 * rnd.uniform(.92, 1.04) + 0.06
        n = max(5, round((8 + 9 * (1 - f)) * density))
        droop = math.radians(24 - 34 * f)  # jos crengile atârnă, sus urcă
        off = rnd.uniform(0, 2 * math.pi)
        for k in range(n):
            az = off + 2 * math.pi * k / n + rnd.uniform(-.25, .25)
            dr = droop + math.radians(rnd.uniform(-6, 6))
            L = radius / math.cos(dr) * rnd.uniform(.9, 1.05)
            if y - L * math.sin(dr) * .65 < .06:  # vârful crengii nu intră în podea
                dr = math.asin(max(-.5, min(.9, (y - .06) / (L * .65))))
            direc = norm((math.cos(az) * math.cos(dr), -math.sin(dr), math.sin(az) * math.cos(dr)))
            base = (math.cos(az) * .02, y + L * math.sin(dr) * .35, math.sin(az) * .02)
            width = max(.14, L * aspect)
            dark = .40 + .26 * f  # crengile de jos sunt mai în umbră
            var = rnd.randrange(variants)
            for tw in (0, math.radians(42), math.radians(-42)):
                card(base, direc, L, width, tw + rnd.uniform(-.15, .15), var, dark * .22, min(.95, dark + .28 + rnd.uniform(-.1, .1)))
        # crenguțe scurte lângă trunchi: umplu golurile, ca să nu se vadă trunchiul printre etaje
        for k in range(max(4, n // 2)):
            az = off + 2 * math.pi * (k + .5) / max(4, n // 2) + rnd.uniform(-.3, .3)
            dr = math.radians(rnd.uniform(-25, 10))
            L = max(.12, radius * rnd.uniform(.35, .55))
            direc = norm((math.cos(az) * math.cos(dr), -math.sin(dr), math.sin(az) * math.cos(dr)))
            yy = y + (ytop - y0) / layers * .5
            for tw in (0, math.radians(60)):
                card((0, yy, 0), direc, L, max(.12, L * .7), tw, rnd.randrange(variants), .08, .28 + .15 * f)
    # --- vârful (crenguțe verticale în stea)
    tipb = (0, ytop - .06, 0)
    for k in range(3):
        card(tipb, norm((0.015, 1, 0)), H - ytop + .06, .14, k * math.pi / 3, 0, .55, .95)

    # --- trunchi + suport metalic
    # miez întunecat în interior: golurile dintre crengi se văd închise, ca la un brad real
    core_seg, core_col = 10, (0.035, 0.06, 0.035)
    for i in range(core_seg):
        a0, a1 = 2 * math.pi * i / core_seg, 2 * math.pi * (i + 1) / core_seg
        rb = R * .5
        p0, p1 = (math.cos(a0) * rb, y0 + .05, math.sin(a0) * rb), (math.cos(a1) * rb, y0 + .05, math.sin(a1) * rb)
        tp = (0, ytop - .05, 0)
        nn = norm((math.cos((a0 + a1) / 2), .35, math.sin((a0 + a1) / 2)))
        wood.quad(p0, p1, tp, tp, nn, col=(core_col,) * 4)
    tr, brown, metal = .022, (0.23, 0.17, 0.11), (0.09, 0.09, 0.09)
    wood.box((-tr, 0.05, -tr), (tr, ytop, tr), brown)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        for t in range(6):  # picior: segmente înclinate de la trunchi la podea
            r0, r1 = .03 + .045 * t, .03 + .045 * (t + 1)
            yy0, yy1 = .12 - .02 * (t + 1), .12 - .02 * t
            cx, cz = math.cos(a) * (r0 + r1) / 2, math.sin(a) * (r0 + r1) / 2
            s = .012
            wood.box((cx - s, max(0, yy0), cz - s), (cx + s, yy1, cz + s), metal)
    # --- conuri și bobițe 3D, la capetele crengilor
    rnd2 = random.Random(seed + 99)
    for li in range(layers):
        f = li / (layers - 1)
        if f > .88:
            continue
        y = y0 + (ytop - y0) * f
        radius = R * (1 - f) ** 0.92 + 0.06
        for k in range(max(5, round((8 + 9 * (1 - f)) * density))):
            az = rnd2.uniform(0, 2 * math.pi)
            out = (math.cos(az), 0, math.sin(az))
            r = radius * rnd2.uniform(.72, .9)
            drop = r * math.tan(math.radians(24 - 34 * f)) * .7
            p = (out[0] * r, y - drop, out[2] * r)
            u = rnd2.random()
            if u < cones:
                L = rnd2.uniform(.075, .095)
                ellipsoid(wood, add(p, (0, -L * .45, 0)), norm((out[0] * .25, -1, out[2] * .25)), L, L * .36, (0.30, 0.17, 0.08), scales=True)
            elif u < cones + berries:
                for _ in range(rnd2.randint(4, 6)):
                    q = add(p, (rnd2.uniform(-.022, .022), rnd2.uniform(-.015, .02), rnd2.uniform(-.022, .022)))
                    q = add(q, out, .02)
                    rb = rnd2.uniform(.012, .015)
                    ellipsoid(wood, q, (0, 1, 0), rb * 2, rb, (0.80, 0.04, 0.09), rings=5, seg=7)
    # --- scară exactă: dimensiunile produsului = cutia exterioară a modelului
    # (plăcile crengilor ies puțin peste rază, iar vârful peste înălțime → corectăm la final)
    allp = leaves.P + wood.P
    ymin = min(p[1] for p in allp)
    ymax = max(p[1] for p in allp)
    wx = max(p[0] for p in allp) - min(p[0] for p in allp)
    wz = max(p[2] for p in allp) - min(p[2] for p in allp)
    sy, sxz = H / (ymax - ymin), (2 * R) / max(wx, wz)
    for m in (leaves, wood):
        m.P = [(x * sxz, (y - ymin) * sy, z * sxz) for x, y, z in m.P]
    return leaves, wood


# ---------------------------------------------------------------- GLB

def glb(leaves, wood, tex_png):
    blobs, views, accessors = [], [], []

    def push(data, target=None):
        blobs.append((data, target))
        return len(blobs) - 1

    def acc(bv, ctype, count, typ, mn=None, mx=None):
        a = {'bufferView': bv, 'componentType': ctype, 'count': count, 'type': typ}
        if mn is not None:
            a['min'], a['max'] = mn, mx
        accessors.append(a)
        return len(accessors) - 1

    def pack(fmt, rows):
        return b''.join(struct.pack(fmt, *r) for r in rows)

    prims = []
    for m, mat in ((leaves, 0), (wood, 1)):
        if not m.P:
            continue
        xs, ys, zs = zip(*m.P)
        attrs = {
            'POSITION': acc(push(pack('<3f', m.P), 34962), 5126, len(m.P), 'VEC3', [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)]),
            'NORMAL': acc(push(pack('<3f', m.N), 34962), 5126, len(m.N), 'VEC3'),
            'COLOR_0': acc(push(pack('<4f', m.C), 34962), 5126, len(m.C), 'VEC4'),
        }
        if m.textured:
            attrs['TEXCOORD_0'] = acc(push(pack('<2f', m.T), 34962), 5126, len(m.T), 'VEC2')
        big = len(m.P) > 65535
        idx = acc(push(struct.pack('<%d%s' % (len(m.I), 'I' if big else 'H'), *m.I), 34963), 5125 if big else 5123, len(m.I), 'SCALAR')
        prims.append({'attributes': attrs, 'indices': idx, 'material': mat})
    img_bv = push(tex_png)

    binbuf, off = b'', 0
    for data, target in blobs:
        pad = (-len(data)) % 4
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        binbuf += data + b'\0' * pad
        off += len(data) + pad

    gltf = {
        'asset': {'version': '2.0', 'generator': 'Sersimo simulator brad – make_tree3d.py'},
        'extensionsUsed': ['KHR_materials_unlit'],
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'brad'}],
        'meshes': [{'primitives': prims}],
        'materials': [
            {'name': 'crengi', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
             'alphaMode': 'MASK', 'alphaCutoff': 0.5, 'doubleSided': True, 'extensions': {'KHR_materials_unlit': {}}},
            {'name': 'trunchi', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}, 'extensions': {'KHR_materials_unlit': {}}},
        ],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': img_bv, 'mimeType': 'image/png'}],
        'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binbuf)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binbuf)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js
            + struct.pack('<I4s', len(binbuf), b'BIN\0') + binbuf)


# ---------------------------------------------------------------- USDZ (iPhone / AR Quick Look)

def _f(v):
    return ('%.5f' % v).rstrip('0').rstrip('.') if v != int(v) else str(int(v))


def usdz(leaves, wood, tex_png, bins=6, tex_h=1024, mode='emissive'):
    """Fișier .usdz pentru iPhone (AR Quick Look), cu aspectul variantei Android.

    Pe Android bradul e „unlit”: culoarea = textura × umbrirea pe vârfuri (închis spre trunchi, deschis spre vârf).
    Quick Look nu știe de culori pe vârfuri și adaugă propria lumină, așa că:
      - umbrirea e „coaptă” în texturi: crengile sunt grupate după cât de luminos e capătul lor,
        iar pentru fiecare grupă textura e înmulțită cu gradientul trunchi→vârf;
      - materialele sunt emisive (diffuse negru): culoarea din textură se vede ca atare, fără lumina Apple."""
    from PIL import ImageChops
    out = ['#usda 1.0', '(', '    defaultPrim = "Brad"', '    metersPerUnit = 1', '    upAxis = "Y"', ')', '',
           'def Xform "Brad"', '{',
           '    token preliminary:anchoring:type = "plane"',  # Quick Look: pune bradul pe podea
           '    token preliminary:planeAnchoring:alignment = "horizontal"', '']
    mats, files = [], []

    def mesh_block(name, quads, P, N, T, mat, double):
        idx, pts, nrm, st = [], [], [], []
        for q in quads:
            for v in q:
                idx.append(len(pts)); pts.append(P[v]); nrm.append(N[v])
                if T:
                    st.append((T[v][0], 1 - T[v][1]))
        b = ['    def Mesh "%s" (' % name, '        prepend apiSchemas = ["MaterialBindingAPI"]', '    )', '    {',
             '        uniform bool doubleSided = %d' % (1 if double else 0),
             '        int[] faceVertexCounts = [%s]' % ', '.join(['4'] * len(quads)),
             '        int[] faceVertexIndices = [%s]' % ', '.join(map(str, idx)),
             '        rel material:binding = </Brad/Materiale/%s>' % mat,
             '        normal3f[] normals = [%s] (interpolation = "vertex")' % ', '.join('(%s, %s, %s)' % tuple(map(_f, n)) for n in nrm),
             '        point3f[] points = [%s]' % ', '.join('(%s, %s, %s)' % tuple(map(_f, p)) for p in pts)]
        if T:
            b.append('        texCoord2f[] primvars:st = [%s] (interpolation = "vertex")' % ', '.join('(%s, %s)' % tuple(map(_f, t)) for t in st))
        b += ['        uniform token subdivisionScheme = "none"', '    }', '']
        return b

    base = Image.open(io.BytesIO(tex_png)).convert('RGBA')
    if base.height > tex_h:
        base = base.resize((base.width * tex_h // base.height, tex_h), Image.LANCZOS)
    W = base.width
    rgb, alpha = base.convert('RGB'), base.getchannel('A')

    # crengi: grupate după luminozitatea capătului (u=1); baza (u=0) = media grupei
    lq = [tuple(range(i, i + 4)) for i in range(0, len(leaves.P), 4)]
    groups = {}
    for q in lq:
        cin, cout = leaves.C[q[0]][0], leaves.C[q[1]][0]
        groups.setdefault(min(bins - 1, int(cout * bins)), []).append((q, cin, cout))
    for b, items in sorted(groups.items()):
        cin = sum(i[1] for i in items) / len(items)
        cout = sum(i[2] for i in items) / len(items)
        grad = Image.new('L', (W, 1))
        grad.putdata([int(255 * min(1, cin + (cout - cin) * x / (W - 1))) for x in range(W)])
        grad = grad.resize(rgb.size).convert('RGB')
        baked = ImageChops.multiply(rgb, grad)
        baked.putalpha(alpha)
        buf = io.BytesIO(); baked.save(buf, 'PNG', optimize=True)
        fname = 'crengi%d.png' % b
        files.append((fname, buf.getvalue()))
        name = 'Crengi%d' % b
        out += mesh_block(name, [i[0] for i in items], leaves.P, leaves.N, leaves.T, 'M' + name, True)
        mats.append(('M' + name, 'tex', fname))
    # lemn, miez, conuri, bobițe: culori fixe (deja „luminate” în vertex colors)
    wq = [tuple(range(i, i + 4)) for i in range(0, len(wood.P), 4)]
    groups = {}
    for q in wq:
        c = tuple(round(sum(wood.C[v][i] for v in q) / 4 * 12) / 12 for i in range(3))
        groups.setdefault(c, []).append(q)
    for i, (c, qs) in enumerate(sorted(groups.items())):
        name = 'Obiect%d' % i
        out += mesh_block(name, qs, wood.P, wood.N, None, 'M' + name, True)
        mats.append(('M' + name, 'color', c))

    out += ['    def Scope "Materiale"', '    {']
    for name, kind, val in mats:
        out += ['        def Material "%s"' % name, '        {',
                '            token outputs:surface.connect = </Brad/Materiale/%s/Suprafata.outputs:surface>' % name,
                '            def Shader "Suprafata"', '            {',
                '                uniform token info:id = "UsdPreviewSurface"',
                '                float inputs:roughness = 1', '                float inputs:metallic = 0']
        if mode == 'emissive':
            out += ['                color3f inputs:diffuseColor = (0, 0, 0)']  # fără lumina Apple: totul vine din emisiv
        chan = 'emissiveColor' if mode == 'emissive' else 'diffuseColor'
        if kind == 'tex':
            out += ['                color3f inputs:%s.connect = </Brad/Materiale/%s/Textura.outputs:rgb>' % (chan, name),
                    '                float inputs:opacity.connect = </Brad/Materiale/%s/Textura.outputs:a>' % name,
                    '                float inputs:opacityThreshold = 0.5',
                    '                token outputs:surface', '            }',
                    '            def Shader "St"', '            {', '                uniform token info:id = "UsdPrimvarReader_float2"',
                    '                string inputs:varname = "st"', '                float2 outputs:result', '            }',
                    '            def Shader "Textura"', '            {', '                uniform token info:id = "UsdUVTexture"',
                    '                asset inputs:file = @%s@' % val,
                    '                float2 inputs:st.connect = </Brad/Materiale/%s/St.outputs:result>' % name,
                    '                token inputs:wrapS = "clamp"', '                token inputs:wrapT = "clamp"',
                    '                float3 outputs:rgb', '                float outputs:a', '            }']
        else:
            out += ['                color3f inputs:%s = (%s, %s, %s)' % ((chan,) + tuple(map(_f, val))),
                    '                token outputs:surface', '            }']
        out += ['        }']
    out += ['    }', '}', '']
    usda = '\n'.join(out).encode()

    # USDZ = zip necomprimat, cu datele fiecărui fișier aliniate la 64 de octeți (cerință Apple)
    import zipfile
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w', zipfile.ZIP_STORED) as z:
        for fname, data in [('brad.usda', usda)] + files:
            zi = zipfile.ZipInfo(fname, (2024, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_STORED
            off = bio.tell() + 30 + len(fname)
            pad = (-(off + 4)) % 64
            zi.extra = struct.pack('<HH', 0x1986, pad) + b'\0' * pad
            z.writestr(zi, data)
    return bio.getvalue()


if __name__ == '__main__':
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--h', type=float, required=True, help='înălțime, cm')
    a.add_argument('--d', type=float, required=True, help='diametru la bază, cm')
    a.add_argument('--palette', help='poza bradului (de aici se iau nuanțele de verde)')
    a.add_argument('--frost', type=float, default=0.0, help='cât din ace au vârf alb (0–1)')
    a.add_argument('--berries', type=float, default=0.0, help='cât de des apar bobițe roșii (0–1)')
    a.add_argument('--density', type=float, default=1.0, help='desimea crengilor (0.6–1.6)')
    a.add_argument('--seed', type=int, default=7)
    a.add_argument('--atlas', help='atlas de crengi reale (din make_branch_atlas.py), în loc de acele desenate')
    a.add_argument('--cones', type=float, default=0.0, help='conuri 3D: din câte capete de crengi (0–1, ex. 0.1)')
    a.add_argument('--berries3d', type=float, default=0.0, help='ciorchini de bobițe 3D (0–1, ex. 0.1)')
    a.add_argument('--tex-out', help='salvează și textura de ramură (PNG), ca s-o vezi')
    a.add_argument('-o', '--out', required=True)
    a.add_argument('--usdz', help='scrie și varianta pentru iPhone (AR Quick Look)')
    a.add_argument('--usdz-mode', choices=['emissive', 'lit'], default='lit', help='iPhone: emisiv (fără lumina Apple) sau luminat normal')
    o = a.parse_args()

    greens = palette_from(o.palette) if o.palette else [(64, 82, 46), (78, 96, 54), (56, 70, 40), (90, 104, 62)]
    if o.atlas:
        tex = Image.open(o.atlas).convert('RGBA')
        variants, aspect = tex.height // (tex.width // 2), .5
    else:
        tex = branch_texture(greens, o.frost, o.berries, seed=o.seed)
        variants, aspect = 4, .45
    if o.tex_out:
        tex.save(o.tex_out)
    buf = io.BytesIO(); tex.save(buf, 'PNG', optimize=True)
    leaves, wood = build_tree(o.h, o.d, o.seed, variants, o.density, aspect, o.cones, o.berries3d)
    data = glb(leaves, wood, buf.getvalue())
    if o.usdz:
        with open(o.usdz, 'wb') as f:
            f.write(usdz(leaves, wood, buf.getvalue(), mode=o.usdz_mode))
        print(f'{o.usdz}: varianta iPhone')
    with open(o.out, 'wb') as f:
        f.write(data)
    print(f'{o.out}: {len(data) / 1024:.0f} KB, {len(leaves.P) // 4} placi de crengi, {o.h:.0f}x{o.d:.0f} cm')
