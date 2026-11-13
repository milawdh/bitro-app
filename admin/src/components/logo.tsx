import Link from 'next/link';
export function Logo({href='/dashboard',small=false}: {href?:string; small?:boolean}) {
  return <Link href={href} className={`brand ${small?'brand-small':''}`} aria-label="بیترو‌لرن، صفحهٔ اصلی"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m10 8-7 8 7 8M22 8l7 8-7 8" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/><path d="m18 5-4 22" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/></svg></span><span className="brand-word" dir="ltr">bitro<span>learn</span><i /></span></Link>;
}
