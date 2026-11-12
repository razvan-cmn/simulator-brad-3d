"""Fișiere USDZ mici de diagnostic pentru iPhone (AR Quick Look): o creangă pe o placă, în mai multe variante
de autor, ca să aflăm ce metodă de transparență citește corect iOS. Folosește biblioteca oficială USD (usd-core).

  T1  ca bradul actual: opacitate din canalul alfa + prag 0.4, material luminat
  T2  opacitate din alfa FĂRĂ prag (amestec semi-transparent)
  T3  ca T1, dar scris cu API-ul oficial USD, cu spațiu de culoare declarat și împachetat cu utilitarul oficial ARKit
  T4  prag 0.5 + culoarea și alfa din același PNG, fără „diffuse” negru, roughness 0.8 (rețeta din exemplele Apple)

Exemplu:  python tools/usdz_diag.py ar/crengi-frasin.png ar/iphone/diag
"""
import os
import sys
import tempfile

from PIL import Image
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt


def branch_png(atlas, out):
    im = Image.open(atlas).convert('RGBA')
    row = im.crop((0, 0, im.width, im.width // 2))  # primul rând = o creangă
    row.save(out)


def build(path_usdc, tex_name, threshold=0.4, color_space=None, blend=False, roughness=1.0):
    st = Usd.Stage.CreateNew(path_usdc)
    UsdGeom.SetStageUpAxis(st, UsdGeom.Tokens.y)
    UsdGeom.SetStageMetersPerUnit(st, 1.0)
    root = UsdGeom.Xform.Define(st, '/Creanga')
    st.SetDefaultPrim(root.GetPrim())
    root.GetPrim().CreateAttribute('preliminary:anchoring:type', Sdf.ValueTypeNames.Token).Set('plane')
    root.GetPrim().CreateAttribute('preliminary:planeAnchoring:alignment', Sdf.ValueTypeNames.Token).Set('horizontal')

    # placă verticală 1,2 × 0,6 m, de la 0,4 la 1,0 m deasupra podelei
    m = UsdGeom.Mesh.Define(st, '/Creanga/Placa')
    m.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(-.6, .4, 0), Gf.Vec3f(.6, .4, 0), Gf.Vec3f(.6, 1.0, 0), Gf.Vec3f(-.6, 1.0, 0)]))
    m.CreateFaceVertexCountsAttr(Vt.IntArray([4]))
    m.CreateFaceVertexIndicesAttr(Vt.IntArray([0, 1, 2, 3]))
    m.CreateNormalsAttr(Vt.Vec3fArray([Gf.Vec3f(0, 0, 1)] * 4))
    m.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
    m.CreateDoubleSidedAttr(True)
    m.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
    pv = UsdGeom.PrimvarsAPI(m).CreatePrimvar('st', Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
    pv.Set(Vt.Vec2fArray([Gf.Vec2f(0, 0), Gf.Vec2f(1, 0), Gf.Vec2f(1, 1), Gf.Vec2f(0, 1)]))

    mat = UsdShade.Material.Define(st, '/Creanga/Mat')
    sh = UsdShade.Shader.Define(st, '/Creanga/Mat/Suprafata')
    sh.CreateIdAttr('UsdPreviewSurface')
    sh.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(roughness)
    sh.CreateInput('metallic', Sdf.ValueTypeNames.Float).Set(0.0)
    rd = UsdShade.Shader.Define(st, '/Creanga/Mat/St')
    rd.CreateIdAttr('UsdPrimvarReader_float2')
    rd.CreateInput('varname', Sdf.ValueTypeNames.String).Set('st')
    tx = UsdShade.Shader.Define(st, '/Creanga/Mat/Textura')
    tx.CreateIdAttr('UsdUVTexture')
    tx.CreateInput('file', Sdf.ValueTypeNames.Asset).Set(tex_name)
    tx.CreateInput('st', Sdf.ValueTypeNames.Float2).ConnectToSource(rd.ConnectableAPI(), 'result')
    tx.CreateInput('wrapS', Sdf.ValueTypeNames.Token).Set('clamp')
    tx.CreateInput('wrapT', Sdf.ValueTypeNames.Token).Set('clamp')
    if color_space:
        tx.CreateInput('sourceColorSpace', Sdf.ValueTypeNames.Token).Set(color_space)
    rgb = tx.CreateOutput('rgb', Sdf.ValueTypeNames.Float3)
    a = tx.CreateOutput('a', Sdf.ValueTypeNames.Float)
    sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(rgb)
    sh.CreateInput('opacity', Sdf.ValueTypeNames.Float).ConnectToSource(a)
    if not blend:
        sh.CreateInput('opacityThreshold', Sdf.ValueTypeNames.Float).Set(threshold)
    mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), 'surface')
    UsdShade.MaterialBindingAPI.Apply(m.GetPrim()).Bind(mat)
    st.GetRootLayer().Save()


def main():
    atlas, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    work = tempfile.mkdtemp()
    tex = os.path.join(work, 'creanga.png')
    branch_png(atlas, tex)
    cases = {
        'T1': dict(threshold=0.4),
        'T2': dict(blend=True),
        'T3': dict(threshold=0.4, color_space='sRGB'),
        'T4': dict(threshold=0.5, color_space='auto', roughness=0.8),
    }
    for name, kw in cases.items():
        usdc = os.path.join(work, name + '.usdc')
        build(usdc, 'creanga.png', **kw)
        out = os.path.join(outdir, name + '.usdz')
        if os.path.exists(out):
            os.remove(out)
        cwd = os.getcwd(); os.chdir(work)
        try:
            ok = UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(name + '.usdc'), os.path.abspath(os.path.join(cwd, out)))
        finally:
            os.chdir(cwd)
        print(name, 'ok' if ok else 'EROARE', os.path.getsize(out) if os.path.exists(out) else '-')


if __name__ == '__main__':
    main()
