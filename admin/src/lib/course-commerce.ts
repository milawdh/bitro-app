import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {CourseDto,InvoiceDto} from './course-api';

export type CommerceType = 'free' | 'mixed' | 'paid';
export type LicenseStatus = 'locked' | 'pending' | 'ready' | 'needsReconciliation';
export interface CourseCommerce extends Pick<CourseDto,'id'|'commerceType'|'priceRial'|'introVideoId'> { commerceType:CommerceType; cover:{kind:'preset'|'image';presetKey:'code'|'server'|'layers';fileId:string|null} }
export interface CourseMembership { courseId:string; paidAccess:boolean; licenseStatus:LicenseStatus; licenseSource:'none'|'manual'|'api'; licenseKey:string|null }
export interface InvoiceView extends Pick<InvoiceDto,'id'|'courseId'|'amountRial'> { paymentStatus:'pending'|'paid'; observedPaymentStatus:'unpaid'|'success'; fulfillmentStatus:'pending'|'completed' }
export const commerceCourses:CourseCommerce[] = [
  {id:'csharp',commerceType:'free',priceRial:0,cover:{kind:'preset',presetKey:'code',fileId:null},introVideoId:'demo-intro'},
  {id:'dotnet',commerceType:'mixed',priceRial:2500000,cover:{kind:'preset',presetKey:'server',fileId:null},introVideoId:null},
  {id:'architecture',commerceType:'paid',priceRial:5000000,cover:{kind:'image',presetKey:'layers',fileId:'demo-cover'},introVideoId:null},
];
export interface CommerceState {
  memberships:CourseMembership[]; invoices:InvoiceView[];
  enroll:(courseId:string)=>Promise<void>;
  checkout:(courseId:string)=>Promise<void>;
  observePayment:(courseId:string)=>Promise<void>;
  processPayment:(courseId:string)=>Promise<void>;
  finishLicense:(courseId:string,unknown?:boolean)=>Promise<void>;
  activate:(courseId:string,mode:'manual'|'api',key?:string)=>Promise<void>;
}
// Local provider only. These operations deliberately never contact a gateway or backend.
export const useCourseCommerce = create<CommerceState>()(persist((set,get)=>({
  memberships:[],invoices:[],
  enroll:async(courseId)=>{if(!get().memberships.some(m=>m.courseId===courseId))set(s=>({memberships:[...s.memberships,{courseId,paidAccess:false,licenseStatus:'locked',licenseSource:'none',licenseKey:null}]}));},
  checkout:async(courseId)=>{
    const course=commerceCourses.find(c=>c.id===courseId);
    if(!course||course.commerceType==='free'||!get().memberships.some(m=>m.courseId===courseId))throw new Error('ابتدا دوره را اضافه کنید.');
    if(get().memberships.some(m=>m.courseId===courseId&&m.paidAccess)||get().invoices.some(i=>i.courseId===courseId))return;
    set(s=>({invoices:[...s.invoices,{id:`demo-${courseId}`,courseId,amountRial:course.priceRial,paymentStatus:'pending',observedPaymentStatus:'unpaid',fulfillmentStatus:'pending'}]}));
  },
  observePayment:async(courseId)=>{set(s=>({invoices:s.invoices.map(i=>i.courseId===courseId?{...i,observedPaymentStatus:'success'}:i)}));},
  processPayment:async(courseId)=>{
    if(!get().invoices.some(i=>i.courseId===courseId&&i.observedPaymentStatus==='success'))return;
    set(s=>({invoices:s.invoices.map(i=>i.courseId===courseId?{...i,paymentStatus:'paid',fulfillmentStatus:'completed'}:i),memberships:s.memberships.map(m=>m.courseId===courseId?{...m,paidAccess:true,licenseStatus:m.licenseStatus==='ready'?'ready':'pending',licenseSource:m.licenseSource==='manual'?'manual':'api'}:m)}));
  },
  finishLicense:async(courseId,unknown=false)=>{set(s=>({memberships:s.memberships.map(m=>m.courseId===courseId&&m.paidAccess&&m.licenseStatus==='pending'?{...m,licenseStatus:unknown?'needsReconciliation':'ready',licenseKey:unknown?null:`DEMO-LICENSE-${courseId}`} :m)}));},
  activate:async(courseId,mode,key)=>{
    if(mode==='manual'&&!key?.trim())throw new Error('کلید لایسنس دستی الزامی است.');
    await get().enroll(courseId);
    set(s=>({memberships:s.memberships.map(m=>m.courseId===courseId&&m.licenseStatus!=='ready'?{...m,paidAccess:true,licenseStatus:mode==='manual'?'ready':'pending',licenseSource:mode,licenseKey:mode==='manual'?key!:null}:m)}));
  },
}),{name:'bitro-course-commerce-v1'}));
