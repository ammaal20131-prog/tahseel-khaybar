const path='/opt/node22/lib/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode/';
const QRCode=require(path+'index.js'), ECL=require(path+'QRErrorCorrectLevel.js');
const fs=require('fs'); const { chromium }=require('playwright');
const BASE='https://ammaal20131-prog.github.io/tahseel-khaybar/#/folder/';
const cats=JSON.parse(process.argv[2]); const out=process.argv[3]; const repo=process.argv[4];
const logo='data:image/png;base64,'+fs.readFileSync(repo+'/assets/moe-logo.png').toString('base64');
function svg(url){const q=new QRCode(-1,ECL.H);q.addData(url);q.make();const n=q.getModuleCount();let r='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))r+=`M${x+4} ${y+4}h1v1h-1z`;const s=n+8;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${r}" fill="#0f3d3c"/></svg>`;}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:800,height:1060},deviceScaleFactor:2});
for(const [i,[key,title,note]] of cats.entries()){const url=BASE+key;
const html=`<html dir="rtl"><body style="margin:0;font-family:'DejaVu Sans';background:#fff">
<div style="width:800px;height:1060px;box-sizing:border-box;border:14px solid #0f3d3c;display:flex;flex-direction:column;align-items:center;padding:36px 40px;text-align:center">
<img src="${logo}" style="height:90px">
<div style="font-size:24px;color:#0f3d3c;margin-top:14px;font-weight:bold">ملف لجنة التحصيل الدراسي – متوسطة خيبر الجنوب</div>
<div style="margin-top:26px;background:#0f3d3c;color:#fff;border-radius:18px;padding:18px 30px;font-size:40px;font-weight:bold;line-height:1.35">${title}</div>
<div style="margin-top:26px;width:520px;height:520px">${svg(url)}</div>
<div style="font-size:22px;color:#333;margin-top:12px">امسحي الرمز للدخول إلى القسم مباشرة</div>
<div style="font-size:18px;color:#A0623A;margin-top:8px">${note}</div>
<div dir="ltr" style="font-size:14px;color:#777;margin-top:auto;font-family:'DejaVu Sans Mono'">${url}</div></div></body></html>`;
await p.setContent(html);await p.waitForTimeout(150);const f=`${out}/${String(i+1).padStart(2,'0')}-${key}.png`;await p.screenshot({path:f,clip:{x:0,y:0,width:800,height:1060}});console.log(f);}
await b.close();})();
