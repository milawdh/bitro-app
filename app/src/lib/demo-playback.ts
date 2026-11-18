import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from './course-commerce';
import {PlaybackRequestError,type PlaybackLoader} from '@/features/media/playback-source';

/** Local UI provider until account/content integration. Uses the same expiring-link contract. */
export function demoPlaybackLoader(courseId:string,publicIntroduction=false):PlaybackLoader {
 return async signal=>{
  signal.throwIfAborted();
  if(!publicIntroduction){
   if(!useAppStore.getState().session)throw new PlaybackRequestError(401,'برای ادامهٔ پخش دوباره وارد حساب شوید.');
   if(!useCourseCommerce.getState().memberships.some(m=>m.courseId===courseId))throw new PlaybackRequestError(403,'دسترسی شما به این ویدئو تأیید نشد.');
  }
  return {url:'/media/course-preview.mp4?lease='+crypto.randomUUID(),expiresAt:new Date(Date.now()+4*60*60*1000).toISOString()};
 };
}
