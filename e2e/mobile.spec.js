// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * AL-MOB: Mobile UI — layout, drawer, header title, Ideenkammer and Marktplatz.
 * All tests run at 390×844 (iPhone 12 size).
 * Requires the app running on http://localhost:8080 with the dev profile.
 * Dev seed: admin/4711, user/user. Pardur world_id=1.
 */

test.use({ viewport: { width: 390, height: 844 } });

// ─── shared mobile helpers ─────────────────────────────────────────────────

/**
 * Logs in by temporarily switching to desktop viewport (where the login button
 * is visible), reusing the same proven modal flow as the desktop test suite,
 * then restoring the mobile viewport.
 */
async function loginMobile(page, username, password) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
  await page.locator('#btn-login').click();
  await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
  await page.locator('#fl-u').fill(username);
  await page.locator('#fl-p').fill(password);
  await page.locator('#m-save').click();
  await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
  await page.setViewportSize({ width: 390, height: 844 });
}

/**
 * Opens the slide-in drawer.
 * The drawer slides in via CSS (right: -100% → right: 0) so we check for the
 * "open" class rather than toBeVisible(), which would always pass for display:flex.
 */
async function openDrawer(page) {
  await page.locator('#mobile-header button[aria-label="Menü öffnen"]').click();
  await expect(page.locator('#mobile-drawer')).toHaveClass(/open/, { timeout: 2000 });
}

/** Navigates to the Ideenkammer via the drawer (requires login first). */
async function goToIdeenkammerMobile(page) {
  await openDrawer(page);
  await page.locator('#mobile-drawer button:has-text("Ideenkammer")').click();
  await expect(page.locator('#page-ideas')).toHaveClass(/active/, { timeout: 5000 });
}

// ── AL-MOB-001: Mobile Layout ─────────────────────────────────────────────────

test.describe('AL-MOB-001 — Mobile Layout', () => {

  test('mobile header is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mobile-header')).toBeVisible();
  });

  test('desktop nav is hidden on mobile', async ({ page }) => {
    await page.goto('/');
    // The desktop <nav> has no id; the mobile nav has id="mobile-bottom-nav"
    await expect(page.locator('nav:not([id])')).toBeHidden();
  });

  test('bottom tab nav is hidden on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mobile-bottom-nav')).toBeHidden();
  });

  test('mobile header shows "Astral Library" on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mob-header-title')).toContainText('Astral Library');
  });

  test('burger button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mobile-header button[aria-label="Menü öffnen"]')).toBeVisible();
  });

});

// ── AL-MOB-002: Burger-Menü / Drawer ─────────────────────────────────────────

test.describe('AL-MOB-002 — Burger-Menü und Drawer', () => {

  test('drawer is closed on page load (no "open" class)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mobile-drawer')).not.toHaveClass(/open/);
  });

  test('burger button opens the drawer', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mobile-header button[aria-label="Menü öffnen"]').click();
    await expect(page.locator('#mobile-drawer')).toHaveClass(/open/, { timeout: 2000 });
  });

  test('close button inside drawer removes the "open" class', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await page.locator('#mobile-drawer button[aria-label="Menü schließen"]').click();
    await expect(page.locator('#mobile-drawer')).not.toHaveClass(/open/);
  });

  test('drawer title shows "Astral Library"', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await expect(page.locator('.mob-drawer-title')).toContainText('Astral Library');
  });

  test('drawer contains a Marktplatz entry', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await expect(page.locator('#mobile-drawer button:has-text("Marktplatz")')).toBeVisible();
  });

  test('clicking Marktplatz in drawer closes drawer and shows items page', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await page.locator('#mobile-drawer button:has-text("Marktplatz")').click();
    await expect(page.locator('#mobile-drawer')).not.toHaveClass(/open/);
    await expect(page.locator('#page-items')).toHaveClass(/active/, { timeout: 3000 });
  });

  test('world sub-links (Timeline) are listed in the drawer', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    // Worlds are rendered dynamically; wait for the first world row then check sub-links
    await expect(page.locator('#mob-drawer-worlds .mob-drawer-world-row').first())
      .toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('#mob-drawer-worlds .mob-drawer-world-sub:has-text("Timeline")').first()
    ).toBeVisible();
  });

});

// ── AL-MOB-003: Auth-abhängige Sichtbarkeit ───────────────────────────────────

test.describe('AL-MOB-003 — Auth-abhängige Sichtbarkeit im Drawer', () => {

  test('Ideenkammer entry is hidden in drawer when logged out', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await expect(page.locator('#mobile-drawer button:has-text("Ideenkammer")')).toBeHidden();
  });

  test('Ideenkammer entry is visible in drawer when logged in as user', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await openDrawer(page);
    await expect(page.locator('#mobile-drawer button:has-text("Ideenkammer")')).toBeVisible();
  });

  test('Ideenkammer entry is visible in drawer when logged in as admin', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'admin', '4711');
    await openDrawer(page);
    await expect(page.locator('#mobile-drawer button:has-text("Ideenkammer")')).toBeVisible();
  });

  test('ideas FAB has display:none inline style when logged out (applyAuthUI)', async ({ page }) => {
    await page.goto('/');
    // Wait for the auth check API call to complete so applyAuthUI() has run
    await page.waitForLoadState('networkidle');
    const inlineDisplay = await page.locator('#ideas-fab').evaluate(el => el.style.display);
    expect(inlineDisplay).toBe('none');
  });

  test('ideas FAB is visible on the ideas page when logged in', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#ideas-fab')).toBeVisible({ timeout: 3000 });
  });

  test('items FAB has display:none inline style when logged out (admin-only)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const inlineDisplay = await page.locator('#items-fab').evaluate(el => el.style.display);
    expect(inlineDisplay).toBe('none');
  });

  test('items FAB is visible on Marktplatz when logged in as admin', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'admin', '4711');
    await expect(page.locator('#items-fab')).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-MOB-004: Mobile Header-Titel ──────────────────────────────────────────

test.describe('AL-MOB-004 — Mobile Header-Titel', () => {

  test('header shows "Astral Library - Marktplatz" after navigating to items', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await page.locator('#mobile-drawer button:has-text("Marktplatz")').click();
    await expect(page.locator('#mob-header-title'))
      .toHaveText('Astral Library - Marktplatz', { timeout: 3000 });
  });

  test('header shows "Astral Library - Ideenkammer" on ideas page', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#mob-header-title'))
      .toHaveText('Astral Library - Ideenkammer', { timeout: 3000 });
  });

  test('header shows world name (not sub-page name) when navigating to a world section', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await expect(page.locator('#mob-drawer-worlds .mob-drawer-world-row').first())
      .toBeVisible({ timeout: 5000 });
    // Click the first available Timeline sub-link
    await page.locator('#mob-drawer-worlds .mob-drawer-world-sub:has-text("Timeline")').first().click();
    const title = await page.locator('#mob-header-title').textContent({ timeout: 3000 });
    // Must be "Astral Library - <worldname>"
    expect(title).toMatch(/^Astral Library - .+$/);
    // Must NOT contain sub-page names — only the world name is shown
    expect(title).not.toContain('Timeline');
    expect(title).not.toContain('Wiki');
    expect(title).not.toContain('Karte');
  });

});

// ── AL-MOB-005: Ideenkammer mobil ────────────────────────────────────────────

test.describe('AL-MOB-005 — Ideenkammer mobil', () => {

  test('kanban board is not visible on mobile ideas page', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('.ideas-rope-wrap')).toBeHidden();
  });

  test('mobile flat list (#mob-ideas-list) is visible', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#mob-ideas-list')).toBeVisible();
  });

  test('tag filter bar is visible above the list', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#ideas-tag-filter-bar')).toBeVisible();
  });

  test('filter bar contains an "Alle" chip', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#ideas-tag-filter-bar button:has-text("Alle")')).toBeVisible();
  });

  test('filter bar does not wrap (scrolls horizontally)', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    const flexWrap = await page.locator('#ideas-tag-filter-bar').evaluate(
      el => window.getComputedStyle(el).flexWrap
    );
    expect(flexWrap).toBe('nowrap');
  });

  test('desktop-preferred notice is not visible on mobile ideas page', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await expect(page.locator('#page-ideas .desktop-notice')).toBeHidden();
  });

  test('ideas FAB opens the create idea modal', async ({ page }) => {
    await page.goto('/');
    await loginMobile(page, 'user', 'user');
    await goToIdeenkammerMobile(page);
    await page.locator('#ideas-fab').click();
    await expect(page.locator('#ideas-modal-bg')).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-MOB-006: Marktplatz mobil ─────────────────────────────────────────────

test.describe('AL-MOB-006 — Marktplatz mobil', () => {

  test('items page is active by default on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-items')).toHaveClass(/active/, { timeout: 5000 });
  });

  test('items table renders rows', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#items-body tr').first()).toBeVisible({ timeout: 5000 });
  });

  test('item rows have no border-radius', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#items-body tr').first()).toBeVisible({ timeout: 5000 });
    const radius = await page.locator('#items-body tr').first().evaluate(
      el => window.getComputedStyle(el).borderRadius
    );
    expect(radius).toBe('0px');
  });

  test('items-wrap does not clip action buttons (overflow not hidden)', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.locator('.items-wrap').evaluate(
      el => window.getComputedStyle(el).overflow
    );
    expect(overflow).not.toBe('hidden');
  });

  test('item name cell does not truncate with ellipsis', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#items-body tr').first()).toBeVisible({ timeout: 5000 });
    const textOverflow = await page.locator('#items-body tr td:first-child').first().evaluate(
      el => window.getComputedStyle(el).textOverflow
    );
    expect(textOverflow).not.toBe('ellipsis');
  });

  test('search field is visible and functional on mobile', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('#s-search');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Trank');
    await expect(page.locator('#items-body tr').first()).toBeVisible({ timeout: 3000 });
  });

});
