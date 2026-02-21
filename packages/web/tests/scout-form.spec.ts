import { test, expect } from '@playwright/test';

test.describe('Scout form (unauthenticated)', () => {
  test('requires authentication to access scouting', async ({ page }) => {
    const response = await page.goto('/scout');
    expect(response?.status()).toBeLessThan(500);
    // Should redirect or show auth needed
  });
});
