import type { Metadata } from 'next';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {title: {default: 'بیترو‌لرن | کد را ببین، عمیق یاد بگیر', template: '%s | بیترو‌لرن'}, description: 'یادگیری تعاملی برنامه‌نویسی به فارسی؛ سی‌شارپ و دات‌نت را با آزمایش، تصویرسازی و تمرین یاد بگیر.'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="fa" dir="rtl" suppressHydrationWarning><body><AppProviders>{children}</AppProviders></body></html>;
}
