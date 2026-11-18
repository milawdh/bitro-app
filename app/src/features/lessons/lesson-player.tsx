'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Braces, Check, CheckCircle2, ChevronLeft, CircleHelp, Code2, Copy, Eye, FlaskConical, GripVertical, Lightbulb, Maximize2, Minimize2, Moon, PanelRightClose, Play, RotateCcw, Sparkles, Sun, Terminal, Trophy, X } from 'lucide-react';
import { ConceptSimulator } from '@/features/concepts/concept-simulator';
import { CodeEditor } from '@/features/editor/code-editor';
import { courseProvider, faNumber } from '@/lib/courses';
import { useAppStore } from '@/stores/use-app-store';
import { canAdvanceLesson, lessonDefinitions, lessonStepTitles, runLessonPreview } from './lesson-data';
import './lessons.css';
import { useCourseCommerce } from '@/lib/course-commerce';
import { CourseAccess } from '@/features/learning/course-access';
import {LessonSavePanel} from '@/features/learning/learning-save-panel';
import {learningProvider} from '@/lib/learning-provider';

type MobilePanel = 'learn' | 'visualize' | 'code' | 'output';

function EnrolledLessonPlayer({ courseSlug, lessonSlug, initialMode = 'guided' }: { courseSlug: string; lessonSlug: string; initialMode?: 'guided' | 'explore' }) {
  const lesson = lessonDefinitions[lessonSlug];
  const course = courseProvider.get(courseSlug)!;
  const lessonId = `${courseSlug}/${lessonSlug}`;
  const account=useAppStore(s=>s.email);
  const bufferKey=`bitro-lesson-${encodeURIComponent(account)}:${lessonId}`;
  const [assessmentError,setAssessmentError]=useState('');
  const completeLesson = useAppStore(state => state.completeLesson);
  const completed = useAppStore(state => state.completedLessons.includes(lessonId));
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);
  const [mode, setMode] = useState<'guided' | 'explore'>(initialMode);
  const [step, setStep] = useState(0);
  const [guidedCode, setGuidedCode] = useState(lesson.code);
  const [exploreCode, setExploreCode] = useState(lesson.code);
  const [loaded, setLoaded] = useState(false);
  const [selection, setSelection] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [passed, setPassed] = useState(false);
  const [hint, setHint] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'visualize' | 'code'>(initialMode === 'explore' ? 'code' : 'visualize');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(initialMode === 'explore' ? 'code' : 'learn');
  const [showInstructions, setShowInstructions] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [inspectorDrawer, setInspectorDrawer] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [supported, setSupported] = useState(true);
  const [copied, setCopied] = useState(false);
  const [widths, setWidths] = useState({ instructions: 285, inspector: 230 });
  const layout = useRef<HTMLDivElement>(null);
  const code = mode === 'guided' ? guidedCode : exploreCode;
  const updateCode = mode === 'guided' ? setGuidedCode : setExploreCode;
  const nextLesson = course.lessons[course.lessons.findIndex(item => item.slug === lessonSlug) + 1];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(bufferKey) ?? 'null');
      if (saved) {
        if (typeof saved.guidedCode === 'string') setGuidedCode(saved.guidedCode);
        if (typeof saved.exploreCode === 'string') setExploreCode(saved.exploreCode);
        if (typeof saved.passed === 'boolean') setPassed(saved.passed);
        if (typeof saved.step === 'number') setStep(Math.max(0, Math.min(saved.passed ? 4 : 3, saved.step)));
      }
    } catch { /* A corrupt local preview snapshot is safely ignored. */ }
    setLoaded(true);
  }, [lessonId,bufferKey]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(bufferKey, JSON.stringify({ guidedCode, exploreCode, passed, step })); } catch { /* The lesson stays usable if browser storage is unavailable. */ }
  }, [guidedCode, exploreCode, passed, step, loaded, bufferKey]);

  const run = useCallback(() => {
    const result = runLessonPreview(code, lesson);
    setSupported(result.supported); setOutput(result.output); setShowInspector(true);
    setMobilePanel('output');
    if (window.innerWidth > 760 && window.innerWidth <= 1200) setInspectorDrawer(true);
  }, [code, lesson, setSupported, setOutput, setShowInspector, setMobilePanel, setInspectorDrawer]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [run]);
  const resize = (event: PointerEvent<HTMLDivElement>, panel: 'instructions' | 'inspector') => {
    event.preventDefault();
    const origin = event.clientX;
    const initial = widths[panel];
    const move = (moveEvent: globalThis.PointerEvent) => setWidths(previous => ({ ...previous, [panel]: Math.max(210, Math.min(430, initial + (panel === 'instructions' ? origin - moveEvent.clientX : moveEvent.clientX - origin))) }));
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  const goToStep = (value: number) => { setStep(value); setHint(false); if (value === 1) setWorkspaceTab('visualize'); if (value === 2 || value === 3) setWorkspaceTab('code'); if (value === 4) setWorkspaceTab('visualize'); };
  const advance = () => {
    if (step === 4 && passed) { completeLesson(lessonId); return; }
    if (canAdvanceLesson(step, passed)) goToStep(Math.min(4, step + 1));
  };
  const submit = async () => {setAssessmentError('');try{const result=await learningProvider.submit(lessonId,true,{contentVersion:1,idempotencyKey:crypto.randomUUID(),answers:[{questionId:'lesson',optionId:String(selection)}]});setFeedback(result.isPassed?'correct':'incorrect');if(result.isPassed){setPassed(true);completeLesson(lessonId);}}catch(e){setAssessmentError((e as Error).message);}};
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  const progress = completed ? 100 : Math.round(step / 5 * 100);

  return <div className={`lesson-player ${maximized ? 'blp-maximized' : ''}`}>
    <LessonSavePanel id={lessonId} revision={passed} buffer={{guidedCode,exploreCode,step}} onLoad={s=>{setGuidedCode(s.drafts.find(d=>d.mode==='guided')?.code??lesson.code);setExploreCode(s.drafts.find(d=>d.mode==='explore')?.code??lesson.code);setStep(s.progress.completedAt?s.progress.step:Math.min(3,s.progress.step));setPassed(Boolean(s.progress.completedAt));}}/>
    {assessmentError&&<p role="alert">{assessmentError}</p>}
    <header className="blp-header"><Link href="/dashboard" className="blp-logo" aria-label="داشبورد بیترو"><Braces size={26} /><span dir="ltr">bitro<span>learn</span></span></Link><span className="blp-header-divider" /><Link href={`/learn/${courseSlug}`} className="blp-course-back"><ArrowRight size={15} />{course.title}</Link><div className="blp-header-progress"><span>پیشرفت درس</span><div><i style={{ width: `${progress}%` }} /></div><strong>{faNumber(progress)}٪</strong></div><button className="blp-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="تغییر پوسته">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><Link href={`/learn/${courseSlug}`} className="blp-close" aria-label="خروج از درس"><X size={18} /></Link></header>
    <div className="blp-toolbar"><div className="blp-lesson-title"><span className="blp-lesson-icon"><BookOpen size={17} /></span><div><h1>{lesson.title}</h1><span>{faNumber(lesson.duration)} دقیقه · درس تعاملی</span></div></div><div className="blp-mode-switch" aria-label="حالت درس"><button className={mode === 'guided' ? 'active' : ''} onClick={() => setMode('guided')}><BookOpen size={13} /> با راهنما</button><button className={mode === 'explore' ? 'active' : ''} onClick={() => { setMode('explore'); setWorkspaceTab('code'); }}><FlaskConical size={13} /> آزمایش آزاد</button></div><div className="blp-toolbar-actions"><span className="blp-preview-badge"><span /> پیش‌نمایش آموزشی</span><button className="blp-icon" onClick={() => setShowInstructions(!showInstructions)} aria-label={showInstructions ? 'بستن راهنمای درس' : 'نمایش راهنمای درس'}><PanelRightClose size={17} /></button><button className="blp-icon" onClick={() => { if (window.innerWidth <= 1200) setInspectorDrawer(!inspectorDrawer); else setShowInspector(!showInspector); }} aria-label="نمایش یا پنهان‌کردن خروجی"><Terminal size={17} /></button></div></div>
    <div ref={layout} className={`blp-layout ${!showInstructions ? 'blp-hide-instructions' : ''} ${!showInspector ? 'blp-hide-inspector' : ''} ${inspectorDrawer ? 'blp-inspector-drawer' : ''} blp-mobile-${mobilePanel}`} style={{ '--blp-instructions': `${widths.instructions}px`, '--blp-inspector': `${widths.inspector}px` } as CSSProperties}>
      <aside className="blp-instructions">
        <div className="blp-step-top"><span>قدم {faNumber(step + 1)} از ۵</span><span>{faNumber(Math.round((step + 1) / 5 * 100))}٪</span></div><nav className="blp-steps" aria-label="قدم‌های درس">{lessonStepTitles.map((title, index) => <button key={title} className={`${step === index ? 'active' : ''} ${index < step || index === 4 && completed ? 'done' : ''}`} disabled={index === 4 && !passed} onClick={() => goToStep(index)}><span>{index < step || index === 4 && completed ? <Check size={12} /> : faNumber(index + 1)}</span>{title}{step === index && <ChevronLeft size={14} />}</button>)}</nav>
        <div className="blp-reading"><span className="blp-reading-label">{mode === 'explore' ? 'آزمایش آزاد · کد تو محفوظ است' : lessonStepTitles[step]}</span><h2>{step === 0 ? 'از اینجا شروع کنیم' : step === 1 ? 'حالا نوبت توست' : step === 2 ? 'از تصویر به کد' : step === 3 ? 'یک چالش کوچک' : 'خوب پیش رفتی!'}</h2>
          {step === 0 && <><p>{lesson.intro}</p><div className="blp-analogy"><Lightbulb size={17} /><p>{lesson.analogy}</p></div><h3>در این درس یاد می‌گیری</h3><ul className="blp-objectives">{lesson.objectives.map(objective => <li key={objective}><Check size={13} />{objective}</li>)}</ul></>}
          {step === 1 && <><p>{lesson.experiment}</p><div className="blp-try-note"><Eye size={18} /><p>به نتیجه نگاه کن، یک تغییر کوچک بده و دوباره مقایسه کن. هر آزمایش را می‌توانی از نو شروع کنی.</p></div><button className="btn btn-ghost blp-mobile-show" onClick={() => { setMobilePanel('visualize'); setWorkspaceTab('visualize'); }}>نمایش آزمایش <ArrowLeft size={15} /></button></>}
          {step === 2 && <><p>کد نمونه را بخوان و خروجی آن را پیش‌بینی کن. سپس دکمهٔ «اجرای نمونه» را بزن و نتیجهٔ پیش‌بینی‌شده را مقایسه کن.</p><div className="blp-analogy"><Code2 size={17} /><p>اجرای این نسخه شبیه‌سازی نمونهٔ مشخص است. کد دلخواه در این مرورگر کامپایل نمی‌شود.</p></div><button className="btn btn-ghost blp-mobile-show" onClick={() => { setMobilePanel('code'); setWorkspaceTab('code'); }}>رفتن به ویرایشگر <ArrowLeft size={15} /></button></>}
          {step === 3 && <><p>{lesson.question}</p><div className="blp-quiz">{lesson.choices.map((choice, index) => <button key={choice} onClick={() => { setSelection(index); setFeedback(null); }} className={`${selection === index ? 'selected' : ''} ${feedback === 'correct' && selection === index ? 'correct' : ''}`} aria-pressed={selection === index}><span>{['الف', 'ب', 'ج'][index]}</span>{choice}</button>)}</div><button className="btn btn-primary blp-submit" onClick={submit} disabled={selection === null}>بررسی پاسخ <Check size={15} /></button>{feedback && <div className={`blp-feedback ${feedback}`} role="status">{feedback === 'correct' ? <><CheckCircle2 size={17} /><p>درست گفتی! {lesson.explanation}</p></> : <><CircleHelp size={17} /><p>هنوز دقیق نیست. یک بار دیگر به نمونه نگاه کن؛ می‌توانی از راهنما هم کمک بگیری.</p></>}</div>}</>}
          {step === 4 && <><div className="blp-summary-icon"><Trophy size={32} /></div><p>{lesson.explanation}</p><ul className="blp-objectives">{lesson.objectives.map(objective => <li key={objective}><CheckCircle2 size={14} />{objective}</li>)}</ul>{completed && <div className="blp-feedback correct" role="status"><CheckCircle2 size={17} /><p>این درس در پیشرفت تو ثبت شد. آمادهٔ قدم بعدی هستی!</p></div>}</>}
          {step !== 4 && <div className="blp-hint"><button onClick={() => setHint(!hint)} aria-expanded={hint}><Lightbulb size={15} />{hint ? 'بستن راهنما' : 'یک راهنمای کوچک'}<ChevronLeft size={13} /></button>{hint && <p>{lesson.hint}</p>}</div>}
        </div><div className="blp-instruction-footer"><Sparkles size={14} /> هر تجربه، یک قدم به فهم عمیق‌تر.</div>
      </aside>
      <div className="blp-resize blp-resize-instructions" onPointerDown={event => resize(event, 'instructions')} role="separator" aria-orientation="vertical" aria-label="تغییر عرض راهنمای درس" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setWidths(previous => ({ ...previous, instructions: Math.max(210, Math.min(430, previous.instructions + (event.key === 'ArrowLeft' ? 20 : -20))) })); }}><GripVertical size={12} /></div>
      <main className="blp-workspace"><div className="blp-workspace-top"><div className="blp-workspace-tabs"><button className={workspaceTab === 'visualize' ? 'active' : ''} onClick={() => { setWorkspaceTab('visualize'); setMobilePanel('visualize'); }}><FlaskConical size={14} /> تصویر مفهوم</button><button className={workspaceTab === 'code' ? 'active' : ''} onClick={() => { setWorkspaceTab('code'); setMobilePanel('code'); }}><Code2 size={14} /> کد سی‌شارپ</button></div><button className="blp-icon" aria-label={maximized ? 'بازگشت از حالت تمام‌صفحه' : 'بزرگ‌کردن فضای کار'} onClick={() => setMaximized(!maximized)}>{maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div>
        <div className="blp-workspace-content">{workspaceTab === 'visualize' ? <><div className="blp-visual-label"><span><span /> آزمایش زنده</span><small>تغییر بده، ببین، یاد بگیر.</small></div><ConceptSimulator concept={lesson.concept} /><div className="blp-visual-bottom"><FlaskConical size={15} /><p>این تصویر، مدل آموزشی ساده‌شده است؛ هر گام را خودت کنترل می‌کنی.</p></div></> : <div className="blp-code-workspace"><div className="blp-filebar" dir="ltr"><span className="blp-file-icon">C#</span><span>Program.cs</span><i>{mode === 'explore' ? 'explore' : 'guided'}</i><button onClick={copy} aria-label="کپی کد">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div><CodeEditor modelPath={`file:///bitrolearn/lessons/${lessonId}/${mode}.cs`} value={code} onChange={updateCode} language="csharp" height="420px" /><div className="blp-editor-bottom"><span dir="ltr">C# · UTF-8</span><span>ذخیرهٔ خودکار در مرورگر</span></div><div className="blp-code-actions"><button className="btn btn-ghost" onClick={() => { updateCode(lesson.code); setOutput([]); }}><RotateCcw size={14} /> کد اولیه</button><button className="btn btn-primary" onClick={run}><Play size={14} fill="currentColor" /> اجرای نمونه <kbd>Ctrl ↵</kbd></button></div><p className="blp-execution-disclaimer">پیش‌نمایش فقط خروجی ازپیش‌تعریف‌شدهٔ کد نمونه را نمایش می‌دهد.</p></div>}</div>
      </main>
      <div className="blp-resize blp-resize-inspector" onPointerDown={event => resize(event, 'inspector')} role="separator" aria-orientation="vertical" aria-label="تغییر عرض خروجی" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setWidths(previous => ({ ...previous, inspector: Math.max(210, Math.min(430, previous.inspector + (event.key === 'ArrowRight' ? 20 : -20))) })); }}><GripVertical size={12} /></div>
      <aside className="blp-inspector"><div className="blp-inspector-heading"><Terminal size={15} /><strong>خروجی و جزئیات</strong><button className="blp-icon" onClick={() => setOutput([])} aria-label="پاک‌کردن خروجی"><RotateCcw size={13} /></button></div><div className="blp-output"><div className="blp-inspector-label"><span className="blp-console-dot" /> CONSOLE OUTPUT <small>SIMULATED</small></div>{output.length ? <div className={`blp-console-lines ${!supported ? 'unsupported' : ''}`} aria-live="polite" dir={supported ? 'ltr' : 'rtl'}>{output.map((line, index) => <div key={`${line}-${index}`}><span>{supported ? '›' : '!'}</span>{line}</div>)}{supported && <p dir="rtl"><CheckCircle2 size={12} /> پیش‌نمایش نمونه کامل شد</p>}</div> : <div className="blp-console-empty"><Terminal size={25} strokeWidth={1} /><p>خروجی کد اینجا نمایش داده می‌شود.</p><button onClick={() => { setWorkspaceTab('code'); setMobilePanel('code'); }}>کد نمونه را بررسی کن <ArrowLeft size={12} /></button></div>}</div><div className="blp-inspector-concept"><div className="blp-inspector-label">یادداشت مفهوم</div><h3>{lesson.title}</h3><p>{lesson.analogy}</p></div><div className="blp-inspector-checkpoints"><div className="blp-inspector-label">ایستگاه‌های یادگیری</div>{lessonStepTitles.slice(0, 4).map((title, index) => <div key={title}><span className={step > index || index === 3 && passed ? 'done' : ''}>{step > index || index === 3 && passed ? <Check size={10} /> : index + 1}</span><p>{title}</p></div>)}</div><Link href={lesson.concept === 'loops' ? `/learn/${lessonId}?mode=explore` : `/concept-labs/${lesson.concept}`} className="blp-open-lab"><FlaskConical size={15} /> {lesson.concept === 'loops' ? 'آزمایش آزاد همین مفهوم' : 'ادامه در آزمایشگاه'} <ArrowLeft size={13} /></Link></aside>
    </div>
    <footer className="blp-footer"><button className="btn btn-ghost" disabled={step === 0} onClick={() => goToStep(step - 1)}><ArrowRight size={15} /> قدم قبل</button><span className="blp-footer-title">{lessonStepTitles[step]}<i />{faNumber(step + 1)} از ۵</span>{completed && step === 4 ? <Link className="btn btn-primary" href={nextLesson ? `/learn/${courseSlug}/${nextLesson.slug}` : `/learn/${courseSlug}`}>{nextLesson ? 'درس بعدی' : 'بازگشت به مسیر'}<ArrowLeft size={15} /></Link> : <button className="btn btn-primary" onClick={advance} disabled={!canAdvanceLesson(step, passed)}>{step === 4 ? 'اتمام و ثبت درس' : 'قدم بعدی'}{step === 4 ? <Check size={15} /> : <ArrowLeft size={15} />}</button>}</footer>
    <nav className="blp-mobile-nav" aria-label="پنل‌های درس">{([{ id: 'learn', label: 'یادگیری', icon: BookOpen }, { id: 'visualize', label: 'تصویر مفهوم', icon: FlaskConical }, { id: 'code', label: 'کدنویسی', icon: Code2 }, { id: 'output', label: 'خروجی', icon: Terminal }] as const).map(({ id, label, icon: Icon }) => <button key={id} className={mobilePanel === id ? 'active' : ''} onClick={() => { setMobilePanel(id); if (id === 'visualize' || id === 'code') setWorkspaceTab(id); }}><Icon size={18} /><span>{label}</span></button>)}</nav>
  </div>;
}

export function LessonPlayer(props:{courseSlug:string;lessonSlug:string;initialMode?:'guided'|'explore'}) {
 const account=useAppStore(s=>s.email);
 const session=useAppStore(s=>s.session),membership=useCourseCommerce(s=>s.memberships.some(m=>m.courseId===props.courseSlug));
 if(!session||!membership)return <main style={{maxWidth:900,margin:'40px auto',padding:24}}><h1>ابتدا دوره را به دوره‌های من اضافه کنید</h1><CourseAccess courseId={props.courseSlug}/><Link href={`/learn/${props.courseSlug}`}>معرفی و سرفصل‌های دوره</Link></main>;
 return <EnrolledLessonPlayer key={account} {...props}/>;
}
