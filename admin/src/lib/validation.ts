import type { AdminData,AdminCourse,AdminLesson,AdminChallenge,AdminProject,AdminLab,ContentEntityMap,ContentKind,SaveResult } from './types';

const concepts=['variables','references','objects','oop','threads','async','http','di','transactions','loops'];
export const validFilePath=(path:string)=>/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(path);
export function validateEntity<K extends ContentKind>(kind:K,entity:ContentEntityMap[K],data:AdminData):SaveResult {
 const errors:Record<string,string>={};
 const required=(key:string,value:unknown,message:string)=>{if(typeof value!=='string'||!value.trim())errors[key]=message;};
 required('id',entity.id,'شناسهٔ محتوا مشخص نیست.');required('title',entity.title,'عنوان را وارد کن.');
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entity.slug))errors.slug='شناسهٔ مسیر باید از حروف کوچک انگلیسی، عدد و خط تیره تشکیل شود.';
 const duplicate=data[kind].some(item=>item.id!==entity.id&&item.slug===entity.slug&&(kind!=='lessons'||(item as AdminLesson).courseId===(entity as AdminLesson).courseId));
 if(duplicate)errors.slug='این شناسهٔ مسیر قبلاً استفاده شده است.';
 if(!['draft','published','archived'].includes(entity.status))errors.status='وضعیت محتوا معتبر نیست.';
 const publish=entity.status==='published';
 if(publish)required('description',entity.description,'برای انتشار، توضیح کوتاه را بنویس.');
 if(kind==='courses'){
  const course=entity as AdminCourse;
  if(!['beginner','intermediate','advanced'].includes(course.level))errors.level='سطح دوره را انتخاب کن.';
  if(publish&&!course.modules.length)errors.modules='برای انتشار حداقل یک فصل بساز.';
  if(course.modules.some(module=>!module.title.trim())||new Set(course.modules.map(module=>module.id)).size!==course.modules.length)errors.modules='فصل‌ها باید عنوان و شناسهٔ یکتا داشته باشند.';
  if(data.lessons.some(lesson=>lesson.courseId===course.id&&!course.modules.some(module=>module.id===lesson.moduleId)))errors.modules='این فصل هنوز درس دارد؛ ابتدا درس‌های آن را به فصل دیگری منتقل کن.';
 }
 if(kind==='lessons'||kind==='challenges'||kind==='projects'){
  const item=entity as AdminLesson|AdminChallenge|AdminProject;
  const course=data.courses.find(course=>course.id===item.courseId);
  if(!course)errors.courseId='یک دورهٔ معتبر انتخاب کن.';
  if(publish&&course?.status==='archived')errors.courseId='محتوای یک دورهٔ بایگانی‌شده قابل انتشار نیست.';
  if(!Number.isFinite(item.duration)||item.duration<=0)errors.duration='زمان باید بیشتر از صفر باشد.';
 }
 if(kind==='lessons'){
  const lesson=entity as AdminLesson;
  if(!Number.isInteger(lesson.order)||lesson.order<0)errors.order='ترتیب درس باید یک عدد صحیح نامنفی باشد.';
  if(!data.courses.find(course=>course.id===lesson.courseId)?.modules.some(module=>module.id===lesson.moduleId))errors.moduleId='یک فصل از همین دوره انتخاب کن.';
  if(!concepts.includes(lesson.concept))errors.concept='مفهوم درس پشتیبانی نمی‌شود.';
  if(publish){
   required('intro',lesson.intro,'توضیح اصلی درس را بنویس.');required('experiment',lesson.experiment,'راهنمای آزمایش را بنویس.');required('code',lesson.code,'کد نمونه را وارد کن.');required('question',lesson.question,'پرسش پایانی را بنویس.');
   if(!lesson.objectives.some(objective=>objective.trim()))errors.objectives='حداقل یک هدف یادگیری لازم است.';
   if(lesson.choices.length<2||lesson.choices.some(choice=>!choice.trim())||!Number.isInteger(lesson.answer)||lesson.answer<0||lesson.answer>=lesson.choices.length)errors.choices='حداقل دو گزینه و یک پاسخ صحیح معتبر مشخص کن.';
  }
 }
 if(kind==='challenges'){
  const challenge=entity as AdminChallenge;
  if(!concepts.includes(challenge.concept))errors.concept='مفهوم چالش پشتیبانی نمی‌شود.';
  if(publish&&(!challenge.questions.length||new Set(challenge.questions.map(question=>question.id)).size!==challenge.questions.length||challenge.questions.some(q=>!q.prompt.trim()||q.options.length<2||q.options.some(option=>!option.label.trim())||new Set(q.options.map(option=>option.id)).size!==q.options.length||!q.options.some(option=>option.id===q.correctOption))))errors.questions='هر پرسش به شناسهٔ یکتا، متن، حداقل دو گزینهٔ یکتا و یک پاسخ صحیح نیاز دارد.';
 }
 if(kind==='projects'){
  const project=entity as AdminProject;
  if(project.files.some(file=>!validFilePath(file.path))||new Set(project.files.map(file=>file.path)).size!==project.files.length)errors.files='مسیر فایل‌ها باید معتبر و یکتا باشد؛ مسیر والد مجاز نیست.';
  if(publish&&!project.files.length)errors.files='برای انتشار، حداقل یک فایل بساز.';
  if(publish&&!project.objectives.some(objective=>objective.trim()))errors.objectives='برای انتشار، حداقل یک هدف یادگیری بنویس.';
 }
 if(kind==='labs'){
  const lab=entity as AdminLab,existing=data.labs.find(item=>item.id===lab.id);
  if(!existing||existing.concept!==lab.concept)errors.concept='در این نسخه فقط سناریوهای موجود قابل مدیریت هستند.';
  if(!Number.isFinite(lab.duration)||lab.duration<=0)errors.duration='زمان باید بیشتر از صفر باشد.';
  if(Object.values(lab.config).some(value=>typeof value==='number'&&!Number.isFinite(value)))errors.config='مقادیر تنظیمات باید معتبر باشند.';
 }
 return Object.keys(errors).length?{ok:false,error:Object.values(errors)[0],errors}:{ok:true};
}
