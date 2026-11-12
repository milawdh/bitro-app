import { describe, expect, it } from 'vitest';
import type { LearningEvent } from '@/lib/types';
import { groupReportDays, reportEvents, summarizeReport } from './analytics-model';

const events: LearningEvent[] = [
  { id: '1', userId: 'a', lessonId: 'variables', kind: 'lesson_started', date: '2026-11-12T19:00:00Z', durationMinutes: 3 },
  { id: '2', userId: 'a', lessonId: 'variables', kind: 'lesson_completed', date: '2026-11-12T20:45:00Z', durationMinutes: 8 },
  { id: '3', userId: 'b', lessonId: 'loops', kind: 'challenge_completed', date: '2026-11-13T08:00:00Z', durationMinutes: 4 },
];
describe('admin learning reports', () => {
  it('filters full Tehran calendar days, including the midnight boundary', () => {
    expect(reportEvents(events, '2026-11-12', '2026-11-12').map((event) => event.id)).toEqual(['1']);
    expect(reportEvents(events, '2026-11-13', '2026-11-13').map((event) => event.id)).toEqual(['2', '3']);
    expect(reportEvents(events, '2026-11-14', '2026-11-12')).toEqual([]);
  });
  it('counts unique learners and distinguishes lessons from challenges', () => {
    expect(summarizeReport(events)).toEqual({ learners: 2, completed: 1, minutes: 15, completionRate: 100, challenges: 1 });
    expect(summarizeReport([]).completionRate).toBe(0);
  });
  it('retains empty days in a timeline instead of inventing activity', () => {
    expect(groupReportDays(events, '2026-11-11', '2026-11-13').map((day) => day.completed)).toEqual([0, 0, 1]);
  });
  it('measures completion only for distinct learner and lesson pairs started in this range', () => {
    const unrelated: LearningEvent = { ...events[1], id: '4', userId: 'other', lessonId: 'objects' };
    expect(summarizeReport([events[0], unrelated]).completionRate).toBe(0);
    expect(summarizeReport([events[0], events[1], { ...events[1], id: 'retry' }]).completionRate).toBe(100);
  });
});
