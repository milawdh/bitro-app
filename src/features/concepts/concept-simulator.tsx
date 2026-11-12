'use client';

import { useEffect, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, Box, Braces, CarFront, Check, CheckCheck, ChevronLeft, ChevronRight, CircleDot, Database, GitBranch, Globe, Layers, Minus, Pause, Play, Plus, RotateCcw, ShieldCheck, Sparkles, Unplug, Zap } from 'lucide-react';
import { carsReducer, initialCars, initialTransaction, playbackReducer, threadProgress, transactionReducer, variableName, type Schedule } from './simulation-core';
import './concepts.css';

const HttpPipelineGraph = dynamic(() => import('./http-pipeline-graph').then(module => module.HttpPipelineGraph), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: 310, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }} role="status">آماده‌سازی نمودار درخواست…</div>,
});

const persian = (value: number) => value.toLocaleString('fa-IR');
const pipeline = ['مرورگر', 'درخواست HTTP', 'میان‌افزار', 'کنترلر', 'سرویس', 'مخزن داده', 'پایگاه داده', 'پاسخ ۲۰۰'];

export const conceptDefinitions = [
  { slug: 'variables', title: 'متغیرها', subtitle: 'یک نام، یک نوع، یک مقدار', icon: Box, category: 'مبانی', description: 'مقدارها را تغییر بده و ارتباط بین نام، نوع و داده را ببین.', color: 'purple' },
  { slug: 'references', title: 'مقدار و ارجاع', subtitle: 'کپی داده یا اشتراک یک شیء؟', icon: GitBranch, category: 'مبانی', description: 'دو متغیر را به یک شیء متصل کن و اثر تغییر آن را دنبال کن.', color: 'cyan' },
  { slug: 'objects', title: 'کلاس‌ها و اشیا', subtitle: 'یک نقشه، چند دنیای مستقل', icon: CarFront, category: 'شیءگرایی', description: 'ماشین بساز، سرعتش را تغییر بده و استقلال اشیا را تجربه کن.', color: 'amber' },
  { slug: 'oop', title: 'چندریختی', subtitle: 'یک قرارداد، رفتارهای متفاوت', icon: Layers, category: 'شیءگرایی', description: 'یک متد مشترک را روی اشیای متفاوت فراخوانی کن.', color: 'purple' },
  { slug: 'threads', title: 'نخ‌ها و هم‌زمانی', subtitle: 'چند مسیر برای انجام کار', icon: GitBranch, category: 'پیشرفته', description: 'تفاوت اجرای ترتیبی، هم‌زمان و موازی را قدم‌به‌قدم کشف کن.', color: 'cyan' },
  { slug: 'async', title: 'انتظار ناهمگام', subtitle: 'منتظر بمان، اما متوقف نشو', icon: Zap, category: 'پیشرفته', description: 'در زمان انتظار شبکه، کار مستقل را ادامه بده.', color: 'amber' },
  { slug: 'http', title: 'سفر یک درخواست', subtitle: 'از مرورگر تا پایگاه داده', icon: Globe, category: 'بک‌اند', description: 'درخواست را از هر لایه عبور بده و پاسخ آن را بررسی کن.', color: 'cyan' },
  { slug: 'di', title: 'تزریق وابستگی', subtitle: 'چه کسی سرویس را می‌سازد؟', icon: Braces, category: 'بک‌اند', description: 'عمر سرویس‌ها را عوض کن و استفادهٔ دوباره از نمونه‌ها را ببین.', color: 'purple' },
  { slug: 'transactions', title: 'تراکنش‌ها', subtitle: 'همهٔ تغییرها، یا هیچ‌کدام', icon: Database, category: 'بک‌اند', description: 'انتقال اعتبار را ثبت کن یا همهٔ تغییرها را برگردان.', color: 'green' },
];

interface ConceptSimulatorProps { concept?: string; compact?: boolean }

export function ConceptSimulator({ concept = 'variables', compact = false }: ConceptSimulatorProps) {
  const [playback, dispatch] = useReducer(playbackReducer, { tick: 0, total: concept === 'http' ? 7 : concept === 'loops' ? 5 : 12, playing: false, speed: 1 });
  const [value, setValue] = useState(42);
  const [name, setName] = useState('score');
  const [cars, dispatchCars] = useReducer(carsReducer, initialCars);
  const [selectedCar, setSelectedCar] = useState(1);
  const [schedule, setSchedule] = useState<Schedule>('concurrent');
  const [shared, setShared] = useState(true);
  const [referenceValue, setReferenceValue] = useState(10);
  const [animal, setAnimal] = useState('dog');
  const [sound, setSound] = useState(false);
  const [lifetime, setLifetime] = useState('scoped');
  const [request, setRequest] = useState(1);
  const [resolve, setResolve] = useState(1);
  const [transaction, dispatchTransaction] = useReducer(transactionReducer, initialTransaction);
  const [loopCount, setLoopCount] = useState(5);
  const definition = conceptDefinitions.find(item => item.slug === concept);
  const currentCar = cars.find(car => car.id === selectedCar) ?? cars[0];

  useEffect(() => {
    if (!playback.playing) return;
    const interval = setInterval(() => dispatch({ type: 'step' }), 650 / playback.speed);
    return () => clearInterval(interval);
  }, [playback.playing, playback.speed]);

  const reset = () => {
    dispatch({ type: 'reset', total: concept === 'http' ? 7 : concept === 'threads' && schedule === 'parallel' ? 6 : concept === 'loops' ? loopCount : 12 });
    setValue(42); setName('score'); dispatchCars({ type: 'reset' }); setSelectedCar(1);
    setReferenceValue(10); setSound(false); setRequest(1); setResolve(1); dispatchTransaction('reset');
  };
  const loopTick = Math.min(playback.tick, loopCount);
  const code = concept === 'variables' ? `int ${name} = ${value};\nConsole.WriteLine(${name});`
    : concept === 'objects' ? `Car ${currentCar.name.toLowerCase()} = new Car();\n${currentCar.name.toLowerCase()}.Speed = ${currentCar.speed};`
    : concept === 'references' ? `var first = new Score { Value = 10 };\n${shared ? 'var second = first;' : 'var second = new Score { Value = 10 };'}\nfirst.Value = ${referenceValue};`
    : concept === 'threads' ? schedule === 'parallel' ? 'Parallel.Invoke(TaskA, TaskB);' : schedule === 'sequential' ? 'TaskA();\nTaskB();' : '// Simplified single-CPU schedule\n// A → B → A → B ...'
    : concept === 'oop' ? `Animal animal = new ${animal === 'dog' ? 'Dog' : 'Cat'}();\nanimal.Speak();`
    : concept === 'async' ? 'Task<string> data = GetDataAsync();\nDoIndependentWork();\nstring result = await data;'
    : concept === 'http' ? 'app.MapGet("/users", async (IUserService service) =>\n    Results.Ok(await service.GetUsersAsync()));'
    : concept === 'di' ? `services.Add${lifetime === 'singleton' ? 'Singleton' : lifetime === 'scoped' ? 'Scoped' : 'Transient'}<IUserService, UserService>();`
    : concept === 'transactions' ? `using var tx = db.BeginTransaction();\nTransfer(from, to, 30);\ntx.${transaction.status === 'rolled-back' ? 'Rollback' : 'Commit'}();`
    : `for (int i = 0; i < ${loopCount}; i++)\n{\n    Console.WriteLine(i);\n}`;

  const explanation = concept === 'variables' ? `متغیر «${name}» حالا مقدار ${persian(value)} را نگه می‌دارد. این ظرف یک استعارهٔ آموزشی است، نه نمایش واقعی حافظه.`
    : concept === 'objects' ? `از کلاس مشترک، ${persian(cars.length)} شیء مستقل ساخته‌ای. تغییر سرعت یک ماشین، ماشین دیگر را تغییر نمی‌دهد.`
    : concept === 'references' ? shared ? 'هر دو متغیر به یک شیء اشاره می‌کنند؛ تغییر شیء از هر مسیر، از مسیر دیگر هم دیده می‌شود.' : 'دو شیء جدا ساخته‌ای؛ تغییر مقدار شیء اول روی شیء دوم اثری ندارد.'
    : concept === 'threads' ? schedule === 'parallel' ? 'در این مدل، دو هسته هم‌زمان کار می‌کنند. هر قدم، هر دو مسیر را جلو می‌برد.' : schedule === 'concurrent' ? 'یک هسته بین دو نخ جابه‌جا می‌شود. کارها در هم پیش می‌روند؛ هم‌زمانی لزوماً اجرای موازی نیست.' : 'ابتدا تمام کار نخ اول انجام می‌شود، سپس نخ دوم شروع می‌کند.'
    : concept === 'oop' ? 'نوع قرارداد ثابت است؛ پیاده‌سازی متد با توجه به شیء واقعی انتخاب می‌شود.'
    : concept === 'async' ? 'در زمان انتظار عملیات ورودی/خروجی، کار مستقل می‌تواند ادامه یابد. استفاده از await به‌خودی‌خود نخ جدیدی نمی‌سازد.'
    : concept === 'http' ? `درخواست اکنون در مرحلهٔ «${pipeline[Math.min(playback.tick, 7)]}» قرار دارد. این یک مسیر نمونه و ساده‌شده است.`
    : concept === 'di' ? lifetime === 'singleton' ? 'یک نمونه در تمام درخواست‌ها دوباره استفاده می‌شود.' : lifetime === 'scoped' ? 'در یک درخواست، همان نمونه استفاده می‌شود؛ درخواست جدید، نمونهٔ تازه می‌گیرد.' : 'هر بار دریافت سرویس، نمونهٔ تازه‌ای ساخته می‌شود.'
    : concept === 'transactions' ? transaction.status === 'idle' ? 'اعتبارها را در قالب یک تراکنش جابه‌جا کن؛ هنوز تغییری ثبت نشده است.' : transaction.status === 'pending' ? 'دو تغییر در انتظار ثبت هستند. اکنون می‌توانی هر دو را ثبت یا هر دو را برگردانی.' : transaction.status === 'committed' ? 'هر دو تغییر با هم ثبت شدند. مجموع اعتبار ثابت مانده است.' : 'هر دو تغییر برگشتند و اعتبار اولیه بازیابی شد.'
    : `حلقه تا اینجا ${persian(loopTick)} بار اجرا شده است. شرط پایان، جلوی تکرار بی‌نهایت را می‌گیرد.`;

  const usesPlayback = ['threads', 'http', 'async', 'loops'].includes(concept);

  return <div className={`concept-simulator ${compact ? 'concept-compact' : ''}`}>
    {!compact && <div className="cs-topline"><span className="cs-live"><i /> آزمایش تعاملی</span><span className="cs-model">مدل آموزشی · اجرای شبیه‌سازی‌شده</span></div>}
    <div className={`cs-stage cs-stage-${concept}`}>
      {concept === 'variables' && <div className="cs-variable-scene">
        <div className="cs-var-caption"><span className="cs-type">int</span><label>نام متغیر<input aria-label="نام متغیر" value={name} onChange={event => setName(variableName(event.target.value))} maxLength={18} dir="ltr" /></label></div>
        <div className="cs-value-box"><div className="cs-value-box-shine" /><AnimatePresence mode="popLayout"><motion.span key={value} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: .18 }} aria-live="polite">{persian(value)}</motion.span></AnimatePresence><span className="cs-value-type">INTEGER VALUE</span></div>
        <div className="cs-value-controls"><button aria-label="کاهش مقدار" className="cs-round-button" onClick={() => setValue(Math.max(-999, value - 1))}><Minus size={18} /></button><span>مقدار را تغییر بده</span><button aria-label="افزایش مقدار" className="cs-round-button" onClick={() => setValue(Math.min(999, value + 1))}><Plus size={18} /></button></div>
      </div>}
      {concept === 'objects' && <div className="cs-objects-scene">
        <div className="cs-blueprint"><Braces size={22} /><strong>class Car</strong><span>Speed · Accelerate() · Brake()</span><button className="btn btn-primary cs-small" disabled={cars.length >= 4} onClick={() => { dispatchCars({ type: 'create' }); setSelectedCar(cars.length + 1); }}><Plus size={15} /> ساخت ماشین</button></div>
        <div className="cs-object-grid">{cars.map(car => <motion.button layout initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} key={car.id} className={`cs-car cs-${car.color} ${selectedCar === car.id ? 'selected' : ''}`} onClick={() => setSelectedCar(car.id)} aria-pressed={selectedCar === car.id}><span className="cs-car-id">OBJECT #{car.id}</span><CarFront size={40} strokeWidth={1.2} /><strong>{car.name}</strong><span>{persian(car.speed)} <small>km/h</small></span><div className="cs-car-meter"><i style={{ width: `${car.speed / 120 * 100}%` }} /></div></motion.button>)}</div>
        <div className="cs-inline-controls"><button className="btn btn-ghost" onClick={() => dispatchCars({ type: 'brake', id: selectedCar })}><Minus size={16} /> ترمز</button><span>{currentCar.name}</span><button className="btn btn-primary" onClick={() => dispatchCars({ type: 'accelerate', id: selectedCar })}><Zap size={16} /> گاز بده</button></div>
      </div>}
      {concept === 'references' && <div className="cs-references-scene"><div className="cs-segmented"><button className={shared ? 'active' : ''} onClick={() => setShared(true)}>ارجاع مشترک</button><button className={!shared ? 'active' : ''} onClick={() => setShared(false)}>دو شیء مستقل</button></div><div className="cs-reference-map" dir="ltr"><div className="cs-reference-labels"><span>first <ArrowRight size={18} /></span><span>second <ArrowRight size={18} /></span></div><div className="cs-reference-objects"><div className="cs-memory-object"><Box size={22} /><small>OBJECT #01</small><strong>{referenceValue}</strong></div>{!shared && <div className="cs-memory-object alternate"><Box size={22} /><small>OBJECT #02</small><strong>10</strong></div>}{shared && <div className="cs-shared-line"><GitBranch size={21} /><span>shared reference</span></div>}</div></div><button className="btn btn-primary" onClick={() => setReferenceValue(referenceValue + 5)}><Plus size={16} /> پنج واحد به شیء اول اضافه کن</button></div>}
      {concept === 'threads' && <div className="cs-threads-scene"><div className="cs-segmented">{(['sequential', 'concurrent', 'parallel'] as Schedule[]).map((mode, index) => <button key={mode} className={schedule === mode ? 'active' : ''} onClick={() => { setSchedule(mode); dispatch({ type: 'reset', total: mode === 'parallel' ? 6 : 12 }); }}>{['ترتیبی', 'هم‌زمان', 'موازی'][index]}</button>)}</div><div className="cs-thread-heading"><span>{schedule === 'parallel' ? '۲ هستهٔ پردازشی' : '۱ هستهٔ پردازشی'}</span><span>گام {persian(playback.tick)}</span></div><div className="cs-lanes" dir="ltr">{threadProgress(playback.tick, schedule).map((progress, lane) => <div className={`cs-lane cs-lane-${lane}`} key={lane}><div className="cs-lane-label"><span className="cs-lane-dot" /><strong>Thread {lane === 0 ? 'A' : 'B'}</strong><small>{progress}/6</small></div><div className="cs-lane-track">{Array.from({ length: 6 }, (_, step) => <div className={`cs-task ${progress > step ? 'done' : ''} ${progress === step && playback.tick > 0 ? 'next' : ''}`} key={step}>{progress > step ? <Check size={17} /> : step + 1}</div>)}</div></div>)}</div><div className="cs-cpu"><CircleDot size={17} /><span>{playback.tick === 0 ? 'آمادهٔ شروع' : playback.tick >= playback.total ? 'همهٔ کارها انجام شدند' : schedule === 'parallel' ? 'دو کار در یک لحظه پیش می‌روند' : 'در هر لحظه، فقط یک نخ روی هسته اجرا می‌شود'}</span></div></div>}
      {concept === 'oop' && <div className="cs-oop-scene"><div className="cs-contract"><Layers size={26} /><strong>abstract class Animal</strong><code>public abstract string Speak();</code></div><ArrowDown className="cs-connect-arrow" size={28} /><div className="cs-segmented"><button className={animal === 'dog' ? 'active' : ''} onClick={() => { setAnimal('dog'); setSound(false); }}>شیء از کلاس Dog</button><button className={animal === 'cat' ? 'active' : ''} onClick={() => { setAnimal('cat'); setSound(false); }}>شیء از کلاس Cat</button></div><div className="cs-speech"><span>{animal === 'dog' ? '🐕' : '🐈'}</span><strong aria-live="polite">{sound ? animal === 'dog' ? 'Woof!' : 'Meow!' : 'Speak()'}</strong></div><button className="btn btn-primary" onClick={() => setSound(true)}><Play size={16} /> فراخوانی متد مشترک</button></div>}
      {concept === 'async' && <div className="cs-async-scene"><div className="cs-thread-heading"><span>انتظار شبکه در کنار کار مستقل</span><span>گام {persian(playback.tick)}</span></div><div className="cs-async-row"><Globe size={23} /><span>درخواست شبکه</span><div className="cs-async-track"><i style={{ width: `${Math.min(playback.tick / 8, 1) * 100}%` }} /></div><strong>{playback.tick >= 8 ? 'پاسخ رسید' : playback.tick ? 'در انتظار…' : 'آماده'}</strong></div><div className="cs-async-row independent"><Zap size={23} /><span>کار مستقل</span><div className="cs-async-track"><i style={{ width: `${Math.min(Math.max(playback.tick - 1, 0) / 4, 1) * 100}%` }} /></div><strong>{playback.tick >= 5 ? 'کامل شد' : playback.tick > 1 ? 'در حال انجام' : 'آماده'}</strong></div><div className={`cs-await ${playback.tick >= 8 ? 'resolved' : ''}`}><Unplug size={25} /><span>{playback.tick >= 8 ? 'ادامهٔ متد پس از آماده‌شدن نتیجه' : 'ادامهٔ متد، منتظر آماده‌شدن نتیجه است'}</span></div></div>}
      {concept === 'http' && <div className="cs-http-scene"><div className="cs-http-request" dir="ltr"><span>GET</span><code>/api/users</code><small>{playback.tick >= 7 ? '200 OK' : 'request →'}</small></div><HttpPipelineGraph step={playback.tick} /><div className="cs-response" dir="ltr">{playback.tick >= 7 ? '{ "users": [{ "id": 1, "name": "Arman" }] }' : '// Step through the request lifecycle'}</div></div>}
      {concept === 'di' && <div className="cs-di-scene"><div className="cs-segmented">{['singleton', 'scoped', 'transient'].map(value => <button key={value} className={lifetime === value ? 'active' : ''} onClick={() => { setLifetime(value); setRequest(1); setResolve(1); }}>{value}</button>)}</div><div className="cs-di-map"><div className="cs-service-node"><Globe size={23} /><strong>Request #{request}</strong></div><ArrowLeft size={24} /><div className="cs-service-node highlighted"><Braces size={26} /><strong>IUserService</strong><small>instance #{lifetime === 'singleton' ? 1 : lifetime === 'scoped' ? request : resolve}</small></div></div><div className="cs-inline-controls"><button className="btn btn-ghost" onClick={() => setResolve(resolve + 1)}>دریافت دوبارهٔ سرویس</button><button className="btn btn-primary" onClick={() => { setRequest(request + 1); setResolve(resolve + 1); }}><Plus size={16} /> درخواست جدید</button></div><span className="cs-resolve-count">تعداد دریافت سرویس: {persian(resolve)}</span></div>}
      {concept === 'transactions' && <div className="cs-transactions-scene"><div className="cs-accounts">{transaction.balances.map((balance, index) => <div className={`cs-account ${transaction.status === 'pending' ? 'pending' : ''}`} key={index}><Database size={26} /><span>حساب {index === 0 ? 'اول' : 'دوم'}</span><motion.strong key={balance} initial={{ opacity: .4 }} animate={{ opacity: 1 }}>{persian(balance)}</motion.strong><small>واحد اعتبار</small></div>)}</div><div className="cs-transaction-status" aria-live="polite"><ShieldCheck size={17} />{transaction.status === 'pending' ? 'تغییرهای موقت · در انتظار تصمیم تو' : transaction.status === 'committed' ? 'تراکنش ثبت شد' : transaction.status === 'rolled-back' ? 'تراکنش برگشت خورد' : 'بدون تغییر ثبت‌شده'}</div><div className="cs-inline-controls">{transaction.status === 'idle' ? <button className="btn btn-primary" onClick={() => dispatchTransaction('begin')}>انتقال ۳۰ واحد</button> : transaction.status === 'pending' ? <><button className="btn btn-ghost" onClick={() => dispatchTransaction('rollback')}>برگرداندن تغییرها</button><button className="btn btn-primary" onClick={() => dispatchTransaction('commit')}><CheckCheck size={17} /> ثبت تراکنش</button></> : <button className="btn btn-ghost" onClick={() => dispatchTransaction('reset')}>آزمایش دوباره</button>}</div></div>}
      {concept === 'loops' && <div className="cs-loops-scene"><div className="cs-loop-count"><label htmlFor="loop-count">تعداد تکرارها</label><input id="loop-count" type="range" min="2" max="8" value={loopCount} onChange={event => { setLoopCount(Number(event.target.value)); dispatch({ type: 'reset', total: Number(event.target.value) }); }} /><strong>{persian(loopCount)}</strong></div><div className="cs-loop-iterations">{Array.from({ length: loopCount }, (_, index) => <div className={loopTick > index ? 'complete' : loopTick === index ? 'active' : ''} key={index}><span>i = {index}</span>{loopTick > index ? <Check size={24} /> : <RotateCcw size={22} />}</div>)}</div><div className="cs-loop-output" dir="ltr">{Array.from({ length: loopTick }, (_, index) => <span key={index}>{index}</span>)}</div></div>}
    </div>
    <div className="cs-code" dir="ltr"><div><span className="cs-code-dot" />{definition?.slug === 'http' ? 'Program.cs' : 'example.cs'}<span>C#</span></div><pre><code>{code}</code></pre></div>
    {!compact && <div className="cs-explanation" aria-live="polite"><Sparkles size={17} /><p>{explanation}</p></div>}
    <div className="cs-controls">
      <button className="cs-icon-btn" onClick={reset} aria-label="بازنشانی آزمایش"><RotateCcw size={17} /></button>
      {usesPlayback ? <><button className="cs-icon-btn" onClick={() => dispatch({ type: 'step', delta: -1 })} aria-label="گام قبل" disabled={playback.tick === 0}><ChevronRight size={20} /></button><button className="cs-play" onClick={() => dispatch({ type: playback.playing ? 'pause' : 'play' })} aria-label={playback.playing ? 'توقف پخش' : 'شروع پخش'}>{playback.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{playback.playing ? 'توقف' : playback.tick >= playback.total ? 'پخش دوباره' : 'پخش'}</button><button className="cs-icon-btn" onClick={() => dispatch({ type: 'step' })} aria-label="گام بعد" disabled={playback.tick >= playback.total}><ChevronLeft size={20} /></button><select aria-label="سرعت پخش" value={playback.speed} onChange={event => dispatch({ type: 'speed', speed: Number(event.target.value) })}><option value={.5}>۰٫۵×</option><option value={1}>۱×</option><option value={2}>۲×</option></select><span className="cs-step-label">{persian(playback.tick)} / {persian(playback.total)}</span></> : <span className="cs-interact-hint"><CircleDot size={14} />{compact ? 'خودت امتحان کن' : 'با تغییر مقدارها، نتیجه را زنده ببین'}</span>}
    </div>
  </div>;
}
