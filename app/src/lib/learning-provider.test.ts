import {beforeEach,describe,it,expect,vi} from 'vitest';
import {learningProvider} from './learning-provider';
import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from './course-commerce';

describe('account-owned learning provider',()=>{
 beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});useAppStore.setState({session:true,email:'a@example.com'});useCourseCommerce.setState({memberships:['csharp','dotnet'].map(courseId=>({courseId,paidAccess:false,licenseStatus:'locked',licenseSource:'none',licenseKey:null})),invoices:[]});});
 it('keeps two code modes and different learner accounts independent',async()=>{
  await learningProvider.saveLesson('csharp/variables',0,{guidedCode:'guided',exploreCode:'free',step:2});
  useAppStore.setState({email:'b@example.com'});expect((await learningProvider.lesson('csharp/variables')).progress.version).toBe(0);
  useAppStore.setState({email:'a@example.com'});const restored=await learningProvider.lesson('csharp/variables');expect(restored.drafts.map(d=>d.code)).toEqual(['guided','free']);expect(restored.progress.step).toBe(2);
 });
 it('failed and conflicting saves keep the last successful document',async()=>{
  const buffer={guidedCode:'saved',exploreCode:'free',step:1};await learningProvider.saveLesson('csharp/variables',0,buffer);
  await expect(learningProvider.saveLesson('csharp/variables',0,{...buffer,guidedCode:'stale'})).rejects.toMatchObject({status:409});
  await expect(learningProvider.saveLesson('csharp/variables',1,{...buffer,guidedCode:'unsaved'},'network')).rejects.toMatchObject({status:503});
  expect((await learningProvider.lesson('csharp/variables')).drafts[0].code).toBe('saved');
 });
 it('replays attempts once and preserves completion after a later failed attempt',async()=>{
  const request={contentVersion:1,idempotencyKey:'same-request',answers:[{questionId:'lesson',optionId:'1'}]};const result=await learningProvider.submit('csharp/variables',true,request);expect(result.isPassed).toBe(true);
  expect(await learningProvider.submit('csharp/variables',true,request)).toEqual(result);
  await expect(learningProvider.submit('csharp/variables',true,{...request,contentVersion:2},'changed')).rejects.toMatchObject({status:409});
  expect((await learningProvider.submit('csharp/variables',true,{...request,idempotencyKey:'new',answers:[{questionId:'lesson',optionId:'0'}]})).isPassed).toBe(false);
  expect((await learningProvider.lesson('csharp/variables')).progress.completedAt).toBe(result.createdAt);
 });
});
