import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FlaskConical } from 'lucide-react';
import { ConceptSimulator } from '@/features/concepts/concept-simulator';

const details: Record<string, { title: string; subtitle: string; outcomes: string[]; course?: string; lesson?: string }> = {
  variables: { title: 'متغیرها؛ یک نام برای یک مقدار', subtitle: 'مقدار را تغییر بده و هم‌زمان تغییر کد را ببین.', outcomes: ['رابطهٔ نام، نوع و مقدار', 'تغییر مقدار یک متغیر', 'تفاوت استعاره و حافظهٔ واقعی'], course: 'csharp', lesson: 'variables' },
  references: { title: 'مقدار یا ارجاع؟', subtitle: 'وقتی دو متغیر را به یک شیء وصل می‌کنی، چه اتفاقی می‌افتد؟', outcomes: ['شناخت هویت یک شیء', 'تفاوت دو شیء و دو ارجاع', 'اثر تغییر دادهٔ مشترک'], course: 'csharp', lesson: 'references' },
  objects: { title: 'از یک کلاس، چند ماشین بساز', subtitle: 'هر ماشین هویت و سرعت خودش را دارد؛ فرمان دست توست.', outcomes: ['تفاوت کلاس و نمونه', 'استقلال وضعیت اشیا', 'تغییر وضعیت با متد'], course: 'csharp', lesson: 'objects' },
  oop: { title: 'یک قرارداد، چند رفتار', subtitle: 'با یک متد مشترک، رفتار اشیای متفاوت را کشف کن.', outcomes: ['قرارداد مشترک و پیاده‌سازی', 'فراخوانی متد بازنویسی‌شده', 'انتخاب رفتار در زمان اجرا'], course: 'csharp', lesson: 'objects' },
  threads: { title: 'اجرای برنامه را روی خط زمان ببین', subtitle: 'یک کار، دو کار، یک هسته یا دو هسته؛ تفاوت را تجربه کن.', outcomes: ['تفاوت ترتیب و هم‌زمانی', 'جابه‌جایی بین نخ‌ها', 'تفاوت هم‌زمانی و موازی‌سازی'], course: 'csharp', lesson: 'threads' },
  async: { title: 'منتظر بمان، اما متوقف نشو', subtitle: 'ببین در زمان انتظار شبکه، چه کار دیگری می‌توان انجام داد.', outcomes: ['انتظار بدون مسدودکردن', 'ادامهٔ کار مستقل', 'تفاوت انتظار ناهمگام و نخ جدید'], course: 'csharp', lesson: 'async' },
  http: { title: 'همراه یک درخواست سفر کن', subtitle: 'از کلیک کاربر تا پاسخ سرویس؛ هر لایه را از نزدیک ببین.', outcomes: ['نقش میان‌افزار و کنترلر', 'جداکردن مسئولیت لایه‌ها', 'بازگشت پاسخ از سرویس'], course: 'dotnet', lesson: 'http' },
  di: { title: 'عمر یک سرویس چقدر است؟', subtitle: 'درخواست جدید بساز و ببین کدام نمونه دوباره استفاده می‌شود.', outcomes: ['یک نمونه برای تمام درخواست‌ها', 'یک نمونه در محدودهٔ درخواست', 'نمونهٔ تازه در هر دریافت'], course: 'dotnet', lesson: 'di' },
  transactions: { title: 'همهٔ تغییرها، یا هیچ‌کدام', subtitle: 'اعتبار جابه‌جا کن و ثبت یا برگشت تراکنش را تجربه کن.', outcomes: ['تغییرهای موقت تراکنش', 'ثبت یکپارچهٔ تغییرها', 'بازگردانی تمام تغییرها'] },
};
export default async function ConceptLabPage({ params }: { params: Promise<{ conceptSlug: string }> }) {
  const { conceptSlug } = await params;
  const detail = details[conceptSlug];
  if (!detail) notFound();
  return <div className="lab-detail-page"><Link href="/concept-labs" className="lab-detail-back"><ArrowRight size={15} /> همهٔ آزمایشگاه‌ها</Link><div className="page-header"><div><span className="eyebrow">مفهوم را با تجربه یاد بگیر</span><h1>{detail.title}</h1><p className="muted">{detail.subtitle}</p></div></div><div className="lab-detail-layout"><ConceptSimulator key={conceptSlug} concept={conceptSlug} /><aside className="panel lab-detail-aside"><span className="badge"><FlaskConical size={12} /> آزمایش آزاد</span><h3 style={{ marginTop: 20 }}>چه چیزی یاد می‌گیری؟</h3><ul>{detail.outcomes.map(outcome => <li key={outcome}><Check size={15} />{outcome}</li>)}</ul><p>کنترل‌ها را امتحان کن. هر تغییر، بلافاصله در مدل و کد نمونه دیده می‌شود. {detail.lesson ? 'برای مرور مرحله‌به‌مرحله، وارد درس مرتبط شو.' : 'در این آزمایشگاه می‌توانی ثبت و بازگردانی تراکنش را آزادانه تجربه کنی؛ درس راهنمای این مفهوم هنوز در این نسخه آماده نیست.'}</p><Link href={detail.lesson ? `/learn/${detail.course}/${detail.lesson}` : '/concept-labs'} className="btn btn-primary">{detail.lesson ? 'یادگیری با راهنما' : 'کشف آزمایشگاه‌های بیشتر'} <ArrowLeft size={15} /></Link><div className="lab-related"><h3>آزمایش بعدی</h3>{Object.entries(details).filter(([slug]) => slug !== conceptSlug).slice(0, 3).map(([slug, item]) => <Link href={`/concept-labs/${slug}`} key={slug}>{item.title}<ArrowLeft size={14} /></Link>)}</div></aside></div></div>;
}
