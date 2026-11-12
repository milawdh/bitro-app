'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, Clock3, FilePenLine, GraduationCap, Mail, Save, ShieldCheck, ShieldOff, Trophy, UserRound, UsersRound } from 'lucide-react';
import { ConfirmDialog, DataTable, EmptyState, Field, PageHeader, StatusBadge } from '@/components/ui';
import { useAdminStore } from '@/stores/admin-store';
import type { AdminUser } from '@/lib/types';
import { faNumber, formatDate } from '@/lib/utils';
import './people.css';

const roleLabels: Record<AdminUser['role'], string> = { learner: 'یادگیرنده', editor: 'ویراستار', admin: 'مدیر' };
const personColor = (color: string) => (({ purple: 'var(--primary)', cyan: 'var(--cyan)', amber: 'var(--amber)', green: 'var(--green)' } as Record<string, string>)[color] ?? color);

export function UsersPage() {
  const users = useAdminStore((state) => state.users);
  const updateUser = useAdminStore((state) => state.updateUser);
  const notify = useAdminStore((state) => state.notify);
  const [selected, setSelected] = useState<string[]>([]);
  const active = users.filter((user) => user.status === 'active').length;
  const suspendSelected = () => {
    for (const id of selected) updateUser(id, { status: 'suspended' });
    notify(`${faNumber(selected.length)} کاربر در نسخهٔ محلی تعلیق شد.`); setSelected([]);
  };
  return <div className="people-page"><PageHeader eyebrow="پشت هر پیشرفت، یک ذهن کنجکاوست" title="جامعهٔ یادگیرنده‌ها" description="کاربران نمونه، مسیرهایشان و وضعیت دسترسی در فضای نمایشی." action={<span className="badge"><UsersRound size={15} /> {faNumber(users.length)} کاربر نمونه</span>} />
    <div className="people-stats"><div className="panel"><span className="people-stat-icon"><UsersRound size={21} /></span><div><strong>{faNumber(users.length)}</strong><span>همهٔ کاربران</span></div></div><div className="panel"><span className="people-stat-icon green"><ShieldCheck size={21} /></span><div><strong>{faNumber(active)}</strong><span>حساب فعال</span></div></div><div className="panel"><span className="people-stat-icon amber"><GraduationCap size={21} /></span><div><strong>{faNumber(users.filter((user) => user.role === 'learner').length)}</strong><span>یادگیرندهٔ کنجکاو</span></div></div><div className="panel"><span className="people-stat-icon cyan"><FilePenLine size={21} /></span><div><strong>{faNumber(users.filter((user) => user.role !== 'learner').length)}</strong><span>عضو تیم محتوا</span></div></div></div>
    <DataTable<AdminUser> rows={users} search={(user) => `${user.name} ${user.email} ${roleLabels[user.role]}`} status={(user) => user.status} statusOptions={[{ value: 'active', label: 'فعال' }, { value: 'suspended', label: 'تعلیق‌شده' }]} searchPlaceholder="جست‌وجوی نام، ایمیل یا نقش…" emptyTitle="کاربری با این مشخصات پیدا نشد" onBulkAction={setSelected} bulkActionLabel="تعلیق کاربران" columns={[
      { key: 'name', label: 'یادگیرنده', sortValue: (user) => user.name, render: (user) => <Link className="people-person" href={`/users/${user.id}`}><span className="people-avatar" style={{ '--person-color': personColor(user.avatarColor) } as React.CSSProperties}>{user.name.charAt(0)}</span><span><strong>{user.name}</strong><small dir="ltr">{user.email}</small></span></Link> },
      { key: 'role', label: 'نقش', sortValue: (user) => user.role, render: (user) => <span className="people-role">{roleLabels[user.role]}</span> },
      { key: 'status', label: 'وضعیت', sortValue: (user) => user.status, render: (user) => <StatusBadge status={user.status} /> },
      { key: 'progress', label: 'یادگیری', sortValue: (user) => user.completedLessonIds.length, render: (user) => <span className="people-table-progress"><BookOpen size={13} />{faNumber(user.completedLessonIds.length)} درس</span> },
      { key: 'joined', label: 'تاریخ عضویت', sortValue: (user) => user.joinedAt, render: (user) => <span className="people-table-date">{formatDate(user.joinedAt)}</span> },
      { key: 'view', label: '', render: (user) => <Link className="people-open-user" href={`/users/${user.id}`} aria-label={`مشاهدهٔ ${user.name}`}><ChevronLeft size={18} /></Link> },
    ]} />
    <div className="people-demo-note"><ShieldCheck size={17} /><p>حساب‌ها و تغییر نقش‌ها در این پنل نمایشی‌اند. هیچ تغییری در حساب واقعی یا اپ یادگیرنده ایجاد نمی‌شود.</p></div>
    <ConfirmDialog open={selected.length > 0} onOpenChange={(open) => { if (!open) setSelected([]); }} title="دسترسی این کاربران تعلیق شود؟" description={`وضعیت ${faNumber(selected.length)} حساب فقط در داده‌های محلی این پنل تغییر می‌کند. بعداً می‌توانی دوباره فعالشان کنی.`} confirmLabel="تعلیق کاربران انتخاب‌شده" danger onConfirm={suspendSelected} />
  </div>;
}

export function UserDetail({ id }: { id: string }) {
  const users = useAdminStore((state) => state.users), courses = useAdminStore((state) => state.courses), lessons = useAdminStore((state) => state.lessons), challenges = useAdminStore((state) => state.challenges);
  const updateUser = useAdminStore((state) => state.updateUser), notify = useAdminStore((state) => state.notify);
  const user = users.find((item) => item.id === id);
  const [role, setRole] = useState<AdminUser['role'] | null>(null), [notes, setNotes] = useState<string | null>(null), [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  if (!user) return <EmptyState title="این کاربر پیدا نشد" description="ممکن است داده‌های محلی بازنشانی شده باشند." action={<Link href="/users" className="btn btn-primary">بازگشت به کاربران</Link>} />;
  function save(event: FormEvent) { event.preventDefault(); const result = updateUser(id, { role: role ?? user!.role, notes: notes ?? user!.notes }); if (result.ok) { notify('اطلاعات کاربر در این پنل ذخیره شد.'); setRole(null); setNotes(null); setError(''); } else setError(result.error ?? 'ذخیره انجام نشد.'); }
  const enrolled = courses.filter((course) => user.enrolledCourseIds.includes(course.id));
  const completed = lessons.filter((lesson) => user.completedLessonIds.includes(lesson.id));
  const statusChange = () => { const next = user.status === 'active' ? 'suspended' : 'active'; const result = updateUser(id, { status: next }); if (result.ok) notify(next === 'active' ? 'حساب نمایشی دوباره فعال شد.' : 'حساب نمایشی تعلیق شد.'); else notify(result.error ?? 'تغییر وضعیت انجام نشد.', 'error'); setConfirm(false); };
  return <div className="people-page"><Link className="people-back" href="/users"><ArrowRight size={15} /> همهٔ کاربران</Link><PageHeader eyebrow="یک نگاه نزدیک‌تر به مسیر یادگیری" title="جزئیات کاربر" description="وضعیت، مسیرها و یادداشت‌های داخلی این حساب نمونه." />
    <div className="panel people-user-hero"><span className="people-avatar large" style={{ '--person-color': personColor(user.avatarColor) } as React.CSSProperties}>{user.name.charAt(0)}</span><div><div className="people-user-badges"><StatusBadge status={user.status} /><span className="people-role">{roleLabels[user.role]}</span></div><h2>{user.name}</h2><span className="people-user-mail" dir="ltr"><Mail size={13} />{user.email}</span></div><div className="people-user-dates"><span><UserRound size={14} />عضو از {formatDate(user.joinedAt)}</span><span><Clock3 size={14} />آخرین فعالیت {formatDate(user.lastActiveAt)}</span></div></div>
    <div className="people-stats three"><div className="panel"><span className="people-stat-icon"><BookOpen size={21} /></span><div><strong>{faNumber(completed.length)}</strong><span>درس تکمیل‌شده</span></div></div><div className="panel"><span className="people-stat-icon amber"><Trophy size={21} /></span><div><strong>{faNumber(challenges.filter((challenge) => user.completedChallengeIds.includes(challenge.id)).length)}</strong><span>چالش حل‌شده</span></div></div><div className="panel"><span className="people-stat-icon cyan"><GraduationCap size={21} /></span><div><strong>{faNumber(enrolled.length)}</strong><span>مسیر فعال</span></div></div></div>
    <div className="people-detail-grid"><section><div className="people-section-heading"><h2>مسیرهای یادگیری</h2><span className="muted">قدم‌به‌قدم، رو به جلو</span></div>{enrolled.length ? enrolled.map((course) => { const related = lessons.filter((lesson) => lesson.courseId === course.id); const done = related.filter((lesson) => user.completedLessonIds.includes(lesson.id)).length; const percent = related.length ? Math.round(done / related.length * 100) : 0; return <div className="panel people-enrolled-course" key={course.id}><span className="people-course-icon"><BookOpen size={23} /></span><div><Link href={`/courses/${course.id}`}><h3>{course.title}</h3></Link><p>{faNumber(done)} از {faNumber(related.length)} درس تکمیل شده</p><div className="people-progress-track"><i style={{ width: `${percent}%` }} /></div></div><strong>{faNumber(percent)}٪</strong></div>; }) : <div className="panel people-empty-small"><BookOpen size={28} /><p>هنوز مسیری برای این حساب ثبت نشده است.</p></div>}
      <div className="people-section-heading spaced"><h2>مفهوم‌هایی که یاد گرفته</h2><span className="muted">درس‌های تکمیل‌شدهٔ نمونه</span></div><div className="panel people-completed-list">{completed.length ? completed.map((lesson) => <Link href={`/lessons/${lesson.id}`} key={lesson.id}><span className="people-completed-check"><Check size={15} /></span><div><strong>{lesson.title}</strong><small>{courses.find((course) => course.id === lesson.courseId)?.title}</small></div><span>{faNumber(lesson.duration)} دقیقه</span><ChevronLeft size={15} /></Link>) : <div className="people-empty-small"><GraduationCap size={27} /><p>اولین درس تکمیل‌شده، اینجا ثبت می‌شود.</p></div>}</div>
    </section><aside><form className="panel people-form-panel" onSubmit={save}><span className="people-panel-icon"><FilePenLine size={24} /></span><h2>اطلاعات داخلی</h2><p className="muted">نقش و یادداشت‌های این حساب را مدیریت کن.</p><Field label="نقش کاربر"><select value={role ?? user.role} onChange={(event) => setRole(event.target.value as AdminUser['role'])}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="یادداشت داخلی" hint="این یادداشت فقط در نسخهٔ محلی ادمین دیده می‌شود."><textarea rows={5} value={notes ?? user.notes} onChange={(event) => setNotes(event.target.value)} placeholder="نکته‌ای برای تیم محتوا…" /></Field>{error && <p className="people-error" role="alert">{error}</p>}<button type="submit" className="btn btn-primary"><Save size={15} />ذخیرهٔ اطلاعات کاربر</button></form><div className="panel people-form-panel spaced"><span className={`people-panel-icon ${user.status === 'active' ? 'danger' : 'green'}`}>{user.status === 'active' ? <ShieldOff size={23} /> : <ShieldCheck size={23} />}</span><h3>{user.status === 'active' ? 'مدیریت دسترسی' : 'بازگشت به یادگیری'}</h3><p className="muted">{user.status === 'active' ? 'تعلیق حساب فقط وضعیت نمایشی را تغییر می‌دهد و قابل بازگشت است.' : 'حساب را دوباره در فهرست کاربران فعال قرار بده.'}</p><button type="button" className={`btn ${user.status === 'active' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setConfirm(true)}>{user.status === 'active' ? 'تعلیق حساب' : 'فعال‌کردن حساب'}</button></div></aside></div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={user.status === 'active' ? 'حساب تعلیق شود؟' : 'حساب دوباره فعال شود؟'} description={`وضعیت حساب «${user.name}» فقط در داده‌های محلی مدیریت تغییر می‌کند.`} confirmLabel={user.status === 'active' ? 'تأیید تعلیق حساب' : 'تأیید فعال‌کردن حساب'} danger={user.status === 'active'} onConfirm={statusChange} />
  </div>;
}
