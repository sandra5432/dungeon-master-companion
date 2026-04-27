/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const state = {
  worlds: [],
  events: [],
  undated: [],
  items: [],
  auth: { loggedIn: false, isAdmin: false, userId: null, username: null, colorHex: null, mustChangePassword: false },
  ui: {
    activeWorldId: null,
    activeTags: new Set(),
    activeChars: new Set(),
    activeTypes: new Set(),
    tagsCollapsed: true,
    charsCollapsed: true,
    compact: false,
    currentPage: 'timeline',
    detailId: null,
    detailSource: null,
    sortKey: null,
    sortDir: 1,
    activeItemTags: new Set(),
    searchText: '',
    minPrice: 0,
    maxPrice: Infinity,
    dragId: null,
    dragSource: null,
    itemPage: 0,
    wikiActiveWorldId: null,
    wikiSearchText: '',
    wikiSearchTimer: null,
    wikiEditId: null,
    wikiPendingImages: [],
    wikiExistingImages: [],
    wikiTypeFilter: new Set(),
    wikiFilterPanelOpen: false,
    wikiView: 'hierarchy',
    wikiCollapsedTypes: new Set(),
    wikiCollapsedNodes: new Set(),
    wikiEditParentId: null,
  },
  wikiTitles: [],
  wikiAllEntries: [],
  wikiFullGraph: null,
  map: {
    pois:              [],
    poiTypes:          [],
    activeTool:        'interact',
    ruler:             null,
    rulerStep:         0,
    rulerStart:        null,
    bgUrl:             null,
    bgScale:           1.0,
    zoom:              1.0,
    panX:              0,
    panY:              0,
    editPoiId:         null,
    pendingX:          null,
    pendingY:          null,
    selectedGesinnung: null,
  },
};

// Modal edit state
let editId       = null;
let editSource   = null; // 'tl'|'undated'|'item'|'item-del'|'tl-del'|'undated-del'|'drop'|'world'|'world-del'|'login'
let editItemId   = null;
let editWorldId  = null;
let dropEventId  = null;   // undated event id being dropped
let dropAfterEventId = null; // predecessor event id (null = top)
let undatedMode  = false;
let mouseDownX   = 0;
let mouseDownY   = 0;
let didDrag      = false;

/* ══════════════════════════════════════
   API WRAPPER
══════════════════════════════════════ */
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });
  if (res.status === 401) { showLoginModal(); throw new Error('Unauthorized'); }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Request failed'); }
  if (res.status === 204) return null;
  return res.json();
}

async function apiUpload(path, formData) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  if (res.status === 401) { showLoginModal(); throw new Error('Unauthorized'); }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Upload failed'); }
  return res.json();
}

/* ══════════════════════════════════════
   THEME / NAV
══════════════════════════════════════ */
function applyThemeFromStorage() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
}

/* ══════════════════════════════════════
   URL ROUTING
══════════════════════════════════════ */

/**
 * Builds a pathname string for the given world, section, and optional sub-ID.
 * @param {number|null} worldId
 * @param {string} section  'timeline' | 'wiki' | 'map' | 'items'
 * @param {number|null} [subId]
 * @returns {string}
 */
function buildUrl(worldId, section, subId) {
  if (!worldId || section === 'items') return '/';
  const base = `/world/${worldId}/${section}`;
  return subId ? `${base}/${subId}` : base;
}

/**
 * Parses window.location.pathname into a routing descriptor.
 * @returns {{ page: string, worldId: number|null, subId: number|null }}
 */
function parseUrl() {
  const m = window.location.pathname.match(/^\/world\/(\d+)\/(timeline|wiki|map)(?:\/(\d+))?/);
  if (m) {
    return {
      page:    m[2],
      worldId: parseInt(m[1], 10),
      subId:   m[3] ? parseInt(m[3], 10) : null,
    };
  }
  return { page: 'items', worldId: null, subId: null };
}

/**
 * Pushes a new entry onto the browser history stack.
 * @param {string} path
 */
function pushUrl(path) {
  history.pushState(null, '', path);
}

/**
 * Navigates the app to the state described by a parsed URL.
 * Sets world/page state directly (does not go through selectWorld) to avoid
 * double-pushes. When push=true, updates the browser URL.
 *
 * @param {{ page: string, worldId: number|null, subId: number|null }} parsed
 * @param {boolean} push  true when user-initiated; false on startup / popstate
 */
async function navigateToUrl({ page, worldId, subId }, push) {
  console.debug('[navigateToUrl] →', { page, worldId, subId, push });

  if (page === 'items') {
    if (push) pushUrl('/');
    showPage('items');
    console.debug('[navigateToUrl] ← items');
    return;
  }

  const world = worldId ? state.worlds.find(w => w.id === worldId) : null;

  // Guests can only navigate to worlds the server already returned (guestCanRead filter).
  if (!state.auth.loggedIn && !world) {
    if (push) pushUrl('/');
    showPage('items');
    console.debug('[navigateToUrl] ← guest, no accessible world, fallback to items');
    return;
  }

  if (!world) {
    if (push) pushUrl('/');
    showPage('items');
    console.debug('[navigateToUrl] ← unknown world, fallback to items');
    return;
  }

  // Update world state without triggering selectWorld's own URL push
  const worldChanged = state.ui.activeWorldId !== worldId;
  if (worldChanged) {
    state.ui.activeWorldId     = worldId;
    state.ui.wikiActiveWorldId = worldId;
    localStorage.setItem('activeWorldId', worldId);
    state.events  = [];
    state.undated = [];
    state.ui.activeTags  = new Set();
    state.ui.activeChars = new Set();
    state.ui.activeTypes = new Set();
  }

  // Redirect to first enabled section if the requested page is disabled for this world
  if (!isSectionEnabled(world, page)) {
    const fallback = firstEnabledSection(world);
    if (fallback && fallback !== page) {
      console.debug('[navigateToUrl] page disabled, redirecting to', fallback);
      return navigateToUrl({ page: fallback, worldId, subId: null }, push);
    }
    // All sections disabled — fall through and show nothing
  }

  if (page === 'timeline') {
    if (worldChanged || !state.events.length) {
      try {
        const [ev, und] = await Promise.all([
          api('GET', `/worlds/${worldId}/events`),
          api('GET', `/worlds/${worldId}/events/unpositioned`),
        ]);
        // Stale-check: bail if another navigation changed the world while we were loading
        if (state.ui.activeWorldId !== worldId) return;
        state.events  = ev  || [];
        state.undated = und || [];
      } catch (e) { console.error('[navigateToUrl] load events failed', e); }
    }
    if (state.ui.activeWorldId !== worldId) return;
    if (push) pushUrl(buildUrl(worldId, 'timeline', subId));
    showPage('timeline');
    if (subId) {
      const inTl      = state.events.find(e => e.id === subId);
      const inUndated = !inTl && state.undated.find(e => e.id === subId);
      if (inTl)           { populateDetail(subId, 'tl');      openDetailPanel(); }
      else if (inUndated) { populateDetail(subId, 'undated'); openDetailPanel(); }
    }

  } else if (page === 'wiki') {
    if (push) pushUrl(buildUrl(worldId, 'wiki', subId));
    showPage('wiki');
    if (subId) await loadWikiArticle(subId, true);

  } else if (page === 'map') {
    if (push) pushUrl(buildUrl(worldId, 'map'));
    showPage('map');
  }

  renderTopNavWorlds();
  console.debug('[navigateToUrl] ← done', page);
}

function showPage(p) {
  if (p === 'config' && !state.auth.isAdmin) return;
  if (p === 'users'  && !state.auth.isAdmin) return;
  state.ui.currentPage = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  const pageEl = document.getElementById('page-' + p);
  if (pageEl) pageEl.classList.add('active');

  if (p === 'items') {
    const navEl = document.getElementById('nav-items');
    if (navEl) navEl.classList.add('active');
  } else if (state.ui.activeWorldId) {
    const navEl = document.getElementById('nav-world-' + state.ui.activeWorldId);
    if (navEl) navEl.classList.add('active');
  }

  if (p !== 'timeline') closeDetail();
  if (p === 'items')  renderItems();
  if (p === 'users')  renderUsers();
  if (p === 'wiki')   initWikiPage();
  if (p === 'config') renderConfigWorlds();
  if (p === 'map')    initMapPage();

  renderSectionTabs();
}

/* ══════════════════════════════════════
   AUTH VISIBILITY
══════════════════════════════════════ */

/** Returns true if the current user (logged-in or guest) may create/edit content in the active world. */
function canEditActiveWorld() {
  if (state.auth.isAdmin) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  if (state.auth.loggedIn) return w?.userCanEdit !== false;
  return w?.guestCanEdit === true;
}

/** Returns true if the current user may delete content in the active world. */
function canDeleteActiveWorld() {
  if (state.auth.isAdmin) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  if (state.auth.loggedIn) return w?.userCanDelete !== false;
  return w?.guestCanDelete === true;
}

function applyAuthUI() {
  const { loggedIn, isAdmin, username } = state.auth;
  const activeWorld = state.worlds.find(w => w.id === state.ui.activeWorldId);
  const canEditWorld   = isAdmin || (loggedIn ? activeWorld?.userCanEdit   !== false : activeWorld?.guestCanEdit   === true);
  const canDeleteWorld = isAdmin || (loggedIn ? activeWorld?.userCanDelete !== false : activeWorld?.guestCanDelete === true);

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  document.querySelectorAll('.user-action-only').forEach(el => {
    el.style.display = loggedIn ? '' : 'none';
  });
  document.querySelectorAll('.world-edit-only').forEach(el => {
    el.style.display = canEditWorld ? '' : 'none';
  });
  document.querySelectorAll('.world-delete-only').forEach(el => {
    el.style.display = canDeleteWorld ? '' : 'none';
  });

  const btnLogin = document.getElementById('btn-login');
  const navUser  = document.getElementById('nav-user');
  if (btnLogin) btnLogin.style.display = loggedIn ? 'none' : '';
  if (navUser) {
    navUser.style.display = loggedIn ? '' : 'none';
    navUser.textContent   = username || '';
  }
}

// keep old name as alias so nothing else breaks
function updateAdminVisibility() { applyAuthUI(); }

/**
 * Triggers a browser download of the wiki export ZIP for the given world.
 * Uses a temporary anchor element to initiate the download without a fetch call.
 * @param {number} worldId  ID of the world to export
 */
function exportWorldWiki(worldId) {
  console.debug('[exportWorldWiki] →', worldId);
  const a = document.createElement('a');
  a.href = `/api/export/worlds/${worldId}/wiki`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.debug('[exportWorldWiki] ← download triggered');
}

/**
 * Triggers a browser download of the full items export as a Markdown file.
 * Uses a temporary anchor element to initiate the download without a fetch call.
 */
function exportItems() {
  console.debug('[exportItems] →');
  const a = document.createElement('a');
  a.href = '/api/export/items';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.debug('[exportItems] ← download triggered');
}

function renderConfigWorlds() {
  const el = document.getElementById('config-worlds-body');
  if (!el) return;
  if (!state.worlds.length) {
    el.innerHTML = '<tr><td colspan="3" style="text-align:center;font-style:italic;color:var(--t3);padding:16px">Keine Welten vorhanden</td></tr>';
    return;
  }
  el.innerHTML = state.worlds.map(w => `
    <tr>
      <td>${escHtml(w.name)}</td>
      <td>${escHtml(w.description || '—')}</td>
      <td>
        <div class="act-btns">
          <button class="act-btn" onclick="openEditWorldModal(${w.id},event)" title="Bearbeiten">✎</button>
          <button class="act-btn" onclick="exportWorldWiki(${w.id})" title="Wiki exportieren" style="font-size:1.1rem">⤓</button>
          <button class="act-btn del" onclick="openDeleteWorldConfirm(${w.id},event)" title="Löschen">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTopNavWorlds() {
  const linksEl = document.getElementById('nav-links');
  if (!linksEl) return;
  const marktplatz = document.getElementById('nav-items');
  linksEl.innerHTML = '';
  if (marktplatz) linksEl.appendChild(marktplatz);
  state.worlds.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'nav-link' + (w.id === state.ui.activeWorldId ? ' active' : '');
    btn.id = 'nav-world-' + w.id;
    btn.textContent = w.name;
    btn.onclick = () => selectWorld(w.id);
    linksEl.appendChild(btn);
  });
}

/**
 * Returns true if the given section ('timeline'|'wiki'|'map') is enabled for the world object.
 * @param {object} world  A world object from state.worlds (may be undefined)
 * @param {string} section
 * @returns {boolean}
 */
function isSectionEnabled(world, section) {
  if (!world) return true; // no world selected — don't restrict
  if (section === 'timeline') return world.chronicleEnabled !== false;
  if (section === 'wiki')     return world.wikiEnabled      !== false;
  if (section === 'map')      return world.mapEnabled        !== false;
  return true;
}

/**
 * Returns the first enabled section for the given world, or null if none are enabled.
 * @param {object} world
 * @returns {string|null}
 */
function firstEnabledSection(world) {
  for (const s of ['timeline', 'wiki', 'map']) {
    if (isSectionEnabled(world, s)) return s;
  }
  return null;
}

function renderSectionTabs() {
  const tabs = document.getElementById('section-tabs');
  if (!tabs) return;
  const isWorldPage = ['timeline', 'wiki', 'map'].includes(state.ui.currentPage);
  tabs.style.display = (state.ui.activeWorldId && isWorldPage) ? '' : 'none';
  const world       = state.worlds.find(w => w.id === state.ui.activeWorldId);
  const tabTimeline = document.getElementById('tab-timeline');
  const tabWiki     = document.getElementById('tab-wiki');
  const tabMap      = document.getElementById('tab-map');
  if (tabTimeline) {
    tabTimeline.style.display = isSectionEnabled(world, 'timeline') ? '' : 'none';
    tabTimeline.classList.toggle('active', state.ui.currentPage === 'timeline');
  }
  if (tabWiki) {
    tabWiki.style.display = isSectionEnabled(world, 'wiki') ? '' : 'none';
    tabWiki.classList.toggle('active', state.ui.currentPage === 'wiki');
  }
  if (tabMap) {
    tabMap.style.display = isSectionEnabled(world, 'map') ? '' : 'none';
    tabMap.classList.toggle('active', state.ui.currentPage === 'map');
  }
}

function selectSection(section) {
  const world = state.worlds.find(w => w.id === state.ui.activeWorldId);
  if (!isSectionEnabled(world, section)) return;
  pushUrl(buildUrl(state.ui.activeWorldId, section));
  showPage(section);
}

// keep old name as alias (used in world create/delete handlers below)
function renderTimelineWorldTabs() { renderTopNavWorlds(); }

async function selectWorld(worldId) {
  state.ui.activeWorldId     = worldId;
  state.ui.wikiActiveWorldId = worldId;
  localStorage.setItem('activeWorldId', worldId);
  state.events  = [];
  state.undated = [];
  state.ui.activeTags    = new Set();
  state.ui.activeChars   = new Set();
  state.ui.activeTypes   = new Set();

  const world = state.worlds.find(w => w.id === worldId);
  // Always land on the first visible section tab for this world
  const section = firstEnabledSection(world) || 'timeline';

  pushUrl(buildUrl(worldId, section));

  // Switch the visible page (showPage is not called here to avoid double data loads)
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  const pageEl = document.getElementById('page-' + section);
  if (pageEl) pageEl.classList.add('active');
  state.ui.currentPage = section;
  renderTopNavWorlds();
  renderSectionTabs();
  applyAuthUI();

  if (section === 'timeline') {
    try {
      const [events, undated] = await Promise.all([
        api('GET', `/worlds/${worldId}/events`),
        api('GET', `/worlds/${worldId}/events/unpositioned`),
      ]);
      // Stale-check: another navigation may have changed the active world while we were loading
      if (state.ui.activeWorldId !== worldId) return;
      state.events  = events;
      state.undated = undated;
    } catch (e) { console.error('Failed to load world events', e); }
    if (state.ui.activeWorldId !== worldId) return;
    renderTimeline();
  } else if (section === 'wiki') {
    await initWikiPage();
  } else if (section === 'map') {
    await initMapPage();
  }
}

