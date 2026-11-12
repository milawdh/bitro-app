import { test, expect } from '@playwright/test';

test('user details persist role, notes, and a confirmed suspension', async ({ page }) => {
  await page.goto('/users');
  await page.locator('.people-person').first().click();
  await page.getByLabel('نقش کاربر', { exact: false }).selectOption('editor');
  await page.getByLabel('یادداشت داخلی', { exact: false }).fill('یادداشت آزمایشی تیم محتوا');
  await page.getByRole('button', { name: 'ذخیرهٔ اطلاعات کاربر' }).click();
  await page.reload();
  await expect(page.getByLabel('نقش کاربر', { exact: false })).toHaveValue('editor');
  await expect(page.getByLabel('یادداشت داخلی', { exact: false })).toHaveValue('یادداشت آزمایشی تیم محتوا');
  const suspended = await page.getByRole('button', { name: 'فعال‌کردن حساب', exact: true }).isVisible();
  if (suspended) {
    await page.getByRole('button', { name: 'فعال‌کردن حساب', exact: true }).click();
    await page.getByRole('button', { name: 'تأیید فعال‌کردن حساب', exact: true }).click();
  }
  await page.getByRole('button', { name: 'تعلیق حساب', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'تأیید تعلیق حساب', exact: true }).click();
  await expect(page.locator('.people-user-badges')).toContainText('تعلیق');
  await page.reload();
  await expect(page.getByRole('button', { name: 'فعال‌کردن حساب', exact: true })).toBeVisible();
});

test('admin settings persist including theme and workspace identity', async ({ page }) => {
  await page.goto('/settings');
  await page.getByPlaceholder('نام فضای کار').fill('استودیوی محتوای بیترو');
  await page.getByPlaceholder('نام نمایشی مدیر').fill('سارا');
  await page.locator('.people-theme-options').getByRole('button', { name: 'روشن', exact: true }).click();
  await page.getByRole('button', { name: 'ذخیرهٔ تنظیمات', exact: true }).click();
  await expect(page.locator('.people-success')).toContainText('ذخیره شد');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByPlaceholder('نام فضای کار')).toHaveValue('استودیوی محتوای بیترو');
  await expect(page.getByPlaceholder('نام نمایشی مدیر')).toHaveValue('سارا');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('analytics validates the range and exports only the selected report', async ({ page }) => {
  await page.goto('/analytics');
  await page.getByRole('button', { name: '۷ روز اخیر', exact: true }).click();
  await expect(page.locator('.people-report-presets button').first()).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'دریافت گزارش', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('bitrolearn-learning-report.csv');
  await page.getByLabel('شروع بازه').fill('2027-01-01');
  await page.getByLabel('پایان بازه').fill('2026-01-01');
  await expect(page.locator('.people-range-error')).toContainText('بازهٔ معتبر');
  await expect(page.getByRole('button', { name: 'دریافت گزارش', exact: true })).toBeDisabled();
});

test('admin reset preserves the learner origin storage and admin preferences', async ({ page, context }) => {
  const learnerPage = await context.newPage();
  await learnerPage.goto('http://127.0.0.1:3000/dashboard');
  await learnerPage.waitForFunction(() => Boolean(document.documentElement.dataset.theme));
  const marker = await learnerPage.evaluate(() => { const value = localStorage.getItem('bitro-progress') ?? '{}'; localStorage.setItem('bitro-admin-isolation-proof', 'student-origin'); return value; });
  await page.goto('/settings');
  await page.getByPlaceholder('نام نمایشی مدیر').fill('مدیر آزمایشی');
  await page.getByRole('button', { name: 'ذخیرهٔ تنظیمات', exact: true }).click();
  await page.getByRole('button', { name: 'بازنشانی داده‌های ادمین', exact: true }).click();
  await page.getByRole('button', { name: 'بازنشانی ادمین', exact: true }).click();
  await expect(page.getByPlaceholder('نام نمایشی مدیر')).toHaveValue('مدیر آزمایشی');
  expect(await learnerPage.evaluate(() => localStorage.getItem('bitro-progress') ?? '{}')).toBe(marker);
  expect(await learnerPage.evaluate(() => localStorage.getItem('bitro-admin-isolation-proof'))).toBe('student-origin');
  await learnerPage.close();
});

test('local demo login changes the admin session without a remote auth service', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'نام نمایشی مدیر', exact: true }).fill('مدیر محتوا');
  await page.getByRole('textbox', { name: 'ایمیل نمایشی', exact: true }).fill('content@example.com');
  await page.getByRole('button', { name: 'ورود به پنل آزمایشی' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('bitro-admin-data-v1') ?? '{}'));
  expect(snapshot.state.session).toBe(true);
  expect(snapshot.state.settings.adminName).toBe('مدیر محتوا');
});
