'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { useEffect, useReducer, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Code2, ExternalLink, FileCode2, FileJson, FilePlus2, Files, FlaskConical, Folder, FolderOpen, Globe, Hammer, Maximize2, Pencil, Play, RotateCcw, Send, Square, Terminal, TestTube2, Trash2, X } from 'lucide-react';
import { CodeEditor } from '@/features/editor/code-editor';
import { apiResponse, initialFiles, isPristine, projectReducer, simulateCommand, validFilePath, type ProjectFile, type TerminalResult } from './model';
import '@/features/editor/workspace.css';
import './projects.css';
import {WorkspaceSavePanel} from '@/features/learning/learning-save-panel';
import {useAppStore} from '@/stores/use-app-store';
import {useCourseCommerce} from '@/lib/course-commerce';
import {CourseAccess} from '@/features/learning/course-access';

function EnrolledProjectWorkspace() {
  const account=useAppStore(s=>s.email);
  const storageKey='bitro-project-my-first-api:'+encodeURIComponent(account);
  const [files, dispatch] = useReducer(projectReducer, initialFiles);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState('Program.cs');
  const [tabs, setTabs] = useState(['Program.cs', 'Controllers/UsersController.cs']);
  const [closedFolders, setClosedFolders] = useState<string[]>([]);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'api' | 'problems'>('terminal');
  const [terminal, setTerminal] = useState(['BitroLearn · MyFirstApi workspace', 'Frontend-only educational preview. Type help for commands.', '']);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [built, setBuilt] = useState(false);
  const [path, setPath] = useState('/api/users');
  const [response, setResponse] = useState<ReturnType<typeof apiResponse> | null>(null);
  const [apiError, setApiError] = useState('');
  const [fileAction, setFileAction] = useState<'create' | 'rename' | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [checkpoint, setCheckpoint] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => { try { const saved = localStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed.files) && parsed.files.every((f: ProjectFile) => typeof f.path === 'string' && typeof f.content === 'string' && validFilePath(f.path))) { dispatch({ type: 'reset' }); for (const file of initialFiles) if (!parsed.files.some((item: ProjectFile) => item.path === file.path)) dispatch({ type: 'delete', path: file.path }); for (const file of parsed.files as ProjectFile[]) { dispatch({ type: 'create', path: file.path }); dispatch({ type: 'edit', path: file.path, content: file.content }); } const nextActive = parsed.files.some((f: ProjectFile) => f.path === parsed.active) ? parsed.active : parsed.files[0]?.path ?? ''; setActive(nextActive); setTabs(nextActive ? [nextActive] : []); setCheckpoint(typeof parsed.checkpoint === 'number' ? parsed.checkpoint : 0); } } } catch { /* Keep original project if local data is unavailable. */ } setReady(true); }, [storageKey]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(storageKey, JSON.stringify({ files, active, checkpoint })); } catch { /* Editor remains available without persistence. */ } }, [files, active, ready, checkpoint, storageKey]);

  const currentFile = files.find((f) => f.path === active);
  const pristine = isPristine(files);
  const folders = [...new Set(files.filter((f) => f.path.includes('/')).map((f) => f.path.split('/')[0]))];
  const baseFiles = files.filter((f) => !f.path.includes('/'));

  function openFile(filePath: string) { setActive(filePath); setTabs((all) => all.includes(filePath) ? all : [...all, filePath]); }
  function closeTab(filePath: string) { const next = tabs.filter((p) => p !== filePath); setTabs(next); if (active === filePath) setActive(next.at(-1) ?? ''); }
  function execute(nextCommand: string) {
    if (!nextCommand.trim()) return;
    if (nextCommand.trim() === 'clear') { setTerminal([]); setCommand(''); return; }
    const result: TerminalResult = nextCommand.trim() === 'ls' ? { output: files.map((file) => file.path) } : simulateCommand(nextCommand, pristine);
    setTerminal((lines) => [...lines, `$ ${nextCommand}`, ...result.output, '']);
    if ('running' in result && result.running !== undefined) setRunning(result.running);
    if ('build' in result && result.build !== undefined) setBuilt(result.build);
    setCommand(''); setBottomTab('terminal');
  }
  function submitFileAction() {
    if (!validFilePath(fileName)) { setFileError('نامی مثل Models/Book.cs وارد کنید؛ فاصله و مسیر والد مجاز نیست.'); return; }
    if (files.some((f) => f.path === fileName)) { setFileError('فایلی با این نام وجود دارد.'); return; }
    if (fileAction === 'create') { dispatch({ type: 'create', path: fileName }); openFile(fileName); }
    else { dispatch({ type: 'rename', path: active, nextPath: fileName }); setTabs((all) => all.map((p) => p === active ? fileName : p)); setActive(fileName); }
    setFileAction(null); setFileName(''); setFileError(''); setBuilt(false); setRunning(false); setResponse(null); setApiError('');
  }
  function removeFile() { if (!currentFile) return; dispatch({ type: 'delete', path: active }); closeTab(active); setBuilt(false); setRunning(false); setResponse(null); setApiError(''); setNotice('فایل حذف شد. با بازنشانی پروژه می‌توانید نسخهٔ اولیه را برگردانید.'); }
  function reset() { dispatch({ type: 'reset' }); setActive('Program.cs'); setTabs(['Program.cs']); setBuilt(false); setRunning(false); setResponse(null); setApiError(''); setResponse(null); setCheckpoint(0); setTerminal(['Sample project restored. [SIMULATION]']); setNotice('پروژه به نمونهٔ اولیه بازگشت.'); }
  function sendRequest() { if (!running) { setApiError('ابتدا اجرای نمایشی پروژه را شروع کنید.'); setResponse(null); return; } setApiError(''); setResponse(apiResponse(path)); }

  return <div className="workbench"><header className="wb-header"><Logo /><div className="wb-heading"><span className="wb-divider" /><FolderOpen size={18} /><span dir="ltr">MyFirstApi</span><span className="badge">فضای پروژه</span></div><Link href="/projects" className="btn btn-ghost wb-back">پروژه‌های من <ArrowRight size={16} /></Link></header>
    <div className="wb-subheader"><div><span className="wb-status-dot" />{running ? 'سرور نمایشی فعال است' : 'محیط توسعه آماده است'} <span className="muted">/</span><span className="pw-local-label">ذخیره‌سازی محلی</span></div><div className="pw-top-actions"><button className="btn btn-ghost" onClick={() => setShowInstructions(!showInstructions)}><CircleHelp size={15} />راهنمای پروژه</button><button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} />بازنشانی</button><button className="btn btn-primary" onClick={() => running ? (setRunning(false), setResponse(null), setTerminal((lines) => [...lines, 'Application stopped. [SIMULATION]'])) : execute('dotnet run')}>{running ? <Square size={13} /> : <Play size={13} fill="currentColor" />}{running ? 'توقف' : 'اجرای نمایشی'}</button></div></div>
    <WorkspaceSavePanel id="my-first-api" files={files} activeFile={active||null} checkpoint={checkpoint} onLoad={saved=>{dispatch({type:'reset'});for(const file of initialFiles)if(!saved.files.some(f=>f.path===file.path))dispatch({type:'delete',path:file.path});for(const file of saved.files){dispatch({type:'create',path:file.path});dispatch({type:'edit',path:file.path,content:file.content});}setActive(saved.activeFile??saved.files[0]?.path??'');setTabs(saved.activeFile?[saved.activeFile]:[]);setCheckpoint(saved.checkpoint);}}/>
    {notice && <div className="wb-notice"><CheckCircle2 size={16} /><span>{notice}</span><button className="wb-icon" aria-label="بستن پیام" onClick={() => setNotice('')}><X size={15} /></button></div>}
    <main className={`pw-layout ${!showInstructions ? 'pw-no-guide' : ''} ${expanded ? 'pw-expanded' : ''}`}>
      {!expanded && <aside className="pw-explorer"><div className="pw-explorer-title"><span><Files size={15} />فایل‌های پروژه</span><button className="wb-icon" aria-label="فایل جدید" onClick={() => { setFileAction('create'); setFileName(''); setFileError(''); }}><FilePlus2 size={16} /></button></div><div className="pw-root"><ChevronDown size={13} /><FolderOpen size={15} /><b dir="ltr">MYFIRSTAPI</b></div><div className="pw-tree" dir="ltr">{folders.map((folder) => <div key={folder}><button className="pw-folder" onClick={() => setClosedFolders((all) => all.includes(folder) ? all.filter((item) => item !== folder) : [...all, folder])}>{closedFolders.includes(folder) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}<Folder size={15} /><span>{folder}</span></button>{!closedFolders.includes(folder) && files.filter((f) => f.path.startsWith(`${folder}/`)).map((file) => <button className={`pw-file nested ${active === file.path ? 'active' : ''}`} key={file.path} onClick={() => openFile(file.path)}><FileCode2 size={14} /><span>{file.path.substring(folder.length + 1)}</span></button>)}</div>)}{baseFiles.map((file) => <button className={`pw-file ${active === file.path ? 'active' : ''}`} key={file.path} onClick={() => openFile(file.path)}>{file.path.endsWith('.json') ? <FileJson size={14} /> : <FileCode2 size={14} />}<span>{file.path}</span></button>)}</div><div className="pw-explorer-actions"><button className="btn btn-ghost" disabled={!active} onClick={() => { setFileAction('rename'); setFileName(active); setFileError(''); }}><Pencil size={13} />تغییر نام</button><button className="wb-icon" disabled={!active} aria-label="حذف فایل" onClick={removeFile}><Trash2 size={14} /></button></div><div className="pw-explorer-footer"><span className="wb-status-dot" />{ready ? 'تغییرات ذخیره شدند' : 'در حال آماده‌سازی'}</div></aside>}
      <section className="pw-main"><div className="wb-tabs pw-editor-tabs"><div className="pw-open-tabs" dir="ltr">{tabs.map((filePath) => <div className={`wb-file-tab ${active === filePath ? 'active' : ''}`} key={filePath}><button onClick={() => setActive(filePath)}><FileCode2 size={14} />{filePath.split('/').at(-1)}</button><button className="wb-icon" aria-label={`بستن ${filePath}`} onClick={() => closeTab(filePath)}><X size={12} /></button></div>)}</div><div className="wb-tab-actions"><button className="wb-icon" aria-label="بزرگ کردن ویرایشگر" onClick={() => setExpanded(!expanded)}><Maximize2 size={15} /></button></div></div><div className="pw-breadcrumb" dir="ltr"><Folder size={12} /><span>MyFirstApi</span>{active.split('/').map((part, i) => <span key={`${part}-${i}`}><ChevronRight size={10} />{part}</span>)}</div><div className="pw-code">{currentFile ? <CodeEditor value={currentFile.content} modelPath={`file:///bitrolearn/projects/my-first-api/${active}`} language={active.endsWith('.json') ? 'json' : active.endsWith('.csproj') ? 'xml' : 'csharp'} onChange={(content) => { dispatch({ type: 'edit', path: active, content }); setRunning(false); setBuilt(false); setResponse(null); setApiError(''); }} /> : <div className="pw-no-file"><Code2 size={36} /><span>یک فایل از فهرست انتخاب کنید.</span><button className="btn btn-ghost" onClick={() => { setFileAction('create'); setFileName(''); }}>ساخت فایل جدید</button></div>}</div><div className="wb-editor-toolbar"><span dir="ltr">{active.endsWith('.json') ? 'JSON' : 'C#'} <span className="wb-toolbar-dot">•</span> UTF-8 <span className="wb-toolbar-dot">•</span> {currentFile?.content.split('\n').length ?? 0} lines</span><div><span className="pw-save-state"><Check size={12} />ذخیرهٔ خودکار</span><button className="btn btn-ghost" onClick={() => execute('dotnet build')}><Hammer size={14} />ساخت نمایشی</button><button className="btn btn-ghost" onClick={() => execute('dotnet test')}><TestTube2 size={14} />تست نمایشی</button></div></div>
        <div className="pw-bottom"><div className="wb-output-tabs"><button className={bottomTab === 'terminal' ? 'active' : ''} onClick={() => setBottomTab('terminal')}><Terminal size={15} />ترمینال</button><button className={bottomTab === 'api' ? 'active' : ''} onClick={() => setBottomTab('api')}><Globe size={15} />درخواست API</button><button className={bottomTab === 'problems' ? 'active' : ''} onClick={() => setBottomTab('problems')}><CircleHelp size={15} />وضعیت پروژه</button><span className="wb-simulation">SIMULATION</span></div>
          {bottomTab === 'terminal' && <div className="pw-terminal" dir="ltr"><div className="pw-terminal-lines" role="log">{terminal.map((line, i) => <div className={line.startsWith('$') ? 'command' : line.includes('succeeded') || line.startsWith('PASS') ? 'success' : ''} key={`${i}-${line}`}>{line || '\u00a0'}</div>)}</div><form onSubmit={(e) => { e.preventDefault(); execute(command); }}><label htmlFor="terminal-command">❯</label><input id="terminal-command" value={command} onChange={(e) => setCommand(e.target.value)} autoComplete="off" spellCheck={false} placeholder="dotnet build | dotnet run | dotnet test | help" aria-label="دستور ترمینال نمایشی" /><button aria-label="اجرای دستور" className="wb-icon"><ChevronRight size={15} /></button></form></div>}
          {bottomTab === 'api' && <div className="pw-api"><div className="pw-api-label">درخواست آموزشی به سرور نمایشی؛ بدون ارتباط شبکه</div><form onSubmit={(e) => { e.preventDefault(); sendRequest(); }} dir="ltr"><span className="pw-http-method">GET</span><input aria-label="مسیر درخواست" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/api/users" /><button className="btn btn-primary" type="submit"><Send size={13} />ارسال</button></form>{apiError && <p className="pw-api-error" role="status">{apiError}</p>}{response ? <div className="pw-response"><div dir="ltr"><span className={response.status === 200 ? 'ok' : 'not-found'}>{response.status} {response.text}</span><span>application/json · mock response</span></div><pre dir="ltr">{JSON.stringify(response.body, null, 2)}</pre></div> : !apiError && <div className="pw-api-empty"><Globe size={23} /><span>ابتدا پروژه را اجرا کنید، سپس یک درخواست بفرستید.</span><small dir="ltr">/api/users · /api/users/1 · /api/users/999</small></div>}</div>}
          {bottomTab === 'problems' && <div className="pw-problems"><FlaskConical size={27} /><b>{pristine ? 'نمونهٔ آماده برای بررسی' : 'فایل‌های پروژه ویرایش شده‌اند'}</b><p>{pristine ? 'ساخت، اجرا و تست برای این نمونه به‌صورت نمایشی در دسترس است.' : 'تغییرات شما ذخیره می‌شود. بررسی خطاهای واقعی و کامپایل کد ویرایش‌شده به سرویس اجرای واقعی نیاز دارد.'}</p><span className="badge">{files.length.toLocaleString('fa-IR')} فایل · {built ? 'ساخت نمایشی موفق' : 'هنوز ساخته نشده'}</span></div>}
        </div>
      </section>
      {showInstructions && !expanded && <aside className="pw-guide"><span className="wb-overline">از اولین خط تا اولین پاسخ</span><h1>اولین رابط وب تو<span>.</span></h1><p>ساختار یک پروژهٔ واقعی را کشف کن و مسیر یک درخواست را بشناس.</p><div className="pw-guide-progress"><span>ایستگاه یادگیری</span><b>{Math.round(checkpoint / 3 * 100).toLocaleString('fa-IR')}٪</b><div><span style={{ width: `${checkpoint / 3 * 100}%` }} /></div></div><ol className="pw-checkpoints">{[{ title: 'ساختار پروژه را بشناس', text: 'فایل Program.cs نقطهٔ شروع برنامه است. سرویس‌ها ثبت و مسیرها به برنامه اضافه می‌شوند.' }, { title: 'کنترلر را دنبال کن', text: 'فایل UsersController.cs را باز کن. درخواست از کنترلر به سرویس می‌رسد و پاسخ برمی‌گردد.' }, { title: 'یک درخواست بفرست', text: 'اجرای نمایشی را بزن و از پنل درخواست API مسیر /api/users را امتحان کن. پاسخ ۴۰۴ را هم بررسی کن.' }].map((item, i) => <li className={i < checkpoint ? 'completed' : i === checkpoint ? 'current' : ''} key={item.title}><button onClick={() => setCheckpoint(i)} aria-label={`نمایش مرحلهٔ ${i + 1}`}><span>{i < checkpoint ? <Check size={13} /> : i + 1}</span><b>{item.title}</b></button>{i === checkpoint && <div><p>{item.text}</p><button className="btn btn-ghost" onClick={() => { setCheckpoint(i + 1); if (i === 0) openFile('Controllers/UsersController.cs'); if (i === 1) setBottomTab('api'); }}>متوجه شدم <ChevronLeft size={13} /></button></div>}</li>)}</ol>{checkpoint === 3 && <div className="pw-project-done"><CheckCircle2 size={29} /><b>اولین قدم را ساختی!</b><p>حالا برای درک عمیق‌تر، مسیر درخواست را در آزمایشگاه ببین.</p><Link className="btn btn-primary" href="/concept-labs/http">دیدن جریان درخواست <ChevronLeft size={14} /></Link></div>}<div className="pw-guide-tip"><FlaskConical size={18} /><p>این محیط یک پیش‌نمایش آموزشی است. درخواست‌ها، خروجی ساخت و تست‌ها همگی شبیه‌سازی‌شده‌اند.</p></div><Link className="pw-lab-link" href="/learn/dotnet/http">درس مرتبط: مسیر درخواست وب <ExternalLink size={13} /></Link></aside>}
    </main><footer className="wb-footer"><span><span className="wb-status-dot" />{running ? 'سرور نمایشی فعال' : 'پیش‌نمایش محلی'}</span><span dir="ltr">main <span>⑂</span></span><span dir="ltr">MyFirstApi · .NET 8 · C#</span></footer>
    <Dialog.Root open={fileAction !== null} onOpenChange={(open) => { if (!open) setFileAction(null); }}><Dialog.Portal><Dialog.Overlay className="pw-dialog-backdrop" /><Dialog.Content className="pw-file-dialog"><div><Dialog.Title>{fileAction === 'create' ? 'یک فایل تازه بساز' : 'نام فایل را تغییر بده'}</Dialog.Title><Dialog.Close className="wb-icon" aria-label="بستن پنجره"><X size={17} /></Dialog.Close></div><Dialog.Description>مسیر فایل را نسبت به پوشهٔ پروژه وارد کنید.</Dialog.Description><form onSubmit={(e) => { e.preventDefault(); submitFileAction(); }}><label htmlFor="new-file-name">نام و مسیر فایل</label><input id="new-file-name" dir="ltr" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Models/Book.cs" />{fileError && <span className="pw-file-error" role="alert">{fileError}</span>}<div><button className="btn btn-primary" type="submit">{fileAction === 'create' ? 'ساخت فایل' : 'ذخیرهٔ نام'}</button><Dialog.Close className="btn btn-ghost" type="button">انصراف</Dialog.Close></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

export function ProjectWorkspace(){
 const session=useAppStore(s=>s.session),account=useAppStore(s=>s.email),enrolled=useCourseCommerce(s=>s.memberships.some(m=>m.courseId==='dotnet'));
 if(!session||!enrolled)return <main style={{maxWidth:900,margin:'40px auto',padding:24}}><h1>برای ذخیرهٔ پروژه ابتدا دوره را اضافه کنید</h1><CourseAccess courseId="dotnet"/></main>;
 return <EnrolledProjectWorkspace key={account}/>;
}


