'use client';
import {AnimationEditor} from '@/components/animation-editor';
import Image from 'next/image';
import type {AdminCourse} from '@/lib/types';
export function CourseCommerceFields({course,onChange}:{course:AdminCourse;onChange:(patch:Partial<AdminCourse>)=>void}){
 return <><section className="panel" style={{padding:24,display:'grid',gap:16}}><h2>ارائهٔ دوره و رسانه</h2>
 <label>نوع دوره<select value={course.commerceType??'free'} onChange={e=>onChange({commerceType:e.target.value as AdminCourse['commerceType']})}><option value="free">کاملاً رایگان</option><option value="mixed">رایگان + ادامه در اسپات‌پلیر</option><option value="paid">کاملاً پولی در اسپات‌پلیر</option></select></label>
 {course.commerceType&&course.commerceType!=='free'&&<><label>قیمت بخش پولی به ریال<input type="number" min="1000" value={course.priceRial??1000} onChange={e=>onChange({priceRial:Number(e.target.value)})}/></label><label>شناسهٔ دورهٔ اسپات‌پلیر<input dir="ltr" value={course.spotPlayerCourseId??''} onChange={e=>onChange({spotPlayerCourseId:e.target.value})}/></label></>}
 <label>نمایهٔ آماده<select value={course.cover?.presetKey??'code'} onChange={e=>onChange({cover:{kind:'preset',presetKey:e.target.value,fileId:null}})}><option value="code">کدنویسی</option><option value="server">بک‌اند</option><option value="layers">معماری</option></select></label>
 <label>نوع کاور<select value={course.cover?.kind??'preset'} onChange={e=>onChange({cover:{kind:e.target.value as 'preset'|'image',presetKey:course.cover?.presetKey??'code',fileId:e.target.value==='image'?'demo-cover':null}})}><option value="preset">نمایهٔ آماده</option><option value="image">تصویر</option></select></label>
 {course.cover?.kind==='image'&&<><label>شناسهٔ تصویر آماده<input value={course.cover.fileId??''} onChange={e=>onChange({cover:{...course.cover!,fileId:e.target.value}})}/></label><Image src="/media/course-cover.png" alt="نمونهٔ کاور تصویری" width={320} height={180}/></>}
 <label>شناسهٔ ویدئوی معرفی اختیاری<input dir="ltr" value={course.introVideoId??''} onChange={e=>onChange({introVideoId:e.target.value})}/></label>
 <p className="muted">ویدئوی معرفی عمومی است؛ استفاده از درس‌ها نیاز به ورود و افزودن دوره دارد.</p>
 </section><AnimationEditor bindings={course.animations??[]} onChange={animations=>onChange({animations})}/></>;
}
