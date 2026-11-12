"""Reîmpachetează un .usdz (scris de make_tree3d.py) cu utilitarul oficial ARKit din USD:
usda → usdc binar, spațiu de culoare sRGB declarat pe texturi, apoi UsdUtils.CreateNewARKitUsdzPackage.

Exemplu:  python tools/usdz_official.py ar/iphone/d-nou.usdz ar/iphone/diag/T5-brad.usdz
"""
import os
import sys
import tempfile
import zipfile

from pxr import Sdf, Usd, UsdShade, UsdUtils

src, dst = sys.argv[1], os.path.abspath(sys.argv[2])
work = tempfile.mkdtemp()
zipfile.ZipFile(src).extractall(work)
usda = [f for f in os.listdir(work) if f.endswith('.usda')][0]
st = Usd.Stage.Open(os.path.join(work, usda))
for p in st.Traverse():
    if p.GetTypeName() == 'Shader' and p.GetAttribute('info:id').Get() == 'UsdUVTexture':
        UsdShade.Shader(p).CreateInput('sourceColorSpace', Sdf.ValueTypeNames.Token).Set('sRGB')
st.GetRootLayer().Export(os.path.join(work, 'brad.usdc'))
cwd = os.getcwd(); os.chdir(work)
try:
    if os.path.exists(dst):
        os.remove(dst)
    ok = UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath('brad.usdc'), dst)
finally:
    os.chdir(cwd)
print('ok' if ok else 'EROARE', dst, os.path.getsize(dst) if os.path.exists(dst) else '-')
