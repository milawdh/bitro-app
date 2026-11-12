import { test, expect } from '@playwright/test';
test('local onboarding, search, and settings persist',async({page})=>{
  await page.goto('/register');
  await page.getByPlaceholder('نام تو').fill('سارا');
  await page.getByPlaceholder('you@example.com').fill('sara@example.com');
  await page.getByRole('button',{name:'بریم ماجراجویی'}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading',{level:1})).toContainText('سارا');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('textbox',{name:'جست‌وجو',exact:true}).fill('متغیر');
  await page.locator('.search-results').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/learn\/csharp\/variables$/);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{level:1})).toContainText('سارا');
});
test('a structured challenge validates all answers and records completion',async({page})=>{
  await page.goto('/challenges/variable-assignment');
  await page.locator('input[name="assign"][value="30"]').check();
  await page.locator('input[name="copy"][value="7"]').check();
  await page.locator('input[name="increment"][value="7"]').check();
  await page.getByRole('button',{name:'بررسی پاسخ‌ها'}).click();
  await expect(page.locator('.ch-result')).toContainText('عالی بود!');
  await page.reload();
  const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('bitro-progress')||'{}').state.completedChallenges);
  expect(completed).toContain('variable-assignment');
});
