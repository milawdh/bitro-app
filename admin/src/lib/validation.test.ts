import {describe,expect,it} from 'vitest';
import {createSeedData} from '@/data/fixtures';
import {validateEntity,validFilePath} from './validation';
describe('admin content validation',()=>{
 it('accepts all seeded content and rejects duplicate slugs',()=>{
  const data=createSeedData();for(const kind of ['courses','lessons','labs','challenges','projects'] as const)for(const item of data[kind])expect(validateEntity(kind,item,data).ok,`${kind}/${item.id}`).toBe(true);
  expect(validateEntity('courses',{...data.courses[0],id:'new-id'},data).errors?.slug).toBeTruthy();
 });
 it('prevents orphan lessons and deleting modules with lessons',()=>{
  const data=createSeedData();expect(validateEntity('lessons',{...data.lessons[0],moduleId:'missing'},data).errors?.moduleId).toBeTruthy();
  expect(validateEntity('courses',{...data.courses[0],modules:[]},data).errors?.modules).toBeTruthy();
 });
 it('allows incomplete drafts but requires a correct assessment for publication',()=>{
  const data=createSeedData(),lesson={...data.lessons[0],question:'',choices:[],status:'draft' as const};
  expect(validateEntity('lessons',lesson,data).ok).toBe(true);
  expect(validateEntity('lessons',{...lesson,status:'published'},data).errors?.choices).toBeTruthy();
  const challenge={...data.challenges[0],questions:data.challenges[0].questions.map(question=>({...question,correctOption:'missing'})),status:'published' as const};
  expect(validateEntity('challenges',challenge,data).errors?.questions).toBeTruthy();
 });
 it('rejects ambiguous project files and unsupported simulation creation',()=>{
  const data=createSeedData();expect(validFilePath('../Secrets.cs')).toBe(false);expect(validFilePath('Models/Book.cs')).toBe(true);
  expect(validateEntity('projects',{...data.projects[0],files:[data.projects[0].files[0],data.projects[0].files[0]]},data).errors?.files).toBeTruthy();
  expect(validateEntity('labs',{...data.labs[0],id:'arbitrary-engine'},data).errors?.concept).toBeTruthy();
 });
});
