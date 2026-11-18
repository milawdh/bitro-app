'use client';
import Link from 'next/link';
import { useMemo,useState } from 'react';
import { commerceCourses,useCourseCommerce } from '@/lib/course-commerce';
import { useAppStore } from '@/stores/use-app-store';
import {RenewableVideo} from '@/features/media/renewable-video';
import {demoPlaybackLoader} from '@/lib/demo-playback';

export function CourseAccess({courseId}:{courseId:string}) {
  const state=useCourseCommerce(),session=useAppStore(s=>s.session);
  const [error,setError]=useState('');
  const introPlayback=useMemo(()=>demoPlaybackLoader(courseId,true),[courseId]);
  const course=commerceCourses.find(c=>c.id===courseId);
  if(!course)return null;
  const membership=state.memberships.find(m=>m.courseId===courseId),invoice=state.invoices.find(i=>i.courseId===courseId);
  const run=(action:()=>Promise<void>)=>{setError('');action().catch(e=>setError(e.message));};
  return <section className="panel" style={{padding:24,marginBlock:20}} aria-label="عضویت و لایسنس دوره">
    <span className="badge">{{free:'دورهٔ رایگان',mixed:'بخش رایگان + ادامه در اسپات‌پلیر',paid:'ارائه در اسپات‌پلیر'}[course.commerceType]}</span>
    {course.introVideoId&&<figure style={{maxWidth:640}}><RenewableVideo mediaKey={'intro:'+courseId} requestPlayback={introPlayback} label="ویدئوی معرفی دوره"/><figcaption>ویدئوی نمونهٔ معرفی؛ مشاهدهٔ معرفی نیاز به عضویت ندارد.</figcaption></figure>}
    <h2>دوره‌های من</h2>
    {!session?<Link className="btn btn-primary" href="/login">ورود و افزودن دوره</Link>:!membership?<button className="btn btn-primary" onClick={()=>run(()=>state.enroll(courseId))}>افزودن به دوره‌های من</button>:<p>دوره اضافه شده است. {course.commerceType!=='paid'?'درس‌های داخل سایت در دسترس شما هستند.':''}</p>}
    {membership&&courseId==='csharp'&&<Link className="btn btn-ghost" href="/learn/csharp/video-overview">درس ویدئویی نمونه بدون آزمون</Link>}
    {membership&&course.commerceType!=='free'&&<>
      {!membership.paidAccess&&!invoice&&<button className="btn btn-primary" onClick={()=>run(()=>state.checkout(courseId))}>خرید بخش اسپات‌پلیر · {course.priceRial.toLocaleString('fa-IR')} ریال</button>}
      {invoice&&<p role="status">{invoice.paymentStatus==='paid'?'پرداخت تأیید شده است.':invoice.observedPaymentStatus==='success'?'پرداخت انجام شده؛ فعال‌سازی در انتظار پردازش است.':'فاکتور پرداخت نشده است.'}</p>}
      {membership.paidAccess&&<p role="status">{{locked:'لایسنس قفل است',pending:'بخش پولی فعال است؛ لایسنس در حال صدور است.',ready:'لایسنس آماده است.',needsReconciliation:'صدور نیازمند پیگیری پشتیبانی است.'}[membership.licenseStatus]}</p>}
      {membership.licenseKey&&<><p>کلید لایسنس</p><code dir="ltr" style={{overflowWrap:'anywhere'}}>{membership.licenseKey}</code><button className="btn btn-ghost" onClick={()=>run(()=>navigator.clipboard.writeText(membership.licenseKey!))}>کپی لایسنس</button></>}
      <details style={{marginTop:20}}><summary>سناریوی نمایشی پرداخت</summary><p>این کنترل‌ها فقط دادهٔ محلی را تغییر می‌دهند.</p>
        {invoice?.observedPaymentStatus==='unpaid'&&<button className="btn btn-ghost" onClick={()=>run(()=>state.observePayment(courseId))}>شبیه‌سازی پرداخت و استعلام</button>}
        {invoice?.observedPaymentStatus==='success'&&invoice.paymentStatus==='pending'&&<button className="btn btn-ghost" onClick={()=>run(()=>state.processPayment(courseId))}>اجرای نوبت ورکر</button>}
        {membership.licenseStatus==='pending'&&<><button className="btn btn-ghost" onClick={()=>run(()=>state.finishLicense(courseId))}>تکمیل صدور لایسنس</button><button className="btn btn-ghost" onClick={()=>run(()=>state.finishLicense(courseId,true))}>پاسخ نامعلوم اسپات‌پلیر</button></>}
      </details>
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
