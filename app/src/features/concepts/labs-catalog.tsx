'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, FlaskConical, MousePointer2, Sparkles } from 'lucide-react';
import { conceptDefinitions } from './concept-simulator';

export function LabsCatalog() {
  const [filter, setFilter] = useState('همهٔ آزمایشگاه‌ها');
  const concepts = conceptDefinitions.filter(concept => filter === 'همهٔ آزمایشگاه‌ها' || concept.category === filter);
  return <div className="labs-page">
    <div className="page-header"><div><span className="eyebrow">یادگیری، با یک تجربهٔ واقعی</span><h1>آزمایشگاه مفاهیم<span className="muted">.</span></h1><p className="muted">مفهوم‌ها را فقط نخوان؛ لمسشان کن، تغییرشان بده و نتیجه را ببین.</p></div><span className="badge"><FlaskConical size={14} /> ۹ آزمایش تعاملی</span></div>
    <div className="panel labs-intro"><Sparkles size={30} /><div><h2>اینجا اشتباه‌کردن، بخشی از یادگیری است.</h2><p>هر آزمایش یک مدل آموزشی ساده‌شده است؛ بدون نصب ابزار، آزادانه تجربه کن و هر زمان خواستی از نو شروع کن.</p></div></div>
    <div className="labs-filters" role="group" aria-label="فیلتر آزمایشگاه‌ها">{['همهٔ آزمایشگاه‌ها', 'مبانی', 'شیءگرایی', 'پیشرفته', 'بک‌اند'].map(category => <button key={category} className={category === filter ? 'active' : ''} onClick={() => setFilter(category)} aria-pressed={category === filter}>{category}</button>)}</div>
    <div className="labs-grid">{concepts.map(({ slug, title, description, icon: Icon, category, color }) => <Link className="panel lab-card" key={slug} href={`/concept-labs/${slug}`}><div className="lab-card-top"><span className={`lab-card-icon ${color}`}><Icon size={24} strokeWidth={1.5} /></span><span className="badge">{category}</span></div><h2>{title}</h2><p>{description}</p><div className="lab-card-footer"><span>شروع آزمایش <ArrowLeft size={15} /></span><small><MousePointer2 size={11} /> تعاملی</small></div></Link>)}</div>
  </div>;
}
