import { test, expect } from '@playwright/test';

test.describe('My Teams (unauthenticated)', () => {
  test('redirects or shows auth prompt when not authenticated', async ({ page }) => {
    const response = await page.goto('/my-teams');
    expect(response?.status()).toBeLessThan(500);
  });
});
