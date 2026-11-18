import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const progress=JSON.parse(localStorage.getItem('bitro-progress')??'{"state":{}}');
    localStorage.setItem('bitro-progress',JSON.stringify({...progress,state:{...progress.state,session:true}}));
    const commerce=JSON.parse(localStorage.getItem('bitro-course-commerce-v1')??'{"state":{"memberships":[],"invoices":[]}}');
    for(const courseId of ['csharp','dotnet'])if(!commerce.state.memberships.some((m:{courseId:string})=>m.courseId===courseId))commerce.state.memberships.push({courseId,paidAccess:false,licenseStatus:'locked',licenseSource:'none',licenseKey:null});
    localStorage.setItem('bitro-course-commerce-v1',JSON.stringify(commerce));
  });
});

test('a learner can reach the first interactive lesson from the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('فقط کد نخوان');
  await page.getByRole('link', { name: 'اولین قدم رو بردار' }).click();
  await expect(page).toHaveURL(/\/learn\/csharp\/variables$/);
  await expect(page.getByRole('heading', { name: 'متغیر چیست؟', exact: true, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'قدم بعدی', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'حالا نوبت توست' })).toBeVisible();
  await page.getByRole('button', { name: 'قدم بعدی', exact: true }).click();
  await page.getByRole('button', { name: /اجرای نمونه/ }).click();
  await expect(page.locator('.blp-console-lines')).toContainText('50');
  await expect(page.locator('.blp-console-lines')).toContainText('پیش‌نمایش نمونه کامل شد');
});

test('learning paths lead to authored course lessons', async ({ page }) => {
  await page.goto('/learn');
  await page.locator('.lp-course-card').filter({ hasText: 'دنیای سی‌شارپ' }).click();
  await expect(page).toHaveURL(/\/learn\/csharp$/);
  await expect(page.getByRole('heading', { name: 'دنیای سی‌شارپ', exact: true })).toBeVisible();
  await expect(page.locator('.lp-lesson-row')).toHaveCount(6);
  await page.getByRole('link', { name: /شروع یادگیری/ }).click();
  await expect(page).toHaveURL(/\/learn\/csharp\/variables$/);
});

test('variables, objects, and thread controls change deterministic visible state', async ({ page }) => {
  await page.goto('/concept-labs/variables');
  await page.getByRole('button', { name: 'افزایش مقدار', exact: true }).click();
  await expect(page.locator('.cs-value-box')).toContainText('۴۳');
  await page.getByRole('textbox', { name: 'نام متغیر' }).fill('points');
  await expect(page.locator('.cs-code pre')).toContainText('int points = 43;');
  await page.goto('/concept-labs/objects');
  await page.getByRole('button', { name: 'ساخت ماشین' }).click();
  await expect(page.locator('.cs-car')).toHaveCount(2);
  await page.locator('.cs-car').first().click();
  await page.getByRole('button', { name: 'گاز بده' }).click();
  await expect(page.locator('.cs-car').first()).toContainText('۲۰');
  await expect(page.locator('.cs-car').nth(1)).toContainText('۰');
  await page.goto('/concept-labs/threads');
  await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await expect(page.locator('.cs-lane-label small').nth(0)).toHaveText('1/6');
  await expect(page.locator('.cs-lane-label small').nth(1)).toHaveText('1/6');
  await page.getByRole('button', { name: 'ترتیبی', exact: true }).click();
  await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await expect(page.locator('.cs-lane-label small').nth(0)).toHaveText('1/6');
  await expect(page.locator('.cs-lane-label small').nth(1)).toHaveText('0/6');
  await page.getByRole('button', { name: 'موازی', exact: true }).click();
  await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await expect(page.locator('.cs-lane-label small').nth(1)).toHaveText('1/6');
});

test('a lesson requires a correct assessment and persists completion', async ({ page }) => {
  await page.goto('/learn/csharp/variables');
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'قدم بعدی', exact: true }).click();
  await expect(page.getByRole('button', { name: 'قدم بعدی', exact: true })).toBeDisabled();
  await page.locator('.blp-quiz button').nth(0).click();
  await page.getByRole('button', { name: 'بررسی پاسخ' }).click();
  await expect(page.locator('.blp-feedback')).toContainText('هنوز دقیق نیست');
  await page.locator('.blp-quiz button').nth(1).click();
  await page.getByRole('button', { name: 'بررسی پاسخ' }).click();
  await expect(page.locator('.blp-feedback')).toContainText('درست گفتی');
  await page.getByRole('button', { name: 'قدم بعدی', exact: true }).click();
  await expect(page.getByRole('link', { name: 'درس بعدی' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'درس بعدی' })).toBeVisible();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('bitro-progress') ?? '{}'));
  expect(progress.state.completedLessons).toContain('csharp/variables');
});

test('the interactive HTTP graph follows playback through to the response', async ({ page }) => {
  await page.goto('/concept-labs/http');
  const graph = page.getByRole('group', { name: 'نمودار تعاملی مسیر درخواست HTTP' });
  await expect(graph.locator('.react-flow__node')).toHaveCount(8);
  await expect(graph.locator('.http-flow-node.active strong')).toHaveText('مرورگر');
  await graph.getByRole('button', { name: 'بزرگ‌نمایی نمودار', exact: true }).click();
  await graph.getByRole('button', { name: 'نمایش کامل نمودار', exact: true }).click();
  await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await expect(graph.locator('.http-flow-node.active strong')).toHaveText('درخواست HTTP');
  for (let index = 1; index < 7; index++) await page.getByRole('button', { name: 'گام بعد', exact: true }).click();
  await expect(graph.locator('.http-flow-node.visited')).toHaveCount(7);
  await expect(graph.locator('.http-flow-node.active strong')).toHaveText('پاسخ ۲۰۰');
  await expect(page.locator('.cs-response')).toContainText('Arman');
});

test('theme switching and mobile lesson panels remain usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'فعال‌کردن تم روشن' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const path of ['/concept-labs/references', '/concept-labs/threads', '/learn/csharp/variables']) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  const navigation = page.getByRole('navigation', { name: 'پنل‌های درس' });
  await navigation.getByRole('button', { name: 'تصویر مفهوم' }).click();
  await expect(page.locator('.cs-value-box')).toBeVisible();
  await navigation.getByRole('button', { name: 'کدنویسی' }).click();
  await page.getByRole('button', { name: /اجرای نمونه/ }).click();
  await expect(page.locator('.blp-console-lines')).toBeVisible();
  await expect(page.locator('.blp-console-lines')).toContainText('50');
});
