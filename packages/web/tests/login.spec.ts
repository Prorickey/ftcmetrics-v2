import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('shows OAuth provider buttons', async ({ page }) => {
    await page.goto('/login');
    // Should have at least one OAuth button (Google, Discord, or GitHub)
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('does not expose credentials in page source', async ({ page }) => {
    await page.goto('/login');
    const content = await page.content();
    expect(content).not.toContain('client_secret');
    expect(content).not.toContain('NEXTAUTH_SECRET');
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(errors.filter(e => !e.includes('hydration') && !e.includes('NEXT_REDIRECT'))).toHaveLength(0);
  });
});
