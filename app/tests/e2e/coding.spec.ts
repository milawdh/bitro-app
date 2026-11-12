import { expect, test } from '@playwright/test';

test.describe('coding learning environments', () => {
  test('runs a supported loop sample and exposes its deterministic trace', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'اجرای نمایشی', exact: false }).click();
    await page.getByLabel('سرعت پخش').selectOption('2');
    await expect(page.locator('.pg-console-line').filter({ hasText: 'Total: 15' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.pg-variables')).toContainText('15');
    await page.getByRole('button', { name: 'ردگیری اجرا' }).click();
    await expect(page.locator('.pg-trace-list > button')).toHaveCount(12);
    await page.locator('.pg-trace-list > button').nth(5).click();
    await expect(page.locator('.pg-variables')).toContainText('6');
    await expect(page.locator('.pg-current-event')).toContainText('تکرار 3');
  });

  test('clearly rejects edited C# instead of reporting fictional execution', async ({ page }) => {
    await page.goto('/playground');
    const editor = page.locator('.monaco-editor [role="textbox"]').first();
    await expect(editor).toBeAttached({ timeout: 30000 });
    await editor.focus();
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially('Console.WriteLine("changed");');
    await page.getByRole('button', { name: 'اجرای نمایشی', exact: false }).click();
    await expect(page.locator('.pg-diagnostic')).toContainText('کامپایل نمی‌شود');
    await expect(page.locator('.pg-console-line')).toHaveCount(0);
    await page.getByRole('button', { name: 'بازگشت به نمونهٔ آماده' }).click();
    await expect(page.locator('.pg-diagnostic')).toHaveCount(0);
  });

  test('creates, renames, edits, persists and deletes a project file', async ({ page }) => {
    await page.goto('/projects/my-first-api');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'فایل جدید', exact: true }).click();
    await page.getByLabel('نام و مسیر فایل').fill('Models/Book.cs');
    await page.getByRole('button', { name: 'ساخت فایل', exact: true }).click();
    await expect(page.locator('.pw-tree')).toContainText('Book.cs');
    await page.getByRole('button', { name: 'تغییر نام', exact: true }).click();
    await page.getByLabel('نام و مسیر فایل').fill('Models/Note.cs');
    await page.getByRole('button', { name: 'ذخیرهٔ نام', exact: true }).click();
    const editor = page.locator('.monaco-editor [role="textbox"]').first();
    await editor.focus();
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially('namespace MyFirstApi;\npublic record Note(int Id);');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('bitro-project-my-first-api') ?? '{}').files?.find((file: { path: string }) => file.path === 'Models/Note.cs')?.content)).toContain('record Note');
    await page.reload();
    await expect(page.locator('.pw-tree')).toContainText('Note.cs');
    await expect(page.locator('.pw-breadcrumb')).toContainText('Note.cs');
    await page.getByRole('button', { name: 'حذف فایل', exact: true }).click();
    await expect(page.locator('.pw-tree')).not.toContainText('Note.cs');
    await expect(page.getByText('فایل حذف شد.', { exact: false })).toBeVisible();
  });

  test('simulates a project run and meaningful API success and not-found responses', async ({ page }) => {
    await page.goto('/projects/my-first-api');
    await page.getByRole('button', { name: 'اجرای نمایشی', exact: true }).click();
    await expect(page.locator('.pw-terminal-lines')).toContainText('SIMULATION');
    await page.getByRole('button', { name: 'درخواست API', exact: true }).click();
    await page.getByRole('button', { name: 'ارسال', exact: true }).click();
    await expect(page.locator('.pw-response')).toContainText('200 OK');
    await expect(page.locator('.pw-response')).toContainText('Arman');
    await page.getByLabel('مسیر درخواست').fill('/api/users/999');
    await page.getByRole('button', { name: 'ارسال', exact: true }).click();
    await expect(page.locator('.pw-response')).toContainText('404 Not Found');
  });
});

