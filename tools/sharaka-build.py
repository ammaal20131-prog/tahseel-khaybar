#!/usr/bin/env python3
"""ينشئ نسخة العرض من سجل الشراكة المجتمعية على موقع قت هب (sharaka.html + sharaka-files/).

المصدر: سجل الشراكة على Claude (https://claude.ai/artifact/XTZJKsUdo8xX5YPBRqc5Mq).
تستخدمه مهمة المزامنة: تقرأ صفحة السجل وبياناته وملفاته، ثم تشغّل:
  python3 -I tools/sharaka-build.py --html PAGE.html --data DATA_DIR --assets ASSETS_DIR --out REPO_DIR
  DATA_DIR  : مخرجات ArtifactData (out_dir) وفيه coop/ meetings/ links/ plan/
  ASSETS_DIR: ملفات السجل بأسماء <id>.<ext> (من Artifact read path=<id>)
يطبع قائمة معرّفات الملفات الناقصة إن وُجدت (ولا ينشئ شيئاً حينها).
"""
import argparse, glob, json, os, re, shutil, sys

ap = argparse.ArgumentParser()
ap.add_argument('--html', required=True); ap.add_argument('--data', required=True)
ap.add_argument('--assets', required=True); ap.add_argument('--out', required=True)
a = ap.parse_args()

src = open(a.html, encoding='utf8').read()
# نزع غلاف النشر إن وُجد
m = re.match(r'<!doctype html><html><head>.*?</head><body>', src, re.S | re.I)
if m: src = src[m.end():]
src = re.sub(r'</body></html>\s*$', '', src.strip())

def load(c):
    out = []
    for f in sorted(glob.glob(os.path.join(a.data, c, '*.json'))):
        d = json.load(open(f, encoding='utf8')); d['_id'] = os.path.basename(f)[:-5]; out.append(d)
    return out
plan_f = os.path.join(a.data, 'plan', 'status.json')
data = {'coop': load('coop'), 'meet': load('meetings'), 'links': load('links'),
        'plan': json.load(open(plan_f, encoding='utf8')) if os.path.exists(plan_f) else {}}
js = json.dumps(data, ensure_ascii=False)

ids = sorted(set(re.findall(r'/_blob/([0-9a-f]{32})', src + js)))
have = {os.path.basename(p).split('.')[0]: p for p in glob.glob(os.path.join(a.assets, '*'))}
missing = [i for i in ids if i not in have]
if missing:
    print('MISSING', ' '.join(missing)); sys.exit(2)

fdir = os.path.join(a.out, 'sharaka-files'); os.makedirs(fdir, exist_ok=True)
for f in os.listdir(fdir): os.remove(os.path.join(fdir, f))
names = {}
for i in ids:
    p = have[i]; name = os.path.basename(p); shutil.copyfile(p, os.path.join(fdir, name)); names[i] = 'sharaka-files/' + name
for i, n in names.items():
    src = src.replace('/_blob/' + i, n); js = js.replace('/_blob/' + i, n)

# روابط الملفات: من /_blob/ إلى sharaka-files/
src = src.replace(r'\/_blob\/[\w-]+', r'sharaka-files\/[\w.-]+').replace(r'\/_blob\/', r'sharaka-files\/')
# التنزيل بدون صلاحيات Claude
src = src.replace('async function dlPdf(u,n,b){if(!S.dl){window.open(u,"_blank");return}',
  'async function dlPdf(u,n,b){if(!S.dl){const x=document.createElement("a");x.href=u;x.download=n.replace(/[\\\\/:*?"<>|—]+/g," ").trim()+u.slice(u.lastIndexOf("."));document.body.appendChild(x);x.click();x.remove();return}')
# البيانات ثابتة من آخر مزامنة، والعرض للقراءة فقط
i = src.find('(async()=>{const [db,user,dl]')
if i < 0: print('INIT_NOT_FOUND'); sys.exit(3)
j = src.find('</script>', i)
src = (src[:i] + 'const DATA=' + js + ';\nS.coop=DATA.coop;S.meet=DATA.meet;S.links=DATA.links;S.plan=DATA.plan;S.owner=false;S.ready=true;render();\n' + src[j:])
if 'claude.use("db")' in src: print('DB_LEFT'); sys.exit(4)

head = ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}</style></head><body>\n')
open(os.path.join(a.out, 'sharaka.html'), 'w', encoding='utf8').write(head + src + '\n</body></html>\n')
print('OK', len(ids), 'files,', len(data['coop']), 'coop,', len(data['links']), 'links')
