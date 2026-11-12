import { LessonEditor } from '@/features/curriculum/lesson-editor';
export default async function Page({searchParams}:{searchParams:Promise<{course?:string}>}){const {course}=await searchParams;return <LessonEditor courseId={course}/>;}
