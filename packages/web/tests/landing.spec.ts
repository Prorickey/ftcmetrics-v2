import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('has login link', async ({ page }) => {
    await page.goto('/');
    const loginLink = page.getByRole('link', { name: /sign in|log in|login/i });
    await expect(loginLink).toBeVisible();
  });

  test('renders hero content', async ({ page }) => {
    await page.goto('/');
    // Should have some heading content
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0);
  });
});
