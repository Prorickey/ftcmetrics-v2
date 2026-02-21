import { test, expect } from '@playwright/test';

test.describe('Analytics pages', () => {
  test('analytics page loads', async ({ page }) => {
    const response = await page.goto('/analytics');
    expect(response?.status()).toBeLessThan(500);
  });

  test('rankings page loads', async ({ page }) => {
    const response = await page.goto('/rankings');
    expect(response?.status()).toBeLessThan(500);
  });

  test('does not expose API credentials', async ({ page }) => {
    await page.goto('/analytics');
    const content = await page.content();
    expect(content).not.toContain('FTC_API_TOKEN');
    expect(content).not.toContain('FTC_API_USERNAME');
  });
});
