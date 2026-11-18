import type {PlaybackDto} from '@/lib/course-api';

export type PlaybackLoader=(signal:AbortSignal)=>Promise<PlaybackDto>;
export class PlaybackRequestError extends Error {
 constructor(public readonly status:number,message:string){super(message);}
}
export function checkedPlayback(value:unknown):PlaybackDto {
 const data=value as Partial<PlaybackDto>|null;
 if(!data||typeof data.url!=='string'||typeof data.expiresAt!=='string'||!Number.isFinite(Date.parse(data.expiresAt)))throw new PlaybackRequestError(502,'نشانی پخش معتبر دریافت نشد.');
 const url=new URL(data.url,typeof location==='undefined'?'http://localhost':location.href);
 if(!['https:','http:'].includes(url.protocol))throw new PlaybackRequestError(502,'نشانی پخش معتبر نیست.');
 return {url:data.url,expiresAt:data.expiresAt};
}
/** Each request re-enters the backend authorization path. Never cache signed URLs. */
export function backendPlaybackLoader(endpoint:string,method:'GET'|'POST'='POST',csrfEndpoint='/public/auth/csrf?area=app'):PlaybackLoader {
 return async signal=>{
  const headers:Record<string,string>={};
  if(method==='POST'){
   const csrf=await fetch(csrfEndpoint,{credentials:'include',cache:'no-store',signal});
   if(!csrf.ok)throw new PlaybackRequestError(csrf.status,'دریافت مجوز پخش ممکن نشد.');
   headers['X-CSRF-TOKEN']=(await csrf.json()).requestToken;
  }
  const response=await fetch(endpoint,{method,headers,credentials:'include',cache:'no-store',signal});
  if(!response.ok)throw new PlaybackRequestError(response.status,response.status===401?'برای ادامهٔ پخش دوباره وارد حساب شوید.':response.status===403?'دسترسی شما به این ویدئو تأیید نشد.':'دریافت لینک تازه ممکن نشد؛ دوباره تلاش کنید.');
  return checkedPlayback(await response.json());
 };
}
