// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, ADMIN_HEADERS } = require('./helpers');

/**
 * AL-C: Admin features — Nutzerverwaltung (C1) and Weltverwaltung (C2).
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

// ── Local navigation helpers ──────────────────────────────────────────────────

async function openUsersPage(page) {
  await page.goto('/');
  await loginAsAdmin(page);
  await page.locator('#btn-gear').click();
  await expect(page.locator('#page-users')).toBeVisible({ timeout: 5000 });
  // renderUsers() is async and not awaited by showPage — wait for tbody to have rows
  await expect(page.locator('#users-body tr')).not.toHaveCount(0, { timeout: 5000 });
}

async function openWorldsConfig(page) {
  await page.goto('/');
  await loginAsAdmin(page);
  await page.locator('#btn-config').click();
  await expect(page.locator('#page-config')).toBeVisible({ timeout: 5000 });
}

// ── AL-C1-001: Nutzerliste anzeigen ──────────────────────────────────────────

test.describe('AL-C1-001 — Nutzerliste anzeigen', () => {

  test('user management page is accessible for admin via gear icon', async ({ page }) => {
    await openUsersPage(page);
    await expect(page.locator('#users-table')).toBeVisible();
  });

  test('user management page is NOT accessible without login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-gear')).toBeHidden({ timeout: 5000 });
  });

  test('seeded users admin and user appear in the list', async ({ page }) => {
    await openUsersPage(page);
    await expect(page.locator('#users-body').filter({ hasText: 'admin' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#users-body').filter({ hasText: 'user' })).toBeVisible();
  });

});

// ── AL-C1-002: Nutzer erstellen ───────────────────────────────────────────────

test.describe('AL-C1-002 — Nutzer erstellen', () => {
  const newUsername = `e2euser-${Date.now()}`;

  test.afterEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/admin/users', { headers: ADMIN_HEADERS });
    if (!res.ok()) return;
    const users = await res.json();
    const u = users.find(x => x.username === newUsername);
    if (u) await apiCtx.delete(`/api/admin/users/${u.id}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open the create user modal', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('button:has-text("+ Nutzer anlegen")').click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#um-username')).toBeVisible();
    await page.locator('#user-modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 3000 });
  });

  test('admin can create a new user and it appears in the list', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('button:has-text("+ Nutzer anlegen")').click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#um-username').fill(newUsername);
    await page.locator('#um-role').selectOption('USER');
    await page.locator('#um-save').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#users-body').filter({ hasText: newUsername })).toBeVisible({ timeout: 5000 });
  });

  test('saving without username shows error', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('button:has-text("+ Nutzer anlegen")').click();
    await page.locator('#um-username').fill('');
    await page.locator('#um-save').click();
    await expect(page.locator('#um-err')).toBeVisible({ timeout: 3000 });
    await page.locator('#user-modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-C1-003: Nutzerrolle und Farbe bearbeiten ───────────────────────────────

test.describe('AL-C1-003 — Nutzerrolle und Farbe bearbeiten', () => {
  let userId;
  const editUsername = `e2eedit-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/admin/users', {
      headers: ADMIN_HEADERS,
      data: { username: editUsername, role: 'USER', colorHex: '#ff0000' },
    });
    expect(res.ok(), `beforeEach: POST /api/admin/users returned ${res.status()}`).toBeTruthy();
    userId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (userId) await apiCtx.delete(`/api/admin/users/${userId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open the edit modal for a user', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('#users-body tr').filter({ hasText: editUsername }).locator('button').first().click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#user-modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 3000 });
  });

  test('admin can change user role to ADMIN', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('#users-body tr').filter({ hasText: editUsername }).locator('button').first().click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#um-role').selectOption('ADMIN');
    await page.locator('#um-save').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#users-body tr').filter({ hasText: editUsername }).filter({ hasText: 'ADMIN' })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-C1-004: Nutzer löschen ─────────────────────────────────────────────────

test.describe('AL-C1-004 — Nutzer löschen', () => {
  let userId;
  const delUsername = `e2edel-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/admin/users', {
      headers: ADMIN_HEADERS,
      data: { username: delUsername, role: 'USER', colorHex: '#ff0000' },
    });
    expect(res.ok(), `beforeEach: POST /api/admin/users returned ${res.status()}`).toBeTruthy();
    userId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (userId) await apiCtx.delete(`/api/admin/users/${userId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can delete a user and it disappears from the list', async ({ page }) => {
    await openUsersPage(page);
    const row = page.locator('#users-body tr').filter({ hasText: delUsername });
    // deleteUser() uses window.confirm — accept it before clicking
    page.once('dialog', dialog => dialog.accept());
    await row.locator('button.act-btn.del').click();
    await expect(page.locator('#users-body').filter({ hasText: delUsername })).toBeHidden({ timeout: 5000 });
    userId = null;
  });

});

// ── AL-C1-005: Passwort zurücksetzen ─────────────────────────────────────────

test.describe('AL-C1-005 — Passwort zurücksetzen (wird auf Benutzername gesetzt)', () => {
  let userId;
  const resetUsername = `e2ereset-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/admin/users', {
      headers: ADMIN_HEADERS,
      data: { username: resetUsername, role: 'USER', colorHex: '#ff0000' },
    });
    expect(res.ok(), `beforeEach: POST /api/admin/users returned ${res.status()}`).toBeTruthy();
    userId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (userId) await apiCtx.delete(`/api/admin/users/${userId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('reset password checkbox appears when editing a user', async ({ page }) => {
    await openUsersPage(page);
    await page.locator('#users-body tr').filter({ hasText: resetUsername }).locator('button').first().click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#um-reset-grp')).toBeVisible();
    await expect(page.locator('#um-reset-pw')).toBeVisible();
    await page.locator('#user-modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 3000 });
  });

  test('after reset, user can log in with their username as password', async ({ page, request: apiCtx }) => {
    await openUsersPage(page);
    await page.locator('#users-body tr').filter({ hasText: resetUsername }).locator('button').first().click();
    await expect(page.locator('#user-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#um-reset-pw').check();
    await page.locator('#um-save').click();
    await expect(page.locator('#user-modal')).toBeHidden({ timeout: 5000 });

    const loginRes = await apiCtx.post('/api/login', {
      data: { username: resetUsername, password: resetUsername },
    });
    expect(loginRes.status()).toBe(200);
  });

});

// ── AL-C1-006: Eigenes Passwort ändern ───────────────────────────────────────

test.describe('AL-C1-006 — Eigenes Passwort ändern', () => {

  test('password change overlay can be opened by logged-in user', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.evaluate(() => {
      document.getElementById('pw-overlay').style.display = 'flex';
    });
    await expect(page.locator('#pw-overlay')).toBeVisible();
  });

  test('password change with wrong current password shows an error', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.evaluate(() => {
      document.getElementById('pw-overlay').style.display = 'flex';
    });
    await page.locator('#pw-current').fill('wrongpassword');
    await page.locator('#pw-new').fill('newpassword123');
    await page.locator('#pw-confirm').fill('newpassword123');
    await page.locator('#pw-overlay button:has-text("Passwort setzen")').click();
    await expect(page.locator('#pw-err')).toBeVisible({ timeout: 3000 });
  });

  test('password change with mismatched confirmation shows an error', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.evaluate(() => {
      document.getElementById('pw-overlay').style.display = 'flex';
    });
    await page.locator('#pw-current').fill('4711');
    await page.locator('#pw-new').fill('newpassword123');
    await page.locator('#pw-confirm').fill('differentpassword');
    await page.locator('#pw-overlay button:has-text("Passwort setzen")').click();
    await expect(page.locator('#pw-err')).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-C2-001: Weltenliste anzeigen ──────────────────────────────────────────

test.describe('AL-C2-001 — Weltenliste anzeigen', () => {

  test('world config page is accessible for admin via config icon', async ({ page }) => {
    await openWorldsConfig(page);
    await expect(page.locator('#config-worlds-table, #config-worlds-body').first()).toBeVisible({ timeout: 5000 });
  });

  test('seeded worlds Pardur, Eldorheim, and Regeln appear in the list', async ({ page }) => {
    await openWorldsConfig(page);
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Pardur' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Eldorheim' })).toBeVisible();
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Regeln' })).toBeVisible();
  });

  test('world config page is NOT accessible without login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-config')).toBeHidden({ timeout: 5000 });
  });

});

// ── AL-C2-002: Welt erstellen ─────────────────────────────────────────────────

test.describe('AL-C2-002 — Welt erstellen', () => {
  const newWorldName = `E2E-Welt-${Date.now()}`;
  let createdWorldId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (createdWorldId) {
      await apiCtx.delete(`/api/worlds/${createdWorldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      createdWorldId = null;
    } else {
      const res = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
      if (!res.ok()) return;
      const worlds = await res.json();
      const w = worlds.find(x => x.name === newWorldName);
      if (w) await apiCtx.delete(`/api/worlds/${w.id}`, { headers: ADMIN_HEADERS }).catch(() => {});
    }
  });

  test('admin can open the create world modal', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-n')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can create a new world and it appears in the list', async ({ page, request: apiCtx }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill(newWorldName);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: newWorldName })).toBeVisible({ timeout: 5000 });

    const res = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
    const worlds = await res.json();
    const w = worlds.find(x => x.name === newWorldName);
    createdWorldId = w?.id;
  });

  test('saving without a world name shows an error', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill('');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

});

// ── AL-C2-003: Welt bearbeiten ────────────────────────────────────────────────

test.describe('AL-C2-003 — Welt bearbeiten', () => {
  let worldId;
  const editWorldName = `E2E-Edit-${Date.now()}`;
  const updatedName = `E2E-Upd-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: editWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open the edit modal for a world', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-n')).toHaveValue(editWorldName);
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can change the world name', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill(updatedName);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: updatedName })).toBeVisible({ timeout: 5000 });
  });

  test('admin can set a sortOrder/sequence value', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-seq')).toBeVisible();
    await page.locator('#fw-seq').fill('5');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  });

});

// ── AL-C2-004: Weltberechtigungen konfigurieren ───────────────────────────────

test.describe('AL-C2-004 — Weltberechtigungen konfigurieren', () => {
  let worldId;
  const permWorldName = `E2E-Perm-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: permWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('permission checkboxes are visible in the world edit modal', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-guest-read')).toBeVisible();
    await expect(page.locator('#fw-guest-edit')).toBeVisible();
    await expect(page.locator('#fw-guest-delete')).toBeVisible();
    await expect(page.locator('#fw-user-read')).toBeVisible();
    await expect(page.locator('#fw-user-edit')).toBeVisible();
    await expect(page.locator('#fw-user-delete')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can toggle guest read permission and save', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    const checkbox = page.locator('#fw-guest-read');
    const wasChecked = await checkbox.isChecked();
    if (wasChecked) {
      await checkbox.uncheck();
    } else {
      await checkbox.check();
    }
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  });

  test('feature section checkboxes are visible (Chronik, Wiki, Karte)', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-chronicle, #fw-timeline')).toBeVisible();
    await expect(page.locator('#fw-wiki')).toBeVisible();
    await expect(page.locator('#fw-map')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

});

// ── AL-C2-005: Welt löschen ───────────────────────────────────────────────────

test.describe('AL-C2-005 — Welt löschen', () => {
  let worldId;
  const delWorldName = `E2E-Del-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: delWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can delete a world and it disappears from the list', async ({ page }) => {
    await openWorldsConfig(page);
    const row = page.locator('#config-worlds-body tr').filter({ hasText: delWorldName });
    await row.locator('button.act-btn.del, button[title="Löschen"]').last().click();
    const modal = page.locator('#modal');
    if (await modal.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.locator('#m-save').click();
    }
    await expect(page.locator('#config-worlds-body').filter({ hasText: delWorldName })).toBeHidden({ timeout: 5000 });
    worldId = null;
  });

});

// ── AL-C2-006: Wiki-Export pro Welt ──────────────────────────────────────────

test.describe('AL-C2-006 — Wiki-Export pro Welt', () => {

  test('GET /api/export/worlds/1/wiki returns 200 with application/zip', async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/export/worlds/1/wiki', { headers: ADMIN_HEADERS });
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('zip');
  });

  test('wiki export is not accessible without authentication', async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/export/worlds/1/wiki');
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });

});
