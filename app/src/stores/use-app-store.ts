'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tehranDate, type LearningActivity } from '@/lib/activity';

interface AppState {
  name: string; email: string; theme: 'dark' | 'light'; dailyGoal: number;
  completedLessons: string[]; completedChallenges: string[]; hasHydrated: boolean;
  session: boolean; experience: 'beginner' | 'experienced';
  activity: LearningActivity[]; studyDays: string[]; toggleStudyDay: (date: string) => void;
  setName: (name: string) => void; setTheme: (theme: 'dark' | 'light') => void;
  setDailyGoal: (minutes: number) => void; completeLesson: (id: string) => void;
  completeChallenge: (id: string) => void; resetProgress: () => void;
  login: (name: string, email: string, experience?: 'beginner' | 'experienced') => void;
  logout: () => void; setHasHydrated: (ready: boolean) => void;
}
export const useAppStore = create<AppState>()(persist((set) => ({
  name: 'آرمان', email: 'arman@example.com', theme: 'dark', dailyGoal: 30,
  completedLessons: [], completedChallenges: [], hasHydrated: false, session: false, experience: 'beginner',
  activity: [], studyDays: [], toggleStudyDay: (date) => set((s)=>({studyDays:s.studyDays.includes(date)?s.studyDays.filter(d=>d!==date):[...s.studyDays,date]})),
  setName: (name) => set({name}), setTheme: (theme) => set({theme}),
  setDailyGoal: (dailyGoal) => set({dailyGoal}),
  completeLesson: (id) => set((s) => s.completedLessons.includes(id)?s:({completedLessons: [...s.completedLessons,id],activity:[...s.activity,{id,kind:'lesson',date:tehranDate()}]})),
  completeChallenge: (id) => set((s) => s.completedChallenges.includes(id)?s:({completedChallenges: [...s.completedChallenges,id],activity:[...s.activity,{id,kind:'challenge',date:tehranDate()}]})),
  resetProgress: () => {
    if (typeof window !== 'undefined') {
      try {
        for (const key of Object.keys(localStorage).filter(key=>key.startsWith('bitro-lesson-'))) {
          const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
          localStorage.setItem(key, JSON.stringify({...saved,passed:false,step:0}));
        }
      } catch { /* Reset the in-memory progress even if browser storage is unavailable. */ }
    }
    set({completedLessons: [], completedChallenges: [],activity:[],studyDays:[]});
  },
  login: (name, email, experience = 'beginner') => set({name, email, experience, session: true}),
  logout: () => set({session: false}), setHasHydrated: (hasHydrated) => set({hasHydrated}),
}), {name: 'bitro-progress', storage: createJSONStorage(() => localStorage), onRehydrateStorage: () => (state) => state?.setHasHydrated(true), partialize: (state) => ({name: state.name, email: state.email, theme: state.theme, dailyGoal: state.dailyGoal, completedLessons: state.completedLessons, completedChallenges: state.completedChallenges, session: state.session, experience: state.experience,activity:state.activity,studyDays:state.studyDays}) }));
