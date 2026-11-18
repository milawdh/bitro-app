'use client';
import {useCourseCommerce} from '@/lib/course-commerce';
export default function InvoicesPage(){
 const state=useCourseCommerce();
 return <main><h1>فاکتورها و حسابرسی پرداخت</h1><p className="muted">دادهٔ نمایشی مطابق وضعیت‌های بک‌اند؛ تماس واقعی با درگاه انجام نمی‌شود.</p><button className="btn btn-primary" onClick={async()=>{await state.enroll('dotnet');await state.checkout('dotnet');}}>ساخت فاکتور نمونه</button>
 {state.invoices.map(i=><section key={i.id} className="panel" style={{padding:24,marginBlock:20}}><h2>{i.id}</h2><p>{i.amountRial.toLocaleString('fa-IR')} ریال · وضعیت مالی: {i.paymentStatus} · فعال‌سازی: {i.fulfillmentStatus}</p>
 <details><summary>نمونهٔ پاسخ استعلام</summary><pre dir="ltr" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify({result:100,status:i.paymentStatus==='paid'?1:i.observedPaymentStatus==='success'?2:-1,amount:i.amountRial,orderId:i.id},null,2)}</pre></details>
 <button className="btn btn-ghost" onClick={()=>state.observePayment(i.courseId)}>ثبت نتیجهٔ نمایشی استعلام</button><button className="btn btn-ghost" onClick={()=>state.processPayment(i.courseId)}>اجرای نمایشی ورکر</button>
 </section>)}
 </main>;
}
