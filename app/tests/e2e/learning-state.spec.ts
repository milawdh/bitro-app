import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{const progress=JSON.parse(localStorage.getItem('bitro-progress')??'{"state":{}}');localStorage.setItem('bitro-progress',JSON.stringify({...progress,state:{...progress.state,session:true}}));localStorage.setItem('bitro-course-commerce-v1',JSON.stringify({state:{memberships:['csharp','dotnet'].map(courseId=>({courseId,paidAccess:false,licenseStatus:'locked',licenseSource:'none',licenseKey:null})),invoices:[]},version:0}));});});
test('save errors preserve the lesson and successful saves can be restored',async({page})=>{
 await page.goto('/learn/csharp/variables');const panel=page.getByRole('region',{name:'ذخیرهٔ پیشرفت'});
 await panel.getByText('سناریوی ذخیره',{exact:true}).click();await panel.getByLabel('سناریوی ذخیره').selectOption('network');await panel.getByRole('button',{name:'ذخیرهٔ حساب نمایشی'}).click();await expect(panel.getByRole('alert')).toContainText('متن شما محفوظ است');
 await panel.getByLabel('سناریوی ذخیره').selectOption('normal');await page.getByRole('button',{name:'قدم بعدی',exact:true}).click();await panel.getByRole('button',{name:'ذخیرهٔ حساب نمایشی'}).click();await expect(panel.getByRole('status')).toContainText('ذخیره شد');
 await page.getByRole('button',{name:'قدم بعدی',exact:true}).click();await panel.getByRole('button',{name:'بارگیری نسخهٔ ذخیره‌شده'}).click();await expect(page.getByRole('heading',{name:'حالا نوبت توست'})).toBeVisible();
});
test('a video without an assessment can be completed and retains its completion',async({page})=>{
 await page.goto('/learn/csharp/video-overview');await page.getByRole('button',{name:'درس را تمام کردم'}).click();await expect(page.getByRole('button',{name:'درس تکمیل شده است'})).toBeDisabled();await page.reload();await expect(page.getByRole('button',{name:'درس تکمیل شده است'})).toBeDisabled();
});
test('two open lesson tabs cannot silently overwrite the first saved checkpoint',async({page,context})=>{
 await page.goto('/learn/csharp/variables');const sibling=await context.newPage();await sibling.goto('/learn/csharp/variables');
 const first=page.getByRole('region',{name:'ذخیرهٔ پیشرفت'}),second=sibling.getByRole('region',{name:'ذخیرهٔ پیشرفت'});
 await page.getByRole('button',{name:'قدم بعدی',exact:true}).click();await first.getByRole('button',{name:'ذخیرهٔ حساب نمایشی'}).click();await expect(first.getByRole('status')).toContainText('ذخیره شد');
 await second.getByRole('button',{name:'ذخیرهٔ حساب نمایشی'}).click();await expect(second.getByRole('alert')).toContainText('نسخهٔ ذخیره‌شده تغییر کرده');
 const step=await page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-learning-v1:arman@example.com')??'{}').lessons['csharp/variables'].progress.step);expect(step).toBe(1);await sibling.close();
});
test('a changed challenge question cannot register a new completion',async({page})=>{
 await page.goto('/challenges/variable-assignment');await page.locator('input[name="assign"][value="30"]').check();await page.locator('input[name="copy"][value="7"]').check();await page.locator('input[name="increment"][value="7"]').check();await page.getByText('سناریوی تصحیح نمایشی',{exact:true}).click();await page.getByLabel('سناریوی تصحیح').selectOption('changed');await page.getByRole('button',{name:'بررسی پاسخ‌ها'}).click();await expect(page.getByRole('alert').filter({hasText:'سؤال تغییر کرده'})).toBeVisible();await expect(page.locator('.ch-result')).toHaveCount(0);
});
