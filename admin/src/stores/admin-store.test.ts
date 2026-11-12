// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {useAdminStore,repositoryFor} from './admin-store';
import {createSeedData} from '@/data/fixtures';
describe('independent admin repositories',()=>{
 beforeEach(()=>{localStorage.clear();useAdminStore.setState({...createSeedData(),session:true,toasts:[]});});
 it('saves content, records activity and restores it after rehydration',async()=>{
  const course={...useAdminStore.getState().courses[0],title:'دورهٔ ویرایش‌شده'};
  expect(repositoryFor('courses').save(course).ok).toBe(true);expect(useAdminStore.getState().activity[0].action).toBe('updated');
  const saved=localStorage.getItem('bitro-admin-data-v1');useAdminStore.setState(createSeedData());localStorage.setItem('bitro-admin-data-v1',saved!);await useAdminStore.persist.rehydrate();
  expect(repositoryFor('courses').get(course.id)?.title).toBe('دورهٔ ویرایش‌شده');
 });
 it('validates publication atomically and archives a course with its lessons',()=>{
  const state=useAdminStore.getState(),bad={...state.lessons[0],question:'',status:'draft' as const};state.saveEntity('lessons',bad);
  expect(state.setStatus('lessons',[bad.id,state.lessons[1].id],'published').ok).toBe(false);
  expect(useAdminStore.getState().lessons.find(lesson=>lesson.id===bad.id)?.status).toBe('draft');
  expect(state.setStatus('courses',['csharp'],'archived').ok).toBe(true);
  expect(useAdminStore.getState().lessons.filter(lesson=>lesson.courseId==='csharp').every(lesson=>lesson.status==='archived')).toBe(true);
 });
 it('orders lessons without losing membership and rejects partial lists',()=>{
  const state=useAdminStore.getState(),moduleId=state.lessons[0].moduleId,ids=state.lessons.filter(lesson=>lesson.moduleId===moduleId).map(lesson=>lesson.id).reverse();
  expect(state.reorderLessons('csharp',moduleId,ids).ok).toBe(true);
  expect(useAdminStore.getState().lessons.filter(lesson=>lesson.moduleId===moduleId).sort((a,b)=>a.order-b.order).map(lesson=>lesson.id)).toEqual(ids);
  expect(state.reorderLessons('csharp',moduleId,ids.slice(1)).ok).toBe(false);
 });
 it('resets admin drafts while preserving student data and admin preferences',()=>{
  localStorage.setItem('bitro-progress','student-progress');localStorage.setItem('bitro-admin-draft-course-new','draft');
  useAdminStore.getState().updateSettings({theme:'light'});useAdminStore.getState().updateUser('learner-1',{status:'suspended'});useAdminStore.getState().resetData();
  expect(localStorage.getItem('bitro-progress')).toBe('student-progress');expect(localStorage.getItem('bitro-admin-draft-course-new')).toBeNull();
  expect(useAdminStore.getState().settings.theme).toBe('light');expect(useAdminStore.getState().users[0].status).toBe('active');
 });
});
