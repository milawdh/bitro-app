'use client';
import Link from 'next/link';
import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from '@/lib/course-commerce';
import {CourseAccess} from './course-access';
export function InvoiceResult({invoiceId}:{invoiceId:string}){
 const session=useAppStore(s=>s.session),invoice=useCourseCommerce(s=>s.invoices.find(i=>i.id===invoiceId));
 return <main style={{maxWidth:900,margin:'48px auto',padding:24}}><h1>نتیجهٔ پرداخت</h1>{!session?<Link className="btn btn-primary" href="/login">ورود برای مشاهدهٔ فاکتور</Link>:invoice?<><p>مبلغ فاکتور: {invoice.amountRial.toLocaleString('fa-IR')} ریال</p><CourseAccess courseId={invoice.courseId}/></>:<p>فاکتوری با این شناسه در حساب شما پیدا نشد.</p>}<Link className="btn btn-ghost" href="/my-courses">بازگشت به دوره‌های من</Link></main>;
}
