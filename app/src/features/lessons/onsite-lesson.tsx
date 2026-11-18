'use client';
import Link from 'next/link';
import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from '@/lib/course-commerce';
import type {LessonDto,AnimationBinding} from '@/lib/course-api';
import {CourseAccess} from '@/features/learning/course-access';
import {ConceptSimulator} from '@/features/concepts/concept-simulator';
import {useEffect,useMemo,useRef,useState} from 'react';
import {learningProvider} from '@/lib/learning-provider';
import {RenewableVideo} from '@/features/media/renewable-video';
import {demoPlaybackLoader} from '@/lib/demo-playback';

type OnsiteLessonRecord=Pick<LessonDto,'id'|'title'|'intro'|'hasQuiz'> & {videoUrl:string|null;animations:AnimationBinding[]};
const videoLesson:OnsiteLessonRecord={id:'demo-video',title:'درس ویدئویی بدون آزمون',intro:'این درس نمونه، ارائهٔ ویدئو بدون آزمون یا انیمیشن اجباری را نشان می‌دهد.',hasQuiz:false,videoUrl:'/media/course-preview.mp4',animations:[]};
export function OnsiteLesson({courseId}:{courseId:string}){
 const session=useAppStore(s=>s.session),enrolled=useCourseCommerce(s=>s.memberships.some(m=>m.courseId===courseId));
 const account=useAppStore(s=>s.email);
 const [position,setPosition]=useState(0),[completed,setCompleted]=useState(false),[error,setError]=useState(''),[positionLoaded,setPositionLoaded]=useState(false);const video=useRef<HTMLVideoElement>(null);
 const requestPlayback=useMemo(()=>demoPlaybackLoader(courseId),[courseId]);
 const id=courseId+'/video-overview';
 useEffect(()=>{let active=true;setPositionLoaded(false);if(session&&enrolled)learningProvider.lesson(id).then(s=>{if(active){setPosition(s.progress.videoPositionSeconds??0);setCompleted(Boolean(s.progress.completedAt));setPositionLoaded(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,session,enrolled,account]);
 if(!session||!enrolled)return <main style={{maxWidth:900,margin:'40px auto',padding:24}}><h1>ابتدا دوره را اضافه کنید</h1><CourseAccess courseId={courseId}/></main>;
 const lesson=videoLesson;
 return <main className="panel" style={{maxWidth:1000,margin:'40px auto',padding:32}}><Link href={`/learn/${courseId}`}>بازگشت به دوره</Link><h1>{lesson.title}</h1>{lesson.intro&&<p>{lesson.intro}</p>}{lesson.videoUrl&&positionLoaded&&<RenewableVideo mediaKey={account+":"+id} elementRef={video} requestPlayback={requestPlayback} initialPosition={position} onPosition={seconds=>{void learningProvider.videoPosition(id,seconds).catch(e=>setError(e.message));}}/>} {lesson.animations.filter(a=>a.enabled).map(a=><ConceptSimulator key={a.key} concept={a.key} settings={a.settings}/>)}<p className="muted">ویدئوی این صفحه نمونهٔ محلی برای نمایش پخش است.</p><button className="btn btn-primary" disabled={completed} onClick={()=>learningProvider.completeVideo(id,video.current?.currentTime??0).then(()=>{setCompleted(true);useAppStore.getState().completeLesson(id);}).catch(e=>setError(e.message))}>{completed?'درس تکمیل شده است':'درس را تمام کردم'}</button>{error&&<p role="alert">{error}</p>}</main>;
}
