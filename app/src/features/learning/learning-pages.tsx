'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, Clock3, Code2, Compass, Layers3, Play, Search, Server, Sparkles, Target, Zap } from 'lucide-react';
import { courseProvider, faNumber, type Course } from '@/lib/courses';
import { useAppStore } from '@/stores/use-app-store';
import './learning.css';

const courseIcons = { code: Code2, server: Server, layers: Layers3 };

export function CourseMark({ course, small = false }: { course: Course; small?: boolean }) {
  const Icon = courseIcons[course.icon as keyof typeof courseIcons] ?? Code2;
  return <span className={`lp-course-mark lp-${course.color} ${small ? 'lp-mark-small' : ''}`}><Icon size={small ? 22 : 32} strokeWidth={1.6} /></span>;
}

export function LearningPaths() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const completed = useAppStore((s) => s.completedLessons);
  const courses = courseProvider.list();
  const visible = courses.filter((c) => (filter === 'all' || c.slug === filter) && `${c.title} ${c.subtitle} ${c.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="lp-page">
    <div className="page-header"><div><span className="eyebrow">یک مسیر روشن، یک شروع تازه</span><h1>مسیرهای یادگیری</h1><p className="muted">از فهمیدن یک مفهوم تا ساختن یک محصول؛ قدم‌به‌قدم کنار تو هستیم.</p></div><span className="badge"><Compass size={15} /> {faNumber(courses.length)} مسیر تخصصی</span></div>
    <div className="lp-learning-banner panel"><div className="lp-banner-orbit"><Code2 size={36} /><span /><span /></div><div><span className="eyebrow">یاد بگیر. تجربه کن. بساز.</span><h2>مسیرت را پیدا کن؛ با سرعت خودت پیش برو.</h2><p className="muted">هر درس، یک تجربهٔ تعاملی است. پیشرفتت هم در همین مرورگر ذخیره می‌شود.</p></div><Link className="btn btn-primary" href="/learn/csharp/variables">از اولین متغیر شروع کن <ArrowLeft size={17} /></Link></div>
    <div className="lp-toolbar"><div className="lp-filters" role="group" aria-label="فیلتر مسیرها">{[['all', 'همهٔ مسیرها'], ['csharp', 'مبانی برنامه‌نویسی'], ['dotnet', 'توسعهٔ بک‌اند'], ['architecture', 'معماری نرم‌افزار']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="lp-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی مسیر…" aria-label="جست‌وجوی مسیر یادگیری" /></label></div>
    <div className="lp-course-grid">{visible.map((course) => {
      const done = course.lessons.filter((l) => completed.includes(`${course.slug}/${l.slug}`)).length;
      const progress = course.lessons.length ? Math.round(done / course.lessons.length * 100) : 0;
      return <Link href={`/learn/${course.slug}`} key={course.slug} className={`panel lp-course-card lp-${course.color}`}><div className="lp-course-top"><CourseMark course={course} /><span className="badge">{course.tag}</span></div><span className="lp-english" dir="ltr">{course.subtitle}</span><h2>{course.title}</h2><p className="muted">{course.description}</p><div className="lp-course-meta"><span><Layers3 size={15} />{faNumber(course.modules.length)} فصل</span><span><BookOpen size={15} />{faNumber(course.lessons.length)} درس تعاملی</span></div><div className="lp-progress-label"><span>{done ? 'یادگیری در جریان است' : 'آمادهٔ کشف یک دنیای جدید؟'}</span><strong>{faNumber(progress)}٪</strong></div><div className="lp-progress-track"><span style={{width: `${progress}%`}} /></div><div className="lp-card-bottom"><span>{course.lessons.length ? done ? 'ادامهٔ مسیر' : 'کشف مسیر' : 'مشاهدهٔ نقشهٔ راه'}</span><ArrowLeft size={19} /></div></Link>;
    })}</div>
    {visible.length === 0 && <div className="panel lp-empty"><Search size={30} /><h2>مسیری با این عبارت پیدا نشد</h2><p className="muted">یک عبارت دیگر را امتحان کن یا همهٔ مسیرها را ببین.</p><button className="btn btn-ghost" onClick={() => { setSearch(''); setFilter('all'); }}>نمایش همهٔ مسیرها</button></div>}
    <div className="lp-bottom-note"><Sparkles size={18} /><span>بهترین مسیر، مسیری است که همین امروز شروعش کنی.</span><Link href="/concept-labs">اول یک مفهوم را امتحان کن <ArrowLeft size={15} /></Link></div>
  </div>;
}

export function CourseDetail({ slug }: { slug: string }) {
  const course = courseProvider.get(slug);
  const completed = useAppStore((s) => s.completedLessons);
  const [openModule, setOpenModule] = useState<number | null>(0);
  if (!course) return <div className="lp-empty panel"><Compass size={35} /><h1>این مسیر پیدا نشد</h1><Link href="/learn" className="btn btn-primary">بازگشت به مسیرها</Link></div>;
  const done = course.lessons.filter((l) => completed.includes(`${course.slug}/${l.slug}`)).length;
  const next = course.lessons.find((l) => !completed.includes(`${course.slug}/${l.slug}`)) ?? course.lessons[0];
  const duration = course.lessons.reduce((sum, l) => sum + l.duration, 0);
  return <div className={`lp-page lp-${course.color}`}>
    <Link href="/learn" className="lp-back"><ArrowLeft size={16} /> همهٔ مسیرهای یادگیری</Link>
    <div className="lp-course-detail-hero panel"><div><span className="eyebrow">{course.tag} · مسیر یادگیری بیترو</span><h1>{course.title}</h1><p className="muted">{course.description}</p><div className="lp-course-meta"><span><Layers3 size={16} /> {faNumber(course.modules.length)} فصل</span><span><BookOpen size={16} /> {faNumber(course.lessons.length)} درس آماده</span><span><Clock3 size={16} /> {faNumber(duration)} دقیقه تجربهٔ تعاملی</span></div>{next ? <Link href={`/learn/${slug}/${next.slug}`} className="btn btn-primary"><Play size={17} fill="currentColor" /> {done ? 'ادامهٔ یادگیری' : 'شروع یادگیری'} <ArrowLeft size={17} /></Link> : <Link href="/concept-labs/di" className="btn btn-primary">مفهوم معماری را تجربه کن <ArrowLeft size={17} /></Link>}</div><div className="lp-detail-art"><CourseMark course={course} /><span dir="ltr">{course.subtitle}</span><div className="lp-detail-dots"><i /><i /><i /><i /><i /></div></div></div>
    <div className="lp-detail-layout"><section><div className="lp-section-heading"><h2>درس‌های تعاملی</h2><span className="muted">{faNumber(done)} از {faNumber(course.lessons.length)} درس کامل شده</span></div>{course.lessons.length > 0 ? <div className="lp-lesson-list">{course.lessons.map((lesson, i) => {
      const isDone = completed.includes(`${slug}/${lesson.slug}`);
      return <Link href={`/learn/${slug}/${lesson.slug}`} key={lesson.slug} className="panel lp-lesson-row"><span className={`lp-lesson-number ${isDone ? 'done' : ''}`}>{isDone ? <Check size={19} /> : faNumber(i + 1).padStart(2, '۰')}</span><div><h3>{lesson.title}</h3><p className="muted">{lesson.description}</p></div><span className="lp-lesson-time"><Clock3 size={14} /> {faNumber(lesson.duration)} دقیقه</span><ArrowLeft size={18} /></Link>;
    })}</div> : <div className="panel lp-empty"><Layers3 size={35} /><h3>نقشهٔ راه معماری، از مفهوم تا سیستم</h3><p className="muted">در این نسخه، نقشهٔ کامل فصل‌ها در دسترس است. برای شروع، تزریق وابستگی و هم‌زمانی را در آزمایشگاه تجربه کن.</p><Link className="btn btn-primary" href="/concept-labs">ورود به آزمایشگاه <ArrowLeft size={16} /></Link></div>}
    <div className="lp-section-heading lp-spaced"><h2>نقشهٔ کامل مسیر</h2><span className="badge">{faNumber(course.modules.length)} فصل</span></div><div className="panel lp-module-list">{course.modules.map((module, i) => <div className="lp-module" key={module}><button aria-expanded={openModule === i} onClick={() => setOpenModule(openModule === i ? null : i)}><span><small>{faNumber(i + 1).padStart(2, '۰')}</small>{module}</span><ChevronDown size={16} style={{transform: openModule === i ? 'rotate(180deg)' : undefined}} /></button>{openModule === i && <div className="lp-module-body"><p>در این فصل، مفهوم «{module}» را با مثال‌های کوتاه، مشاهدهٔ رفتار برنامه و تمرین گام‌به‌گام یاد می‌گیری.</p><span className="muted">{course.lessons.length ? 'درس‌های آمادهٔ این نسخه در فهرست بالا مشخص شده‌اند؛ همهٔ فصل‌ها هنوز محتوای تعاملی ندارند.' : 'این فصل بخشی از نقشهٔ توسعهٔ محتواست؛ در نسخهٔ فعلی، آزمایشگاه مفاهیم مرتبط را تجربه کن.'}</span></div>}</div>)}</div></section>
    <aside className="lp-course-aside panel"><span className="lp-aside-icon"><Target size={26} /></span><h3>این مسیر برای توست اگر…</h3><p className="muted">{slug === 'csharp' ? 'می‌خواهی برنامه‌نویسی را اصولی شروع کنی و به‌جای حفظ‌کردن کد، منطقش را بفهمی.' : slug === 'dotnet' ? 'با مبانی برنامه‌نویسی آشنایی داری و می‌خواهی پشت صحنهٔ سرویس‌های وب را بسازی.' : 'کد می‌نویسی و حالا می‌خواهی تصمیم‌های بهتری دربارهٔ طراحی سیستم بگیری.'}</p><hr /><h3>روش یادگیری ما</h3>{['اول مفهوم را ببین', 'با کنترل‌ها تجربه کن', 'کد را قدم‌به‌قدم دنبال کن', 'دانشت را با تمرین محک بزن'].map((text, i) => <p className="lp-method-step" key={text}><span>{faNumber(i + 1)}</span>{text}</p>)}<div className="lp-aside-tip"><Zap size={17} /><span>روزی چند دقیقه تمرین پیوسته، از یک ماراتن پراکنده بهتر است.</span></div></aside></div>
  </div>;
}
