"""Generează un model 3D (.glb) la scară reală dintr-un decupaj de brad (PNG/WebP transparent).

Modelul e făcut din „panouri” verticale cu poza bradului, rotite în jurul trunchiului (ca o stea văzută de sus),
plus opțional un „miez”: un con verde închis în interior, care umple golurile dintre ramuri ca bradul să pară plin.

  --planes 1   un singur panou (perfect din față, plat din lateral)
  --planes 2   cruce (90°)
  --planes 4   stea la 45° (cel mai plin, recomandat)
  --core       adaugă miezul verde din interior

Panourile din spate sunt puțin mai închise la culoare (--shade), ca să dea adâncime.

Exemplu:
  python tools/make_glb.py prototip/assets/tree.webp --h 220 --d 135 --basex 0.545 --planes 4 --core -o ar/frasin-220.glb
"""
import argparse
import io
import json
import math
import struct

from PIL import Image


def png_bytes(path, max_h, dilate):
    im = Image.open(path).convert('RGBA')
    if im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    if dilate:
        # îngroașă puțin ramurile (alpha), ca golurile mici dintre ace să dispară
        from PIL import ImageFilter
        a = im.getchannel('A').filter(ImageFilter.MaxFilter(dilate * 2 + 1))
        im.putalpha(a)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def plane(theta, w0, w1, h, shade):
    """Panou vertical prin trunchi, rotit cu theta în jurul axei verticale."""
    c, s = math.cos(theta), math.sin(theta)
    p = lambda w, y: (c * w, y, -s * w)
    pos = [p(w0, 0), p(w1, 0), p(w1, h), p(w0, h)]
    nrm = [(s, 0, c)] * 4
    uv = [(0, 1), (1, 1), (1, 0), (0, 0)]
    col = [(shade, shade, shade, 1)] * 4
    return pos, nrm, uv, col


def cone(r, y0, y1, seg=24):
    """Con închis (miezul): bază la y0 cu raza r, vârf la y1."""
    pos, nrm, idx = [], [], []
    slope = r / (y1 - y0)
    for i in range(seg):
        a = 2 * math.pi * i / seg
        x, z = math.cos(a), math.sin(a)
        n = (x, slope, z); L = math.sqrt(sum(k * k for k in n)); n = tuple(k / L for k in n)
        pos += [(r * x, y0, r * z), (0, y1, 0)]
        nrm += [n, n]
    for i in range(seg):
        a, b = 2 * i, 2 * ((i + 1) % seg)
        idx += [a, b, a + 1]
    return pos, nrm, idx


def build(img, h_cm, d_cm, basex, planes, core, shade, max_tex, dilate):
    h, d = h_cm / 100.0, d_cm / 100.0
    w0, w1 = -basex * d, (1 - basex) * d

    P, N, T, C, I = [], [], [], [], []
    for k in range(planes):
        th = math.pi * k / planes  # panourile acoperă 180° (fiecare are două fețe)
        sh = 1.0 if k == 0 else shade
        pos, nrm, uv, col = plane(th, w0, w1, h, sh)
        b = len(P)
        P += pos; N += nrm; T += uv; C += col
        I += [b, b + 1, b + 2, b, b + 2, b + 3]

    def pack(fmt, rows):
        return b''.join(struct.pack(fmt, *r) for r in rows)

    blobs = [pack('<3f', P), pack('<3f', N), pack('<2f', T), pack('<4f', C), struct.pack('<%dH' % len(I), *I),
             png_bytes(img, max_tex, dilate)]
    if core:
        # miezul: ~70% din raza bradului, de la ~12% la ~88% din înălțime (nu se vede la vârf și la picioare)
        cp, cn, ci = cone(min(-w0, w1) * 0.7, h * 0.12, h * 0.88)
        blobs += [pack('<3f', cp), pack('<3f', cn), struct.pack('<%dH' % len(ci), *ci)]

    views, off, binbuf = [], 0, b''
    for i, bl in enumerate(blobs):
        pad = (-len(bl)) % 4
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(bl)}
        if i in (0, 1, 2, 3, 6, 7):
            v['target'] = 34962
        elif i in (4, 8):
            v['target'] = 34963
        views.append(v)
        binbuf += bl + b'\0' * pad
        off += len(bl) + pad

    xs, ys, zs = zip(*P)
    accessors = [
        {'bufferView': 0, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)]},
        {'bufferView': 1, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'},
        {'bufferView': 2, 'componentType': 5126, 'count': len(T), 'type': 'VEC2'},
        {'bufferView': 3, 'componentType': 5126, 'count': len(C), 'type': 'VEC4'},
        {'bufferView': 4, 'componentType': 5123, 'count': len(I), 'type': 'SCALAR'},
    ]
    prims = [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2, 'COLOR_0': 3}, 'indices': 4, 'material': 0}]
    materials = [{
        'name': 'brad',
        'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
        'alphaMode': 'MASK', 'alphaCutoff': 0.5, 'doubleSided': True,
        'extensions': {'KHR_materials_unlit': {}},  # culorile din poză, fără umbrire de la lumini
    }]
    if core:
        cx, cy, cz = zip(*cp)
        accessors += [
            {'bufferView': 6, 'componentType': 5126, 'count': len(cp), 'type': 'VEC3', 'min': [min(cx), min(cy), min(cz)], 'max': [max(cx), max(cy), max(cz)]},
            {'bufferView': 7, 'componentType': 5126, 'count': len(cn), 'type': 'VEC3'},
            {'bufferView': 8, 'componentType': 5123, 'count': len(ci), 'type': 'SCALAR'},
        ]
        prims.append({'attributes': {'POSITION': 5, 'NORMAL': 6}, 'indices': 7, 'material': 1})
        materials.append({'name': 'miez', 'pbrMetallicRoughness': {'baseColorFactor': [0.075, 0.11, 0.07, 1], 'metallicFactor': 0, 'roughnessFactor': 1},
                          'doubleSided': True, 'extensions': {'KHR_materials_unlit': {}}})

    gltf = {
        'asset': {'version': '2.0', 'generator': 'Sersimo simulator brad – make_glb.py'},
        'extensionsUsed': ['KHR_materials_unlit'],
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'brad'}],
        'meshes': [{'primitives': prims}],
        'materials': materials,
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': 5, 'mimeType': 'image/png'}],
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(binbuf)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binbuf)
    return (struct.pack('<4sII', b'glTF', 2, total)
            + struct.pack('<I4s', len(js), b'JSON') + js
            + struct.pack('<I4s', len(binbuf), b'BIN\0') + binbuf)


if __name__ == '__main__':
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('image')
    a.add_argument('--h', type=float, required=True, help='înălțimea bradului, cm')
    a.add_argument('--d', type=float, required=True, help='diametrul la bază, cm')
    a.add_argument('--basex', type=float, default=0.5, help='poziția trunchiului pe lățime (0–1)')
    a.add_argument('--planes', type=int, default=4, help='câte panouri (1, 2, 3, 4…)')
    a.add_argument('--core', action='store_true', help='adaugă miezul verde închis')
    a.add_argument('--shade', type=float, default=0.82, help='luminozitatea panourilor din spate (0–1)')
    a.add_argument('--dilate', type=int, default=0, help='îngroașă ramurile cu N px')
    a.add_argument('--max-tex', type=int, default=2048, help='înălțimea maximă a texturii, px')
    a.add_argument('-o', '--out', required=True)
    o = a.parse_args()
    data = build(o.image, o.h, o.d, o.basex, o.planes, o.core, o.shade, o.max_tex, o.dilate)
    with open(o.out, 'wb') as f:
        f.write(data)
    print(f'{o.out}: {len(data) / 1024:.0f} KB, {o.h:.0f}x{o.d:.0f} cm, {o.planes} panouri' + (' + miez' if o.core else ''))
