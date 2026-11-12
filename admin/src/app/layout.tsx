import type {Metadata} from 'next';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import './admin.css';
import {Providers} from '@/components/providers';
export const metadata:Metadata={title:{default:'بیترو‌لرن | استودیوی مدیریت',template:'%s | مدیریت بیترو‌لرن'},description:'استودیوی مدیریت محتوا و تجربهٔ یادگیری بیترو‌لرن — نسخهٔ نمایشی مستقل.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;}
