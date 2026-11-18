import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from './course-commerce';
import {lessonDefinitions} from '@/features/lessons/lesson-data';
import {challenges,validateChallenge} from '@/features/challenges/challenge-engine';
import type {ProgressDto,DraftDto,WorkspaceDto,AttemptDto,AttemptRequest} from './course-api';

export type LearningScenario='normal'|'network'|'conflict'|'changed';
export class LearningError extends Error {constructor(message:string,public status:number){super(message);}}
export interface LessonSnapshot {progress:ProgressDto;drafts:DraftDto[]}
interface LocalLearning {lessons:Record<string,LessonSnapshot>;workspaces:Record<string,WorkspaceDto>;attempts:Record<string,{hash:string;result:AttemptDto}>}
export function learningAccount(){const state=useAppStore.getState();if(!state.session)throw new LearningError('برای ذخیره وارد حساب شوید.',401);return state.email.toLowerCase().trim();}
function read():LocalLearning{const value=localStorage.getItem('bitro-learning-v1:'+learningAccount());return value?JSON.parse(value):{lessons:{},workspaces:{},attempts:{}};}
function write(state:LocalLearning){localStorage.setItem('bitro-learning-v1:'+learningAccount(),JSON.stringify(state));}
function access(course:string){learningAccount();if(!useCourseCommerce.getState().memberships.some(m=>m.courseId===course))throw new LearningError('ابتدا دوره را به دوره‌های من اضافه کنید.',403);}
function fault(scenario:LearningScenario){if(scenario==='network')throw new LearningError('ذخیره انجام نشد؛ متن شما محفوظ است. دوباره تلاش کنید.',503);if(scenario==='conflict')throw new LearningError('نسخهٔ ذخیره‌شده تغییر کرده است؛ متن فعلی را نگه دارید یا نسخهٔ ذخیره‌شده را بارگیری کنید.',409);if(scenario==='changed')throw new LearningError('سؤال تغییر کرده است؛ نسخهٔ تازه را بارگیری و دوباره پاسخ دهید.',409);}
export const learningProvider={
 async lesson(id:string):Promise<LessonSnapshot>{access(id.split('/')[0]);const row=read().lessons[id];if(row)return row;const code=lessonDefinitions[id.split('/')[1]]?.code??'';return {progress:{lessonId:id,version:0,step:0,videoPositionSeconds:null,completedAt:null},drafts:['guided','explore'].map(mode=>({lessonId:id,mode,version:0,code}))};},
 async saveLesson(id:string,expected:number,buffer:{guidedCode:string;exploreCode:string;step:number},scenario:LearningScenario='normal'):Promise<LessonSnapshot>{
  access(id.split('/')[0]);fault(scenario);const state=read(),old=state.lessons[id];if((old?.progress.version??0)!==expected)fault('conflict');
  const next={progress:{lessonId:id,version:expected+1,step:buffer.step,videoPositionSeconds:old?.progress.videoPositionSeconds??null,completedAt:old?.progress.completedAt??null},drafts:['guided','explore'].map(mode=>({lessonId:id,mode,version:expected+1,code:mode==='guided'?buffer.guidedCode:buffer.exploreCode}))};state.lessons[id]=next;write(state);return next;
 },
 async completeVideo(id:string,position:number):Promise<ProgressDto>{access(id.split('/')[0]);if(id.split('/')[1]!=='video-overview')throw new LearningError('تکمیل این درس به قبولی آزمون نیاز دارد.',409);const state=read(),old=state.lessons[id];const progress={lessonId:id,version:(old?.progress.version??0)+1,step:4,videoPositionSeconds:Math.max(0,position),completedAt:old?.progress.completedAt??new Date().toISOString()};state.lessons[id]={progress,drafts:old?.drafts??[]};write(state);return progress;},
 async videoPosition(id:string,position:number):Promise<void>{access(id.split('/')[0]);const state=read(),old=state.lessons[id];state.lessons[id]={progress:{lessonId:id,version:(old?.progress.version??0)+1,step:old?.progress.step??0,videoPositionSeconds:Math.max(0,position),completedAt:old?.progress.completedAt??null},drafts:old?.drafts??[]};write(state);},
 async workspace(id:string,files:WorkspaceDto['files']):Promise<WorkspaceDto>{access('dotnet');return read().workspaces[id]??{templateId:id,version:0,templateVersion:1,currentTemplateVersion:1,files,activeFile:files[0]?.path??null,checkpoint:0};},
 async saveWorkspace(row:WorkspaceDto,scenario:LearningScenario='normal'):Promise<WorkspaceDto>{access('dotnet');fault(scenario);const state=read();if((state.workspaces[row.templateId]?.version??0)!==row.version)fault('conflict');const next={...row,version:row.version+1};state.workspaces[row.templateId]=next;write(state);return next;},
 async submit(id:string,isLesson:boolean,request:AttemptRequest,scenario:LearningScenario='normal'):Promise<AttemptDto>{
  const challenge=challenges.find(c=>c.slug===id);access(isLesson?id.split('/')[0]:challenge?.course??'csharp');fault(scenario);
  const state=read(),hash=JSON.stringify({id,isLesson,...request}),prior=state.attempts[request.idempotencyKey];if(prior){if(prior.hash!==hash)fault('conflict');return prior.result;}
  if(request.contentVersion!==1)fault('changed');
  let feedback:AttemptDto['feedback'];
  if(isLesson){const definition=lessonDefinitions[id.split('/')[1]],answer=request.answers[0];if(!definition||request.answers.length!==1||answer.questionId!=='lesson'||!definition.choices[Number(answer.optionId)])throw new LearningError('یک گزینهٔ معتبر انتخاب کنید.',400);feedback=[{questionId:'lesson',correct:Number(answer.optionId)===definition.answer,explanation:definition.explanation}];}
  else{if(!challenge||request.answers.length!==challenge.questions.length||new Set(request.answers.map(a=>a.questionId)).size!==request.answers.length||request.answers.some(a=>!challenge.questions.some(q=>q.id===a.questionId&&q.options.some(o=>o.id===a.optionId))))throw new LearningError('برای همهٔ پرسش‌ها یک گزینهٔ معتبر انتخاب کنید.',400);const result=validateChallenge(challenge,Object.fromEntries(request.answers.map(a=>[a.questionId,a.optionId])));feedback=result.results;}
  const result:AttemptDto={id:crypto.randomUUID(),lessonId:isLesson?id:null,challengeId:isLesson?null:id,contentVersion:1,isPassed:feedback.every(f=>f.correct),correctCount:feedback.filter(f=>f.correct).length,totalCount:feedback.length,feedback,createdAt:new Date().toISOString()};
  state.attempts[request.idempotencyKey]={hash,result};
  if(isLesson&&result.isPassed){const old=state.lessons[id];state.lessons[id]={progress:{lessonId:id,version:(old?.progress.version??0)+1,step:old?.progress.step??3,videoPositionSeconds:null,completedAt:old?.progress.completedAt??result.createdAt},drafts:old?.drafts??['guided','explore'].map(mode=>({lessonId:id,mode,version:0,code:lessonDefinitions[id.split('/')[1]].code}))};}
  write(state);return result;
 }
};
