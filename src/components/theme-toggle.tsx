'use client';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/stores/use-app-store';
export function ThemeToggle() {const theme=useAppStore(s=>s.theme),setTheme=useAppStore(s=>s.setTheme);return <button className="icon-button" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={theme==='dark'?'فعال‌کردن تم روشن':'فعال‌کردن تم تیره'} title="تغییر تم">{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>;}
