import { notFound } from 'next/navigation';
import { LessonPlayer } from '@/features/lessons/lesson-player';
import { lessonDefinitions } from '@/features/lessons/lesson-data';
import { courseProvider } from '@/lib/courses';
import {OnsiteLesson} from '@/features/lessons/onsite-lesson';
export default async function LessonPage({ params, searchParams }: { params: Promise<{ courseSlug: string; lessonSlug: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { courseSlug, lessonSlug } = await params;
  const { mode } = await searchParams;
  const initialMode = mode === 'explore' ? 'explore' : 'guided';
  const course = courseProvider.get(courseSlug);
  if(courseSlug==='csharp'&&lessonSlug==='video-overview')return <OnsiteLesson courseId={courseSlug}/>;
  if (!course?.lessons.some(lesson => lesson.slug === lessonSlug) || !lessonDefinitions[lessonSlug]) notFound();
  return <LessonPlayer key={`${courseSlug}/${lessonSlug}/${initialMode}`} courseSlug={courseSlug} lessonSlug={lessonSlug} initialMode={initialMode} />;
}
