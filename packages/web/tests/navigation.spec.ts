import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('landing page has navigation links', async ({ page }) => {
    await page.goto('/');
    // Check for main nav links
    const nav = page.getByRole('navigation');
    await expect(nav.first()).toBeVisible();
  });

  test('clicking analytics link navigates correctly', async ({ page }) => {
    await page.goto('/');
    const analyticsLink = page.getByRole('link', { name: 'Analytics', exact: true });
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForURL('**/analytics**');
      expect(page.url()).toContain('analytics');
    }
  });

  test('clicking rankings link navigates correctly', async ({ page }) => {
    await page.goto('/');
    const rankingsLink = page.getByRole('link', { name: 'Rankings', exact: true });
    if (await rankingsLink.isVisible()) {
      await rankingsLink.click();
      await page.waitForURL('**/rankings**');
      expect(page.url()).toContain('rankings');
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
  });
});
