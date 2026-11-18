import {test,expect} from '@playwright/test';
test('enrollment, observed payment, worker activation and licensing remain separate',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('bitro-progress',JSON.stringify({state:{session:true},version:0}));
  localStorage.removeItem('bitro-course-commerce-v1');
 });
 await page.goto('/learn/dotnet');
 await page.getByRole('button',{name:'افزودن به دوره‌های من',exact:true}).click();
 await page.getByRole('button',{name:/خرید بخش اسپات‌پلیر/}).click();
 await page.getByText('سناریوی نمایشی پرداخت',{exact:true}).click();
 await page.getByRole('button',{name:'شبیه‌سازی پرداخت و استعلام'}).click();
 await expect(page.getByRole('status')).toContainText('فعال‌سازی در انتظار پردازش');
 await page.getByRole('button',{name:'اجرای نوبت ورکر'}).click();
 await expect(page.getByText('بخش پولی فعال است؛ لایسنس در حال صدور است.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'تکمیل صدور لایسنس'}).click();
 await expect(page.getByText('DEMO-LICENSE-dotnet',{exact:true})).toBeVisible();
});
test('a direct lesson link requires enrollment',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('bitro-progress',JSON.stringify({state:{session:true},version:0}));localStorage.removeItem('bitro-course-commerce-v1');});
 await page.goto('/learn/csharp/variables');
 await expect(page.getByRole('heading',{name:'ابتدا دوره را به دوره‌های من اضافه کنید'})).toBeVisible();
 await page.getByRole('button',{name:'افزودن به دوره‌های من',exact:true}).click();
 await expect(page.getByRole('heading',{name:'متغیر چیست؟',exact:true,level:1})).toBeVisible();
});
