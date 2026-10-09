import { test, expect } from '@playwright/test';

test('new game prompt renders', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.getByTestId('button-new-game').click();
  await expect(page.getByText('Do you have a code for unlocking playtesting mode?')).toBeVisible();
  await page.screenshot({ path: 'playwright-new-game-check.png', fullPage: true });
});
