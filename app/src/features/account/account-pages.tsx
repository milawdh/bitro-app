'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Award, BookOpen, Check, CheckCheck, Code2, Flag, Info, Moon, Settings2, ShieldCheck, Sparkles, Sun, Target, Trash2, Trophy, UserRound, X, Zap } from 'lucide-react';
import { courseProvider, faNumber } from '@/lib/courses';
import { useAppStore } from '@/stores/use-app-store';
import { CourseMark } from '@/features/learning/learning-pages';
import '@/features/learning/learning.css';

const allLessons = courseProvider.list().flatMap((c) => c.lessons.map((l) => ({...l, id: `${c.slug}/${l.slug}`, course: c.title})));

function ProgressStats() {
  const completedLessons = useAppStore((s) => s.completedLessons);
  const completedChallenges = useAppStore((s) => s.completedChallenges);
  const lessons = allLessons.filter((l) => completedLessons.includes(l.id));
  const minutes = lessons.reduce((n, l) => n + l.duration, 0);
  return <div className="lp-stats-grid"><div className="panel lp-stat-card"><BookOpen size={25} /><div><strong>{faNumber(lessons.length)}</strong><span>درس به پایان رسیده</span></div></div><div className="panel lp-stat-card"><Trophy size={25} /><div><strong>{faNumber(completedChallenges.length)}</strong><span>چالش حل‌شده</span></div></div><div className="panel lp-stat-card"><Zap size={25} /><div><strong>{faNumber(minutes)}</strong><span>دقیقه محتوای تکمیل‌شده</span></div></div></div>;
}

function Achievements() {
  const completedLessons = useAppStore((s) => s.completedLessons);
  const completedChallenges = useAppStore((s) => s.completedChallenges);
  const achievements = [
    {title: 'اولین قدم', text: 'اولین درس تعاملی‌ات را کامل کن.', done: completedLessons.length > 0, icon: Flag},
    {title: 'حل‌کنندهٔ مسئله', text: 'یک چالش را با موفقیت پشت سر بگذار.', done: completedChallenges.length > 0, icon: Code2},
    {title: 'ذهن کنجکاو', text: 'سه درس متفاوت را به پایان برسان.', done: completedLessons.length >= 3, icon: Sparkles},
    {title: 'در مسیر تسلط', text: 'همهٔ درس‌های آمادهٔ سی‌شارپ را کامل کن.', done: courseProvider.get('csharp')!.lessons.every((l) => completedLessons.includes(`csharp/${l.slug}`)), icon: Award},
  ];
  return <div className="panel">{achievements.map(({title, text, done, icon: Icon}) => <div className={`lp-achievement ${done ? '' : 'locked'}`} key={title}><span><Icon size={22} /></span><div><h3>{title}</h3><p>{text}</p></div>{done && <Check size={18} aria-label="کسب شده" />}</div>)}</div>;
}

export function ProgressPage() {
  const completed = useAppStore((s) => s.completedLessons);
  const challenges = useAppStore((s) => s.completedChallenges);
  const courses = courseProvider.list();
  const finished = allLessons.filter((l) => completed.includes(l.id));
  return <div className="lp-page"><div className="page-header"><div><span className="eyebrow">هر قدم کوچک، یک تغییر بزرگ</span><h1>داستان پیشرفت تو</h1><p className="muted">چیزهایی که یاد گرفتی، مهارت‌هایی که ساختی و قدم بعدی‌ات.</p></div><span className="badge"><Target size={15} /> مسیر خودت را بساز</span></div><ProgressStats />
  <div className="lp-account-grid"><section><div className="lp-section-heading"><h2>پیشرفت در مسیرها</h2><Link href="/learn">مشاهدهٔ مسیرها</Link></div>{courses.map((course) => {
    const done = course.lessons.filter((l) => completed.includes(`${course.slug}/${l.slug}`)).length;
    const percent = course.lessons.length ? Math.round(done / course.lessons.length * 100) : 0;
    return <div key={course.slug} className={`panel lp-progress-course lp-${course.color}`}><CourseMark course={course} small /><div><h3>{course.title}</h3><p className="muted">{course.lessons.length ? `${faNumber(done)} از ${faNumber(course.lessons.length)} درس آماده` : 'نقشهٔ راه فصل‌ها را کشف کن'}</p><div className="lp-progress-label"><span>{done === course.lessons.length && done ? 'مسیر آمادهٔ فعلی کامل شده' : done ? 'به حرکت ادامه بده' : 'شروع یک ماجراجویی تازه'}</span><strong>{faNumber(percent)}٪</strong></div><div className="lp-progress-track"><span style={{width: `${percent}%`}} /></div></div><Link className="btn btn-ghost" href={`/learn/${course.slug}`}><ArrowLeft size={17} /><span className="sr-only">مشاهدهٔ مسیر {course.title}</span></Link></div>;
  })}<div className="lp-section-heading lp-spaced"><h2>درس‌های تکمیل‌شده</h2><span className="muted">ثبت‌شده در این مرورگر</span></div>{finished.length ? <div className="panel lp-timeline">{finished.map((lesson) => <div key={lesson.id} className="lp-timeline-item"><span><Check size={16} /></span><div><h3>{lesson.title}</h3><p>{lesson.course} · {faNumber(lesson.duration)} دقیقه</p><Link className="lp-muted-small" href={`/learn/${lesson.id}`}>مرور دوبارهٔ درس</Link></div></div>)}</div> : <div className="panel lp-empty"><BookOpen size={30} /><h3>اینجا، قدم‌های تو ثبت می‌شوند</h3><p className="muted">اولین درس را کامل کن تا داستان یادگیری‌ات از همین‌جا شروع شود.</p><Link className="btn btn-primary" href="/learn/csharp/variables">شروع اولین درس <ArrowLeft size={16} /></Link></div>}</section><aside><div className="lp-section-heading"><h2>نشان‌های یادگیری</h2><span className="muted">{faNumber(Number(completed.length > 0) + Number(challenges.length > 0) + Number(completed.length >= 3) + Number(courses[0].lessons.every((l) => completed.includes(`csharp/${l.slug}`))))} از ۴</span></div><Achievements /><div className="lp-demo-note lp-spaced"><ShieldCheck size={19} /><span>آمار این صفحه از درس‌ها و چالش‌هایی محاسبه می‌شود که خودت کامل کرده‌ای. اطلاعات فقط در همین مرورگر ذخیره می‌شوند.</span></div></aside></div></div>;
}

export function ProfilePage() {
  const name = useAppStore((s) => s.name);
  const email = useAppStore((s) => s.email);
  const experience = useAppStore((s) => s.experience);
  const goal = useAppStore((s) => s.dailyGoal);
  const session = useAppStore((s) => s.session);
  return <div className="lp-page"><div className="page-header"><div><span className="eyebrow">یک یادگیرندهٔ همیشگی</span><h1>پروفایل من</h1><p className="muted">این گوشه از بیترو، مخصوص توست.</p></div></div><div className="panel lp-profile-hero"><div className="lp-avatar" aria-hidden="true">{name.charAt(0)}</div><div><span className="badge"><UserRound size={13} /> {session ? 'حساب نمایشی محلی' : 'پروفایل پیش‌نمایش'}</span><h1>{name}</h1><p className="muted">اینجا هستم تا کد را عمیق‌تر بفهمم.</p></div><Link className="btn btn-ghost" href="/settings"><Settings2 size={16} /> ویرایش پروفایل</Link></div><ProgressStats /><div className="lp-account-grid"><section><div className="lp-section-heading"><h2>نشان‌های من</h2><Link href="/progress">مشاهدهٔ پیشرفت <ArrowLeft size={14} /></Link></div><Achievements /><div className="lp-learning-banner panel lp-spaced"><div className="lp-banner-orbit"><BookOpen size={30} /><span /><span /></div><div><span className="eyebrow">بهترین سرمایه‌گذاری، روی خودت است</span><h2>قدم بعدی یادگیری‌ات منتظر توست.</h2><p className="muted">یک درس کوتاه، یک مفهوم تازه، یک قدم رو به جلو.</p></div><Link className="btn btn-primary" href="/learn">ادامهٔ مسیر <ArrowLeft size={16} /></Link></div></section><aside><div className="panel lp-profile-about"><h3>دربارهٔ من</h3><dl><dt>نام نمایشی</dt><dd>{name}</dd><dt>ایمیل نمایشی</dt><dd dir="ltr">{email}</dd><dt>تجربهٔ برنامه‌نویسی</dt><dd>{experience === 'beginner' ? 'در آغاز یک مسیر هیجان‌انگیز' : 'در حال عمیق‌تر کردن مهارت‌ها'}</dd><dt>هدف روزانه</dt><dd>{faNumber(goal)} دقیقه یادگیری</dd></dl></div><div className="lp-demo-note lp-spaced"><Info size={18} /><span>پروفایل در این نسخه نمایشی است و احراز هویت واقعی انجام نمی‌شود. تنظیمات و پیشرفتت در مرورگر خودت می‌مانند.</span></div></aside></div></div>;
}

export function SettingsPage() {
  const name = useAppStore((s) => s.name);
  const theme = useAppStore((s) => s.theme);
  const dailyGoal = useAppStore((s) => s.dailyGoal);
  const setName = useAppStore((s) => s.setName);
  const setTheme = useAppStore((s) => s.setTheme);
  const setDailyGoal = useAppStore((s) => s.setDailyGoal);
  const resetProgress = useAppStore((s) => s.resetProgress);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftGoal, setDraftGoal] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const save = (e: FormEvent) => { e.preventDefault(); const nextName = (draftName ?? name).trim(); if (!nextName) return; setName(nextName); setDailyGoal(draftGoal ?? dailyGoal); setSaved(true); };
  return <div className="lp-page"><div className="page-header"><div><span className="eyebrow">بیترو، به سلیقهٔ تو</span><h1>تنظیمات</h1><p className="muted">فضای یادگیری‌ات را به جایی تبدیل کن که دوست داری در آن بمانی.</p></div><span className="badge"><ShieldCheck size={15} /> ذخیره‌سازی محلی</span></div><div className="lp-account-grid"><form onSubmit={save} className="panel lp-form-panel"><h2>پروفایل و هدف یادگیری</h2><p className="muted">با چه نامی صدایت کنیم و چقدر زمان برای یادگیری کنار گذاشته‌ای؟</p><label className="lp-form-field">نام نمایشی<input required minLength={2} maxLength={40} value={draftName ?? name} onChange={(e) => {setDraftName(e.target.value); setSaved(false);}} placeholder="نام تو" autoComplete="given-name" /><small>این نام در داشبورد و پروفایل نمایش داده می‌شود.</small></label><label className="lp-form-field">هدف روزانه<select value={draftGoal ?? dailyGoal} onChange={(e) => {setDraftGoal(Number(e.target.value)); setSaved(false);}}>{[10, 15, 20, 30, 45, 60].map((n) => <option value={n} key={n}>{faNumber(n)} دقیقه در روز</option>)}</select><small>هدف را با برنامهٔ زندگی‌ات هماهنگ کن؛ پیوستگی مهم‌تر از سرعت است.</small></label><hr className="lp-settings-separator" /><h2>ظاهر برنامه</h2><p className="muted">تمی که چشم‌هایت با آن راحت‌ترند انتخاب کن.</p><div className="lp-setting-options" role="group" aria-label="انتخاب تم"><button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}><Moon size={22} />تاریک{theme === 'dark' && <Check size={15} />}</button><button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}><Sun size={22} />روشن{theme === 'light' && <Check size={15} />}</button></div><hr className="lp-settings-separator" /><button type="submit" className="btn btn-primary"><CheckCheck size={17} /> ذخیرهٔ تغییرات</button>{saved && <p className="lp-success-note" role="status"><Check size={16} /> تغییراتت در این مرورگر ذخیره شد.</p>}</form><aside><div className="panel lp-form-panel"><span className="lp-aside-icon"><Target size={25} /></span><h2>یک قدم کوچک، هر روز</h2><p className="muted">یک هدف واقع‌بینانه انتخاب کن. حتی ده دقیقه تمرین هدفمند، از منتظر ماندن برای زمان مناسب بهتر است.</p><div className="lp-demo-note"><Info size={17} /><span>نسخهٔ فعلی یک پیش‌نمایش فرانت‌اند است. تنظیمات بین دستگاه‌های مختلف همگام نمی‌شوند.</span></div></div><div className="panel lp-form-panel lp-spaced"><h2>شروع دوباره</h2><p className="muted">با بازنشانی، وضعیت تکمیل درس‌ها و چالش‌ها پاک می‌شود. تنظیمات پروفایل و کدهای ذخیره‌شده حفظ می‌شوند.</p><Dialog.Root open={resetOpen} onOpenChange={setResetOpen}><Dialog.Trigger asChild><button className="btn btn-ghost lp-danger-button"><Trash2 size={16} /> بازنشانی پیشرفت</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="lp-modal-backdrop" /><Dialog.Content className="panel lp-confirm-dialog" style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%, -50%)',zIndex:101}} dir="rtl"><Dialog.Title>از اول شروع کنیم؟</Dialog.Title><Dialog.Description>همهٔ درس‌ها و چالش‌های تکمیل‌شده از این مرورگر پاک می‌شوند. این کار قابل بازگشت نیست.</Dialog.Description><div className="lp-dialog-actions"><button className="btn btn-ghost lp-danger-button" onClick={() => {resetProgress();setResetOpen(false);setResetDone(true);}}>پاک‌کردن پیشرفت</button><Dialog.Close asChild><button className="btn btn-ghost"><X size={16} /> انصراف</button></Dialog.Close></div></Dialog.Content></Dialog.Portal></Dialog.Root>{resetDone && <p className="lp-success-note" role="status"><Check size={16} /> آمادهٔ یک شروع تازه‌ای.</p>}</div></aside></div></div>;
}
