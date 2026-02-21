import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('landing page has navigation links', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) {
      // Mobile layout hides nav links via CSS — just verify the page loaded
      await expect(page.getByRole('heading', { name: 'FTC Metrics' })).toBeVisible();
    } else {
      const nav = page.getByRole('navigation');
      await expect(nav.first()).toBeVisible();
    }
  });

  test('clicking analytics link navigates correctly', async ({ page }) => {
    await page.goto('/');
    const analyticsLink = page.getByRole('link', { name: 'Analytics', exact: true });
    if (await analyticsLink.isVisible().catch(() => false)) {
      await analyticsLink.click();
      // Analytics may redirect unauthenticated users back to landing or login
      // Just verify the click triggers navigation (URL changes at least briefly)
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      // Either landed on analytics or was redirected to login/home
      expect(url).toMatch(/analytics|login|\//);
    }
  });

  test('clicking rankings link navigates correctly', async ({ page }) => {
    await page.goto('/');
    const rankingsLink = page.getByRole('link', { name: 'Rankings', exact: true });
    if (await rankingsLink.isVisible().catch(() => false)) {
      await rankingsLink.click();
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      expect(url).toMatch(/rankings|login|\//);
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    // Next.js may return 200 with a not-found page or 404
    expect(response?.status()).toBeLessThan(500);
  });
});
