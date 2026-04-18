/**
 * Frontend unit tests for world-permission-aware UI helpers in app.js.
 *
 * Run with: node backend/src/test/js/worldPermissions.test.js
 * No dependencies required — uses Node.js built-in assert module.
 *
 * Covers the helpers that gate rope-gap clicks and POI sidebar buttons
 * based on world-level guest permissions rather than login state alone.
 */

'use strict';

const assert = require('assert/strict');

// ── minimal state scaffold ────────────────────────────────────────────────────

function makeState({ loggedIn = false, activeWorldId = 1, worlds = [] } = {}) {
  return {
    auth: { loggedIn },
    ui:   { activeWorldId },
    worlds,
  };
}

function world(id, { guestCanEdit = false, guestCanDelete = false, guestCanRead = false } = {}) {
  return { id, guestCanEdit, guestCanDelete, guestCanRead };
}

// ── canEditActiveWorld (mirrors the helper to be added to app.js) ─────────────

function canEditActiveWorld(state) {
  if (state.auth.loggedIn) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return w?.guestCanEdit === true;
}

// ── canDeleteActiveWorld ──────────────────────────────────────────────────────

function canDeleteActiveWorld(state) {
  if (state.auth.loggedIn) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return w?.guestCanDelete === true;
}

// ── poiButtonDisabled (mirrors renderPoiTypeSidebar disabled logic) ───────────

function poiButtonDisabled(state) {
  return !canEditActiveWorld(state);
}

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── canEditActiveWorld ────────────────────────────────────────────────────────

console.log('canEditActiveWorld');

test('logged-in user can always edit regardless of guest flag', () => {
  const state = makeState({ loggedIn: true, activeWorldId: 1, worlds: [world(1, { guestCanEdit: false })] });
  assert.equal(canEditActiveWorld(state), true);
});

test('guest can edit when world guestCanEdit=true', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanEdit: true })] });
  assert.equal(canEditActiveWorld(state), true);
});

test('guest cannot edit when world guestCanEdit=false', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanEdit: false })] });
  assert.equal(canEditActiveWorld(state), false);
});

test('guest cannot edit when active world not found in list', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 99, worlds: [world(1, { guestCanEdit: true })] });
  assert.equal(canEditActiveWorld(state), false);
});

test('guest cannot edit when worlds list is empty', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [] });
  assert.equal(canEditActiveWorld(state), false);
});

// ── canDeleteActiveWorld ──────────────────────────────────────────────────────

console.log('\ncanDeleteActiveWorld');

test('logged-in user can always delete', () => {
  const state = makeState({ loggedIn: true, activeWorldId: 1, worlds: [world(1, { guestCanDelete: false })] });
  assert.equal(canDeleteActiveWorld(state), true);
});

test('guest can delete when world guestCanDelete=true', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanDelete: true })] });
  assert.equal(canDeleteActiveWorld(state), true);
});

test('guest cannot delete when world guestCanDelete=false', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanDelete: false })] });
  assert.equal(canDeleteActiveWorld(state), false);
});

// ── rope gap visibility ───────────────────────────────────────────────────────

console.log('\nrope gap visibility');

test('rope gap clickable for guest when world allows edit', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanEdit: true })] });
  assert.equal(canEditActiveWorld(state), true, 'rope gap should be interactive');
});

test('rope gap inert for guest when world denies edit', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 2, worlds: [world(2, { guestCanEdit: false })] });
  assert.equal(canEditActiveWorld(state), false, 'rope gap should be pointer-events:none');
});

// ── POI sidebar button disabled state ────────────────────────────────────────

console.log('\nPOI sidebar button disabled state');

test('POI buttons enabled for logged-in user', () => {
  const state = makeState({ loggedIn: true, activeWorldId: 1, worlds: [world(1, { guestCanEdit: false })] });
  assert.equal(poiButtonDisabled(state), false);
});

test('POI buttons enabled for guest when world guestCanEdit=true', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanEdit: true })] });
  assert.equal(poiButtonDisabled(state), false);
});

test('POI buttons disabled for guest when world guestCanEdit=false', () => {
  const state = makeState({ loggedIn: false, activeWorldId: 1, worlds: [world(1, { guestCanEdit: false })] });
  assert.equal(poiButtonDisabled(state), true);
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
