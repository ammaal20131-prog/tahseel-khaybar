# يحدّث رقم نسخة ملفات الموقع في index.html حتى تصل التعديلات للمستخدمات فوراً بدل بقاء النسخة القديمة في ذاكرة المتصفح.
# شغّليه بعد أي تعديل على js/ أو css/ وقبل الرفع:  python3 tools/bump-version.py
import hashlib, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
files = sorted(p for p in (root / 'js').rglob('*.js'))
h = hashlib.sha1()
for p in files + [root / 'css' / 'app.css']:
    h.update(p.relative_to(root).as_posix().encode()); h.update(p.read_bytes())
v = h.hexdigest()[:10]

imports = {'./' + p.relative_to(root).as_posix(): './' + p.relative_to(root).as_posix() + '?v=' + v for p in files}
block = ('<!--ver-->\n'
         '  <link rel="stylesheet" href="css/app.css?v=' + v + '">\n'
         '  <script type="importmap">' + json.dumps({'imports': imports}, ensure_ascii=False) + '</script>\n'
         '  <!--/ver-->')
idx = root / 'index.html'
s = idx.read_text(encoding='utf-8')
s = re.sub(r'<!--ver-->.*?<!--/ver-->', lambda m: block, s, flags=re.S)
s = re.sub(r'<script type="module" src="js/main\.js[^"]*"></script>', '<script type="module" src="js/main.js?v=' + v + '"></script>', s)
idx.write_text(s, encoding='utf-8')
print('version', v, '-', len(files), 'files')
