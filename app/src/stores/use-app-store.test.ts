// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './use-app-store';

describe('local learner progress', () => {
  beforeEach(() => { localStorage.clear(); useAppStore.setState({ name:'آرمان', theme:'dark', dailyGoal:30, completedLessons:[], completedChallenges:[], activity:[],studyDays:[],session:false }); });
  it('completes lessons and challenges only once', () => {
    const store=useAppStore.getState();
    store.completeLesson('csharp/variables'); store.completeLesson('csharp/variables');
    store.completeChallenge('loop-detective'); store.completeChallenge('loop-detective');
    expect(useAppStore.getState().completedLessons).toEqual(['csharp/variables']);
    expect(useAppStore.getState().completedChallenges).toEqual(['loop-detective']);
  });
  it('restores saved progress and preferences from browser storage', async () => {
    useAppStore.getState().setName('سارا'); useAppStore.getState().setTheme('light'); useAppStore.getState().completeLesson('dotnet/http');
    const saved=localStorage.getItem('bitro-progress');
    useAppStore.setState({name:'آرمان',theme:'dark',completedLessons:[]});
    localStorage.setItem('bitro-progress',saved!);
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState()).toMatchObject({name:'سارا',theme:'light',completedLessons:['dotnet/http']});
  });
  it('resets completion without discarding the learner settings', () => {
    useAppStore.getState().setDailyGoal(45);useAppStore.getState().completeLesson('csharp/variables');
    useAppStore.getState().resetProgress();
    expect(useAppStore.getState().completedLessons).toEqual([]);
    expect(useAppStore.getState().dailyGoal).toBe(45);
  });
  it('resets persisted quiz checkpoints while preserving the learner code',()=>{
    localStorage.setItem('bitro-lesson-csharp/variables',JSON.stringify({passed:true,step:4,guidedCode:'int a = 2;',exploreCode:'int a = 7;'}));
    useAppStore.getState().resetProgress();
    expect(JSON.parse(localStorage.getItem('bitro-lesson-csharp/variables')!)).toEqual({passed:false,step:0,guidedCode:'int a = 2;',exploreCode:'int a = 7;'});
  });
});
