import Link from 'next/link';
import {Compass} from 'lucide-react';
export default function NotFound(){return <main className="not-found"><Compass size={56}/><h1>این صفحه پیدا نشد</h1><p className="muted">از پیشخوان، مسیر مدیریت را ادامه بده.</p><Link className="btn btn-primary" href="/dashboard">برگشت به پیشخوان</Link></main>;}
