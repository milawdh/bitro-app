import {test,expect} from '@playwright/test';
test('manual activation requires a key and adds the course to the learner',async({page})=>{
 await page.goto('/commerce');
 await page.getByRole('radio',{name:'ثبت دستی',exact:true}).check();
 await page.getByRole('button',{name:'اعمال و افزودن به دوره‌های کاربر'}).click();
 await expect(page.getByRole('alert').filter({hasText:'کلید لایسنس دستی الزامی است.'})).toBeVisible();
 await page.getByLabel('کلید لایسنس',{exact:true}).fill('DEMO-MANUAL-LICENSE');
 await page.getByRole('button',{name:'اعمال و افزودن به دوره‌های کاربر'}).click();
 await expect(page.getByRole('code')).toHaveText('DEMO-MANUAL-LICENSE');
 await expect(page.getByText(/عضویت: ثبت شده · بخش پولی: فعال/)).toBeVisible();
});
