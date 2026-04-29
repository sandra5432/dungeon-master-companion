// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

/**
 * AL-A: Marktplatz features — AL-A-001 through AL-A-009.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

/** Creates an item via the admin UI, filters the list by name, and returns its row locator. */
async function createItem(page, name, price = '10', tags = '') {
  await page.locator('button:has-text("+ Hinzufügen")').click();
  await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
  await page.locator('#fi-n').fill(name);
  await page.locator('#fi-p').fill(price);
  if (tags) await page.locator('#fi-tags').fill(tags);
  await page.locator('#m-save').click();
  await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  await page.locator('#s-search').fill(name);
  return page.locator('#items-body tr').filter({ hasText: name });
}

/** Deletes an item by name, using the search box to locate it across pagination. */
async function deleteItem(page, name) {
  await page.locator('#s-search').fill(name);
  await page.locator('#items-body tr').filter({ hasText: name }).locator('button.act-btn.del').first().click();
  await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
  await page.locator('#m-save').click();
  await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  await page.locator('#s-search').fill('');
}

// ── AL-A-001: Artikelliste anzeigen ──────────────────────────────────────────

test.describe('AL-A-001 — Artikelliste anzeigen', () => {

  test('guest sees the items page without logging in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-items')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#page-items table.it')).toBeVisible();
    await expect(page.locator('#item-count')).toBeVisible();
  });

  test('items table header columns are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-items table.it th').filter({ hasText: 'Name' })).toBeVisible();
    await expect(page.locator('#page-items table.it th.col-price')).toBeVisible();
    await expect(page.locator('#page-items table.it th').filter({ hasText: 'Tags' })).toBeVisible();
  });

  test('admin action column is hidden for guest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#th-actions')).toBeHidden();
  });

  test('admin action column is visible after admin login', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await expect(page.locator('#th-actions')).toBeVisible();
  });

});

// ── AL-A-002: Artikel suchen ──────────────────────────────────────────────────

test.describe('AL-A-002 — Artikel suchen', () => {
  const itemName = `Suchtest-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, itemName);
  });

  test.afterEach(async ({ page }) => {
    await deleteItem(page, itemName);
  });

  test('typing in search box filters items by name', async ({ page }) => {
    const uniquePrefix = itemName.slice(0, 12);
    await page.locator('#s-search').fill(uniquePrefix);
    await expect(page.locator('#items-body tr').filter({ hasText: itemName })).toBeVisible();
  });

  test('search with non-matching text hides the item', async ({ page }) => {
    await page.locator('#s-search').fill('xyzABCnomatch_' + Date.now());
    await expect(page.locator('#items-body tr').filter({ hasText: itemName })).toBeHidden();
  });

  test('clearing search restores the item', async ({ page }) => {
    await page.locator('#s-search').fill('xyzABCnomatch');
    await page.locator('#s-search').fill('');
    await expect(page.locator('#items-body tr').first()).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-A-003: Preisspannen-Filter ────────────────────────────────────────────

test.describe('AL-A-003 — Artikel nach Preis filtern', () => {
  const cheapItem     = `Billig-${Date.now()}`;
  const expensiveItem = `Teuer-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, cheapItem, '5');
    await createItem(page, expensiveItem, '999');
  });

  test.afterEach(async ({ page }) => {
    await page.locator('#s-min').fill('');
    await page.locator('#s-max').fill('');
    await deleteItem(page, cheapItem);
    await deleteItem(page, expensiveItem);
  });

  test('max price filter hides items above the limit', async ({ page }) => {
    await page.locator('#s-search').fill('');
    await page.locator('#s-max').fill('100');
    await expect(page.locator('#items-body tr').filter({ hasText: cheapItem })).toBeVisible();
    await expect(page.locator('#items-body tr').filter({ hasText: expensiveItem })).toBeHidden();
  });

  test('min price filter hides items below the limit', async ({ page }) => {
    await page.locator('#s-min').fill('500');
    await expect(page.locator('#items-body tr').filter({ hasText: expensiveItem })).toBeVisible();
    await expect(page.locator('#items-body tr').filter({ hasText: cheapItem })).toBeHidden();
  });

  test('combined min+max filter shows only items in range', async ({ page }) => {
    await page.locator('#s-search').fill('');
    await page.locator('#s-min').fill('1');
    await page.locator('#s-max').fill('100');
    await expect(page.locator('#items-body tr').filter({ hasText: cheapItem })).toBeVisible();
    await expect(page.locator('#items-body tr').filter({ hasText: expensiveItem })).toBeHidden();
  });

});

// ── AL-A-004: Tag-Filter ──────────────────────────────────────────────────────

test.describe('AL-A-004 — Artikel nach Tag filtern', () => {
  const taggedItem   = `Tagged-${Date.now()}`;
  const untaggedItem = `Untagged-${Date.now()}`;
  const tag          = `e2etag${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, taggedItem, '1', tag);
    await createItem(page, untaggedItem, '1', '');
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => clearItemTags());
    await deleteItem(page, taggedItem);
    await deleteItem(page, untaggedItem);
  });

  test('tag filter dropdown opens on click', async ({ page }) => {
    await page.locator('#itf-trigger').click();
    await expect(page.locator('#itf-dropdown')).toBeVisible();
  });

  test('selecting a tag shows only items with that tag', async ({ page }) => {
    await page.locator('#s-search').fill('');
    await page.locator('#itf-trigger').click();
    await page.locator(`#itf-dropdown input[value="${tag}"]`).check();
    await page.locator('body').click();
    await expect(page.locator('#items-body tr').filter({ hasText: taggedItem })).toBeVisible();
    await expect(page.locator('#items-body tr').filter({ hasText: untaggedItem })).toBeHidden();
  });

});

// ── AL-A-005: Artikelliste sortieren ─────────────────────────────────────────

test.describe('AL-A-005 — Artikelliste sortieren', () => {
  const itemA = `AAA-sort-${Date.now()}`;
  const itemZ = `ZZZ-sort-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, itemZ, '1');
    await createItem(page, itemA, '2');
  });

  test.afterEach(async ({ page }) => {
    await deleteItem(page, itemA);
    await deleteItem(page, itemZ);
  });

  test('clicking Name column sorts items ascending', async ({ page }) => {
    const ts = itemA.slice('AAA-sort-'.length);
    await page.locator('#s-search').fill(ts);
    await page.locator('#page-items table.it th').filter({ hasText: 'Name' }).click();
    const rows = page.locator('#items-body tr td:first-child');
    const names = await rows.allTextContents();
    const relevant = names.filter(n => n.startsWith('AAA-sort') || n.startsWith('ZZZ-sort'));
    expect(relevant).toEqual([itemA, itemZ]);
  });

  test('clicking Name column twice reverses sort to descending', async ({ page }) => {
    const ts = itemA.slice('AAA-sort-'.length);
    await page.locator('#s-search').fill(ts);
    const header = page.locator('#page-items table.it th').filter({ hasText: 'Name' });
    await header.click();
    await header.click();
    const rows = page.locator('#items-body tr td:first-child');
    const names = await rows.allTextContents();
    const relevant = names.filter(n => n.startsWith('AAA-sort') || n.startsWith('ZZZ-sort'));
    expect(relevant).toEqual([itemZ, itemA]);
  });

  test('clicking Preis column sorts items by price ascending', async ({ page }) => {
    await page.locator('#s-search').fill('');
    await page.locator('#page-items table.it th.col-price').click();
    await expect(page.locator('#items-body tr').filter({ hasText: itemA })).toBeVisible();
    await expect(page.locator('#items-body tr').filter({ hasText: itemZ })).toBeVisible();
  });

});

// ── AL-A-006: Artikel erstellen ───────────────────────────────────────────────

test.describe('AL-A-006 — Artikel erstellen (Admin only)', () => {

  test('add button is not visible for guest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("+ Hinzufügen")')).toBeHidden();
  });

  test('admin can open the create modal', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.locator('button:has-text("+ Hinzufügen")').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fi-n')).toBeVisible();
    await expect(page.locator('#fi-p')).toBeVisible();
    await page.locator('#modal .m-close').click();
  });

  test('admin can create a new item and it appears in the list', async ({ page }) => {
    const name = `Neuer Gegenstand ${Date.now()}`;
    await page.goto('/');
    await loginAsAdmin(page);
    const row = await createItem(page, name, '42', 'magic');
    await expect(row).toBeVisible();
    await deleteItem(page, name);
  });

  test('saving without a name shows an error', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.locator('button:has-text("+ Hinzufügen")').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fi-n').fill('');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal .m-close').click();
  });

});

// ── AL-A-007: Artikel bearbeiten ──────────────────────────────────────────────

test.describe('AL-A-007 — Artikel bearbeiten (Admin only)', () => {
  const originalName = `Edit-Original-${Date.now()}`;
  const updatedName  = `Edit-Updated-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, originalName, '10');
  });

  test.afterEach(async ({ page }) => {
    if (await page.locator('#btn-login').isVisible().catch(() => false)) {
      await loginAsAdmin(page);
    }
    await page.locator('#s-search').fill(updatedName);
    const updatedExists = (await page.locator('#items-body tr').filter({ hasText: updatedName }).count()) > 0;
    if (updatedExists) {
      await deleteItem(page, updatedName);
    } else {
      await deleteItem(page, originalName);
    }
  });

  test('edit button is not visible for guest', async ({ page }) => {
    await page.locator('#btn-logout').click();
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
    await page.locator('#s-search').fill(originalName);
    await expect(page.locator('#items-body tr').filter({ hasText: originalName }).first().locator('button.act-btn')).toBeHidden({ timeout: 3000 });
    await page.locator('#s-search').fill('');
  });

  test('admin can open the edit modal for an item', async ({ page }) => {
    const row = page.locator('#items-body tr').filter({ hasText: originalName }).first();
    await row.locator('button.act-btn:not(.del)').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fi-n')).toHaveValue(originalName);
    await page.locator('#modal .m-close').click();
  });

  test('admin can update an item name and the change persists', async ({ page }) => {
    const row = page.locator('#items-body tr').filter({ hasText: originalName }).first();
    await row.locator('button.act-btn:not(.del)').click();
    await page.locator('#fi-n').fill(updatedName);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await page.locator('#s-search').fill(updatedName);
    await expect(page.locator('#items-body tr').filter({ hasText: updatedName })).toBeVisible();
    await page.locator('#s-search').fill(originalName);
    await expect(page.locator('#items-body tr').filter({ hasText: originalName })).toBeHidden();
    await page.locator('#s-search').fill('');
  });

});

// ── AL-A-008: Artikel löschen ─────────────────────────────────────────────────

test.describe('AL-A-008 — Artikel löschen (Admin only)', () => {
  const itemName = `Delete-Test-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, itemName);
  });

  test('delete button is not visible for guest', async ({ page }) => {
    await page.locator('#btn-logout').click();
    await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
    await page.locator('#s-search').fill(itemName);
    await expect(page.locator('#items-body tr').filter({ hasText: itemName }).first().locator('button.act-btn.del')).toBeHidden({ timeout: 3000 });
    await page.locator('#s-search').fill('');
  });

  test('admin sees confirmation modal before deleting', async ({ page }) => {
    const row = page.locator('#items-body tr').filter({ hasText: itemName }).first();
    await row.locator('button.act-btn.del').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#del-txt')).toContainText(itemName);
    await page.locator('#modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#items-body tr').filter({ hasText: itemName }).first()).toBeVisible();
  });

  test('admin can delete an item and it disappears from the list', async ({ page }) => {
    await deleteItem(page, itemName);
    await expect(page.locator('#items-body tr').filter({ hasText: itemName })).toBeHidden();
  });

});

// ── AL-A-009: Export als Markdown ────────────────────────────────────────────

test.describe('AL-A-009 — Artikelliste als Markdown exportieren (Admin only)', () => {
  const exportItem = `Export-Test-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await createItem(page, exportItem, '99');
  });

  test.afterEach(async ({ page }) => {
    await deleteItem(page, exportItem);
  });

  test('export button is not visible for guest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("⤓ Exportieren")')).toBeHidden();
  });

  test('export button is visible for admin', async ({ page }) => {
    await expect(page.locator('button:has-text("⤓ Exportieren")')).toBeVisible();
  });

  test('GET /api/export/items returns 200 with markdown content-type for admin session', async ({ page }) => {
    const response = await page.request.get('/api/export/items');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    expect(response.headers()['content-disposition']).toContain('items-export.md');
  });

  test('GET /api/export/items response body contains the test item', async ({ page }) => {
    const response = await page.request.get('/api/export/items');
    const body = await response.text();
    expect(body).toContain(exportItem);
    expect(body).toContain('# Marktplatz');
  });

  test('GET /api/export/items returns 401 for unauthenticated request', async ({ request }) => {
    const response = await request.get('/api/export/items');
    expect([401, 403]).toContain(response.status());
  });

});
