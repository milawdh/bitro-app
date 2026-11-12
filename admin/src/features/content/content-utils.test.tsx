// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import type {BaseContent} from '@/lib/types';
import {useContentDraft} from './content-utils';

const initial:BaseContent={id:'first-challenge',slug:'first-challenge',title:'First challenge',description:'A local challenge',status:'draft',createdAt:'2026-11-12T09:00:00.000Z',updatedAt:'2026-11-12T09:00:00.000Z'};
beforeEach(()=>localStorage.clear());
afterEach(cleanup);

describe('content draft persistence',()=>{
  it('does not recreate a cleared new-form draft during save or saved-prop synchronization',async()=>{
    const key='bitro-admin-draft-challenge-new';
    const hook=renderHook(({item})=>useContentDraft(key,item),{initialProps:{item:initial}});
    await waitFor(()=>expect(hook.result.current.ready).toBe(true));
    act(()=>hook.result.current.update('title','Edited title'));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)!).title).toBe('Edited title'));
    const published:BaseContent={...initial,title:'Edited title',status:'published',updatedAt:'2026-11-12T10:00:00.000Z'};
    act(()=>{hook.result.current.setDraft(published);hook.result.current.clearDraft();});
    expect(localStorage.getItem(key)).toBeNull();
    hook.rerender({item:published});
    await waitFor(()=>expect(hook.result.current.draft.status).toBe('published'));
    expect(localStorage.getItem(key)).toBeNull();
    hook.unmount();
    const next={...initial,id:'second-challenge',slug:'',title:''};
    const second=renderHook(()=>useContentDraft(key,next));
    await waitFor(()=>expect(second.result.current.ready).toBe(true));
    expect(second.result.current.draft.id).toBe('second-challenge');
    expect(second.result.current.draft.title).toBe('');
  });
  it('resumes draft persistence only after an explicit editor update',async()=>{
    const key='bitro-admin-draft-project-example';
    const {result}=renderHook(()=>useContentDraft(key,initial));
    await waitFor(()=>expect(result.current.ready).toBe(true));
    act(()=>result.current.clearDraft());
    expect(localStorage.getItem(key)).toBeNull();
    act(()=>result.current.update('description','A new unsaved edit'));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)!).description).toBe('A new unsaved edit'));
  });
  it('ignores a cached draft based on an older saved version after publication',async()=>{
    const key='bitro-admin-draft-challenge-first-challenge';
    localStorage.setItem(key,JSON.stringify({...initial,title:'Stale cached title'}));
    const published:BaseContent={...initial,title:'Published title',status:'published',updatedAt:'2026-11-12T11:00:00.000Z'};
    const {result}=renderHook(()=>useContentDraft(key,published));
    await waitFor(()=>expect(result.current.ready).toBe(true));
    expect(result.current.draft.title).toBe('Published title');
    expect(result.current.draft.status).toBe('published');
    expect(result.current.restored).toBe(false);
  });
});
