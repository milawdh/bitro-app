'use client';
import dynamic from 'next/dynamic';
import {loader} from '@monaco-editor/react';
import {useAdminStore} from '@/stores/admin-store';
loader.config({paths:{vs:'/monaco/vs'}});
const Editor=dynamic(()=>import('@monaco-editor/react'),{ssr:false});
export function CodeEditor({value,onChange,language='csharp',height=300,modelPath}:{value:string;onChange:(value:string)=>void;language?:string;height?:string|number;modelPath?:string}){
 const theme=useAdminStore(state=>state.settings.theme);
 return <div className="admin-code-editor" dir="ltr" style={{height,minHeight:160}}><Editor height="100%" value={value} path={modelPath} onChange={value=>onChange(value??'')} language={language} theme={theme==='dark'?'bitro-admin-dark':'vs'} loading={<div className="editor-loading">ویرایشگر آماده می‌شود…</div>} beforeMount={monaco=>monaco.editor.defineTheme('bitro-admin-dark',{base:'vs-dark',inherit:true,rules:[{token:'keyword',foreground:'c2a2ff'},{token:'comment',foreground:'68728d'},{token:'string',foreground:'9ed4a5'},{token:'number',foreground:'f0ba82'}],colors:{'editor.background':'#11141f','editor.foreground':'#dce0ef','editorLineNumber.foreground':'#535d77','editor.lineHighlightBackground':'#1b2030','editor.selectionBackground':'#6352a955'}})} options={{editContext:false,fontFamily:'"JetBrains Mono",monospace',fontSize:12,lineHeight:23,minimap:{enabled:false},automaticLayout:true,padding:{top:17,bottom:17},scrollBeyondLastLine:false,wordWrap:'on',tabSize:4,ariaLabel:'ویرایشگر کد',lineNumbersMinChars:3}}/></div>;
}
