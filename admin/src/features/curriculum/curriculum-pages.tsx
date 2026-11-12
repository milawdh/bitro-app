'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, BookOpen, CheckCheck, Clock3, FileText, Layers3, Plus, Sparkles } from 'lucide-react';
import { useAdminStore } from '@/stores/admin-store';
import { ConfirmDialog, DataTable, PageHeader, StatusBadge } from '@/components/ui';
import type { AdminCourse, AdminLesson } from '@/lib/types';
import { faNumber, formatDate } from '@/lib/utils';
import './curriculum.css';

const levelLabels = {beginner:'مقدماتی',intermediate:'متوسط',advanced:'پیشرفته'};

export function CoursesPage() {
  const courses=useAdminStore(s=>s.courses),lessons=useAdminStore(s=>s.lessons),setStatus=useAdminStore(s=>s.setStatus),notify=useAdminStore(s=>s.notify);
  const [archiveIds,setArchiveIds]=useState<string[]>([]);
  const archive=()=>{const result=setStatus('courses',archiveIds,'archived');notify(result.ok?'دوره‌های انتخاب‌شده بایگانی شدند.':result.error??'بایگانی انجام نشد.',result.ok?'success':'error');setArchiveIds([]);};
  return <div className="cm-page"><PageHeader eyebrow="از ایده تا مسیر یادگیری" title="مدیریت دوره‌ها" description="مسیرهایی بساز که یادگیری را به یک تجربهٔ روشن و پیوسته تبدیل می‌کنند." action={<Link href="/courses/new" className="btn btn-primary"><Plus size={17}/> دورهٔ جدید</Link>}/>
    <div className="cm-stat-row"><div className="panel cm-stat"><span className="cm-stat-icon"><Layers3 size={21}/></span><div><strong>{faNumber(courses.length)}</strong><span>مسیر یادگیری</span></div><small>یک نقشه برای هر هدف</small></div><div className="panel cm-stat"><span className="cm-stat-icon green"><CheckCheck size={21}/></span><div><strong>{faNumber(courses.filter(c=>c.status==='published').length)}</strong><span>دورهٔ منتشرشده در پیش‌نمایش</span></div></div><div className="panel cm-stat"><span className="cm-stat-icon cyan"><BookOpen size={21}/></span><div><strong>{faNumber(lessons.length)}</strong><span>درس برای کشف کردن</span></div><Link href="/lessons">مدیریت درس‌ها <ArrowLeft size={13}/></Link></div></div>
    <DataTable<AdminCourse> rows={courses} search={row=>`${row.title} ${row.subtitle} ${row.slug}`} status={row=>row.status} onBulkAction={setArchiveIds} bulkActionLabel="بایگانی دوره‌ها" searchPlaceholder="جست‌وجوی نام دوره یا شناسه…" emptyTitle="هنوز مسیری ساخته نشده" columns={[
      {key:'title',label:'مسیر یادگیری',sortValue:row=>row.title,render:row=><Link className="cm-title-cell" href={`/courses/${row.id}`}><span className={`cm-content-icon ${row.color}`}><Layers3 size={20}/></span><span><strong>{row.title}</strong><small dir="ltr">{row.subtitle||row.slug}</small></span></Link>},
      {key:'level',label:'سطح',sortValue:row=>row.level,render:row=><span className="cm-level">{levelLabels[row.level]}</span>},
      {key:'modules',label:'محتوا',sortValue:row=>row.modules.length,render:row=><span className="cm-count-cell">{faNumber(row.modules.length)} فصل <i/> {faNumber(lessons.filter(l=>l.courseId===row.id).length)} درس</span>},
      {key:'status',label:'وضعیت',sortValue:row=>row.status,render:row=><StatusBadge status={row.status}/>},
      {key:'updatedAt',label:'آخرین ویرایش',sortValue:row=>row.updatedAt,render:row=><span className="muted cm-date">{formatDate(row.updatedAt)}</span>},
      {key:'action',label:'',render:row=><Link className="cm-row-action" href={`/courses/${row.id}`}>مدیریت دوره <ArrowLeft size={14}/></Link>},
    ]}/>
    <div className="cm-local-note"><Sparkles size={15}/><p>تغییرات این بخش فقط در پنل نمایشی ذخیره می‌شوند و محتوای اپ یادگیری را تغییر نمی‌دهند.</p></div>
    <ConfirmDialog open={archiveIds.length>0} onOpenChange={open=>{if(!open)setArchiveIds([]);}} title="این دوره‌ها بایگانی شوند؟" description="دوره‌ها و درس‌های وابسته حذف نمی‌شوند؛ می‌توانی بعداً دوباره وضعیت دوره را تغییر بدهی." onConfirm={archive} confirmLabel="بایگانی دوره‌ها" danger/>
  </div>;
}

export function LessonsPage() {
  const lessons=useAdminStore(s=>s.lessons),courses=useAdminStore(s=>s.courses),setStatus=useAdminStore(s=>s.setStatus),notify=useAdminStore(s=>s.notify);
  const [courseFilter,setCourseFilter]=useState('all'),[archiveIds,setArchiveIds]=useState<string[]>([]);
  const rows=lessons.filter(l=>courseFilter==='all'||l.courseId===courseFilter);
  const archive=()=>{const result=setStatus('lessons',archiveIds,'archived');notify(result.ok?'درس‌های انتخاب‌شده بایگانی شدند.':result.error??'بایگانی انجام نشد.',result.ok?'success':'error');setArchiveIds([]);};
  return <div className="cm-page"><PageHeader eyebrow="مفهوم‌های بزرگ، قدم‌های کوچک" title="مدیریت درس‌ها" description="محتوای آموزشی، کد نمونه و سنجش یادگیری را در یک جا بساز و مرور کن." action={<Link href="/lessons/new" className="btn btn-primary"><Plus size={17}/> درس جدید</Link>}/>
    <div className="panel cm-lessons-banner"><span className="cm-banner-icon"><FileText size={29}/></span><div><span className="eyebrow">هر درس، یک تجربهٔ کامل</span><h2>آموزش، آزمایش و تمرین؛ در یک مسیر پیوسته.</h2><p className="muted">پیش‌نمایش زندهٔ محتوای درس، قبل از انتشار در فضای نمایشی.</p></div><div className="cm-banner-total"><strong>{faNumber(lessons.reduce((sum,l)=>sum+l.duration,0))}</strong><span>دقیقه محتوای آموزشی</span></div></div>
    <div className="cm-course-filter"><label htmlFor="cm-course-filter">نمایش درس‌های</label><select id="cm-course-filter" value={courseFilter} onChange={e=>setCourseFilter(e.target.value)}><option value="all">همهٔ دوره‌ها</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><span className="muted">{faNumber(rows.length)} درس</span></div>
    <DataTable<AdminLesson> rows={rows} search={row=>`${row.title} ${row.slug} ${row.description}`} status={row=>row.status} onBulkAction={setArchiveIds} bulkActionLabel="بایگانی درس‌ها" searchPlaceholder="جست‌وجوی درس…" emptyTitle="این فصل از یادگیری هنوز نوشته نشده" columns={[
      {key:'title',label:'درس',sortValue:row=>row.title,render:row=><Link className="cm-title-cell" href={`/lessons/${row.id}`}><span className="cm-content-icon"><BookOpen size={19}/></span><span><strong>{row.title}</strong><small>{row.description||row.slug}</small></span></Link>},
      {key:'course',label:'دوره و فصل',sortValue:row=>courses.find(c=>c.id===row.courseId)?.title??'',render:row=>{const course=courses.find(c=>c.id===row.courseId);return <div className="cm-course-cell"><span>{course?.title??'دورهٔ نامشخص'}</span><small>{course?.modules.find(m=>m.id===row.moduleId)?.title??'فصل انتخاب نشده'}</small></div>;}},
      {key:'duration',label:'زمان',sortValue:row=>row.duration,render:row=><span className="cm-duration"><Clock3 size={13}/>{faNumber(row.duration)} دقیقه</span>},
      {key:'status',label:'وضعیت',sortValue:row=>row.status,render:row=><StatusBadge status={row.status}/>},
      {key:'updatedAt',label:'آخرین ویرایش',sortValue:row=>row.updatedAt,render:row=><span className="muted cm-date">{formatDate(row.updatedAt)}</span>},
      {key:'action',label:'',render:row=><Link className="cm-row-action" href={`/lessons/${row.id}`}>ویرایش <ArrowLeft size={14}/></Link>},
    ]}/>
    <ConfirmDialog open={archiveIds.length>0} onOpenChange={open=>{if(!open)setArchiveIds([]);}} title="درس‌های انتخاب‌شده بایگانی شوند؟" description="محتوای درس‌ها حفظ می‌شود و بازگرداندن آن‌ها از ویرایشگر ممکن است." onConfirm={archive} confirmLabel="بایگانی درس‌ها" danger/>
  </div>;
}
