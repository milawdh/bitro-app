'use client';
import {useEffect} from 'react';
import {MotionConfig} from 'motion/react';
import {CheckCircle2,X,AlertCircle} from 'lucide-react';
import {useAdminStore} from '@/stores/admin-store';
function Toast({id,message,type}:{id:string;message:string;type:'success'|'error'}){
 const dismiss=useAdminStore(state=>state.dismissToast);
 useEffect(()=>{const timer=setTimeout(()=>dismiss(id),5500);return()=>clearTimeout(timer);},[id,dismiss]);
 return <div className={`admin-toast ${type}`} role={type==='error'?'alert':'status'}>{type==='error'?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}<span>{message}</span><button className="icon-button" onClick={()=>dismiss(id)} aria-label="بستن پیام"><X size={15}/></button></div>;
}
export function Providers({children}:{children:React.ReactNode}){
 const theme=useAdminStore(state=>state.settings.theme),setReady=useAdminStore(state=>state.setHasHydrated),toasts=useAdminStore(state=>state.toasts);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;},[theme]);
 useEffect(()=>setReady(true),[setReady]);
 return <MotionConfig reducedMotion="user">{children}<div className="admin-toasts">{toasts.map(toast=><Toast key={toast.id} {...toast}/>)}</div></MotionConfig>;
}
