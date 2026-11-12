import { ChallengeEditor } from '@/features/content/challenge-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ChallengeEditor id={id}/>;}
