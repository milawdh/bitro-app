import Link from 'next/link';
import { Compass, ArrowRight } from 'lucide-react';
export default function NotFound(){return <main className="not-found"><Compass size={64}/><span className="eyebrow">یک مسیر تازه پیدا کنیم</span><h1>این صفحه هنوز کشف نشده!</h1><p className="muted">می‌تونی از مسیرهای یادگیری، ماجراجویی‌ات رو ادامه بدی.</p><Link href="/learn" className="btn btn-primary"><ArrowRight size={18}/>مسیرهای یادگیری</Link></main>;}
