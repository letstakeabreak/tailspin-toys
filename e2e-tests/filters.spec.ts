import { test, expect, type Page } from '@playwright/test';

/** Locator for the game cards currently visible on the page. */
const visibleCards = (page: Page) => page.locator('[data-testid="game-card"]:visible');

test.describe('Game filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows filter controls', async ({ page }) => {
    await expect(page.getByTestId('game-filters')).toBeVisible();
    await expect(page.getByTestId('filter-publisher')).toBeVisible();
    await expect(page.getByTestId('filter-reset')).toBeVisible();
  });

  test('filters by a single category and can be cleared', async ({ page }) => {
    const total = await visibleCards(page).count();
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    await checkbox.check();

    const categoryName = (await checkbox.locator('xpath=..').textContent())?.trim() ?? '';
    const count = await visibleCards(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(total);
    for (const tag of await visibleCards(page).getByTestId('game-category').allTextContents()) {
      expect(tag.trim()).toBe(categoryName);
    }

    await page.getByTestId('filter-reset').click();
    await expect(visibleCards(page)).toHaveCount(total);
  });

  test('supports multiple categories (OR)', async ({ page }) => {
    const boxes = page.locator('[data-testid^="filter-category-"]');
    await boxes.nth(0).check();
    const first = await visibleCards(page).count();
    await boxes.nth(1).check();
    expect(await visibleCards(page).count()).toBeGreaterThanOrEqual(first);
  });

  test('filters by publisher', async ({ page }) => {
    const select = page.getByTestId('filter-publisher');
    await select.selectOption({ index: 1 });
    const name = (await select.locator('option:checked').textContent())?.trim() ?? '';
    expect(await visibleCards(page).count()).toBeGreaterThan(0);
    for (const tag of await visibleCards(page).getByTestId('game-publisher').allTextContents()) {
      expect(tag.trim()).toBe(name);
    }
  });

  test('combines category and publisher filters and syncs the URL', async ({ page }) => {
    await page.locator('[data-testid^="filter-category-"]').first().check();
    const categoryOnly = await visibleCards(page).count();
    await page.getByTestId('filter-publisher').selectOption({ index: 1 });
    expect(await visibleCards(page).count()).toBeLessThanOrEqual(categoryOnly);
    await expect(page).toHaveURL(/category=\d+.*publisher=\d+/);
  });

  test('restores filters from the URL', async ({ page }) => {
    await page.locator('[data-testid^="filter-category-"]').first().check();
    const count = await visibleCards(page).count();
    await page.reload();
    await expect(page.locator('[data-testid^="filter-category-"]').first()).toBeChecked();
    await expect(visibleCards(page)).toHaveCount(count);
  });

  test('ignores unknown filter ids in the URL', async ({ page }) => {
    const total = await visibleCards(page).count();
    await page.goto('/?category=999999');
    await expect(visibleCards(page)).toHaveCount(total);
  });

  test('shows an empty state when no games match', async ({ page }) => {
    const select = page.getByTestId('filter-publisher');
    const boxes = page.locator('[data-testid^="filter-category-"]');
    const publisherCount = await select.locator('option').count();
    const categoryCount = await boxes.count();

    // Find a category/publisher pair with no games.
    for (let c = 0; c < categoryCount; c++) {
      for (let p = 1; p < publisherCount; p++) {
        await boxes.nth(c).check();
        await select.selectOption({ index: p });
        if ((await visibleCards(page).count()) === 0) {
          await expect(page.getByTestId('filter-empty')).toBeVisible();
          return;
        }
        await page.getByTestId('filter-reset').click();
      }
    }
    test.skip(true, 'every category/publisher pair has games');
  });

  test('is operable by keyboard', async ({ page }) => {
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(page.getByTestId('filter-count')).toContainText('Showing');
  });
});
