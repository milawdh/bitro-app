'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpLeft, Bell, BookOpen, Braces, ChartNoAxesCombined, ChevronDown, ChevronLeft, CircleHelp, Command, FlaskConical, FolderCode, House, LogOut, Menu, Search, Settings2, Sparkles, Target, Trophy, X } from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { useAppStore } from '@/stores/use-app-store';
import { courses } from '@/lib/courses';

const navigation=[{href:'/dashboard',label:'پیشخوان',icon:House},{href:'/learn',label:'مسیرهای یادگیری',icon:BookOpen},{href:'/concept-labs',label:'آزمایشگاه مفاهیم',icon:FlaskConical},{href:'/playground',label:'زمین بازی کد',icon:Braces},{href:'/challenges',label:'چالش‌ها',icon:Trophy},{href:'/projects',label:'پروژه‌های من',icon:FolderCode},{href:'/progress',label:'پیشرفت من',icon:ChartNoAxesCombined}];
export function AppShell({children}: {children:React.ReactNode}) {
  const path=usePathname(),router=useRouter(),[mobile,setMobile]=useState(false),[search,setSearch]=useState(false),[query,setQuery]=useState('');
  const name=useAppStore(s=>s.name),logout=useAppStore(s=>s.logout);
  const title=navigation.find(n=>path===n.href||path.startsWith(n.href+'/'))?.label||(({'/settings':'تنظیمات','/profile':'پروفایل من'} as Record<string,string>)[path])||'بیترو‌لرن';
  useEffect(()=>{function key(e:KeyboardEvent){if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearch(s=>!s);}if(e.key==='Escape')setMobile(false);}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const results=courses.flatMap(c=>[{title:c.title,desc:c.subtitle,href:`/learn/${c.slug}`},...c.lessons.map(l=>({title:l.title,desc:c.title,href:`/learn/${c.slug}/${l.slug}`}))]).filter(r=>`${r.title} ${r.desc}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell"><a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
    {mobile&&<button className="sidebar-scrim" aria-label="بستن فهرست" onClick={()=>setMobile(false)}/>}
    <aside className={`sidebar ${mobile?'is-open':''}`} aria-label="منوی اصلی">
      <div className="sidebar-brand"><Logo/><button className="icon-button mobile-close" onClick={()=>setMobile(false)} aria-label="بستن فهرست"><X size={20}/></button></div>
      <div className="workspace-label"><span className="workspace-avatar"><Braces size={19}/></span><div><strong>فضای یادگیری من</strong><span>هر روز، یک قدم جلوتر</span></div><ChevronDown size={15}/></div>
      <p className="nav-caption">یاد بگیر و تجربه کن</p>
      <nav className="sidebar-nav">{navigation.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobile(false)} className={`nav-item ${path===href||path.startsWith(href+'/')?'active':''}`}><Icon size={20}/><span>{label}</span>{href==='/concept-labs'&&<span className="new-tag">جدید</span>}{(path===href||path.startsWith(href+'/'))&&<span className="active-dot"/>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="mini-spark"><Sparkles size={19}/></span><strong>فقط کد نخوان، تجربه کن.</strong><p>یک مفهوم تازه، یک دید تازه.<br/>آزمایشگاه منتظر توست.</p><Link href="/concept-labs">بریم کشف کنیم<ArrowUpLeft size={16}/></Link><span className="note-orbit"/></div>
      <Link href="/settings" className={`nav-item ${path==='/settings'?'active':''}`}><Settings2 size={19}/><span>تنظیمات</span></Link>
      <Link href="/" className="nav-item"><CircleHelp size={19}/><span>دربارهٔ بیترو‌لرن</span><ArrowUpLeft size={15}/></Link>
      <div className="sidebar-user"><Link href="/profile" className="user-link"><span className="avatar">{name.slice(0,1)}</span><span><strong>{name}</strong><small>حساب یادگیری آزمایشی</small></span></Link><button className="icon-button" aria-label="خروج از حساب آزمایشی" onClick={()=>{logout();router.push('/login');}}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="app-content"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="بازکردن منو" onClick={()=>setMobile(true)}><Menu size={21}/></button><Link href="/dashboard" aria-label="پیشخوان"><House size={17}/></Link><ChevronLeft size={13}/><span>{title}</span></div><div className="topbar-actions"><button className="search-trigger" onClick={()=>setSearch(true)}><Search size={17}/><span>هر چیزی برای یادگرفتن...</span><kbd><Command size={11}/> K</kbd></button><span className="topbar-divider"/><ThemeToggle/><details className="notification-menu"><summary className="icon-button" aria-label="اعلان‌ها"><Bell size={19}/><span className="notification-dot"/></summary><div className="notification-popover panel"><strong>وقت یک کشف تازه‌ست ✨</strong><p>آزمایشگاه کلاس‌ها و اشیا آماده است. یک ماشین بساز و رفتار آن را تغییر بده.</p><Link href="/concept-labs/objects" className="text-link">رفتن به آزمایشگاه <ArrowUpLeft size={15}/></Link></div></details><Link href="/profile" className="avatar topbar-avatar" aria-label="پروفایل من">{name.slice(0,1)}</Link></div></header><main className="page-content" id="main-content">{children}</main><footer className="app-footer"><span>با کنجکاوی بساز، با تجربه یاد بگیر.</span><span dir="ltr">Made for curious minds <span className="purple-dot"/></span></footer></div>
    <nav className="mobile-bottom-nav" aria-label="ناوبری سریع">{navigation.slice(0,5).map(({href,label,icon:Icon})=><Link key={href} href={href} className={path===href?'active':''}><Icon size={20}/><span>{label}</span></Link>)}</nav>
    <Dialog.Root open={search} onOpenChange={setSearch}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="search-dialog"><Dialog.Title className="sr-only">جست‌وجوی درس و مسیر یادگیری</Dialog.Title><Dialog.Description className="sr-only">نام یک مفهوم یا مسیر را بنویسید.</Dialog.Description><div className="search-dialog-field"><Search size={22}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="امروز چی می‌خوای یاد بگیری؟" aria-label="جست‌وجو"/><Dialog.Close className="icon-button" aria-label="بستن جست‌وجو"><X size={20}/></Dialog.Close></div><div className="search-results">{results.length?results.map(r=><Link href={r.href} key={r.href} onClick={()=>setSearch(false)}><span className="search-result-icon"><BookOpen size={18}/></span><span><strong>{r.title}</strong><small>{r.desc}</small></span><ChevronLeft size={17}/></Link>):<p className="empty-message">چیزی پیدا نشد. «متغیر» یا «سی‌شارپ» را امتحان کن.</p>}</div><div className="search-dialog-footer"><Target size={14}/> مسیر بعدی تو، از یک جست‌وجو شروع می‌شه.</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
