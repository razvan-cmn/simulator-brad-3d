"""Atlas de crengi REALE dintr-o poză a bradului pe fundal deschis (perete), pentru make_tree3d.py.

1. scoate fundalul (perete deschis, ușor gălbui) și păstrează acele + vârfurile albe („chiciura”);
2. decupează crengile alese (casete x0,y0,x1,y1 în pixeli), le întoarce cu baza spre stânga (u=0 = lângă trunchi);
3. rotunjește marginile tăiate drept, ca să nu se vadă dreptunghiul;
4. le pune într-un atlas: un rând per creangă (+ variante oglindite), raport 2:1.

Exemplu:
  python tools/make_branch_atlas.py ar/surse/frasin-lateral.webp --box 84,215,335,340 --box 170,90,335,215 -o ar/crengi-frasin.png
"""
import argparse
import math

from PIL import Image, ImageFilter


def key_out_wall(im, lum_max=178, yel_min=6.5, frost_lum=150):
    """Masca: tot ce NU e perete. Peretele = deschis și ușor gălbui; chiciura = deschisă dar neutră/rece."""
    W, H = im.size
    px = im.load()
    m = Image.new('L', im.size)
    mp = m.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            lum = .3 * r + .59 * g + .11 * b
            yel = (r + g) / 2 - b
            mp[x, y] = 255 if (lum < lum_max or (yel < yel_min and lum > frost_lum)) else 0
    return m.filter(ImageFilter.MedianFilter(3))


def soften(c):
    """Înmulțește alpha cu o formă de creangă (îngustă la bază, lată la mijloc, rotunjită la vârf)."""
    W, H = c.size
    a = c.getchannel('A').load()
    for y in range(H):
        for x in range(W):
            u, v = x / (W - 1), abs(y / (H - 1) - .5) * 2
            half = .35 + .65 * math.sin(math.pi * min(1, .15 + u * .95))  # lățimea admisă la poziția u
            k = 1 - max(0, (v - half * .82) / (half * .18 + 1e-6))
            if u > .93:
                k *= max(0, 1 - (u - .93) / .07)
            a[x, y] = int(a[x, y] * max(0, min(1, k)))
    return c


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('image')
    ap.add_argument('--box', action='append', required=True, help='x0,y0,x1,y1 (vârful crengii spre stânga în poză)')
    ap.add_argument('--tip-left', action='store_true', default=True)
    ap.add_argument('--w', type=int, default=1024)
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--preview', help='salvează și o previzualizare pe fundal albastru')
    o = ap.parse_args()

    im = Image.open(o.image).convert('RGB')
    rgba = im.convert('RGBA')
    rgba.putalpha(key_out_wall(im))
    rows = []
    for b in o.box:
        x0, y0, x1, y1 = map(int, b.split(','))
        c = rgba.crop((x0, y0, x1, y1)).transpose(Image.FLIP_LEFT_RIGHT)  # baza (spre trunchi) în stânga
        rows += [c, c.transpose(Image.FLIP_TOP_BOTTOM)]  # + varianta oglindită
    RW, RH = o.w, o.w // 2
    atlas = Image.new('RGBA', (RW, RH * len(rows)), (0, 0, 0, 0))
    for i, c in enumerate(rows):
        sc = min(RW / c.width, RH / c.height)
        c = c.resize((max(1, int(c.width * sc)), max(1, int(c.height * sc))), Image.LANCZOS)
        cell = Image.new('RGBA', (RW, RH), (0, 0, 0, 0))
        cell.alpha_composite(c, (RW - c.width, (RH - c.height) // 2))  # aliniat la vârf (dreapta)
        atlas.alpha_composite(soften(cell), (0, i * RH))
    # corecție de culoare: verdele mai închis și mai bogat (poza e făcută în lumină difuză), albul rămâne alb
    px = atlas.load()
    for y in range(atlas.height):
        for x in range(atlas.width):
            r, g, b, al = px[x, y]
            if not al:
                continue
            lum = .3 * r + .59 * g + .11 * b
            if lum > 175 and abs(r - b) < 25:  # chiciură
                continue
            m = (r + g + b) / 3
            r, g, b = (m + (c - m) * 1.45 for c in (r, g, b))  # saturație
            k = .78
            px[x, y] = (max(0, min(255, int(r * k))), max(0, min(255, int(g * k * 1.03))), max(0, min(255, int(b * k))), al)
    a = atlas.getchannel('A').point(lambda v: 255 if v > 100 else 0)
    atlas.putalpha(a)
    atlas.save(o.out)
    if o.preview:
        p = Image.new('RGBA', atlas.size, (40, 90, 200, 255)); p.alpha_composite(atlas); p.convert('RGB').save(o.preview)
    print(f'{o.out}: {len(rows)} variante, {atlas.size[0]}x{atlas.size[1]}')


if __name__ == '__main__':
    main()
