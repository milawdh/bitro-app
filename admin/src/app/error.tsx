'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="admin-empty"><h1>این صفحه کامل باز نشد</h1><p className="muted">دادهٔ ذخیره‌شده سر جایش است. دوباره امتحان کن.</p><button className="btn btn-primary" onClick={reset}>تلاش دوباره</button></div>;}
