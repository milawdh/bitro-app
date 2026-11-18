'use client';
import {useEffect,useState} from 'react';
import {learningProvider,type LearningScenario,type LessonSnapshot} from '@/lib/learning-provider';
import type {WorkspaceDto} from '@/lib/course-api';

function SaveControls({error,status,onSave,onLoad,scenario,setScenario}:{error:string;status:string;onSave:()=>void;onLoad:()=>void;scenario:LearningScenario;setScenario:(value:LearningScenario)=>void}){
 return <section aria-label="ذخیرهٔ پیشرفت" style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><span role="status" style={{fontSize:12}}>{status}</span><button className="btn btn-ghost" onClick={onSave}>ذخیرهٔ حساب نمایشی</button><button className="btn btn-ghost" onClick={onLoad}>بارگیری نسخهٔ ذخیره‌شده</button>{error&&<p role="alert" style={{width:'100%'}}>{error}</p>}<details style={{fontSize:12}}><summary>سناریوی ذخیره</summary><select aria-label="سناریوی ذخیره" value={scenario} onChange={e=>setScenario(e.target.value as LearningScenario)}><option value="normal">عادی</option><option value="network">خطای ارتباط</option><option value="conflict">تعارض نسخه</option></select></details></section>;
}
export function LessonSavePanel({id,revision,buffer,onLoad}:{id:string;revision:boolean;buffer:{guidedCode:string;exploreCode:string;step:number};onLoad:(snapshot:LessonSnapshot)=>void}){
 const [version,setVersion]=useState(0),[status,setStatus]=useState('ذخیرهٔ نمایشی در همین مرورگر'),[error,setError]=useState(''),[scenario,setScenario]=useState<LearningScenario>('normal'),[savedBuffer,setSavedBuffer]=useState('');
 useEffect(()=>{let active=true;learningProvider.lesson(id).then(s=>{if(active)setVersion(s.progress.version);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,revision]);
 async function save(){setError('');setStatus('در حال ذخیره…');try{const next=await learningProvider.saveLesson(id,version,buffer,scenario);setVersion(next.progress.version);setSavedBuffer(JSON.stringify(buffer));setStatus('پیشرفت و کد هر دو حالت ذخیره شد.');}catch(e){setError((e as Error).message);setStatus('تغییرات فعلی در ویرایشگر محفوظ است.');}}
 async function load(){try{const saved=await learningProvider.lesson(id);onLoad(saved);setVersion(saved.progress.version);setError('');setStatus('نسخهٔ ذخیره‌شده بارگیری شد.');}catch(e){setError((e as Error).message);}}
 const displayStatus=!error&&savedBuffer&&savedBuffer!==JSON.stringify(buffer)?'تغییرات جدید هنوز در حساب نمایشی ذخیره نشده‌اند.':status;
 return <SaveControls {...{error,scenario,setScenario}} status={displayStatus} onSave={save} onLoad={load}/>;
}
export function WorkspaceSavePanel({id,files,activeFile,checkpoint,onLoad}:{id:string;files:WorkspaceDto['files'];activeFile:string|null;checkpoint:number;onLoad:(snapshot:WorkspaceDto)=>void}){
 const [version,setVersion]=useState(0),[status,setStatus]=useState('ذخیرهٔ نمایشی در همین مرورگر'),[error,setError]=useState(''),[scenario,setScenario]=useState<LearningScenario>('normal');
 useEffect(()=>{let active=true;learningProvider.workspace(id,[]).then(s=>{if(active)setVersion(s.version);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id]);
 async function save(){setStatus('در حال ذخیره…');setError('');try{const next=await learningProvider.saveWorkspace({templateId:id,version,templateVersion:1,currentTemplateVersion:1,files,activeFile,checkpoint},scenario);setVersion(next.version);setStatus('فایل‌ها و نقطهٔ ادامه ذخیره شدند.');}catch(e){setError((e as Error).message);setStatus('فایل‌های فعلی در ویرایشگر محفوظ‌اند.');}}
 async function load(){try{const next=await learningProvider.workspace(id,files);onLoad(next);setVersion(next.version);setError('');setStatus('پروژهٔ ذخیره‌شده بارگیری شد.');}catch(e){setError((e as Error).message);}}
 return <SaveControls {...{error,status,scenario,setScenario}} onSave={save} onLoad={load}/>;
}
