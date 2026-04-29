// @ts-check
/**
 * Shared helpers for all Playwright e2e tests.
 * Dev seed: admin/4711 (no mustChangePassword), user/user.
 * Pardur (world_id=1): full guest access. Eldorheim (world_id=2): no guest access.
 */

const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Basic ' + Buffer.from('admin:4711').toString('base64'),
};

const USER_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Basic ' + Buffer.from('user:user').toString('base64'),
};

/** Logs in as admin via the UI login modal. */
async function loginAsAdmin(page) {
  const { expect } = require('@playwright/test');
  await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
  await page.locator('#btn-login').click();
  await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
  await page.locator('#fl-u').fill('admin');
  await page.locator('#fl-p').fill('4711');
  await page.locator('#m-save').click();
  await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
}

/** Logs in as regular user via the UI login modal. */
async function loginAsUser(page) {
  const { expect } = require('@playwright/test');
  await expect(page.locator('#btn-login')).toBeVisible({ timeout: 5000 });
  await page.locator('#btn-login').click();
  await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
  await page.locator('#fl-u').fill('user');
  await page.locator('#fl-p').fill('user');
  await page.locator('#m-save').click();
  await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
}

/** Navigates to Pardur's Chronik. */
async function goToPardurChronik(page) {
  const { expect } = require('@playwright/test');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Pardur/i }).first().click();
  await page.locator('#tab-timeline').click();
  await expect(page.locator('#page-timeline')).toBeVisible({ timeout: 5000 });
}

/** Navigates to Pardur's Wiki. */
async function goToPardurWiki(page) {
  const { expect } = require('@playwright/test');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Pardur/i }).first().click();
  await page.locator('#tab-wiki').click();
  await expect(page.locator('#page-wiki')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#wiki-recent-list')).toBeVisible({ timeout: 5000 });
}

/** Navigates to Pardur's Karte. */
async function goToPardurMap(page) {
  const { expect } = require('@playwright/test');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Pardur/i }).first().click();
  await page.locator('#tab-map').click();
  await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });
}

/** Updates world permissions via API. */
async function setWorldPermissions(apiCtx, worldId, perms) {
  const listRes = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
  const worlds = await listRes.json();
  const world = worlds.find(w => w.id === worldId);
  if (!world) throw new Error(`World ${worldId} not found`);
  const res = await apiCtx.put(`/api/worlds/${worldId}`, {
    headers: ADMIN_HEADERS,
    data: {
      name: world.name,
      description: world.description ?? '',
      sortOrder: world.sortOrder ?? 0,
      milesPerCell: world.milesPerCell ?? 5,
      chronicleEnabled: world.chronicleEnabled ?? true,
      wikiEnabled: world.wikiEnabled ?? true,
      mapEnabled: world.mapEnabled ?? true,
      ...perms,
    },
  });
  if (!res.ok()) throw new Error(`setWorldPermissions failed: ${res.status()}`);
}

/**
 * Logs in as admin and navigates to the Ideenkammer for world_id=1 (Pardur).
 */
async function goToIdeasPage(page) {
  const { expect } = require('@playwright/test');
  await page.goto('/');
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /Pardur/i }).first().click();
  await page.locator('#nav-ideas').click();
  await expect(page.locator('#page-ideas')).toHaveClass(/active/, { timeout: 5000 });
}

/**
 * Logs in as the regular user (non-admin) and navigates to the Ideenkammer for world_id=1 (Pardur).
 */
async function goToIdeasPageAsUser(page) {
  const { expect } = require('@playwright/test');
  await page.goto('/');
  await loginAsUser(page);
  await page.getByRole('button', { name: /Pardur/i }).first().click();
  await page.locator('#nav-ideas').click();
  await expect(page.locator('#page-ideas')).toHaveClass(/active/, { timeout: 5000 });
}

/**
 * Creates a test idea via API and returns the created idea object.
 * @param {import('@playwright/test').APIRequestContext} apiCtx
 * @param {number} worldId
 * @param {object} data  Partial CreateIdeaRequest
 * @returns {Promise<object>}
 */
async function createTestIdea(apiCtx, worldId, data = {}) {
  const res = await apiCtx.post(`/api/worlds/${worldId}/ideas`, {
    headers: ADMIN_HEADERS,
    data: { title: 'Test-Idee', tags: [], ...data },
  });
  if (!res.ok()) throw new Error(`createTestIdea failed: ${res.status()}`);
  return res.json();
}

/**
 * Deletes a test idea via API (admin).
 * @param {import('@playwright/test').APIRequestContext} apiCtx
 * @param {number} worldId
 * @param {number} ideaId
 */
async function deleteTestIdea(apiCtx, worldId, ideaId) {
  await apiCtx.delete(`/api/worlds/${worldId}/ideas/${ideaId}`, { headers: ADMIN_HEADERS });
}

module.exports = {
  ADMIN_HEADERS, USER_HEADERS,
  loginAsAdmin, loginAsUser,
  goToPardurChronik, goToPardurWiki, goToPardurMap,
  setWorldPermissions,
  goToIdeasPage, goToIdeasPageAsUser, createTestIdea, deleteTestIdea,
};
