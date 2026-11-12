'use client';
import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useAppStore } from '@/stores/use-app-store';
export function AppProviders({children}: {children: React.ReactNode}) {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; }, [theme]);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
