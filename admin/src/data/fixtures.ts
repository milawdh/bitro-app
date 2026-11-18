import source from './seed-content.json';
import {commerceCourses} from '@/lib/course-commerce';
import type { AdminData,AdminCourse,AdminLesson,AdminLab,AdminChallenge,AdminProject,AdminUser,LearningEvent,ConceptSlug } from '@/lib/types';

const reference='2026-11-12T09:00:00.000Z';
const past=(days:number,hours=0)=>new Date(Date.parse(reference)-days*86400000-hours*3600000).toISOString();
const base=(id:string,slug:string,title:string,description:string,status:'draft'|'published'|'archived'='published')=>({id,slug,title,description,status,createdAt:past(40),updatedAt:past(1)});
const moduleIndex:Record<string,number>={variables:1,references:1,loops:4,objects:7,threads:14,async:14,http:2,di:4};

export function createSeedData():AdminData {
 const courses:AdminCourse[]=source.courses.map((course,index)=>({...base(course.slug,course.slug,course.title,course.description,index===2?'draft':'published'),subtitle:course.subtitle,level:(['beginner','intermediate','advanced'] as const)[index],color:(['purple','cyan','amber'] as const)[index],modules:course.modules.map((title,i)=>({id:`${course.slug}-module-${i+1}`,title}))}));
 const lessons:AdminLesson[]=source.courses.flatMap(course=>course.lessons.map((lesson,index)=>{
  const content=source.lessons[lesson.slug as keyof typeof source.lessons];
  return {...base(`${course.slug}-${lesson.slug}`,lesson.slug,lesson.title,lesson.description),...content,courseId:course.slug,order:index,moduleId:`${course.slug}-module-${(moduleIndex[lesson.slug]??0)+1}`,concept:content.concept as ConceptSlug};
 }));
 for(const course of courses){const config=commerceCourses.find(c=>c.id===course.id);if(config){course.commerceType=config.commerceType;course.priceRial=config.priceRial;course.cover=config.cover;course.introVideoId=config.introVideoId??undefined;course.spotPlayerCourseId=config.commerceType==='free'?undefined:`demo-${course.id}`;}course.animations=lessons.filter(l=>l.courseId===course.id).map(l=>({key:l.concept,enabled:true,settings:{}})).filter((b,i,all)=>all.findIndex(x=>x.key===b.key)===i);}
 for(const lesson of lessons){lesson.delivery='onsite';lesson.hasQuiz=true;lesson.animations=[{key:lesson.concept,enabled:true,settings:{}}];}
 for(const course of courses.filter(c=>c.commerceType!=='free')){
  const courseModule=course.modules[course.id==='dotnet'?6:0];
  lessons.push({...base(`demo-spot-${course.id}`,`spot-${course.id}`,courseModule.title,'ارائهٔ این سرفصل در اسپات‌پلیر'),courseId:course.id,moduleId:courseModule.id,order:100,duration:30,delivery:'spotplayer',hasQuiz:false,animations:[],concept:'http',intro:'',analogy:'',objectives:[],experiment:'',code:'',output:[],question:'',choices:[],answer:0,hint:'',explanation:''});
 }
 const category:Record<string,AdminLab['category']>={'مبانی':'fundamentals','شیءگرایی':'oop','پیشرفته':'advanced','بک‌اند':'backend'};
 const labs:AdminLab[]=source.labs.map((lab):AdminLab=>({...base(lab.slug,lab.slug,lab.title,lab.description),concept:lab.slug as ConceptSlug,category:category[lab.category]??'fundamentals',duration:15,config:lab.slug==='variables'?{name:'score',initialValue:42}:lab.slug==='threads'?{schedule:'concurrent',steps:6}:lab.slug==='transactions'?{firstBalance:100,secondBalance:50}:lab.slug==='objects'?{initialSpeed:0,maxSpeed:120}:{showExplanations:true}}));
 const challenges:AdminChallenge[]=source.challenges.map((challenge,index)=>({...base(challenge.slug,challenge.slug,challenge.title,challenge.description,index===3?'draft':'published'),difficulty:challenge.difficulty as AdminChallenge['difficulty'],duration:challenge.duration,concept:challenge.concept as ConceptSlug,courseId:challenge.course,hint:challenge.hint,questions:challenge.questions}));
 const projects:AdminProject[]=[{...base('my-first-api','my-first-api','اولین رابط وب من','یک پروژهٔ واقعی دات‌نت؛ از ثبت سرویس تا پاسخ یک درخواست.','draft'),difficulty:'intermediate',courseId:'dotnet',duration:45,files:source.files.map(file=>({...file})),objectives:['شناخت ساختار یک پروژهٔ دات‌نت','دنبال‌کردن مسیر کنترلر تا سرویس','بررسی پاسخ‌های موفق و ناموفق']}];
 const names=['آرمان رضایی','سارا محمدی','علی احمدی','نگار کریمی','پارسا حسینی','مریم صالحی','امیر شریفی','نازنین مرادی','سینا کاظمی','مهسا نادری','پویا موسوی','ترانه امینی','محمد اکبری','آیدا رستمی','کیان رحیمی','زهرا صادقی','سپهر عباسی','هستی حیدری','رضا تقوی','نیکا زمانی','آرش یوسفی','یلدا احمدپور','شایان مهر','رها فرهادی'];
 const users:AdminUser[]=names.map((name,index)=>{
  const enrolledCourseIds=index%3===0?['csharp','dotnet']:['csharp'];
  const available=lessons.filter(lesson=>enrolledCourseIds.includes(lesson.courseId));
  return {id:`learner-${index+1}`,name,email:`learner${index+1}@example.com`,role:index===22?'editor':index===23?'admin':'learner',status:index===7||index===16?'suspended':'active',joinedAt:past(60+index),lastActiveAt:past(index%12),enrolledCourseIds,completedLessonIds:available.slice(0,index%(available.length+1)).map(lesson=>lesson.id),completedChallengeIds:challenges.slice(0,index%4).map(challenge=>challenge.id),avatarColor:['purple','cyan','amber','green'][index%4],notes:''};
 });
 const learningEvents:LearningEvent[]=users.flatMap((user,index)=>user.completedLessonIds.flatMap((lessonId,j)=>[{id:`event-${index}-${j}-start`,userId:user.id,lessonId,date:past((index+j)%28,2),durationMinutes:0,kind:'lesson_started' as const},{id:`event-${index}-${j}-complete`,userId:user.id,lessonId,date:past((index+j)%28,1),durationMinutes:lessons.find(l=>l.id===lessonId)?.duration??15,kind:'lesson_completed' as const}]));
 return {courses,lessons,labs,challenges,projects,users,learningEvents,activity:[
  {id:'activity-1',entityType:'lessons',entityId:'csharp-variables',title:'متغیر چیست؟',action:'published',at:past(0,1),actor:'آرمان'},
  {id:'activity-2',entityType:'projects',entityId:'my-first-api',title:'اولین رابط وب من',action:'updated',at:past(0,3),actor:'سارا'},
  {id:'activity-3',entityType:'challenges',entityId:'object-garage',title:'گاراژ شیءگرا',action:'created',at:past(1),actor:'آرمان'},
  {id:'activity-4',entityType:'courses',entityId:'architecture',title:'فکر کردن مثل یک معمار',action:'updated',at:past(2),actor:'سارا'}
 ],settings:{workspaceName:'استودیوی یادگیری بیترو',adminName:'آرمان',email:'admin@bitrolearn.local',theme:'dark',defaultContentStatus:'draft',notificationsEnabled:true}};
}
