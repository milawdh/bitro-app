'use client';
import Link from 'next/link';
import {courseProvider} from '@/lib/courses';
import {useCourseCommerce} from '@/lib/course-commerce';
import {useAppStore} from '@/stores/use-app-store';
import {CourseAccess} from '@/features/learning/course-access';
export default function MyCourses(){
 const memberships=useCourseCommerce(s=>s.memberships),session=useAppStore(s=>s.session);
 return <main><h1>دوره‌های من</h1>{!session?<Link className="btn btn-primary" href="/login">ورود به حساب</Link>:!memberships.length?<section className="panel" style={{padding:24}}><p>هنوز دوره‌ای اضافه نکرده‌اید.</p><Link href="/learn" className="btn btn-primary">انتخاب دوره</Link></section>:memberships.map(m=><article key={m.courseId}><Link href={`/learn/${m.courseId}`}><h2>{courseProvider.get(m.courseId)?.title??m.courseId}</h2></Link><CourseAccess courseId={m.courseId}/></article>)}</main>;
}
