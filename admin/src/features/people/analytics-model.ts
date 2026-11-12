import type { AdminLesson, LearningEvent } from '@/lib/types';

export function reportEvents(events: LearningEvent[], start: string, end: string) {
  const from = new Date(`${start}T00:00:00+03:30`).getTime();
  const through = new Date(`${end}T23:59:59.999+03:30`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(through) || from > through) return [];
  return events.filter((event) => { const time = new Date(event.date).getTime(); return time >= from && time <= through; });
}

export function summarizeReport(events: LearningEvent[]) {
  const started = new Set(events.filter((event) => event.kind === 'lesson_started').map((event) => `${event.userId}/${event.lessonId}`));
  const completedPairs = new Set(events.filter((event) => event.kind === 'lesson_completed').map((event) => `${event.userId}/${event.lessonId}`));
  const completed = events.filter((event) => event.kind === 'lesson_completed').length;
  const matched = [...started].filter((pair) => completedPairs.has(pair)).length;
  return { learners: new Set(events.map((event) => event.userId)).size, completed, minutes: events.reduce((sum, event) => sum + event.durationMinutes, 0), completionRate: started.size ? Math.round(matched / started.size * 100) : 0, challenges: events.filter((event) => event.kind === 'challenge_completed').length };
}

export function groupReportDays(events: LearningEvent[], start: string, end: string) {
  const from = new Date(`${start}T12:00:00+03:30`).getTime();
  const through = new Date(`${end}T12:00:00+03:30`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(through) || from > through) return [];
  const length = Math.floor((through - from) / 86400000) + 1;
  if (length > 366) return [];
  return Array.from({ length }, (_, index) => {
    const date = new Date(from + index * 86400000).toISOString().slice(0, 10);
    const selected = events.filter((event) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.date)) === date);
    return { date, ...summarizeReport(selected) };
  });
}

export function courseReport(events: LearningEvent[], lessons: AdminLesson[]) {
  const result = new Map<string, { completed: number; learners: Set<string>; minutes: number }>();
  for (const event of events) {
    const courseId = lessons.find((lesson) => lesson.id === event.lessonId)?.courseId;
    if (!courseId) continue;
    const current = result.get(courseId) ?? { completed: 0, learners: new Set<string>(), minutes: 0 };
    if (event.kind === 'lesson_completed') current.completed++;
    current.learners.add(event.userId); current.minutes += event.durationMinutes; result.set(courseId, current);
  }
  return [...result.entries()].map(([courseId, value]) => ({ courseId, completed: value.completed, learners: value.learners.size, minutes: value.minutes })).sort((first, second) => second.completed - first.completed);
}
