'use client';
import {useState} from 'react';
export default function MediaPage(){
 const [file,setFile]=useState<File|null>(null),[parts,setParts]=useState(0),[status,setStatus]=useState<'idle'|'uploading'|'paused'|'validating'|'ready'|'failed'>('idle');
 const partBytes=file?Math.max(16*1024*1024,Math.ceil(file.size/9999)):16*1024*1024;
 const count=file?Math.ceil(file.size/partBytes):0;
 const progress=count?Math.min(100,parts/count*100):0;
 return <main><h1>رسانهٔ دوره</h1><p className="muted">پیش‌نمایش محلی قرارداد آپلود؛ فایلی به سرور ارسال نمی‌شود.</p><section className="panel" style={{padding:24,display:'grid',gap:16,maxWidth:760}}>
 <h2>ویدئو با آپلود قابل ادامه</h2><p>برای حجم کل ویدئو سقف برنامه‌ای وجود ندارد. قالب پخش این نسخه، ویدئوی آمادهٔ وب است.</p>
 <input aria-label="انتخاب ویدئو" type="file" accept="video/mp4" onChange={e=>{setFile(e.target.files?.[0]??null);setParts(0);setStatus('idle');}}/>
 {file&&<><p dir="ltr">{file.name} · {file.size.toLocaleString()} bytes · {count} parts</p><progress aria-label="پیشرفت آپلود" value={progress} max={100}/><p role="status">{({idle:'آمادهٔ شروع',uploading:'در حال آپلود',paused:'متوقف؛ قابل ادامه',validating:'در حال اعتبارسنجی',ready:'آمادهٔ اتصال به درس یا معرفی',failed:'فایل نامعتبر'})[status]}</p>
 {status==='idle'&&<button className="btn btn-primary" onClick={()=>setStatus('uploading')}>شروع آپلود نمایشی</button>}
 {status==='uploading'&&<><button className="btn btn-primary" onClick={()=>{setParts(p=>p+1);if(parts+1>=count)setStatus('validating');}}>تکمیل قطعهٔ بعدی</button><button className="btn btn-ghost" onClick={()=>setStatus('paused')}>قطع اتصال نمایشی</button><button className="btn btn-ghost" onClick={()=>{setParts(count);setStatus('validating');}}>تکمیل همهٔ قطعات</button></>}
 {status==='paused'&&<button className="btn btn-primary" onClick={()=>setStatus('uploading')}>از سرگیری از قطعهٔ باقی‌مانده</button>}
 {status==='validating'&&<><button className="btn btn-primary" onClick={()=>setStatus('ready')}>سناریوی اعتبارسنجی موفق</button><button className="btn btn-ghost" onClick={()=>setStatus('failed')}>سناریوی فایل نامعتبر</button></>}
 </>}
 </section></main>;
}
