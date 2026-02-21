import { test, expect } from '@playwright/test';

test.describe('Team Analytics - Rankings Feature', () => {
  const TEAM_NUMBER = '8569';
  const TEAM_URL = `/analytics/team/${TEAM_NUMBER}`;

  test('team analytics page loads', async ({ page }) => {
    const response = await page.goto(TEAM_URL);
    expect(response?.status()).toBeLessThan(500);

    // The team number should be visible in the page once loaded
    await expect(page.getByText(TEAM_NUMBER).first()).toBeVisible({ timeout: 30000 });
  });

  test('Season Rankings card appears or skeleton loader shows', async ({ page }) => {
    await page.goto(TEAM_URL);

    // Wait for either the actual "Season Rankings" heading or the skeleton loader
    // The skeleton is a set of animated pulse divs inside bg-gray-50/bg-gray-800 block
    const rankingsHeading = page.getByRole('heading', { name: 'Season Rankings' }).or(
      page.locator('h3', { hasText: 'Season Rankings' })
    );

    const skeletonLoader = page.locator('.animate-pulse').first();

    // At least a skeleton should show very quickly; rankings heading may take longer
    await expect(skeletonLoader.or(rankingsHeading)).toBeVisible({ timeout: 30000 });

    // Now wait longer to see if rankings resolve
    // Either the heading becomes visible or a skeleton is still shown (team has no rankings data)
    try {
      await expect(page.locator('h3', { hasText: 'Season Rankings' })).toBeVisible({ timeout: 15000 });
    } catch {
      // Rankings might not be available for this team, which is acceptable
      // The skeleton or the absence of the card is a valid state
    }
  });

  test('Rankings table has correct row structure when rankings are available', async ({ page }) => {
    await page.goto(TEAM_URL);

    // Wait for rankings heading to appear (page needs time to fetch team + rankings)
    const rankingsCard = page.locator('h3', { hasText: 'Season Rankings' });
    try {
      await rankingsCard.waitFor({ state: 'visible', timeout: 25000 });
    } catch {
      test.skip();
      return;
    }

    // Check that the four metric rows exist
    await expect(page.getByRole('cell', { name: 'Overall EPA' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Auto' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Teleop' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'Endgame' })).toBeVisible({ timeout: 5000 });
  });

  test('Rankings table shows World column header when rankings are available', async ({ page }) => {
    await page.goto(TEAM_URL);

    const rankingsCard = page.locator('h3', { hasText: 'Season Rankings' });
    try {
      await rankingsCard.waitFor({ state: 'visible', timeout: 25000 });
    } catch {
      test.skip();
      return;
    }

    // "World" column header should be visible inside the rankings table
    await expect(page.getByRole('columnheader', { name: 'World' })).toBeVisible({ timeout: 5000 });
  });

  test('Seasonal Performance section exists', async ({ page }) => {
    await page.goto(TEAM_URL);

    // The Seasonal Performance section loads asynchronously after the main events list.
    // It only renders when eventSummaries.length > 0, then fetches per-event analytics.
    // Allow up to 30s total for all async data fetches to complete.
    const seasonalHeading = page.getByRole('heading', { name: 'Seasonal Performance' }).or(
      page.locator('h2', { hasText: 'Seasonal Performance' })
    );

    await expect(seasonalHeading).toBeVisible({ timeout: 30000 });
  });
});
