import { expect, test } from '@playwright/test';

const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('Authenticated read-only smoke', () => {
  test.skip(!username || !password, 'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run.');

  test('opens protected server-mediated pages without redirecting back to login', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/login?redirectTo=/tickets');

    const usernameInput = page.locator('input[placeholder="admin"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(usernameInput).toBeEditable();
    await expect(passwordInput).toBeEditable();

    let credentialsReady = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await usernameInput.fill(username!);
      await passwordInput.fill(password!);
      await page.waitForTimeout(100);

      credentialsReady = await usernameInput.inputValue() === username
        && await passwordInput.inputValue() === password;
      if (credentialsReady) break;
    }

    if (!credentialsReady) {
      await passwordInput.fill('');
      throw new Error('Login fields did not retain their values after hydration.');
    }

    await page.locator('button[type="submit"]').click();

    try {
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 60_000 });
    } catch (error) {
      if (/\/login(?:\?|$)/.test(page.url())) {
        await passwordInput.fill('', { timeout: 1_000 }).catch(() => undefined);
      }
      const cookieNames = (await page.context().cookies()).map(({ name }) => name).sort();
      throw new Error(`Authenticated navigation failed; browser cookies: ${cookieNames.join(', ') || '(none)'}`, {
        cause: error,
      });
    }

    for (const route of ['/', '/tickets', '/inbox', '/analytics/personal', '/analytics/staff']) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Internal Server Error');
    }
  });
});
