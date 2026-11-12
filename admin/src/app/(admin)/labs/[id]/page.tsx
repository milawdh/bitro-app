import { LabEditor } from '@/features/content/lab-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <LabEditor id={id}/>;}
