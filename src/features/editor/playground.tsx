'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Braces, Check, CheckCheck, ChevronLeft, ChevronRight, CircleHelp, Code2, Copy, FileCode2, FlaskConical, Maximize2, Pause, Play, RotateCcw, SkipForward, Terminal, X } from 'lucide-react';
import { CodeEditor } from './code-editor';
import { examples, MockExecutionProvider, type ExecutionResult } from '@/features/execution/provider';
import { parsePlaygroundSnapshot } from './persistence';
import './workspace.css';

const provider = new MockExecutionProvider();

export function Playground() {
  const [exampleId, setExampleId] = useState(examples[1].id);
  const example = examples.find((item) => item.id === exampleId)!;
  const [code, setCode] = useState(example.code);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'console' | 'timeline'>('console');
  const [speed, setSpeed] = useState('1');
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const saved = parsePlaygroundSnapshot(localStorage.getItem('bitro-playground')); if (saved) { setExampleId(saved.exampleId); setCode(saved.code); } } catch { /* A fresh editor remains usable if storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (!ready) return; try { localStorage.setItem('bitro-playground', JSON.stringify({ exampleId, code })); } catch { /* Storage can be disabled. */ } }, [exampleId, code, ready]);
  useEffect(() => { if (!playing || !result?.events.length) return; const timer = setInterval(() => setCursor((current) => { if (current >= result.events.length - 1) { setPlaying(false); return current; } return current + 1; }), 700 / Number(speed)); return () => clearInterval(timer); }, [playing, result, speed]);

  const run = useCallback(async () => { setPlaying(false); const next = await provider.execute({ code, exampleId }); setResult(next); setCursor(next.supported ? 0 : -1); setPlaying(next.supported); }, [code, exampleId]);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void run(); } }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [run]);

  function selectExample(id: string) { const next = examples.find((item) => item.id === id)!; setExampleId(id); setCode(next.code); setResult(null); setCursor(-1); setPlaying(false); }
  const currentEvent = result?.events[cursor];
  const output = result?.events.slice(0, cursor + 1).filter((event) => event.type === 'stdout_written').map((event) => event.message) ?? [];
  const finished = Boolean(result?.supported && cursor === result.events.length - 1);
  const visibleOutput = finished ? result?.output ?? [] : output;

  return <div className="workbench">
    <header className="wb-header"><Logo /><div className="wb-heading"><span className="wb-divider" /><Code2 size={18} /><span>زمین بازی کد</span><span className="badge">آزادانه تجربه کن</span></div><Link href="/dashboard" className="btn btn-ghost wb-back">بازگشت به داشبورد <ArrowRight size={16} /></Link></header>
    <div className="wb-subheader"><div><span className="wb-status-dot" />محیط آماده است <span className="muted">/</span><span>کدنویسی با سی‌شارپ</span></div><button className="btn btn-ghost" onClick={() => setHelp(!help)}><CircleHelp size={16} /> راهنمای محیط</button></div>
    {help && <div className="wb-notice"><FlaskConical size={20} /><span>یک نمونه انتخاب کنید، اجرای نمایشی را بزنید و تغییر متغیرها را قدم‌به‌قدم ببینید. میان‌بر اجرا: <kbd dir="ltr">Ctrl + Enter</kbd>. این محیط کامپایلر واقعی سی‌شارپ نیست.</span><button className="wb-icon" aria-label="بستن راهنما" onClick={() => setHelp(false)}><X size={16} /></button></div>}
    <main className={`pg-layout ${expanded ? 'pg-expanded' : ''}`}>
      {!expanded && <aside className="pg-guide"><div className="wb-overline">آزمایش کن. اشتباه کن. یاد بگیر.</div><h1>اینجا، کد زنده می‌شه<span>.</span></h1><p>بین کدی که می‌نویسی و اتفاقی که می‌افته، ارتباط برقرار کن.</p><div className="wb-section-title">نمونه‌های آماده <span>۰۴</span></div><div className="pg-examples">{examples.map((item, index) => <button key={item.id} onClick={() => selectExample(item.id)} className={`pg-example ${item.id === exampleId ? 'active' : ''}`}><span className="pg-example-number">0{index + 1}</span><span><b>{item.title}</b><small>{item.subtitle}</small></span><ChevronLeft size={15} /></button>)}</div><div className="pg-tip"><FlaskConical size={23} /><b>قدرت در کنجکاوی است</b><p>قبل از اجرا حدس بزن خروجی چه می‌شود. بعد با ردگیری مرحله‌ها، حدست را بررسی کن.</p><Link href="/concept-labs/variables">رفتن به آزمایشگاه متغیرها <ChevronLeft size={15} /></Link></div><div className="wb-demo-label"><span /> شبیه‌سازی آموزشی، بدون کامپایل واقعی</div></aside>}
      <section className="pg-editor-area"><div className="wb-tabs"><div className="wb-file-tab active"><FileCode2 size={16} /><span dir="ltr">Program.cs</span><span className="wb-unsaved" /></div><div className="wb-tab-actions"><button className="wb-icon" aria-label="کپی کد" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setHelp(true); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button><button className="wb-icon" aria-label="بزرگ کردن ویرایشگر" onClick={() => setExpanded(!expanded)}><Maximize2 size={16} /></button></div></div>
        <div className="pg-editor"><CodeEditor value={code} modelPath={`file:///bitrolearn/playground/${exampleId}.cs`} onChange={(value) => { setCode(value); setPlaying(false); setResult(null); setCursor(-1); }} /></div>
        <div className="wb-editor-toolbar"><span dir="ltr" className="muted">C# <span className="wb-toolbar-dot">•</span> UTF-8</span><div><button className="btn btn-ghost" onClick={() => selectExample(exampleId)}><RotateCcw size={15} />بازنشانی</button><button className="btn btn-primary" onClick={() => void run()}><Play size={15} fill="currentColor" /> اجرای نمایشی <kbd>⌘ ↵</kbd></button></div></div>
        <div className="pg-output"><div className="wb-output-tabs"><button className={tab === 'console' ? 'active' : ''} onClick={() => setTab('console')}><Terminal size={16} />کنسول خروجی{finished && <span className="wb-count">{visibleOutput.length}</span>}</button><button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}><SkipForward size={16} />ردگیری اجرا</button><span className="wb-simulation">SIMULATION</span></div><div className="pg-output-content" aria-live="polite">{!result ? <div className="pg-empty-output"><Terminal size={28} /><span>یک کنجکاوی کوچک، یک اجرای تازه.</span><small>برای مشاهدهٔ خروجی، «اجرای نمایشی» را بزنید.</small></div> : !result.supported ? <div className="pg-diagnostic"><CircleHelp size={21} /><b>این تغییر هنوز قابل شبیه‌سازی نیست</b><p>{result.diagnostic}</p><button className="btn btn-ghost" onClick={() => selectExample(exampleId)}>بازگشت به نمونهٔ آماده</button></div> : tab === 'console' ? <><div className="pg-terminal-label" dir="ltr">$ dotnet run <span>educational preview</span></div>{visibleOutput.map((line, i) => <div className="pg-console-line" dir="ltr" key={`${line}-${i}`}><span>{String(i + 1).padStart(2, '0')}</span>{line}</div>)}{finished && <div className="pg-success"><CheckCheck size={15} />شبیه‌سازی به پایان رسید.</div>}{!finished && <div className="pg-console-cursor" />}</> : <div className="pg-trace-list">{result.events.map((event, i) => <button className={i === cursor ? 'active' : i < cursor ? 'past' : ''} key={event.sequence} onClick={() => { setCursor(i); setPlaying(false); }}><span>{i < cursor ? <Check size={12} /> : i + 1}</span><b>{event.message}</b><small>خط {event.line.toLocaleString('fa-IR')}</small></button>)}</div>}</div></div>
      </section>
      {!expanded && <aside className="pg-inspector"><div className="wb-section-title"><span className="pg-live-dot" />زیر ذره‌بین</div><p className="pg-inspector-intro">هر قدم کد را، شفاف ببین.</p><div className="pg-inspector-section"><h3><Braces size={16} />متغیرها <span dir="ltr">VARIABLES</span></h3>{currentEvent ? <div className="pg-variables">{Object.entries(currentEvent.variables).map(([name, value]) => <div key={name} dir="ltr"><span>{name}</span><b>{value}</b></div>)}</div> : <p className="pg-inspector-empty">متغیرها بعد از شروع اجرا اینجا نمایش داده می‌شوند.</p>}</div><div className="pg-inspector-section"><h3><SkipForward size={16} />کنترل اجرا</h3><div className="pg-playback"><button className="wb-icon" aria-label="قدم قبلی" disabled={!result?.supported || cursor <= 0} onClick={() => { setPlaying(false); setCursor((n) => n - 1); }}><ChevronRight size={19} /></button><button className="pg-play-button" aria-label={playing ? 'توقف' : 'پخش'} disabled={!result?.supported} onClick={() => { if (finished) setCursor(0); setPlaying(!playing); }}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button className="wb-icon" aria-label="قدم بعدی" disabled={!result?.supported || finished} onClick={() => { setPlaying(false); setCursor((n) => n + 1); }}><ChevronLeft size={19} /></button></div><div className="pg-progress-track"><span style={{ width: `${result?.events.length ? ((cursor + 1) / result.events.length) * 100 : 0}%` }} /></div><div className="pg-step-info"><span>قدم {Math.max(cursor + 1, 0).toLocaleString('fa-IR')} از {(result?.events.length ?? 0).toLocaleString('fa-IR')}</span><label>سرعت <select value={speed} onChange={(e) => setSpeed(e.target.value)} aria-label="سرعت پخش"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label></div></div><div className="pg-current-event"><span>الان چه اتفاقی افتاد؟</span><p aria-live="polite">{currentEvent?.message ?? 'اجرای نمونه را شروع کن تا خط‌به‌خط با هم جلو برویم.'}</p>{currentEvent && <span className="badge">خط {currentEvent.line.toLocaleString('fa-IR')}</span>}</div><div className="pg-inspector-footer"><span className="wb-status-dot" />تغییرات به‌صورت محلی ذخیره می‌شوند.</div></aside>}
    </main><footer className="wb-footer"><span><span className="wb-status-dot" />پیش‌نمایش محلی</span><span>با کنجکاوی ساخته می‌شود <Braces size={13} /></span><span dir="ltr">C# · .NET Learning Environment</span></footer>
  </div>;
}

