import { describe,expect,it } from 'vitest';
import { activityBuckets,tehranDate } from './activity';
describe('learner activity',()=>{
  it('groups completion events using the learner’s Tehran date',()=>{
    expect(tehranDate(new Date('2026-11-12T21:00:00Z'))).toBe('2026-11-13');
    const buckets=activityBuckets([{id:'csharp/variables',date:'2026-11-12',kind:'lesson'},{id:'x',date:'2026-11-12',kind:'challenge'},{id:'csharp/loops',date:'2026-11-11',kind:'lesson'}],'week',new Date('2026-11-12T12:00:00Z'));
    expect(buckets.map(b=>b.count)).toEqual([0,0,0,0,0,1,1]);
  });
});
