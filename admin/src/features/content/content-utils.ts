'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { BaseContent, ConceptSlug, ContentStatus } from '@/lib/types';

export const contentStatusOptions = [{value:'draft',label:'پیش‌نویس'},{value:'published',label:'منتشرشده'},{value:'archived',label:'بایگانی‌شده'}];
export const conceptNames: Record<ConceptSlug,string> = {variables:'متغیرها',references:'مقدار و ارجاع',objects:'کلاس‌ها و اشیا',oop:'چندریختی',threads:'نخ‌ها و هم‌زمانی',async:'انتظار ناهمگام',http:'مسیر درخواست وب',di:'تزریق وابستگی',transactions:'تراکنش‌ها',loops:'حلقه‌ها'};
export const difficultyNames = {beginner:'مقدماتی',intermediate:'متوسط',advanced:'پیشرفته'};
export const categoryNames = {fundamentals:'مبانی برنامه‌نویسی',oop:'شیءگرایی',advanced:'مفاهیم پیشرفته',backend:'توسعهٔ بک‌اند'};
export function useContentDraft<T extends BaseContent>(storageKey: string, initial: T) {
  const [draft,setDraftState] = useState<T>(initial);
  const [ready,setReady] = useState(false);
  const [restored,setRestored] = useState(false);
  const persistenceEnabled=useRef(true);
  const setDraft=useCallback<Dispatch<SetStateAction<T>>>((value)=>{
    persistenceEnabled.current=true;
    setDraftState(value);
  },[]);
  useEffect(()=>{
    setRestored(false);
    try {
      const stored=persistenceEnabled.current?localStorage.getItem(storageKey):null;
      const parsed: unknown=stored?JSON.parse(stored):null;
      if(parsed&&typeof parsed==='object'&&'id' in parsed&&((parsed as BaseContent).id===initial.id||storageKey.endsWith('-new'))&&'title' in parsed&&typeof (parsed as BaseContent).title==='string') {
        const candidate=parsed as T;
        const arraysValid=Object.entries(initial).every(([key,value])=>!Array.isArray(value)||Array.isArray(candidate[key as keyof T]));
        const sameSavedVersion=storageKey.endsWith('-new')||candidate.updatedAt===initial.updatedAt;
        if(arraysValid&&sameSavedVersion){setDraftState(candidate);setRestored(true);}else setDraftState(initial);
      }else setDraftState(initial);
    }catch{setDraftState(initial);}
    setReady(true);
  },[storageKey,initial]);
  useEffect(()=>{if(!ready||!persistenceEnabled.current)return;try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{/* Explicit save remains available if browser draft storage is full. */}},[storageKey,draft,ready]);
  const update=<K extends keyof T>(key:K,value:T[K])=>setDraft(previous=>({...previous,[key]:value}));
  const clearDraft=()=>{persistenceEnabled.current=false;try{localStorage.removeItem(storageKey);}catch{/* Keep the current editor usable without browser storage. */}setRestored(false);};
  const dirty=JSON.stringify({...draft,createdAt:'',updatedAt:''})!==JSON.stringify({...initial,createdAt:'',updatedAt:''});
  return {draft,setDraft,update,ready,restored,clearDraft,dirty};
}
export const statusLabel=(status:ContentStatus)=>contentStatusOptions.find(option=>option.value===status)?.label??status;
export function validProjectPath(path:string){return /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(path);}
