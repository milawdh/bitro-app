'use client';
import {useCallback,useEffect,useImperativeHandle,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {checkedPlayback,PlaybackRequestError,type PlaybackLoader} from './playback-source';
import type {PlaybackDto} from '@/lib/course-api';

interface Props {
 mediaKey:string;requestPlayback:PlaybackLoader;initialPosition?:number;
 elementRef?:RefObject<HTMLVideoElement|null>;onPosition?:(seconds:number)=>void;
 style?:CSSProperties;label?:string;
}

export function RenewableVideo({mediaKey,requestPlayback,initialPosition=0,elementRef,onPosition,style,label='ویدئوی دوره'}:Props){
 const video=useRef<HTMLVideoElement>(null);
 useImperativeHandle(elementRef,()=>video.current!,[]);
 const loader=useRef(requestPlayback),positionCallback=useRef(onPosition),initial=useRef(initialPosition);
 useEffect(()=>{loader.current=requestPlayback;positionCallback.current=onPosition;initial.current=initialPosition;},[requestPlayback,onPosition,initialPosition]);
 const lease=useRef<PlaybackDto|null>(null),position=useRef(initialPosition),wantsPlay=useRef(false),switching=useRef(false);
 const generation=useRef(0),abort=useRef<AbortController|null>(null),pending=useRef<Promise<void>|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),failures=useRef(0),lastProgress=useRef(0);
 const lastPersisted=useRef(0);
 const [status,setStatus]=useState('در حال دریافت لینک پخش…'),[error,setError]=useState('');
 const expired=useCallback(()=>!lease.current||Date.parse(lease.current.expiresAt)<=Date.now(),[]);
 const remember=useCallback((force=true)=>{
  const element=video.current;
  if(element&&!switching.current&&Number.isFinite(element.currentTime)){
   position.current=element.currentTime;
   if(force||Date.now()-lastPersisted.current>=5000){positionCallback.current?.(position.current);lastPersisted.current=Date.now();}
  }
 },[video]);
 const renew=useCallback((capture=true,resumeAfterMediaFailure?:boolean):Promise<void>=>{
  if(pending.current)return pending.current;
  const element=video.current;if(!element)return Promise.resolve();
  if(capture&&!switching.current){position.current=element.currentTime;wantsPlay.current=resumeAfterMediaFailure??!element.paused;}
  switching.current=true;element.pause();
  if(timer.current)clearTimeout(timer.current);
  const current=generation.current,controller=new AbortController();abort.current?.abort();abort.current=controller;
  setError('');setStatus('در حال بررسی دسترسی و دریافت لینک تازه…');
  const task:Promise<void>=(async()=>{
   try{
    const next=checkedPlayback(await Promise.resolve().then(()=>loader.current(controller.signal)));
    if(controller.signal.aborted||generation.current!==current)return;
    if(Date.parse(next.expiresAt)<=Date.now())throw new PlaybackRequestError(502,'لینک دریافت‌شده منقضی شده است. دوباره تلاش کنید.');
    lease.current=next;element.src=next.url;element.load();
   }catch(cause){
    if(controller.signal.aborted||generation.current!==current)return;
    lease.current=null;switching.current=false;element.pause();element.removeAttribute('src');element.load();
    setError(cause instanceof Error?cause.message:'پخش ممکن نشد؛ دوباره تلاش کنید.');setStatus('پخش متوقف شد؛ موقعیت شما محفوظ است.');
   }finally{if(abort.current===controller)pending.current=null;}
  })();
  pending.current=task;return task;
 },[video]);
 const finishRestore=useCallback(()=>{
  const element=video.current;
  if(!element||!lease.current||!switching.current)return;
  switching.current=false;setStatus('آمادهٔ پخش');
  if(timer.current)clearTimeout(timer.current);
  const remaining=Date.parse(lease.current.expiresAt)-Date.now();
  timer.current=setTimeout(()=>{
   if(video.current&&!video.current.paused){wantsPlay.current=true;void renew();}
  },Math.max(1000,remaining-Math.min(5000,remaining/10)));
  if(wantsPlay.current)void element.play().catch(()=>{setStatus('برای ادامه، دکمهٔ پخش را بزنید.');});
 },[renew,video]);
 useEffect(()=>{
  generation.current++;position.current=initial.current;wantsPlay.current=false;switching.current=false;lease.current=null;pending.current=null;failures.current=0;
  void renew(false);
  const check=()=>{
   if(lease.current&&expired()&&wantsPlay.current&&!document.hidden)void renew();
  };
  const leaving=()=>remember();
  window.addEventListener('online',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);window.addEventListener('pagehide',leaving);
  return()=>{
   remember();abort.current?.abort();if(timer.current)clearTimeout(timer.current);
   window.removeEventListener('online',check);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('pagehide',leaving);
  };
 },[mediaKey,renew,remember,expired]);
 const matchingSource=()=>lease.current&&video.current?.currentSrc===new URL(lease.current.url,location.href).href;
 return <div style={{width:'100%'}}>
  <video ref={video} aria-label={label} controls preload="metadata" style={{width:'100%',borderRadius:16,...style}}
   onLoadedMetadata={()=>{
    const element=video.current;if(!element||!matchingSource()||!switching.current)return;
    const target=Math.max(0,Math.min(position.current,Number.isFinite(element.duration)?element.duration:position.current));
    if(Math.abs(element.currentTime-target)>.01)element.currentTime=target;else finishRestore();
   }}
   onSeeked={()=>{if(matchingSource())finishRestore();remember();}}
   onPlay={()=>{wantsPlay.current=true;if(expired())void renew();}}
   onPause={()=>{if(!switching.current){wantsPlay.current=false;remember();}}}
   onEnded={()=>{wantsPlay.current=false;remember();}}
   onCanPlay={()=>{failures.current=0;}}
   onTimeUpdate={()=>{
    const element=video.current;if(element&&!switching.current){
     if(Math.abs(element.currentTime-lastProgress.current)>.5){failures.current=0;lastProgress.current=element.currentTime;}
     remember(false);
    }
   }}
   onError={()=>{
    if(!lease.current||pending.current||!matchingSource())return;
    if(failures.current++<1){void renew(true,video.current?.error?wantsPlay.current:undefined);}
    else{switching.current=false;video.current?.pause();setError('پخش بازیابی نشد؛ برای دریافت لینک تازه دوباره تلاش کنید.');}
   }}/>
  {error?<div role="alert"><p>{error}</p><button className="btn btn-ghost" onClick={()=>{failures.current=0;void renew(false);}}>تلاش دوباره برای پخش</button></div>:<span role="status" style={{fontSize:12}}>{status}</span>}
 </div>;
}
