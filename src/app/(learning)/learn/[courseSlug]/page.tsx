import { CourseDetail } from '@/features/learning/learning-pages';
export default async function Page({ params }: { params: Promise<{ courseSlug: string }> }) { const { courseSlug } = await params; return <CourseDetail slug={courseSlug} />; }
