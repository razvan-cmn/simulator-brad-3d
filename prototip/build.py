import base64, pathlib
d = pathlib.Path(__file__).parent
b64 = lambda f, m: f"data:{m};base64," + base64.b64encode((d/'assets'/f).read_bytes()).decode()
html = (d/'src'/'simulator.template.html').read_text(encoding='utf-8')
html = html.replace('__TREE__', b64('tree.webp','image/webp')).replace('__ORIG__', b64('orig.jpg','image/jpeg'))
(d/'simulator.html').write_text(html, encoding='utf-8')
print('ok', len(html)//1024, 'KB')
