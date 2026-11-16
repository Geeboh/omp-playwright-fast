import { test, expect } from '@playwright/test';

test('@smoke homepage loads and has a useful document title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/\S+/);
  await expect(page.locator('body')).toBeVisible();
});
