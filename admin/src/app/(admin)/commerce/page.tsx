'use client';
import {useState} from 'react';
import {commerceCourses,useCourseCommerce} from '@/lib/course-commerce';
import {useAdminStore} from '@/stores/admin-store';

export default function CommercePage(){
 const state=useCourseCommerce(),[courseId,setCourseId]=useState('dotnet'),[mode,setMode]=useState<'manual'|'api'>('api'),[key,setKey]=useState(''),[error,setError]=useState('');
 const courses=useAdminStore(s=>s.courses);
 const title=(id:string)=>courses.find(c=>c.id===id)?.title??id;
 return <div><h1>فعال‌سازی و لایسنس دوره</h1><p className="muted">سناریوی محلی یک یادگیرنده؛ عملیات به بک‌اند متصل نیست.</p><section className="panel" style={{padding:24,display:'grid',gap:16,maxWidth:700}}>
 <label style={{display:'grid',gap:8}}>دوره<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{commerceCourses.filter(c=>c.commerceType!=='free').map(c=><option key={c.id} value={c.id}>{title(c.id)}</option>)}</select></label>
 <fieldset style={{display:'grid',gap:12}}><legend>روش تأمین لایسنس</legend><label style={{display:'flex',alignItems:'center',gap:8}}><input type="radio" name="mode" checked={mode==='api'} onChange={()=>setMode('api')}/>دریافت خودکار از اسپات‌پلیر</label><label style={{display:'flex',alignItems:'center',gap:8}}><input type="radio" name="mode" checked={mode==='manual'} onChange={()=>setMode('manual')}/>ثبت دستی</label></fieldset>
 {mode==='manual'&&<label style={{display:'grid',gap:8}}>کلید لایسنس<textarea dir="ltr" style={{width:'100%',minHeight:100}} value={key} onChange={e=>setKey(e.target.value)}/></label>}
 <button className="btn btn-primary" onClick={()=>{setError('');state.activate(courseId,mode,key).catch(e=>setError(e.message));}}>اعمال و افزودن به دوره‌های کاربر</button>{error&&<p role="alert">{error}</p>}
 {state.memberships.map(m=><article key={m.courseId}><h3>{title(m.courseId)}</h3><p>عضویت: ثبت شده · بخش پولی: {m.paidAccess?'فعال':'غیرفعال'} · منبع: {m.licenseSource==='manual'?'دستی':'خودکار'} · وضعیت: {{locked:'قفل',pending:'در انتظار صدور',ready:'آماده',needsReconciliation:'نیازمند پیگیری'}[m.licenseStatus]}</p>{m.licenseStatus==='pending'&&<button className="btn btn-ghost" onClick={()=>state.finishLicense(m.courseId)}>تکمیل نمایشی صدور</button>}{m.licenseKey&&<code dir="ltr" style={{overflowWrap:'anywhere'}}>{m.licenseKey}</code>}</article>)}
 </section></div>;
}
