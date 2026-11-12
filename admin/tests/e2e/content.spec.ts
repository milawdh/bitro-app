import {expect,test} from '@playwright/test';

test('lab metadata saves locally and survives a reload',async({page})=>{
  await page.goto('/labs/variables');
  await page.getByRole('textbox',{name:'عنوان آزمایشگاه',exact:true}).fill('متغیرها؛ یک تجربهٔ تازه');
  await page.getByRole('textbox',{name:'توضیح کوتاه',exact:true}).fill('مقدار متغیر را تغییر بده و نتیجهٔ انتساب را ببین.');
  await page.getByRole('button',{name:'ذخیرهٔ پیش‌نویس',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-admin-data-v1')??'{}').state.labs.find((lab:{id:string})=>lab.id==='variables').title)).toBe('متغیرها؛ یک تجربهٔ تازه');
  await page.reload();
  await expect(page.getByRole('textbox',{name:'عنوان آزمایشگاه',exact:true})).toHaveValue('متغیرها؛ یک تجربهٔ تازه');
  await expect(page.locator('.content-lab-preview')).toContainText('متغیرها؛ یک تجربهٔ تازه');
});

test('a structured challenge records its chosen correct answer and publishes locally',async({page})=>{
  await page.goto('/challenges/new');
  await page.getByRole('textbox',{name:'عنوان چالش',exact:true}).fill('یک پیش‌بینی کوچک');
  await page.getByRole('textbox',{name:'شناسهٔ مسیر',exact:true}).fill('small-prediction');
  await page.getByRole('textbox',{name:'توضیح کوتاه چالش',exact:true}).fill('خروجی یک انتساب ساده را پیش‌بینی کن.');
  await page.getByRole('textbox',{name:'متن پرسش',exact:true}).fill('مقدار نهایی score چند است؟');
  for(const [index,value] of ['10','20','30','40'].entries())await page.getByRole('textbox',{name:`متن گزینهٔ ${(index+1).toLocaleString('fa-IR')}`,exact:true}).fill(value);
  await page.getByRole('radio',{name:'انتخاب گزینهٔ ۳ به‌عنوان پاسخ صحیح',exact:true}).check();
  await page.getByRole('textbox',{name:'توضیح پاسخ',exact:true}).fill('مقدار ۱۵ در دو ضرب می‌شود و پاسخ ۳۰ است.');
  await page.getByRole('button',{name:'انتشار در پیش‌نمایش',exact:true}).click();
  await expect(page).toHaveURL(/\/challenges\/(?!new$)[^/]+$/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-admin-data-v1')??'{}').state.challenges.find((challenge:{slug:string})=>challenge.slug==='small-prediction'));
  expect(saved.status).toBe('published');
  expect(saved.questions[0].options.find((option:{id:string})=>option.id===saved.questions[0].correctOption).label).toBe('30');
  await page.reload();
  await expect(page.getByRole('radio',{name:'انتخاب گزینهٔ ۳ به‌عنوان پاسخ صحیح',exact:true})).toBeChecked();
});

test('saving consecutive new challenges creates distinct entities and clears the new-form draft',async({page})=>{
  await page.goto('/challenges/new');
  await page.getByRole('textbox',{name:'عنوان چالش',exact:true}).fill('اولین چالش مستقل');
  await page.getByRole('textbox',{name:'شناسهٔ مسیر',exact:true}).fill('first-independent-challenge');
  await page.getByRole('button',{name:'ذخیرهٔ پیش‌نویس',exact:true}).click();
  await expect(page).toHaveURL(/\/challenges\/(?!new$)[^/]+$/);
  const firstId=page.url().split('/').at(-1);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('bitro-admin-draft-challenge-new'))).toBeNull();
  await page.goto('/challenges/new');
  await expect(page.getByRole('textbox',{name:'عنوان چالش',exact:true})).toHaveValue('');
  await page.getByRole('textbox',{name:'عنوان چالش',exact:true}).fill('دومین چالش مستقل');
  await page.getByRole('textbox',{name:'شناسهٔ مسیر',exact:true}).fill('second-independent-challenge');
  await page.getByRole('button',{name:'ذخیرهٔ پیش‌نویس',exact:true}).click();
  await expect(page).toHaveURL(/\/challenges\/(?!new$)[^/]+$/);
  expect(page.url().split('/').at(-1)).not.toBe(firstId);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-admin-data-v1')??'{}').state.challenges);
  expect(saved.filter((challenge:{slug:string})=>['first-independent-challenge','second-independent-challenge'].includes(challenge.slug))).toHaveLength(2);
});

test('project template file create, rename, edit, save and delete are persistent',async({page})=>{
  await page.goto('/projects/my-first-api');
  await page.getByRole('button',{name:'فایل جدید',exact:true}).click();
  await page.getByRole('textbox',{name:'نام و مسیر فایل',exact:true}).fill('Models/Book.cs');
  await page.getByRole('button',{name:'ساخت فایل',exact:true}).click();
  await expect(page.locator('.content-project-tree')).toContainText('Book.cs');
  await page.getByRole('button',{name:'تغییر نام فایل',exact:true}).click();
  await page.getByRole('textbox',{name:'نام و مسیر فایل',exact:true}).fill('Models/Note.cs');
  await page.getByRole('button',{name:'ذخیرهٔ نام',exact:true}).click();
  const editor=page.locator('.monaco-editor [role="textbox"]').first();
  await expect(editor).toBeAttached({timeout:30000});await editor.focus();await editor.press('ControlOrMeta+a');await editor.pressSequentially('namespace MyFirstApi;\npublic record Note(int Id);');
  await page.getByRole('button',{name:'ذخیرهٔ پیش‌نویس',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-admin-data-v1')??'{}').state.projects.find((project:{id:string})=>project.id==='my-first-api').files.find((file:{path:string})=>file.path==='Models/Note.cs')?.content)).toContain('record Note');
  await page.reload();
  await page.locator('.content-project-tree').getByRole('button',{name:'Note.cs',exact:true}).click();
  await expect(page.locator('.content-project-filebar')).toContainText('Models/Note.cs');
  await page.getByRole('button',{name:'حذف فایل',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'حذف فایل',exact:true}).click();
  await expect(page.locator('.content-project-tree')).not.toContainText('Note.cs');
  await page.getByRole('button',{name:'ذخیرهٔ پیش‌نویس',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-admin-data-v1')??'{}').state.projects.find((project:{id:string})=>project.id==='my-first-api').files.some((file:{path:string})=>file.path==='Models/Note.cs'))).toBe(false);
});
