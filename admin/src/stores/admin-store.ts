'use client';
import {create} from 'zustand';
import {createJSONStorage,persist} from 'zustand/middleware';
import {createSeedData} from '@/data/fixtures';
import {validateEntity} from '@/lib/validation';
import {createId,nowISO} from '@/lib/utils';
import type {AdminData,AdminUser,AdminSettings,AdminActivity,ContentEntityMap,ContentKind,ContentStatus,SaveResult,AdminRepository} from '@/lib/types';

interface Toast {id:string;message:string;type:'success'|'error'}
export interface AdminState extends AdminData {
 hasHydrated:boolean;session:boolean;toasts:Toast[];
 setHasHydrated:(ready:boolean)=>void;
 saveEntity:<K extends ContentKind>(kind:K,entity:ContentEntityMap[K])=>SaveResult;
 setStatus:(kind:ContentKind,ids:string[],status:ContentStatus)=>SaveResult;
 reorderLessons:(courseId:string,moduleId:string,ids:string[])=>SaveResult;
 updateUser:(id:string,patch:Partial<AdminUser>)=>SaveResult;
 updateSettings:(patch:Partial<AdminSettings>)=>SaveResult;
 resetData:()=>void;login:(name:string,email:string)=>void;logout:()=>void;
 notify:(message:string,type?:'success'|'error')=>void;dismissToast:(id:string)=>void;
}
const audit=(state:AdminData,entityType:string,entityId:string,title:string,action:AdminActivity['action']):AdminActivity=>({id:createId('activity'),entityType,entityId,title,action,at:nowISO(),actor:state.settings.adminName});
function validSnapshot(value:unknown):value is Partial<AdminState>{
 if(!value||typeof value!=='object')return false;
 const data=value as AdminData;
 return (['courses','lessons','labs','challenges','projects','users','learningEvents','activity'] as const).every(key=>Array.isArray(data[key]))&&['courses','lessons','labs','challenges','projects'].every(key=>(data[key as ContentKind]).every(item=>item&&typeof item.id==='string'&&typeof item.title==='string'))&&!!data.settings&&['dark','light'].includes(data.settings.theme)&&data.users.every(user=>user&&typeof user.name==='string');
}
export const useAdminStore=create<AdminState>()(persist((set,get)=>({
 ...createSeedData(),hasHydrated:false,session:true,toasts:[],setHasHydrated:hasHydrated=>set({hasHydrated}),
 saveEntity:(kind,entity)=>{
  const state=get(),result=validateEntity(kind,entity,state);if(!result.ok)return result;
  const collection=state[kind] as ContentEntityMap[typeof kind][];
  const existing=collection.find(item=>item.id===entity.id);
  const saved={...entity,title:entity.title.trim(),description:entity.description.trim(),createdAt:existing?.createdAt??nowISO(),updatedAt:nowISO()};
  const next=existing?collection.map(item=>item.id===entity.id?saved:item):[saved,...collection];
  const cascade=kind==='courses'&&entity.status==='archived'?{lessons:state.lessons.map(lesson=>lesson.courseId===entity.id?{...lesson,status:'archived' as const,updatedAt:nowISO()}:lesson)}:{};
  const action:AdminActivity['action']=!existing?'created':existing.status!==saved.status?(saved.status==='published'?'published':saved.status==='archived'?'archived':'restored'):'updated';
  set({[kind]:next,...cascade,activity:[audit(state,kind,entity.id,saved.title,action),...state.activity].slice(0,100)} as Partial<AdminState>);
  return {ok:true};
 },
 setStatus:(kind,ids,status)=>{
  const state=get(),targets=state[kind].filter(item=>ids.includes(item.id));
  if(!targets.length)return {ok:false,error:'محتوایی انتخاب نشده است.'};
  for(const item of targets){const result=validateEntity(kind,{...item,status} as ContentEntityMap[typeof kind],state);if(!result.ok)return result;}
  const activity=targets.map(item=>audit(state,kind,item.id,item.title,status==='published'?'published':status==='archived'?'archived':'restored'));
  const next=state[kind].map(item=>ids.includes(item.id)?{...item,status,updatedAt:nowISO()}:item);
  const cascade=kind==='courses'&&status==='archived'?{lessons:state.lessons.map(lesson=>ids.includes(lesson.courseId)?{...lesson,status:'archived' as const,updatedAt:nowISO()}:lesson)}:{};
  set({[kind]:next,...cascade,activity:[...activity,...state.activity].slice(0,100)} as Partial<AdminState>);return {ok:true};
 },
 updateUser:(id,patch)=>{
  const state=get(),user=state.users.find(item=>item.id===id);if(!user)return {ok:false,error:'کاربر پیدا نشد.'};
  const next={...user,...patch,id:user.id};
  if(!next.name.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)||!['learner','editor','admin'].includes(next.role)||!['active','suspended'].includes(next.status))return {ok:false,error:'نام، ایمیل، نقش و وضعیت کاربر را بررسی کن.'};
  if(state.users.some(item=>item.id!==id&&item.email.toLowerCase()===next.email.toLowerCase()))return {ok:false,error:'این ایمیل قبلاً استفاده شده است.'};
  set({users:state.users.map(item=>item.id===id?next:item),activity:[audit(state,'users',id,next.name,'user_updated'),...state.activity].slice(0,100)});return {ok:true};
 },
 reorderLessons:(courseId,moduleId,ids)=>{
  const state=get(),lessons=state.lessons.filter(lesson=>lesson.courseId===courseId&&lesson.moduleId===moduleId);
  if(ids.length!==lessons.length||new Set(ids).size!==ids.length||ids.some(id=>!lessons.some(lesson=>lesson.id===id)))return {ok:false,error:'فهرست درس‌ها برای مرتب‌سازی معتبر نیست.'};
  set({lessons:state.lessons.map(lesson=>ids.includes(lesson.id)?{...lesson,order:ids.indexOf(lesson.id),updatedAt:nowISO()}:lesson),activity:[audit(state,'courses',courseId,'ترتیب درس‌های فصل','updated'),...state.activity].slice(0,100)});return {ok:true};
 },
 updateSettings:patch=>{
  const state=get(),settings={...state.settings,...patch};
  if(!settings.workspaceName.trim()||!settings.adminName.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)||!['dark','light'].includes(settings.theme)||!['draft','published'].includes(settings.defaultContentStatus))return {ok:false,error:'نام فضای کاری، نام مدیر، ایمیل و تنظیمات را بررسی کن.'};
  set({settings,activity:[audit(state,'settings','general','تنظیمات فضای مدیریت','settings_updated'),...state.activity].slice(0,100)});return {ok:true};
 },
 resetData:()=>{
  if(typeof window!=='undefined')try{Object.keys(localStorage).filter(key=>key.startsWith('bitro-admin-draft-')).forEach(key=>localStorage.removeItem(key));}catch{/* Keep the demo usable when storage is unavailable. */}
  set({...createSeedData(),settings:get().settings,session:get().session});
 },
 login:(name,email)=>set({session:true,settings:{...get().settings,adminName:name.trim(),email:email.trim()}}),logout:()=>set({session:false}),
 notify:(message,type='success')=>set(state=>({toasts:[...state.toasts,{id:createId('toast'),message,type}].slice(-3)})),
 dismissToast:id=>set(state=>({toasts:state.toasts.filter(toast=>toast.id!==id)})),
}),{name:'bitro-admin-data-v1',version:1,storage:createJSONStorage(()=>localStorage),partialize:state=>({courses:state.courses,lessons:state.lessons,labs:state.labs,challenges:state.challenges,projects:state.projects,users:state.users,learningEvents:state.learningEvents,activity:state.activity,settings:state.settings,session:state.session}),merge:(saved,current)=>validSnapshot(saved)?{...current,...saved}:current,onRehydrateStorage:()=>state=>state?.setHasHydrated(true)}));

export function repositoryFor<K extends ContentKind>(kind:K):AdminRepository<ContentEntityMap[K]>{
 return {list:()=>useAdminStore.getState()[kind] as ContentEntityMap[K][],get:id=>(useAdminStore.getState()[kind] as ContentEntityMap[K][]).find(item=>item.id===id),save:entity=>useAdminStore.getState().saveEntity(kind,entity),archive:ids=>useAdminStore.getState().setStatus(kind,ids,'archived')};
}
