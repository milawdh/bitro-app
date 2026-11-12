import {test,expect} from '@playwright/test';
test('dashboard filters, quick search and navigation reflect actual local content',async({page})=>{
 await page.goto('/');await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.locator('.ds-stats .ds-stat')).toHaveCount(4);
 await page.getByLabel('بازهٔ نمودار فعالیت').selectOption('month');
 await expect(page.locator('.ds-chart svg')).toHaveAttribute('aria-label',/۳۰/);
 await page.keyboard.press('ControlOrMeta+k');
 await page.getByRole('textbox',{name:'جست‌وجوی استودیو'}).fill('متغیر چیست');
 await page.locator('.search-results').getByRole('link').first().click();
 await expect(page).toHaveURL(/\/lessons\/csharp-variables$/);
 await expect(page.getByRole('textbox',{name:'عنوان درس',exact:true})).toHaveValue('متغیر چیست؟');
});
test('mobile pages and both themes remain keyboard-accessible without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/dashboard');
 await page.getByRole('button',{name:'فعال‌کردن تم روشن'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 for(const path of ['/dashboard','/courses','/lessons/csharp-variables','/labs/variables','/projects/my-first-api','/users','/analytics','/settings']){
  await page.goto(path);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await page.getByRole('button',{name:'بازکردن منو',exact:true}).click();
 await expect(page.locator('.ad-sidebar')).toHaveClass(/open/);
 await page.keyboard.press('Escape');
 await expect(page.locator('.ad-sidebar')).not.toHaveClass(/open/);
});
