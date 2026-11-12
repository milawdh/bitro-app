export interface CourseLesson { slug: string; title: string; description: string; duration: number; concept: string }
export interface Course { slug: string; title: string; subtitle: string; description: string; tag: string; color: string; icon: string; modules: string[]; lessons: CourseLesson[] }
export const courses: Course[] = [
  {slug: 'csharp', title: 'دنیای سی‌شارپ', subtitle: 'C# Fundamentals', description: 'از اولین متغیر تا تفکر شیءگرا؛ مفاهیم را ببین، تغییر بده و عمیق یاد بگیر.', tag: 'مناسب شروع', color: 'purple', icon: 'code', modules: ['آشنایی با برنامه‌نویسی', 'متغیرها و انواع داده', 'عملگرها', 'شرط‌ها', 'حلقه‌ها', 'متدها', 'آرایه‌ها و مجموعه‌ها', 'کلاس‌ها و اشیا', 'کپسوله‌سازی', 'وراثت', 'چندریختی', 'رابط‌ها', 'مدیریت خطا', 'LINQ', 'Async/Await'], lessons: [
    {slug:'variables',title:'متغیر چیست؟',description:'یک نام، یک مقدار و دنیایی از امکان‌ها.',duration:12,concept:'variables'},
    {slug:'references',title:'مقدار یا ارجاع؟',description:'ببین کپی‌کردن داده‌ها دقیقاً چه معنایی دارد.',duration:18,concept:'references'},
    {slug:'loops',title:'قدرت تکرار با حلقه‌ها',description:'به کامپیوتر یاد بده کارهای تکراری را انجام دهد.',duration:15,concept:'loops'},
    {slug:'objects',title:'کلاس‌ها و اشیا',description:'از یک نقشه، چند ماشین مستقل بساز.',duration:20,concept:'objects'},
    {slug:'threads',title:'نخ‌ها و هم‌زمانی',description:'جریان اجرای برنامه را قدم‌به‌قدم دنبال کن.',duration:22,concept:'threads'},
    {slug:'async',title:'منتظر بمان، اما متوقف نشو',description:'انتظار ناهمگام و ادامهٔ کار با Async/Await.',duration:18,concept:'async'}]},
  {slug:'dotnet',title:'مهندسی بک‌اند با دات‌نت',subtitle:'.NET Backend Development',description:'از اولین درخواست تا ساخت یک API؛ پشت صحنهٔ وب را کشف کن.',tag:'سطح متوسط',color:'cyan',icon:'server',modules:['ساختار پروژهٔ .NET','مبانی ASP.NET Core','HTTP و REST','کنترلرها و Minimal API','تزریق وابستگی','میان‌افزارها','Entity Framework Core','PostgreSQL','مفاهیم احراز هویت','تست‌نویسی','کش‌کردن','سرویس‌های پس‌زمینه'],lessons:[
    {slug:'http',title:'سفر یک درخواست HTTP',description:'مسیر درخواست را از کاربر تا پایگاه داده دنبال کن.',duration:20,concept:'http'},
    {slug:'di',title:'تزریق وابستگی',description:'عمر سرویس‌ها و اشتراک نمونه‌ها را تجربه کن.',duration:18,concept:'di'}]},
  {slug:'architecture',title:'فکر کردن مثل یک معمار',subtitle:'Software Architecture',description:'مسئله‌ها را بشکن، تصمیم‌ها را بسنج و سیستم‌های بهتر طراحی کن.',tag:'پیشرفته',color:'amber',icon:'layers',modules:['اصول SOLID','الگوهای طراحی','معماری تمیز','لایه‌های برنامه','راهبردهای کش','پیام‌رسانی','هم‌زمانی','میکروسرویس‌ها','سیستم‌های توزیع‌شده','طراحی سیستم'],lessons:[]}
];
export const courseProvider = { list: () => courses, get: (slug: string) => courses.find((c) => c.slug === slug) };
export const faNumber = (n: number) => n.toLocaleString('fa-IR');
