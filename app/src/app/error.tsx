'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="not-found"><h1>این بار مسیر کامل نشد</h1><p className="muted">صفحه را دوباره باز کن؛ پیشرفت ذخیره‌شده‌ات اینجاست.</p><button className="btn btn-primary" onClick={reset}>تلاش دوباره</button></div>;}
