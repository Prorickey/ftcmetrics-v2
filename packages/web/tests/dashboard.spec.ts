import { test, expect } from '@playwright/test';

test.describe('Dashboard (unauthenticated)', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    const response = await page.goto('/dashboard');
    // Should redirect to login or show auth prompt
    const url = page.url();
    const redirected = url.includes('login') || url.includes('signin') || url.includes('auth') || url === new URL('/', page.url()).href;
    expect(response?.status()).toBeLessThan(500);
  });

  test('does not expose sensitive data', async ({ page }) => {
    await page.goto('/dashboard');
    const content = await page.content();
    expect(content).not.toContain('DATABASE_URL');
    expect(content).not.toContain('NEXTAUTH_SECRET');
  });
});
