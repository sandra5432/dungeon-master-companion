// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

/**
 * AL-G: Allgemeine Features — Login, Logout, Dark/Light Mode.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

// ── AL-G-001: Einloggen ───────────────────────────────────────────────────────

test.describe('AL-G-001 — Einloggen', () => {

  test('login button is visible before login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
  });

  test('admin can log in; admin-only elements appear', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    // Admin buttons must be visible after login
    await expect(page.locator('#btn-gear')).toBeVisible();
    await expect(page.locator('#btn-config')).toBeVisible();
  });

  test('user login shows username in nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-login').click();
    await page.locator('#fl-u').fill('user');
    await page.locator('#fl-p').fill('user');
    await page.locator('#m-save').click();
    await expect(page.locator('#nav-user')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#nav-user')).toContainText('user');
  });

  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-login').click();
    await page.locator('#fl-u').fill('admin');
    await page.locator('#fl-p').fill('wrongpassword');
    await page.locator('#m-save').click();
    await expect(page.locator('#fl-err')).toBeVisible({ timeout: 3000 });
  });

  test('login modal can be closed with cancel button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-login').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-G-002: Ausloggen ───────────────────────────────────────────────────────

test.describe('AL-G-002 — Ausloggen', () => {

  test('logout button is visible when logged in', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await expect(page.locator('#btn-logout')).toBeVisible();
  });

  test('after logout, admin-only elements disappear', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await expect(page.locator('#btn-gear')).toBeVisible();
    await page.locator('#btn-logout').click();
    await expect(page.locator('#btn-gear')).toBeHidden({ timeout: 3000 });
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 3000 });
  });

  test('after logout, items add button is hidden', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await expect(page.locator('button:has-text("+ Hinzufügen")')).toBeVisible();
    await page.locator('#btn-logout').click();
    await expect(page.locator('button:has-text("+ Hinzufügen")')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-G-003: Dark / Light Mode ───────────────────────────────────────────────

test.describe('AL-G-003 — Dark/Light Mode umschalten', () => {

  test('dark mode is active by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('theme button toggles from dark to light', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme button toggles back to dark', async ({ page }) => {
    await page.goto('/');
    await page.locator('#theme-btn').click(); // to light
    await page.locator('#theme-btn').click(); // back to dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('chosen theme persists across page reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#theme-btn').click(); // switch to light
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

});
