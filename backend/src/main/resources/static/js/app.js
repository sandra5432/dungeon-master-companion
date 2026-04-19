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

  // Guests cannot access world pages — send them to Marktplatz
  if (!state.auth.loggedIn) {
    if (push) pushUrl('/');
    showPage('items');
    console.debug('[navigateToUrl] ← not logged in, fallback to items');
    return;
  }

  const world = worldId ? state.worlds.find(w => w.id === worldId) : null;
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
  if (state.auth.loggedIn) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return w?.guestCanEdit === true;
}

/** Returns true if the current user may delete content in the active world. */
function canDeleteActiveWorld() {
  if (state.auth.loggedIn) return true;
  const w = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return w?.guestCanDelete === true;
}

function applyAuthUI() {
  const { loggedIn, isAdmin, username } = state.auth;
  const activeWorld = state.worlds.find(w => w.id === state.ui.activeWorldId);
  const canEditWorld  = loggedIn || activeWorld?.guestCanEdit   === true;
  const canDeleteWorld = loggedIn || activeWorld?.guestCanDelete === true;

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

/* ══════════════════════════════════════
   WORLD SELECTOR
══════════════════════════════════════ */
function renderWorldSelector() {
  const el = document.getElementById('world-selector');
  if (!el) return;
  if (!state.worlds.length) {
    el.innerHTML = '<div style="font-style:italic;font-size:.78rem;color:var(--t3);text-align:center;padding:8px 0">Keine Welten vorhanden</div>';
    return;
  }
  el.innerHTML = state.worlds.map(w => {
    const isActive = w.id === state.ui.activeWorldId;
    const editBtns = state.auth.isAdmin
      ? `<span class="world-edit-btns">
           <button class="world-edit-btn" title="Bearbeiten" onclick="openEditWorldModal(${w.id},event)">✎</button>
           <button class="world-edit-btn del" title="Löschen" onclick="openDeleteWorldConfirm(${w.id},event)">✕</button>
         </span>`
      : '';
    return `<div class="world-btn${isActive ? ' active' : ''}" onclick="selectWorld(${w.id})">
      <span>${escHtml(w.name)}</span>${editBtns}
    </div>`;
  }).join('');
}

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

/* ══════════════════════════════════════
   TIMELINE
══════════════════════════════════════ */
function isVisible(ev) {
  if (state.ui.activeTags.size > 0 && !ev.tags.some(t => state.ui.activeTags.has(t))) return false;
  if (state.ui.activeChars.size > 0 && !(ev.characters || []).some(c => state.ui.activeChars.has(c))) return false;
  if (state.ui.activeTypes.size > 0 && !state.ui.activeTypes.has(ev.type)) return false;
  return true;
}

function updatePageTitle() {
  const world = state.worlds.find(w => w.id === state.ui.activeWorldId);
  const h1 = document.getElementById('page-title');
  if (h1) h1.textContent = world ? 'Aufzeichnung von ' + world.name : 'Aufzeichnung';
}

function renderTypeFilter() {
  const el = document.getElementById('type-filter-list');
  if (!el) return;
  const types = [
    { value: 'world', label: 'Weltereignis' },
    { value: 'local', label: 'Lokales Ereignis' },
  ];
  el.innerHTML = types.map(t => `
    <button class="tag-fb${state.ui.activeTypes.has(t.value) ? ' on' : ''}" onclick="toggleType('${t.value}')">
      <span style="display:flex;align-items:center;gap:6px"><div class="leg-dot ${t.value}"></div>${escHtml(t.label)}</span>
    </button>`).join('');
}

function toggleType(t)  { state.ui.activeTypes.has(t) ? state.ui.activeTypes.delete(t) : state.ui.activeTypes.add(t); renderTimeline(); }
function clearTypes()   { state.ui.activeTypes.clear(); renderTimeline(); }

function allTagCounts() {
  const m = {};
  state.events.forEach(e => (e.tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; }));
  return m;
}

function wSVG() { return '<svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2c.7 0 1.5.5 2.2 1.5H5.8C6.5 3.5 7.3 3 8 3zM3.5 7h9a5 5 0 010 2h-9a5 5 0 010-2zm.8 4h7.4C10.5 12.5 9.3 13 8 13s-2.5-.5-3.7-2z"/></svg>'; }
function lSVG() { return '<svg viewBox="0 0 16 16"><circle cx="8" cy="6.5" r="2.5"/><path d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" fill="none" stroke="white" stroke-width="1.5"/></svg>'; }
function groupSVG() { return '<svg viewBox="0 0 16 16"><circle cx="5" cy="8" r="3" fill="var(--blue2)" opacity=".8"/><circle cx="11" cy="8" r="3" fill="var(--gold)" opacity=".8"/><circle cx="8" cy="8" r="1.8" fill="#fff" opacity=".9"/></svg>'; }

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openImageLightbox(src, caption) {
  const lb = document.getElementById('img-lightbox');
  document.getElementById('lightbox-img').src = src;
  const cap = document.getElementById('lightbox-caption');
  cap.textContent = caption || '';
  cap.style.display = caption ? '' : 'none';
  lb.style.display = 'flex';
  document.addEventListener('keydown', _lightboxKeyHandler);
}

function closeImageLightbox() {
  document.getElementById('img-lightbox').style.display = 'none';
  document.getElementById('lightbox-img').src = '';
  document.removeEventListener('keydown', _lightboxKeyHandler);
}

function _lightboxKeyHandler(e) {
  if (e.key === 'Escape') closeImageLightbox();
}

// Renders plain text with [label](url) markdown links → clickable <a> tags.
// Only http/https URLs are allowed; other [text](url) patterns are left as escaped text.
function renderDesc(text) {
  const str = String(text || '');
  const linkRe = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = linkRe.exec(str)) !== null) {
    result += escHtml(str.slice(lastIndex, match.index));
    result += '<a href="' + escHtml(match[2].trim()) + '" target="_blank" rel="noopener noreferrer" class="desc-link">' + escHtml(match[1]) + '</a>';
    lastIndex = match.index + match[0].length;
  }
  result += escHtml(str.slice(lastIndex));
  return result;
}

function groupEvents(events) {
  const groups = [];
  let i = 0;
  while (i < events.length) {
    const ev = events[i];
    const dl = ev.dateLabel;
    if (dl) {
      let j = i + 1;
      while (j < events.length && events[j].dateLabel === dl) j++;
      if (j > i + 1) {
        groups.push({ type: 'group', dateLabel: dl, events: events.slice(i, j) });
        i = j;
        continue;
      }
    }
    groups.push({ type: 'single', event: ev });
    i++;
  }
  return groups;
}

function renderTimeline() {
  const tl  = document.getElementById('timeline');
  if (!tl) return;

  if (!state.ui.activeWorldId) {
    tl.innerHTML = '<div style="text-align:center;padding:40px;font-style:italic;color:var(--t3)">Keine Welt ausgewählt.</div>';
    renderTagList();
    renderCharList();
    renderUndated();
    return;
  }

  const isAdmin = state.auth.isAdmin;
  // Reversed: newest events on top
  const groups = groupEvents(state.events).reverse();
  let html = '';

  function lastEventId(grp) {
    return grp.type === 'single' ? grp.event.id : grp.events[grp.events.length - 1].id;
  }

  groups.forEach((grp, gi) => {
    const side = gi % 2 === 0 ? 'right' : 'left';
    // In reversed display the gap at gi sits above grp[gi].
    // Predecessor = last event of grp[gi] (the group directly below = older in timeline),
    // except for the very top gap which uses grp[0] (newest group = insert after newest).
    const predecessorId = lastEventId(groups[gi]);
    const predStr = predecessorId !== null ? predecessorId : 'null';

    if (canEditActiveWorld()) {
      html += `<div class="rope-gap" data-gap="${gi}" data-predecessor="${predStr}" onclick="onRopeClick(event,${predStr})"><div class="rope-gap-hint">✦ Hier eintragen</div></div>`;
    } else {
      html += `<div class="rope-gap" style="pointer-events:none"></div>`;
    }

    if (grp.type === 'single') {
      const ev = grp.event;
      const vis = isVisible(ev);
      const dateLbl = ev.displayDate || ev.dateLabel || '';
      const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'tl';
      const dateBadge = dateLbl ? `<span class="ev-date-badge">${escHtml(dateLbl)}</span>` : '';
      const dragAttrs = state.auth.loggedIn ? `draggable="true" ondragstart="onTLDragStart(event,${ev.id})" ondragend="onTLDragEnd(event)"` : '';
      html += `<div class="event-row ${side}${vis ? '' : ' hidden'}" data-id="${ev.id}">
        <div class="event-node ${escHtml(ev.type)}">${ev.type === 'world' ? wSVG() : lSVG()}</div>
        <div class="event-conn"></div>
        <div class="event-card${isAct ? ' active' : ''}" style="animation-delay:${gi * .05}s" ${dragAttrs} onclick="onTLCardClick(event,${ev.id})">
          <div class="ev-title">${dateBadge}${escHtml(ev.title)}</div>
          <div class="ev-tags">${(ev.tags || []).map(t => '<span class="ev-tag">' + escHtml(t) + '</span>').join('')}</div>
          ${ev.description ? '<div class="ev-desc-preview">' + escHtml(ev.description) + '</div>' : ''}
        </div>
      </div>`;
    } else {
      const anyVisible = grp.events.some(ev => isVisible(ev));
      const groupActive = grp.events.some(ev => state.ui.detailId === ev.id && state.ui.detailSource === 'tl');
      const firstType = grp.events[0].type;
      const itemsHtml = grp.events.map(ev => {
        const vis = isVisible(ev);
        const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'tl';
        const dragAttrs = state.auth.loggedIn ? `draggable="true" ondragstart="onTLDragStart(event,${ev.id})" ondragend="onTLDragEnd(event)"` : '';
        return `<div class="group-ev-item${vis ? '' : ' hidden'}${isAct ? ' active' : ''}" ${dragAttrs} onclick="onTLCardClick(event,${ev.id})">
          <span class="group-ev-dot ${escHtml(ev.type)}"></span>
          <div class="group-ev-content">
            <div class="group-ev-title">${escHtml(ev.title)}</div>
            <div class="ev-tags">${(ev.tags || []).map(t => '<span class="ev-tag">' + escHtml(t) + '</span>').join('')}</div>
            ${ev.description ? '<div class="ev-desc-preview">' + escHtml(ev.description) + '</div>' : ''}
          </div>
        </div>`;
      }).join('');
      html += `<div class="event-row ${side}${anyVisible ? '' : ' hidden'}">
        <div class="event-node ${escHtml(firstType)}">${firstType === 'world' ? wSVG() : lSVG()}</div>
        <div class="event-conn"></div>
        <div class="event-card event-group-card${groupActive ? ' active' : ''}" style="animation-delay:${gi * .05}s">
          <div class="event-group-date">${escHtml(grp.dateLabel)}</div>
          <div class="group-ev-list">${itemsHtml}</div>
        </div>
      </div>`;
    }
  });

  // Final rope gap (bottom = oldest slot, predecessor null = insert before everything)
  if (canEditActiveWorld()) {
    html += `<div class="rope-gap" data-gap="${groups.length}" data-predecessor="null" onclick="onRopeClick(event,null)"><div class="rope-gap-hint">✦ Hier eintragen</div></div>`;
  } else {
    html += `<div class="rope-gap" style="pointer-events:none"></div>`;
  }

  tl.innerHTML = html;
  tl.classList.toggle('compact', state.ui.compact);

  // Wire drag-over for rope gaps (any logged-in user)
  if (state.auth.loggedIn) {
    tl.querySelectorAll('.rope-gap').forEach(gap => {
      gap.addEventListener('dragover', e => {
        if (state.ui.dragId === null) return;
        e.preventDefault();
        gap.classList.add('drop-over');
      });
      gap.addEventListener('dragleave', () => gap.classList.remove('drop-over'));
      gap.addEventListener('drop', e => {
        e.preventDefault();
        gap.classList.remove('drop-over');
        if (state.ui.dragId === null) return;
        const predStr = gap.dataset.predecessor;
        const afterEventId = (predStr === 'null' || predStr === undefined) ? null : parseInt(predStr, 10);
        placeEventOnTimeline(state.ui.dragId, afterEventId);
        state.ui.dragId = null;
      });
    });
  }

  renderTagList();
  renderTypeFilter();
  renderCharList();
  updatePageTitle();
  renderUndated();

  // Refresh detail panel if open
  if (state.ui.detailId !== null) {
    const src  = state.ui.detailSource;
    const id   = state.ui.detailId;
    const list = src === 'undated' ? state.undated : state.events;
    const still = list.find(x => x.id === id);
    if (still) populateDetail(id, src);
    else closeDetail();
  }
}

/* ══════════════════════════════════════
   PLACE EVENT (DRAG & DROP)
══════════════════════════════════════ */
async function placeEventOnTimeline(eventId, afterEventId) {
  if (!state.ui.activeWorldId) return;
  try {
    await api('PATCH', `/worlds/${state.ui.activeWorldId}/events/${eventId}/assign-position`, { afterEventId });
    const [events, undated] = await Promise.all([
      api('GET', `/worlds/${state.ui.activeWorldId}/events`),
      api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
    ]);
    state.events  = events;
    state.undated = undated;
    renderTimeline();
  } catch (e) {
    console.error('Failed to place event', e);
    alert('Fehler beim Einordnen: ' + e.message);
  }
}

async function unplaceEvent(eventId) {
  if (!state.ui.activeWorldId) return;
  try {
    await api('DELETE', `/worlds/${state.ui.activeWorldId}/events/${eventId}/position`);
    const [events, undated] = await Promise.all([
      api('GET', `/worlds/${state.ui.activeWorldId}/events`),
      api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
    ]);
    state.events  = events;
    state.undated = undated;
    renderTimeline();
  } catch (e) {
    console.error('Failed to unplace event', e);
    alert('Fehler beim Entfernen: ' + e.message);
  }
}

function wireUndatedDropZone() {
  const sidebar = document.querySelector('.sidebar-right');
  if (!sidebar) return;
  sidebar.addEventListener('dragover', e => {
    if (state.ui.dragSource !== 'tl') return;
    e.preventDefault();
    sidebar.classList.add('unplace-over');
  });
  sidebar.addEventListener('dragleave', e => {
    if (!sidebar.contains(e.relatedTarget)) sidebar.classList.remove('unplace-over');
  });
  sidebar.addEventListener('drop', e => {
    e.preventDefault();
    sidebar.classList.remove('unplace-over', 'unplace-target');
    if (state.ui.dragSource !== 'tl' || state.ui.dragId === null) return;
    const id = state.ui.dragId;
    state.ui.dragId = null;
    state.ui.dragSource = null;
    unplaceEvent(id);
  });
}

/* ══════════════════════════════════════
   FILTERS
══════════════════════════════════════ */
function renderTagList() {
  const togBtn = document.getElementById('tags-toggle');
  const listEl = document.getElementById('tag-list');
  if (togBtn) togBtn.textContent = state.ui.tagsCollapsed ? '▲' : '▾';
  if (!listEl) return;
  listEl.style.display = state.ui.tagsCollapsed ? 'none' : '';
  if (!state.ui.tagsCollapsed) {
    const counts = allTagCounts();
    listEl.innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `<button class="tag-fb${state.ui.activeTags.has(t) ? ' on' : ''}" onclick="toggleTag('${escHtml(t)}')">${escHtml(t)}<span class="tag-count">${c}</span></button>`)
      .join('');
  }
}

function renderCharList() {
  const togBtn = document.getElementById('chars-toggle');
  const listEl = document.getElementById('char-list');
  if (togBtn) togBtn.textContent = state.ui.charsCollapsed ? '▲' : '▾';
  if (!listEl) return;
  listEl.style.display = state.ui.charsCollapsed ? 'none' : '';
  if (!state.ui.charsCollapsed) {
    const counts = new Map();
    state.events.forEach(ev => (ev.characters || []).forEach(c => counts.set(c, (counts.get(c) || 0) + 1)));
    listEl.innerHTML = [...counts.entries()].sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<button class="tag-fb${state.ui.activeChars.has(c) ? ' on' : ''}" onclick="toggleChar('${escHtml(c)}')">${escHtml(c)}<span class="tag-count">${n}</span></button>`)
      .join('');
  }
}

function toggleTag(t)           { state.ui.activeTags.has(t) ? state.ui.activeTags.delete(t) : state.ui.activeTags.add(t); renderTimeline(); }
function clearTags()            { state.ui.activeTags.clear(); renderTimeline(); }
function toggleTagsCollapsed()  { state.ui.tagsCollapsed = !state.ui.tagsCollapsed; renderTagList(); }
function toggleChar(c)          { state.ui.activeChars.has(c) ? state.ui.activeChars.delete(c) : state.ui.activeChars.add(c); renderTimeline(); }
function clearChars()           { state.ui.activeChars.clear(); renderTimeline(); }
function toggleCharsCollapsed() { state.ui.charsCollapsed = !state.ui.charsCollapsed; renderCharList(); }

function toggleCompact() {
  state.ui.compact = !state.ui.compact;
  document.getElementById('tog-track').classList.toggle('on', state.ui.compact);
  document.getElementById('timeline').classList.toggle('compact', state.ui.compact);
}

/* ══════════════════════════════════════
   UNDATED PANEL
══════════════════════════════════════ */
function renderUndated() {
  const el = document.getElementById('undated-list');
  if (!el) return;
  if (!state.undated.length) { el.innerHTML = '<div class="undated-empty">Keine Einträge</div>'; return; }
  el.innerHTML = state.undated.map(ev => {
    const isAct   = state.ui.detailId === ev.id && state.ui.detailSource === 'undated';
    const draggable = state.auth.loggedIn ? 'draggable="true"' : '';
    return `<div class="undated-card${isAct ? ' active' : ''}"
              ${draggable}
              data-uid="${ev.id}"
              onmousedown="onUndatedMouseDown(event)"
              ondragstart="onUndatedDragStart(event,${ev.id})"
              ondragend="onUndatedDragEnd(event)"
              onclick="onUndatedClick(event,${ev.id})">
      <div class="undated-ttl">${escHtml(ev.title)}</div>
      <div class="undated-tags">${(ev.tags || []).map(t => '<span class="undated-tag">' + escHtml(t) + '</span>').join('')}</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   DRAG & DROP
══════════════════════════════════════ */
function onUndatedMouseDown(e) {
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
  didDrag    = false;
}

function onUndatedDragStart(e, id) {
  if (!state.auth.loggedIn) { e.preventDefault(); return; }
  didDrag = true;
  state.ui.dragId = id;
  state.ui.dragSource = 'undated';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  setTimeout(() => {
    const card = document.querySelector('.undated-card[data-uid="' + id + '"]');
    if (card) card.classList.add('dragging');
  }, 0);
}

function onUndatedDragEnd(e) {
  state.ui.dragId = null;
  state.ui.dragSource = null;
  document.querySelectorAll('.undated-card.dragging').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.rope-gap.drop-over').forEach(g => g.classList.remove('drop-over'));
}

function onTLDragStart(e, id) {
  if (!state.auth.loggedIn) { e.preventDefault(); return; }
  state.ui.dragId = id;
  state.ui.dragSource = 'tl';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  const target = e.target.closest('.event-card, .group-ev-item');
  if (target) setTimeout(() => target.classList.add('tl-dragging'), 0);
  // highlight sidebar as drop zone
  setTimeout(() => {
    const sidebar = document.querySelector('.sidebar-right');
    if (sidebar) sidebar.classList.add('unplace-target');
  }, 0);
}

function onTLDragEnd(e) {
  state.ui.dragId = null;
  state.ui.dragSource = null;
  document.querySelectorAll('.tl-dragging').forEach(c => c.classList.remove('tl-dragging'));
  document.querySelectorAll('.rope-gap.drop-over').forEach(g => g.classList.remove('drop-over'));
  const sidebar = document.querySelector('.sidebar-right');
  if (sidebar) sidebar.classList.remove('unplace-target', 'unplace-over');
}

function onUndatedClick(e, id) {
  const dx = Math.abs(e.clientX - mouseDownX);
  const dy = Math.abs(e.clientY - mouseDownY);
  if (didDrag || dx > 6 || dy > 6) return;
  e.stopPropagation();
  if (state.ui.detailId === id && state.ui.detailSource === 'undated') {
    closeDetail();
    pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
    return;
  }
  populateDetail(id, 'undated');
  openDetailPanel();
  pushUrl(buildUrl(state.ui.activeWorldId, 'timeline', id));
}

/* ══════════════════════════════════════
   ROPE CLICK
══════════════════════════════════════ */
function onRopeClick(e, afterEventId) {
  if (state.ui.dragId !== null) return;
  if (!canEditActiveWorld()) return;
  // afterEventId is the predecessor event id (or null for top)
  openTLModal(afterEventId === 'null' ? null : afterEventId);
}

function openUndatedAdd() {
  undatedMode = true;
  openTLModal(null);
}

/* ══════════════════════════════════════
   DETAIL PANEL
══════════════════════════════════════ */
function onTLCardClick(e, id) {
  e.stopPropagation();
  if (state.ui.detailId === id && state.ui.detailSource === 'tl') {
    closeDetail();
    pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
    return;
  }
  populateDetail(id, 'tl');
  openDetailPanel();
  pushUrl(buildUrl(state.ui.activeWorldId, 'timeline', id));
}

function populateDetail(id, source) {
  const ev = (source === 'undated' ? state.undated : state.events).find(x => x.id === id);
  if (!ev) return;
  state.ui.detailId     = id;
  state.ui.detailSource = source;
  const crName  = ev.creatorUsername  || 'Anonym';
  const crColor = ev.creatorColorHex  || '#888888';
  const dateLbl = source === 'undated' ? 'Datum unbekannt' : (ev.displayDate || '');
  document.getElementById('dp-title').innerHTML = linkifyWikiTitles(escHtml(ev.title));
  document.getElementById('dp-date').textContent  = dateLbl;
  const descEl = document.getElementById('dp-desc');
  if (ev.description && ev.description.trim()) {
    descEl.innerHTML = linkifyWikiTitles(renderDesc(ev.description));
    descEl.className = 'detail-desc';
  } else {
    descEl.textContent = 'Noch keine Beschreibung eingetragen.';
    descEl.className   = 'detail-desc empty';
  }
  document.getElementById('dp-tags').innerHTML = (ev.tags || []).map(t => '<span class="detail-tag">' + escHtml(t) + '</span>').join('');
  const charsEl = document.getElementById('dp-chars');
  if (charsEl) {
    if (ev.characters && ev.characters.length > 0) {
      charsEl.innerHTML = '<div style="font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t2);margin-bottom:5px">Charaktere</div>' +
        '<div class="detail-tags" style="margin-bottom:0">' +
        ev.characters.map(c => '<span class="detail-tag" style="color:var(--gold2);border-color:rgba(200,168,75,.38);background:rgba(200,168,75,.10)">' + escHtml(c) + '</span>').join('') +
        '</div>';
      charsEl.style.display = '';
    } else {
      charsEl.style.display = 'none';
    }
  }
  document.getElementById('dp-meta').innerHTML = `
    <div class="detail-type"><div class="detail-type-dot ${escHtml(ev.type)}"></div>${ev.type === 'world' ? 'Weltereignis' : 'Lokales Ereignis'}</div>
    <div class="detail-creator"><span class="creator-dot" style="background:${escHtml(crColor)};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px"></span>${escHtml(crName)}</div>`;

  const dpEdit    = document.getElementById('dp-edit');
  const dpDel     = document.getElementById('dp-del');
  const dpActions = document.getElementById('dp-actions');
  const evWorld   = state.worlds.find(w => w.id === ev.worldId);
  const canEdit   = state.auth.loggedIn || evWorld?.guestCanEdit   === true;
  const canDelete = state.auth.loggedIn || evWorld?.guestCanDelete === true;
  if (dpActions) dpActions.style.display = (canEdit || canDelete) ? '' : 'none';
  if (dpEdit) dpEdit.style.display = canEdit ? '' : 'none';
  if (dpDel)  dpDel.style.display  = canDelete ? '' : 'none';
  if (dpEdit) dpEdit.onclick = () => { closeDetail(); openEditModal(id, source); };
  if (dpDel)  dpDel.onclick  = () => { closeDetail(); openDeleteConfirm(id, source); };

  // Highlight card
  document.querySelectorAll('.event-card.active, .undated-card.active').forEach(c => c.classList.remove('active'));
  const row = document.querySelector('.event-row[data-id="' + id + '"]');
  if (row) row.querySelector('.event-card')?.classList.add('active');
}

function openDetailPanel() {
  document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.querySelectorAll('.event-card.active, .undated-card.active').forEach(c => c.classList.remove('active'));
  state.ui.detailId     = null;
  state.ui.detailSource = null;
}

document.addEventListener('click', e => {
  const panel = document.getElementById('detail-panel');
  if (!panel || !panel.classList.contains('open')) return;
  if (panel.contains(e.target)) return;
  if (e.target.closest('.event-card') || e.target.closest('.undated-card')) return;
  closeDetail();
  pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
});

/* ══════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════ */
function showForms(tl, it, del, drop, world, login) {
  document.getElementById('f-tl').style.display    = tl    ? 'grid'  : 'none';
  document.getElementById('f-it').style.display    = it    ? 'grid'  : 'none';
  document.getElementById('f-del').style.display   = del   ? 'block' : 'none';
  document.getElementById('f-drop').style.display  = drop  ? 'block' : 'none';
  document.getElementById('f-world').style.display = world ? 'block' : 'none';
  document.getElementById('f-login').style.display = login ? 'block' : 'none';
}

function setSaveBtn(label, danger) {
  const b = document.getElementById('m-save');
  b.textContent = label;
  b.className   = danger ? 'btn btn-danger' : 'btn btn-primary';
}

function openModal()  { document.getElementById('modal').classList.add('open'); }
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editId = null; editSource = null; editItemId = null; editWorldId = null;
  dropEventId = null; dropAfterEventId = null; undatedMode = false;
  const errEl = document.getElementById('fl-err');
  if (errEl) errEl.style.display = 'none';
}
document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
});

/* ══════════════════════════════════════
   OPEN MODALS
══════════════════════════════════════ */
function setModalWorldInfo() {
  const world = state.worlds.find(w => w.id === state.ui.activeWorldId);
  const nameEl = document.getElementById('m-world-name');
  if (nameEl) nameEl.textContent = world ? world.name : '—';
}

function openTLModal(afterEventId) {
  editId = null; editSource = 'tl';
  dropAfterEventId = afterEventId !== undefined ? afterEventId : null;
  document.getElementById('m-title').textContent = 'Ereignis eintragen';
  showForms(true, false, false, false, false, false);
  setSaveBtn('Eintragen', false);
  ['f-ti','f-tg','f-chars'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-desc').value = '';
  document.getElementById('f-ty').value   = 'world';
  document.getElementById('f-da').value   = '';
  setModalWorldInfo();
  openModal();
}

function openAddModal() {
  if (state.ui.currentPage === 'items') {
    editId = null; editSource = 'item'; editItemId = null;
    document.getElementById('m-title').textContent = 'Gegenstand hinzufügen';
    showForms(false, true, false, false, false, false);
    setSaveBtn('Hinzufügen', false);
    ['fi-n','fi-u','fi-tags'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fi-p').value = '';
    openModal();
  } else {
    openTLModal(null);
  }
}

function openEditModal(id, source) {
  editId = id; editSource = source;
  const ev = (source === 'undated' ? state.undated : state.events).find(x => x.id === id);
  if (!ev) return;
  document.getElementById('m-title').textContent = 'Ereignis bearbeiten';
  showForms(true, false, false, false, false, false);
  setSaveBtn('Speichern', false);
  document.getElementById('f-ti').value    = ev.title || '';
  document.getElementById('f-da').value    = source === 'undated' ? '' : (ev.displayDate || ev.dateLabel || '');
  document.getElementById('f-ty').value    = ev.type || 'world';
  document.getElementById('f-tg').value    = (ev.tags || []).join(', ');
  document.getElementById('f-chars').value = (ev.characters || []).join(', ');
  document.getElementById('f-desc').value  = ev.description || '';
  setModalWorldInfo();
  openModal();
}

function openEditItem(itemId) {
  const it = state.items.find(x => x.id === itemId);
  if (!it) return;
  editSource = 'item'; editItemId = itemId;
  document.getElementById('m-title').textContent = 'Gegenstand bearbeiten';
  showForms(false, true, false, false, false, false);
  setSaveBtn('Speichern', false);
  document.getElementById('fi-n').value    = it.name || '';
  document.getElementById('fi-p').value    = it.price ?? '';
  document.getElementById('fi-tags').value = (it.tags || []).join(', ');
  document.getElementById('fi-u').value    = it.url || '';
  openModal();
}

function openDeleteConfirm(id, source) {
  editId = id; editSource = source + '-del';
  const ev = (source === 'undated' ? state.undated : state.events).find(x => x.id === id);
  if (!ev) return;
  document.getElementById('m-title').textContent = 'Eintrag löschen';
  document.getElementById('del-txt').innerHTML =
    'Soll <span class="del-confirm-name">„' + escHtml(ev.title) + '"</span> wirklich aus der Chronik entfernt werden?';
  showForms(false, false, true, false, false, false);
  setSaveBtn('Endgültig löschen', true);
  openModal();
}

function openDeleteItem(itemId) {
  const it = state.items.find(x => x.id === itemId);
  if (!it) return;
  editSource = 'item-del'; editItemId = itemId;
  document.getElementById('m-title').textContent = 'Gegenstand löschen';
  document.getElementById('del-txt').innerHTML =
    'Soll <span class="del-confirm-name">„' + escHtml(it.name) + '"</span> wirklich entfernt werden?';
  showForms(false, false, true, false, false, false);
  setSaveBtn('Endgültig löschen', true);
  openModal();
}

/**
 * Attaches change listeners to the 6 world permission checkboxes so that
 * enforceWorldPermissionConstraints() runs on every toggle.
 * Safe to call multiple times — replaces existing listeners via cloneNode trick.
 */
function attachWorldPermissionListeners() {
  ['fw-guest-read','fw-guest-edit','fw-guest-delete','fw-user-read','fw-user-edit','fw-user-delete'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', enforceWorldPermissionConstraints);
  });
}

/**
 * Enforces permission checkbox constraints:
 * - edit or delete → read must be enabled (within-tier implication)
 * - guest permission → corresponding user permission must also be enabled (guest ≤ user)
 */
function enforceWorldPermissionConstraints() {
  const guestRead   = document.getElementById('fw-guest-read');
  const guestEdit   = document.getElementById('fw-guest-edit');
  const guestDelete = document.getElementById('fw-guest-delete');
  const userRead    = document.getElementById('fw-user-read');
  const userEdit    = document.getElementById('fw-user-edit');
  const userDelete  = document.getElementById('fw-user-delete');
  if (!guestRead) return;

  // edit or delete implies read
  if (guestEdit.checked || guestDelete.checked) guestRead.checked = true;
  if (userEdit.checked  || userDelete.checked)  userRead.checked  = true;

  // guest permissions cannot exceed user permissions
  if (guestRead.checked   && !userRead.checked)   userRead.checked   = true;
  if (guestEdit.checked   && !userEdit.checked)   userEdit.checked   = true;
  if (guestDelete.checked && !userDelete.checked) userDelete.checked = true;
}

function openAddWorldModal() {
  editWorldId = null; editSource = 'world';
  document.getElementById('m-title').textContent = 'Welt hinzufügen';
  showForms(false, false, false, false, true, false);
  setSaveBtn('Erstellen', false);
  document.getElementById('fw-n').value     = '';
  document.getElementById('fw-d').value     = '';
  document.getElementById('fw-seq').value   = '';
  document.getElementById('fw-miles').value = 5;
  document.getElementById('fw-chronicle').checked = true;
  document.getElementById('fw-wiki').checked      = true;
  document.getElementById('fw-map').checked       = true;
  document.getElementById('fw-guest-read').checked   = false;
  document.getElementById('fw-guest-edit').checked   = false;
  document.getElementById('fw-guest-delete').checked = false;
  document.getElementById('fw-user-read').checked    = true;
  document.getElementById('fw-user-edit').checked    = true;
  document.getElementById('fw-user-delete').checked  = true;
  attachWorldPermissionListeners();
  openModal();
}

function openEditWorldModal(worldId, e) {
  if (e) e.stopPropagation();
  const w = state.worlds.find(x => x.id === worldId);
  if (!w) return;
  editWorldId = worldId; editSource = 'world';
  document.getElementById('m-title').textContent = 'Welt bearbeiten';
  showForms(false, false, false, false, true, false);
  setSaveBtn('Speichern', false);
  document.getElementById('fw-n').value     = w.name || '';
  document.getElementById('fw-d').value     = w.description || '';
  document.getElementById('fw-seq').value   = w.sortOrder ? w.sortOrder : '';
  document.getElementById('fw-miles').value = w.milesPerCell ?? 5;
  document.getElementById('fw-chronicle').checked = w.chronicleEnabled !== false;
  document.getElementById('fw-wiki').checked      = w.wikiEnabled      !== false;
  document.getElementById('fw-map').checked       = w.mapEnabled        !== false;
  document.getElementById('fw-guest-read').checked   = w.guestCanRead   === true;
  document.getElementById('fw-guest-edit').checked   = w.guestCanEdit   === true;
  document.getElementById('fw-guest-delete').checked = w.guestCanDelete === true;
  document.getElementById('fw-user-read').checked    = w.userCanRead    !== false;
  document.getElementById('fw-user-edit').checked    = w.userCanEdit    !== false;
  document.getElementById('fw-user-delete').checked  = w.userCanDelete  !== false;
  attachWorldPermissionListeners();
  openModal();
}

function openDeleteWorldConfirm(worldId, e) {
  if (e) e.stopPropagation();
  const w = state.worlds.find(x => x.id === worldId);
  if (!w) return;
  editWorldId = worldId; editSource = 'world-del';
  document.getElementById('m-title').textContent = 'Welt löschen';
  document.getElementById('del-txt').innerHTML =
    'Soll die Welt <span class="del-confirm-name">„' + escHtml(w.name) + '"</span> und alle darin enthaltenen Ereignisse und Wiki-Einträge wirklich entfernt werden?';
  showForms(false, false, true, false, false, false);
  setSaveBtn('Endgültig löschen', true);
  openModal();
}

/* ══════════════════════════════════════
   LOGIN MODAL
══════════════════════════════════════ */
function showLoginModal() {
  editSource = 'login';
  document.getElementById('m-title').textContent = 'Anmelden';
  showForms(false, false, false, false, false, true);
  setSaveBtn('Anmelden', false);
  document.getElementById('fl-u').value = '';
  document.getElementById('fl-p').value = '';
  const errEl = document.getElementById('fl-err');
  if (errEl) errEl.style.display = 'none';
  openModal();
}

function hideLoginModal() {
  closeModal();
}

async function doLogin(username, password) {
  try {
    const result = await api('POST', '/login', { username, password });
    state.auth = {
      loggedIn: true,
      isAdmin: result.admin || false,
      userId: result.userId || null,
      username: result.username || null,
      colorHex: result.colorHex || null,
      mustChangePassword: result.mustChangePassword || false,
    };
    if (result.mustChangePassword) {
      hideLoginModal();
      applyAuthUI();
      showPasswordChangeOverlay();
      return;
    }
    location.href = '/'; // always land on Marktplatz after login
  } catch (e) {
    const errEl = document.getElementById('fl-err');
    if (errEl) { errEl.textContent = 'Anmeldung fehlgeschlagen: ' + e.message; errEl.style.display = 'block'; }
    throw e;
  }
}

async function doLogout() {
  try {
    await api('POST', '/logout');
  } catch (e) {
    // ignore logout errors
  }
  state.auth = { loggedIn: false, isAdmin: false, userId: null, username: null, colorHex: null, mustChangePassword: false };
  state.events = [];
  state.undated = [];
  state.ui.activeWorldId = null;
  state.ui.wikiActiveWorldId = null;
  state.wikiTitles = [];
  state.wikiAllEntries = [];
  state.wikiFullGraph = null;
  const articlePanel = document.getElementById('wiki-article-panel');
  if (articlePanel) {
    articlePanel.style.display = 'none';
    const content = document.getElementById('wiki-article-content');
    if (content) content.innerHTML = '';
  }
  const editorPanel = document.getElementById('wiki-editor-panel');
  if (editorPanel) editorPanel.style.display = 'none';
  // Reload worlds — server returns only those the guest may read
  try {
    state.worlds = await api('GET', '/worlds') || [];
  } catch (e) {
    state.worlds = [];
  }
  applyAuthUI();
  renderTopNavWorlds();
  pushUrl('/');
  renderItems();
  showPage('items');
}

/* ══════════════════════════════════════
   SAVE ENTRY
══════════════════════════════════════ */
async function saveEntry() {
  const saveBtn = document.getElementById('m-save');
  saveBtn.disabled = true;
  try {
    await _saveEntry();
  } finally {
    saveBtn.disabled = false;
  }
}

async function _saveEntry() {
  // LOGIN
  if (editSource === 'login') {
    const username = document.getElementById('fl-u').value.trim();
    const password = document.getElementById('fl-p').value;
    if (!username || !password) { alert('Benutzername und Passwort sind Pflicht'); return; }
    await doLogin(username, password);
    return;
  }

  // WORLD create/edit
  if (editSource === 'world') {
    const name            = document.getElementById('fw-n').value.trim();
    const desc            = document.getElementById('fw-d').value.trim();
    const seqRaw          = document.getElementById('fw-seq').value.trim();
    const seqVal          = parseInt(seqRaw, 10);
    const sortOrder       = seqRaw !== '' && seqVal > 0 ? seqVal : 0;
    const miles           = Math.max(1, parseInt(document.getElementById('fw-miles').value || '5', 10));
    const chronicleEnabled = document.getElementById('fw-chronicle').checked;
    const wikiEnabled      = document.getElementById('fw-wiki').checked;
    const mapEnabled       = document.getElementById('fw-map').checked;
    const guestCanRead     = document.getElementById('fw-guest-read').checked;
    const guestCanEdit     = document.getElementById('fw-guest-edit').checked;
    const guestCanDelete   = document.getElementById('fw-guest-delete').checked;
    const userCanRead      = document.getElementById('fw-user-read').checked;
    const userCanEdit      = document.getElementById('fw-user-edit').checked;
    const userCanDelete    = document.getElementById('fw-user-delete').checked;
    if (!name) { alert('Weltname ist Pflicht'); return; }
    const permissions = { guestCanRead, guestCanEdit, guestCanDelete, userCanRead, userCanEdit, userCanDelete };
    try {
      if (editWorldId != null) {
        const updated = await api('PUT', '/worlds/' + editWorldId, { name, description: desc, sortOrder, milesPerCell: miles, chronicleEnabled, wikiEnabled, mapEnabled, ...permissions });
        const idx = state.worlds.findIndex(w => w.id === editWorldId);
        if (idx > -1) state.worlds[idx] = updated;
        // If the current page is now disabled for the active world, navigate away
        if (state.ui.activeWorldId === editWorldId) {
          const section = firstEnabledSection(updated);
          if (section && !isSectionEnabled(updated, state.ui.currentPage)) {
            await navigateToUrl({ page: section, worldId: editWorldId, subId: null }, true);
          }
          renderSectionTabs();
        }
      } else {
        const created = await api('POST', '/worlds', { name, description: desc, sortOrder, milesPerCell: miles, chronicleEnabled, wikiEnabled, mapEnabled, ...permissions });
        state.worlds.push(created);
        if (!state.ui.activeWorldId) await selectWorld(created.id);
      }
      state.worlds.sort((a, b) => {
        const seqA = a.sortOrder || 0;
        const seqB = b.sortOrder || 0;
        const pa = seqA === 0 ? Infinity : seqA;
        const pb = seqB === 0 ? Infinity : seqB;
        if (pa !== pb) return pa - pb;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      closeModal();
      renderTimelineWorldTabs();
      renderConfigWorlds();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // WORLD delete
  if (editSource === 'world-del') {
    try {
      await api('DELETE', '/worlds/' + editWorldId);
      state.worlds = state.worlds.filter(w => w.id !== editWorldId);
      if (state.ui.activeWorldId === editWorldId) {
        state.ui.activeWorldId = state.worlds[0]?.id ?? null;
        state.events  = [];
        state.undated = [];
        if (state.ui.activeWorldId) await selectWorld(state.ui.activeWorldId);
      }
      closeModal();
      renderTimelineWorldTabs();
      renderConfigWorlds();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // ITEM delete
  if (editSource === 'item-del') {
    try {
      await api('DELETE', '/items/' + editItemId);
      state.items = state.items.filter(x => x.id !== editItemId);
      closeModal();
      renderItems();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // EVENT delete
  if (editSource === 'tl-del') {
    try {
      await api('DELETE', `/worlds/${state.ui.activeWorldId}/events/${editId}`);
      state.events = state.events.filter(x => x.id !== editId);
      closeModal();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }
  if (editSource === 'undated-del') {
    try {
      await api('DELETE', `/worlds/${state.ui.activeWorldId}/events/${editId}`);
      state.undated = state.undated.filter(x => x.id !== editId);
      closeModal();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // ITEM create/edit
  if (editSource === 'item') {
    const name    = document.getElementById('fi-n').value.trim();
    if (!name) { alert('Name ist Pflicht'); return; }
    const price   = parseFloat(document.getElementById('fi-p').value) || 0;
    const url     = document.getElementById('fi-u').value.trim();
    const tagsRaw = document.getElementById('fi-tags').value.trim();
    const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      if (editItemId != null) {
        const updated = await api('PUT', '/items/' + editItemId, { name, price, url, tags });
        const idx = state.items.findIndex(x => x.id === editItemId);
        if (idx > -1) state.items[idx] = updated;
      } else {
        const created = await api('POST', '/items', { name, price, url, tags });
        state.items.push(created);
      }
      closeModal();
      renderItems();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // TIMELINE event create/edit
  const title      = document.getElementById('f-ti').value.trim();
  const dateStr    = document.getElementById('f-da').value.trim();
  const type       = document.getElementById('f-ty').value;
  const tagsRaw    = document.getElementById('f-tg').value.trim();
  const charsRaw   = document.getElementById('f-chars').value.trim();
  const desc       = document.getElementById('f-desc').value.trim();
  if (!title) { alert('Titel ist Pflicht'); return; }
  const tags       = tagsRaw  ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)  : [];
  const characters = charsRaw ? charsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = { title, type, tags, characters, description: desc, dateLabel: dateStr || null };

  try {
    if (editId != null) {
      // Edit existing event
      const updated = await api('PUT', `/worlds/${state.ui.activeWorldId}/events/${editId}`, payload);
      if (editSource === 'undated') {
        const idx = state.undated.findIndex(x => x.id === editId);
        if (idx > -1) {
          if (dateStr) {
            // Moving from undated to timeline — need to assign position
            state.undated.splice(idx, 1);
            // Assign at end by default
            await api('PATCH', `/worlds/${state.ui.activeWorldId}/events/${editId}/assign-position`, { afterEventId: state.events.length > 0 ? state.events[state.events.length - 1].id : null });
          } else {
            state.undated[idx] = updated;
          }
        }
      } else {
        const idx = state.events.findIndex(x => x.id === editId);
        if (idx > -1) state.events[idx] = updated;
      }
    } else {
      // Create new event — always goes to unpositioned first
      const created = await api('POST', `/worlds/${state.ui.activeWorldId}/events`, payload);
      if (!undatedMode && dropAfterEventId !== undefined) {
        // Try to place it after the clicked gap predecessor
        try {
          await api('PATCH', `/worlds/${state.ui.activeWorldId}/events/${created.id}/assign-position`, { afterEventId: dropAfterEventId });
        } catch (pe) {
          console.warn('Could not auto-place event, leaving in unpositioned', pe);
          state.undated.push(created);
          closeModal();
          renderTimeline();
          return;
        }
      } else {
        state.undated.push(created);
        closeModal();
        renderTimeline();
        return;
      }
    }
    // Refresh from server to get correct state
    const [events, undated] = await Promise.all([
      api('GET', `/worlds/${state.ui.activeWorldId}/events`),
      api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
    ]);
    state.events  = events;
    state.undated = undated;
    closeModal();
    renderTimeline();
  } catch (e) { alert('Fehler: ' + e.message); }
}

/* ══════════════════════════════════════
   ITEM TAG MULTISELECT
══════════════════════════════════════ */
let itemTagCounts = []; // [{tagName, count}, ...]

function renderItemTagFilter() {
  const dd = document.getElementById('itf-dropdown');
  if (!dd) return;
  if (itemTagCounts.length === 0) {
    dd.innerHTML = '<div style="padding:6px 10px;font-size:.75rem;color:var(--t3)">Keine Tags vorhanden</div>';
    return;
  }
  dd.innerHTML = itemTagCounts.map(({ tagName, count }) => `
    <label class="rf-option">
      <input type="checkbox" value="${escHtml(tagName)}"
             ${state.ui.activeItemTags.has(tagName) ? 'checked' : ''}
             onchange="onItemTagChange()">
      <span class="ev-tag" style="pointer-events:none">${escHtml(tagName)}</span>
      <span style="margin-left:auto;font-size:.7rem;color:var(--t3)">${count}</span>
    </label>`).join('') +
    '<div class="rf-sep"></div>' +
    '<button class="rf-clear" onclick="clearItemTags()">Auswahl aufheben</button>';
}

function toggleItemTagDd(e) {
  e.stopPropagation();
  const dd = document.getElementById('itf-dropdown');
  const tr = document.getElementById('itf-trigger');
  const open = dd.classList.toggle('open');
  tr.classList.toggle('open', open);
}

function onItemTagChange() {
  const checked = [...document.querySelectorAll('#itf-dropdown input:checked')].map(cb => cb.value);
  state.ui.activeItemTags = new Set(checked);
  state.ui.itemPage = 0;
  updateItemTagLabel();
  renderItems();
}

function updateItemTagLabel() {
  const lbl = document.getElementById('itf-label');
  if (!lbl) return;
  if (state.ui.activeItemTags.size === 0) {
    lbl.innerHTML = '<span class="placeholder">Alle Tags</span>';
  } else {
    lbl.innerHTML = [...state.ui.activeItemTags]
      .map(t => `<span class="ev-tag" style="font-size:.5rem;padding:2px 7px">${escHtml(t)}</span>`)
      .join('');
  }
}

function clearItemTags() {
  state.ui.activeItemTags.clear();
  state.ui.itemPage = 0;
  updateItemTagLabel();
  renderItemTagFilter();
  renderItems();
}

document.addEventListener('click', e => {
  const tf = document.getElementById('item-tag-filter');
  if (!tf || tf.contains(e.target)) return;
  const dd = document.getElementById('itf-dropdown');
  const tr = document.getElementById('itf-trigger');
  if (dd) dd.classList.remove('open');
  if (tr) tr.classList.remove('open');
});

/* ══════════════════════════════════════
   ITEMS
══════════════════════════════════════ */
function renderItems() {
  const searchEl = document.getElementById('s-search');
  const minEl    = document.getElementById('s-min');
  const maxEl    = document.getElementById('s-max');
  if (!searchEl) return;

  const search = searchEl.value.toLowerCase();
  const minP   = parseFloat(minEl.value) || 0;
  const maxP   = parseFloat(maxEl.value) || Infinity;

  let f = state.items.filter(i =>
    (i.name || '').toLowerCase().includes(search) &&
    (state.ui.activeItemTags.size === 0 || (i.tags || []).some(t => state.ui.activeItemTags.has(t))) &&
    (i.price || 0) >= minP && (i.price || 0) <= maxP
  );

  const { sortKey, sortDir } = state.ui;
  if (sortKey) f.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(f.length / PAGE_SIZE));
  if (state.ui.itemPage >= totalPages) state.ui.itemPage = totalPages - 1;
  const page = state.ui.itemPage;
  const pageItems = f.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const isAdmin = state.auth.isAdmin;
  document.getElementById('items-body').innerHTML = pageItems.map((it, i) => `
    <tr style="animation-delay:${i * .04}s">
      <td><span class="i-name">${escHtml(it.name)}</span></td>
      <td class="col-price"><span class="i-price">${(it.price || 0).toLocaleString('de-DE')} ⚜</span></td>
      <td><div class="it-tags">${(it.tags || []).map(t => `<span class="ev-tag">${escHtml(t)}</span>`).join('')}</div></td>
      <td class="i-link"><a href="${escHtml(it.url || '#')}" target="_blank">${escHtml(it.url || '—')}</a></td>
      ${isAdmin ? `<td><div class="act-btns">
        <button class="act-btn" title="Bearbeiten" onclick="openEditItem(${it.id})">✎</button>
        <button class="act-btn del" title="Löschen" onclick="openDeleteItem(${it.id})">✕</button>
      </div></td>` : ''}
    </tr>`).join('');

  const start = f.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const end   = Math.min((page + 1) * PAGE_SIZE, f.length);
  document.getElementById('item-count').textContent =
    f.length === 0 ? '0 Einträge' : `${start}–${end} von ${f.length} Eintr${f.length === 1 ? 'ag' : 'ägen'}`;

  const pagEl = document.getElementById('item-pagination');
  if (totalPages <= 1) {
    pagEl.innerHTML = '';
  } else {
    pagEl.innerHTML = `<div class="pagination">
      <button class="pag-btn" onclick="gotoItemPage(${page - 1})" ${page === 0 ? 'disabled' : ''}>‹</button>
      ${Array.from({length: totalPages}, (_, i) =>
        `<button class="pag-btn${i === page ? ' active' : ''}" onclick="gotoItemPage(${i})">${i + 1}</button>`
      ).join('')}
      <button class="pag-btn" onclick="gotoItemPage(${page + 1})" ${page === totalPages - 1 ? 'disabled' : ''}>›</button>
    </div>`;
  }
}

function gotoItemPage(p) {
  state.ui.itemPage = p;
  renderItems();
}

function sortBy(k) {
  if (state.ui.sortKey === k) state.ui.sortDir *= -1;
  else { state.ui.sortKey = k; state.ui.sortDir = 1; }
  state.ui.itemPage = 0;
  renderItems();
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
async function init() {
  applyThemeFromStorage();
  try {
    const authStatus = await api('GET', '/auth/status');
    state.auth = {
      loggedIn: authStatus.loggedIn || false,
      isAdmin: authStatus.admin || false,
      userId: authStatus.userId || null,
      username: authStatus.username || null,
      colorHex: authStatus.colorHex || null,
      mustChangePassword: authStatus.mustChangePassword || false,
    };

    // Load worlds — server filters to only those readable by the current caller (guests included)
    {
      const worlds = await api('GET', '/worlds');
      state.worlds = worlds || [];

      const savedWorldId = parseInt(localStorage.getItem('activeWorldId'));
      state.ui.activeWorldId = (savedWorldId && state.worlds.find(w => w.id === savedWorldId))
        ? savedWorldId : (state.worlds[0]?.id ?? null);
    }

    if (state.ui.activeWorldId) {
      const [events, undated, items, tagCounts] = await Promise.all([
        api('GET', `/worlds/${state.ui.activeWorldId}/events`),
        api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
        api('GET', '/items'),
        api('GET', '/items/tags'),
      ]);
      state.events  = events     || [];
      state.undated = undated    || [];
      state.items   = items      || [];
      itemTagCounts = tagCounts  || [];
    } else {
      const [items, tagCounts] = await Promise.all([
        api('GET', '/items'),
        api('GET', '/items/tags'),
      ]);
      state.items   = items     || [];
      itemTagCounts = tagCounts || [];
    }

    renderTopNavWorlds();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    applyAuthUI();
    if (state.auth.loggedIn) {
      loadPoiTypes();
      loadWikiTitles();
    }
    await navigateToUrl(parseUrl(), false);
    if (state.auth.mustChangePassword) showPasswordChangeOverlay();
  } catch (e) {
    console.error('Init failed', e);
    renderTopNavWorlds();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    applyAuthUI();
    showPage('timeline');
  }
}

document.addEventListener('DOMContentLoaded', () => { init(); wireUndatedDropZone(); });
window.addEventListener('popstate', () => { navigateToUrl(parseUrl(), false); });

document.addEventListener('click', e => {
  if (!e.target.closest('#wiki-filter-toggle') && !e.target.closest('#wiki-filter-panel')) {
    closeWikiFilterPanel();
  }
});

/* ══════════════════════════════════════
   PASSWORD CHANGE OVERLAY
══════════════════════════════════════ */
function showPasswordChangeOverlay() {
  const overlay = document.getElementById('pw-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    ['pw-current','pw-new','pw-confirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const errEl = document.getElementById('pw-err');
    if (errEl) errEl.style.display = 'none';
  }
}

function hidePasswordChangeOverlay() {
  const overlay = document.getElementById('pw-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function submitPasswordChange() {
  const currentPw = document.getElementById('pw-current').value;
  const newPw     = document.getElementById('pw-new').value;
  const confirmPw = document.getElementById('pw-confirm').value;
  const errEl     = document.getElementById('pw-err');

  if (!currentPw || !newPw || !confirmPw) {
    if (errEl) { errEl.textContent = 'Alle Felder sind Pflicht.'; errEl.style.display = 'block'; }
    return;
  }
  if (newPw !== confirmPw) {
    if (errEl) { errEl.textContent = 'Neue Passwörter stimmen nicht überein.'; errEl.style.display = 'block'; }
    return;
  }
  try {
    await api('POST', '/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
    state.auth.mustChangePassword = false;
    hidePasswordChangeOverlay();
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Fehler beim Ändern des Passworts.'; errEl.style.display = 'block'; }
  }
}

/* ══════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════ */
let userModalMode = 'create'; // 'create' | 'edit'
let userModalId   = null;

async function renderUsers() {
  try {
    const users = await api('GET', '/admin/users');
    const tbody = document.getElementById('users-body');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${escHtml(u.username)}</td>
        <td>${escHtml(u.role)}</td>
        <td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${escHtml(u.colorHex)};vertical-align:middle"></span> ${escHtml(u.colorHex)}</td>
        <td>
          <button class="act-btn" onclick="openEditUserModal(${u.id})">✎</button>
          <button class="act-btn del" onclick="deleteUser(${u.id})">✕</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

function openCreateUserModal() {
  userModalMode = 'create';
  userModalId   = null;
  document.getElementById('um-title').textContent = 'Nutzer anlegen';
  document.getElementById('um-username').value    = '';
  document.getElementById('um-username').disabled = false;
  document.getElementById('um-username-grp').style.display = '';
  document.getElementById('um-role').value    = 'USER';
  document.getElementById('um-color').value   = '#888888';
  document.getElementById('um-reset-grp').style.display = 'none';
  const errEl = document.getElementById('um-err');
  if (errEl) errEl.style.display = 'none';
  document.getElementById('user-modal').style.display = 'flex';
}

function openEditUserModal(id) {
  userModalMode = 'edit';
  userModalId   = id;
  // Re-fetch fresh list to get current values
  api('GET', '/admin/users').then(users => {
    const u = users.find(x => x.id === id);
    if (!u) return;
    document.getElementById('um-title').textContent = 'Nutzer bearbeiten';
    document.getElementById('um-username-grp').style.display = 'none';
    document.getElementById('um-role').value  = u.role;
    document.getElementById('um-color').value = u.colorHex;
    document.getElementById('um-reset-pw').checked = false;
    document.getElementById('um-reset-grp').style.display = '';
    const errEl = document.getElementById('um-err');
    if (errEl) errEl.style.display = 'none';
    document.getElementById('user-modal').style.display = 'flex';
  });
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

async function saveUser() {
  const errEl = document.getElementById('um-err');
  if (errEl) errEl.style.display = 'none';

  const role     = document.getElementById('um-role').value;
  const colorHex = document.getElementById('um-color').value;

  try {
    if (userModalMode === 'create') {
      const username = document.getElementById('um-username').value.trim();
      if (!username) { if (errEl) { errEl.textContent = 'Benutzername ist Pflicht.'; errEl.style.display = 'block'; } return; }
      await api('POST', '/admin/users', { username, role, colorHex });
    } else {
      const resetPassword = document.getElementById('um-reset-pw').checked;
      await api('PUT', '/admin/users/' + userModalId, { role, colorHex, resetPassword });
    }
    closeUserModal();
    renderUsers();
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Fehler.'; errEl.style.display = 'block'; }
  }
}

async function deleteUser(id) {
  if (!confirm('Nutzer wirklich löschen?')) return;
  try {
    await api('DELETE', '/admin/users/' + id);
    renderUsers();
  } catch (e) {
    alert('Fehler: ' + e.message);
  }
}

/* ══════════════════════════════════════
   WIKI — API
══════════════════════════════════════ */
async function loadWikiTitles() {
  try {
    state.wikiTitles = await api('GET', '/wiki/titles');
  } catch(e) { /* non-critical */ }
}

async function loadWikiEntries() {
  const wid = state.ui.wikiActiveWorldId;
  if (!wid) return;
  try {
    const entries = await api('GET', `/wiki?worldId=${wid}`);
    if (state.ui.wikiActiveWorldId !== wid) return; // stale — world changed while loading
    state.wikiAllEntries = entries;
    applyWikiFilter();
  } catch(e) { console.error(e); }
}

async function loadWikiGraph(worldId) {
  try {
    const graph = await api('GET', `/wiki/graph?worldId=${worldId}`);
    if (state.ui.activeWorldId !== worldId) return; // stale — world changed while loading
    state.wikiFullGraph = graph;
    renderWikiGraph(filterWikiGraph(graph));
  } catch(e) { console.error(e); }
}

async function loadWikiArticle(id, silent = false) {
  try {
    const entry = await api('GET', `/wiki/${id}`);
    renderWikiArticle(entry);
    if (!silent) pushUrl(buildUrl(state.ui.wikiActiveWorldId, 'wiki', id));
  } catch(e) { alert('Fehler: ' + e.message); }
}

async function searchWiki(q) {
  const wid = state.ui.wikiActiveWorldId;
  const worldParam = wid ? `&worldId=${wid}` : '';
  try {
    const entries = await api('GET', `/wiki?q=${encodeURIComponent(q)}${worldParam}`);
    state.wikiAllEntries = entries;
    applyWikiFilter();
  } catch(e) { console.error(e); }
}

/* ══════════════════════════════════════
   WIKI — PAGE INIT
══════════════════════════════════════ */
async function initWikiPage() {
  if (state.ui.activeWorldId) {
    state.ui.wikiActiveWorldId = state.ui.activeWorldId;
  } else if (state.worlds.length > 0 && !state.ui.wikiActiveWorldId) {
    state.ui.wikiActiveWorldId = state.worlds[0].id;
    state.ui.activeWorldId     = state.ui.wikiActiveWorldId;
  }

  // Close any open article before loading — prevents stale content from a previous world
  // flashing on screen. This runs synchronously before the first await so no repaint occurs.
  closeWikiArticle(true);
  const editorPanel = document.getElementById('wiki-editor-panel');
  if (editorPanel) editorPanel.style.display = 'none';

  // wiki-world-tabs div no longer exists; section tabs are global

  // Restore search input
  const searchEl = document.getElementById('wiki-search');
  if (searchEl) searchEl.value = state.ui.wikiSearchText;

  // Restore type filter checkboxes and label
  document.querySelectorAll('#wiki-filter-panel input[type=checkbox]').forEach(cb => {
    cb.checked = state.ui.wikiTypeFilter.has(cb.value);
  });
  updateWikiFilterLabel();

  const loadFn = state.ui.wikiSearchText.trim()
    ? () => searchWiki(state.ui.wikiSearchText.trim())
    : loadWikiEntries;
  await Promise.all([loadFn(), loadWikiGraph(state.ui.wikiActiveWorldId)]);
  initWikiImageDrop();
}

function renderWikiWorldTabs() {
  const el = document.getElementById('wiki-world-tabs');
  if (!el) return;
  el.innerHTML = state.worlds.map(w => {
    const active = w.id === state.ui.wikiActiveWorldId ? ' active' : '';
    return `<button class="wiki-world-tab${active}" onclick="selectWikiWorld(${w.id})">${escHtml(w.name)}</button>`;
  }).join('');
}

async function selectWikiWorld(worldId) {
  state.ui.wikiActiveWorldId = worldId;
  renderWikiWorldTabs();
  const loadFn = state.ui.wikiSearchText.trim()
    ? () => searchWiki(state.ui.wikiSearchText.trim())
    : loadWikiEntries;
  await Promise.all([loadFn(), loadWikiGraph(worldId)]);
}

/* ══════════════════════════════════════
   WIKI — RECENT LIST + SEARCH
══════════════════════════════════════ */
function renderWikiRecentList(entries) {
  const el = document.getElementById('wiki-recent-list');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = '<div class="wiki-empty">Keine Einträge.</div>';
    return;
  }
  const view = state.ui.wikiView;

  if (view === 'hierarchy') {
    const idSet = new Set(entries.map(e => e.id));
    const childrenMap = {};
    entries.forEach(e => {
      const pid = e.parentId;
      if (pid && idSet.has(pid)) {
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(e);
      }
    });
    Object.values(childrenMap).forEach(arr => arr.sort((a, b) => a.title.localeCompare(b.title, 'de')));
    const roots = entries
      .filter(e => !e.parentId || !idSet.has(e.parentId))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));

    function renderNode(e, depth) {
      const collapsed = state.ui.wikiCollapsedNodes.has(e.id);
      const children = childrenMap[e.id] || [];
      const hasChildren = children.length > 0;
      const indent = depth * 16;
      let html = `
        <div class="wiki-list-item wiki-hierarchy-item" style="padding-left:${12 + indent}px" onclick="loadWikiArticle(${e.id})">
          ${hasChildren
            ? `<span class="wiki-hierarchy-toggle" onclick="event.stopPropagation();toggleWikiNode(${e.id})">${collapsed ? '▶' : '▼'}</span>`
            : `<span class="wiki-hierarchy-spacer"></span>`}
          <span class="wiki-list-title">${escHtml(e.title)}</span>
          <span class="wiki-type-badge wiki-type-${e.type.toLowerCase()} wiki-type-badge--sm">${escHtml(e.type)}</span>
        </div>
      `;
      if (hasChildren && !collapsed) {
        children.forEach(child => { html += renderNode(child, depth + 1); });
      }
      return html;
    }
    el.innerHTML = roots.map(e => renderNode(e, 0)).join('');

  } else if (view === 'alpha') {
    const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title, 'de'));
    el.innerHTML = sorted.map(e => wikiListItemHtml(e, true)).join('');

  } else if (view === 'type') {
    const typeOrder = Object.keys(WIKI_TYPE_LABELS);
    const byType = {};
    entries.forEach(e => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });
    // also catch any types not in the standard order
    Object.keys(byType).forEach(t => { if (!typeOrder.includes(t)) typeOrder.push(t); });

    el.innerHTML = typeOrder
      .filter(type => byType[type]?.length)
      .map(type => {
        const group = [...byType[type]].sort((a, b) => a.title.localeCompare(b.title, 'de'));
        const collapsed = state.ui.wikiCollapsedTypes.has(type);
        return `
          <div class="wiki-type-group-header" onclick="toggleWikiTypeGroup('${type}')">
            <span class="wiki-type-group-arrow">${collapsed ? '▶' : '▼'}</span>
            <span class="wiki-type-badge wiki-type-${type.toLowerCase()} wiki-type-badge--sm">${escHtml(type)}</span>
            <span class="wiki-type-group-count">${group.length}</span>
          </div>
          ${collapsed ? '' : `<div class="wiki-type-group-entries">${group.map(e => wikiListItemHtml(e, false)).join('')}</div>`}
        `;
      }).join('');
  }
}

function wikiListItemHtml(e, showBadge) {
  return `
    <div class="wiki-list-item" onclick="loadWikiArticle(${e.id})">
      <span class="wiki-list-title">${escHtml(e.title)}</span>
      ${showBadge ? `<span class="wiki-type-badge wiki-type-${e.type.toLowerCase()} wiki-type-badge--sm">${escHtml(e.type)}</span>` : ''}
    </div>
  `;
}

function setWikiView(view) {
  state.ui.wikiView = view;
  ['hierarchy', 'alpha', 'type'].forEach(v => {
    const btn = document.getElementById(`wiki-view-${v}`);
    if (btn) btn.classList.toggle('active', v === view);
  });
  applyWikiFilter();
}

function toggleWikiTypeGroup(type) {
  if (state.ui.wikiCollapsedTypes.has(type)) {
    state.ui.wikiCollapsedTypes.delete(type);
  } else {
    state.ui.wikiCollapsedTypes.add(type);
  }
  applyWikiFilter();
}

function toggleWikiNode(id) {
  if (state.ui.wikiCollapsedNodes.has(id)) {
    state.ui.wikiCollapsedNodes.delete(id);
  } else {
    state.ui.wikiCollapsedNodes.add(id);
  }
  applyWikiFilter();
}

function onWikiSearch(value) {
  clearTimeout(state.ui.wikiSearchTimer);
  state.ui.wikiSearchText = value;
  if (!value.trim()) {
    loadWikiEntries();
    return;
  }
  state.ui.wikiSearchTimer = setTimeout(() => searchWiki(value.trim()), 300);
}

/* ══════════════════════════════════════
   WIKI — TYPE FILTER
══════════════════════════════════════ */
const WIKI_TYPE_LABELS = {
  PERSON: 'Person', SPEZIES: 'Spezies', LOCATION: 'Ort', TERM: 'Begriff',
  RESOURCE: 'Ressource', FAUNA: 'Fauna', FLORA: 'Flora',
  FRAKTION: 'Fraktion', ENTITAET: 'Entität', OTHER: 'Sonstiges'
};

function toggleWikiFilterPanel() {
  const panel = document.getElementById('wiki-filter-panel');
  if (!panel) return;
  state.ui.wikiFilterPanelOpen = !state.ui.wikiFilterPanelOpen;
  panel.style.display = state.ui.wikiFilterPanelOpen ? '' : 'none';
}

function closeWikiFilterPanel() {
  const panel = document.getElementById('wiki-filter-panel');
  if (panel) panel.style.display = 'none';
  state.ui.wikiFilterPanelOpen = false;
}

function toggleWikiTypeFilter(checkbox) {
  const type = checkbox.value;
  if (checkbox.checked) {
    state.ui.wikiTypeFilter.add(type);
  } else {
    state.ui.wikiTypeFilter.delete(type);
  }
  updateWikiFilterLabel();
  applyWikiFilter();
}

function updateWikiFilterLabel() {
  const label = document.getElementById('wiki-filter-label');
  if (!label) return;
  const active = state.ui.wikiTypeFilter;
  if (active.size === 0) {
    label.textContent = 'Alle';
  } else if (active.size === 1) {
    label.textContent = WIKI_TYPE_LABELS[[...active][0]] || [...active][0];
  } else {
    label.textContent = active.size + ' Typen';
  }
}

function applyWikiFilter() {
  const active = state.ui.wikiTypeFilter;
  const filtered = active.size === 0
    ? state.wikiAllEntries
    : state.wikiAllEntries.filter(e => active.has(e.type));
  renderWikiRecentList(filtered);
  if (state.wikiFullGraph) {
    renderWikiGraph(filterWikiGraph(state.wikiFullGraph));
  }
}

function filterWikiGraph(graph) {
  const active = state.ui.wikiTypeFilter;
  if (active.size === 0) return graph;
  const nodes = graph.nodes.filter(n => active.has(n.type));
  const ids = new Set(nodes.map(n => n.id));
  const edges = graph.edges.filter(e => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges };
}

/* ══════════════════════════════════════
   WIKI — D3 GRAPH
══════════════════════════════════════ */
const WIKI_TYPE_COLORS = {
  PERSON:       '#f0c040',
  SPEZIES:      '#d4884a',
  LOCATION:     '#4a90d9',
  TERM:         '#888888',
  RESOURCE:     '#2bb5a0',
  FAUNA:        '#e05555',
  FLORA:        '#4caf50',
  FRAKTION:     '#9c5fb5',
  ENTITAET:     '#e07b30',
  OTHER:        '#cccccc'
};

function renderWikiGraph({ nodes, edges }) {
  const svgEl = document.getElementById('wiki-graph');
  const hint  = document.getElementById('wiki-empty-hint');
  if (!svgEl) return;

  d3.select(svgEl).selectAll('*').remove();

  if (!nodes.length) {
    svgEl.style.display = 'none';
    if (hint) hint.style.display = '';
    return;
  }
  svgEl.style.display = '';
  if (hint) hint.style.display = 'none';

  const width  = svgEl.parentElement.clientWidth  || 800;
  const height = svgEl.parentElement.clientHeight || 600;
  svgEl.setAttribute('width',  width);
  svgEl.setAttribute('height', height);

  const svg = d3.select(svgEl);
  const g   = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform)));

  const simulation = d3.forceSimulation(nodes)
    .force('link',    d3.forceLink(edges).id(d => d.id).distance(120))
    .force('charge',  d3.forceManyBody().strength(-300))
    .force('center',  d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(40));

  const link = g.append('g').selectAll('line')
    .data(edges).join('line')
    .attr('stroke', 'var(--t3)')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.5);

  const node = g.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end',   (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('click', (event, d) => { event.stopPropagation(); loadWikiArticle(d.id); });

  node.append('circle')
    .attr('r', 18)
    .attr('fill', d => WIKI_TYPE_COLORS[d.type] || '#ccc')
    .attr('stroke', 'var(--bg-s)')
    .attr('stroke-width', 2);

  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 32)
    .attr('font-size', '11px')
    .attr('fill', 'var(--t1)')
    .text(d => d.title.length > 16 ? d.title.slice(0, 15) + '…' : d.title);

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

/* ══════════════════════════════════════
   WIKI — ARTICLE VIEW
══════════════════════════════════════ */
function renderWikiArticle(entry) {
  const panel   = document.getElementById('wiki-article-panel');
  const content = document.getElementById('wiki-article-content');
  if (!panel || !content) return;

  const isOwner           = state.auth.loggedIn && entry.createdByUserId === state.auth.userId;
  const isAdmin           = state.auth.isAdmin;
  const entryWorld        = state.worlds.find(w => w.id === entry.worldId);
  const canEdit           = state.auth.loggedIn || entryWorld?.guestCanEdit   === true;
  const canDeleteEntry    = state.auth.loggedIn || entryWorld?.guestCanDelete === true;
  const canManageSpoilers = isOwner || isAdmin;

  const breadcrumbHtml = entry.parentId
    ? `<div class="wiki-breadcrumb"><a class="wiki-breadcrumb-link" data-wiki-id="${entry.parentId}" data-wiki-title="${escHtml(entry.parentTitle)}" onclick="loadWikiArticle(${entry.parentId})">← ${escHtml(entry.parentTitle)}</a></div>`
    : '';

  const childrenHtml = (entry.children && entry.children.length > 0)
    ? `<div class="wiki-linked-section">
        <h4>Unterseiten</h4>
        <div class="wiki-children-list">
          ${entry.children.map(c => `
            <a class="wiki-linked-item" href="#" data-wiki-id="${c.id}" data-wiki-title="${escHtml(c.title)}" onclick="loadWikiArticle(${c.id});return false">
              <span class="wiki-type-badge wiki-type-${c.type.toLowerCase()} wiki-type-badge--sm">${escHtml(c.type)}</span>
              ${escHtml(c.title)}
            </a>
          `).join('')}
        </div>
      </div>`
    : '';

  const imagesHtml = (entry.images || []).map(img => `
    <figure class="wiki-img-figure">
      <img src="/api/wiki/images/${img.id}" alt="${escHtml(img.caption || '')}" class="wiki-img"
           onclick="openImageLightbox('/api/wiki/images/${img.id}', '${escHtml(img.caption || '')}')">
      ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
    </figure>
  `).join('');

  const bodyHtml = entry.body
    ? linkifyWikiTitles(renderWikiMarkdown(entry.body), entry.id)
    : '<em>Kein Inhalt.</em>';

  const spoilerSection = canManageSpoilers
    ? `<details class="wiki-spoiler-mgmt">
        <summary>Spoiler-Zugriff verwalten</summary>
        <div id="wiki-spoiler-readers-${entry.id}">Lade…</div>
        <div class="wiki-spoiler-add">
          <select id="wiki-spoiler-select-${entry.id}"></select>
          <button class="btn btn-sm" onclick="addWikiSpoilerReader(${entry.id})">Hinzufügen</button>
        </div>
      </details>`
    : '';

  const parentCellHtml = entry.parentId
    ? `<a class="wiki-info-link wiki-type-${(entry.parentType || 'other').toLowerCase()}" href="#" data-wiki-id="${entry.parentId}" data-wiki-title="${escHtml(entry.parentTitle)}" onclick="loadWikiArticle(${entry.parentId});return false">${escHtml(entry.parentTitle)}</a>`
    : `<span class="wiki-info-empty">—</span>`;

  const childrenCellHtml = (entry.children && entry.children.length > 0)
    ? entry.children.map(c =>
        `<a class="wiki-info-link wiki-type-${c.type.toLowerCase()}" href="#" data-wiki-id="${c.id}" data-wiki-title="${escHtml(c.title)}" onclick="loadWikiArticle(${c.id});return false">${escHtml(c.title)}</a>`
      ).join('')
    : `<span class="wiki-info-empty">—</span>`;

  content.innerHTML = `
    <div class="wiki-article-header">
      <span class="wiki-type-badge wiki-type-${entry.type.toLowerCase()}">${escHtml(entry.type)}</span>
      <h2 class="wiki-article-title">${escHtml(entry.title)}</h2>
      ${canEdit ? `
        <button class="wiki-icon-btn" title="Bearbeiten" onclick="openWikiEditor(${entry.id})">✎</button>
      ` : ''}
      ${canDeleteEntry ? `
        <button class="wiki-icon-btn wiki-icon-btn--del" title="Löschen" onclick="deleteWikiEntry(${entry.id})">🗑</button>
      ` : ''}
      <span class="wiki-article-world">${escHtml(entry.worldName)}</span>
    </div>
    <div class="wiki-article-body">
      <div class="wiki-images-float">${imagesHtml}</div>
      <div class="wiki-body-text">${bodyHtml}</div>
      <div style="clear:both"></div>
    </div>
    ${spoilerSection}
    <table class="wiki-info-table">
      <tr>
        <th>Elterneintrag</th>
        <td>${parentCellHtml}</td>
      </tr>
      <tr>
        <th>Unterseiten</th>
        <td>${childrenCellHtml}</td>
      </tr>
      <tr>
        <th>Verknüpfte Seiten</th>
        <td><div id="wiki-linked-entries-${entry.id}">Lade…</div></td>
      </tr>
      <tr>
        <th>Verknüpfte Events</th>
        <td><div id="wiki-linked-events-${entry.id}">Lade…</div></td>
      </tr>
    </table>
    <div class="wiki-article-meta">Erstellt von <strong>${escHtml(entry.createdByUsername || 'Anonym')}</strong></div>
  `;

  panel.style.display = '';

  api('GET', `/wiki/${entry.id}/linked-events`).then(events => {
    const el = document.getElementById(`wiki-linked-events-${entry.id}`);
    if (!el) return;
    if (!events.length) { el.innerHTML = '<span class="wiki-info-empty">—</span>'; return; }
    el.innerHTML = events.map(e =>
      `<a class="wiki-info-link" href="#" onclick="openEventFromWiki(${e.id},${e.worldId});return false">${escHtml(e.title)}</a>`
    ).join('');
  }).catch(() => {});

  api('GET', `/wiki/${entry.id}/linked-entries`).then(entries => {
    const el = document.getElementById(`wiki-linked-entries-${entry.id}`);
    if (!el) return;
    if (!entries.length) { el.innerHTML = '<span class="wiki-info-empty">—</span>'; return; }
    el.innerHTML = entries.map(e =>
      `<a class="wiki-info-link wiki-type-${(e.type || 'other').toLowerCase()}" href="#" data-wiki-id="${e.id}" data-wiki-title="${escHtml(e.title)}" onclick="loadWikiArticle(${e.id});return false">${escHtml(e.title)}</a>`
    ).join('');
  }).catch(() => {});

  if (canManageSpoilers) {
    Promise.all([
      api('GET', '/admin/users/names'),
      api('GET', `/wiki/${entry.id}/spoiler-readers`)
    ]).then(([users, readerIds]) => {
      const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));
      const readerSet = new Set(readerIds);

      // Render current readers with their usernames
      const el = document.getElementById(`wiki-spoiler-readers-${entry.id}`);
      if (el) {
        if (!readerIds.length) {
          el.innerHTML = '<em>Keine weiteren Leser.</em>';
        } else {
          el.innerHTML = readerIds.map(uid =>
            `<span class="wiki-reader-tag">${escHtml(userMap[uid] || String(uid))} <button onclick="removeWikiSpoilerReader(${entry.id},${uid})">✕</button></span>`
          ).join('');
        }
      }

      // Build filtered select: exclude admins, creator, already-added readers
      const eligible = users.filter(u =>
        u.role !== 'ADMIN' &&
        u.id !== entry.createdByUserId &&
        !readerSet.has(u.id)
      );

      const sel = document.getElementById(`wiki-spoiler-select-${entry.id}`);
      const btn = sel && sel.closest('.wiki-spoiler-add') && sel.closest('.wiki-spoiler-add').querySelector('button');
      if (sel) {
        if (!eligible.length) {
          sel.innerHTML = '<option value="">— Alle haben bereits Zugriff —</option>';
          sel.disabled = true;
          if (btn) btn.disabled = true;
        } else {
          sel.innerHTML = eligible.map(u => `<option value="${u.id}">${escHtml(u.username)}</option>`).join('');
          sel.disabled = false;
          if (btn) btn.disabled = false;
        }
      }
    }).catch(() => {});
  }
}

function closeWikiArticle(silent = false) {
  const panel = document.getElementById('wiki-article-panel');
  if (panel) panel.style.display = 'none';
  if (!silent) pushUrl(buildUrl(state.ui.wikiActiveWorldId, 'wiki'));
}

function renderWikiMarkdown(body) {
  const processed = body.replace(
    /:::spoiler ([^\n]+)\n([\s\S]*?):::/g,
    (_, name, content) =>
      `<div class="wiki-spoiler-block"><div class="wiki-spoiler-label">🔒 Spoiler: ${escHtml(name)}</div><div class="wiki-spoiler-content">${marked.parse(content)}</div></div>`
  );
  return marked.parse(processed);
}

async function openEventFromWiki(eventId, worldId) {
  if (state.ui.activeWorldId !== worldId) {
    await selectWorld(worldId);
  }
  showPage('timeline');
  populateDetail(eventId, 'tl');
  openDetailPanel();
  pushUrl(buildUrl(worldId, 'timeline', eventId));
}

async function addWikiSpoilerReader(entryId) {
  const sel = document.getElementById(`wiki-spoiler-select-${entryId}`);
  if (!sel || !sel.value) return;
  const userId = parseInt(sel.value);
  if (isNaN(userId)) return;
  try {
    await api('POST', `/wiki/${entryId}/spoiler-readers/${userId}`);
    loadWikiArticle(entryId, true);
  } catch(e) { alert('Fehler: ' + e.message); }
}

async function removeWikiSpoilerReader(entryId, userId) {
  try {
    await api('DELETE', `/wiki/${entryId}/spoiler-readers/${userId}`);
    loadWikiArticle(entryId, true);
  } catch(e) { alert('Fehler: ' + e.message); }
}

async function deleteWikiEntry(id) {
  if (!confirm('Eintrag wirklich löschen?')) return;
  try {
    await api('DELETE', `/wiki/${id}`);
    closeWikiArticle();
    await loadWikiEntries();
    if (state.ui.wikiActiveWorldId) await loadWikiGraph(state.ui.wikiActiveWorldId);
    await loadWikiTitles();
  } catch(e) { alert('Fehler: ' + e.message); }
}

/* ══════════════════════════════════════
   WIKI — EDITOR
══════════════════════════════════════ */
const WIKI_DEFAULT_MARKDOWN = `## Übersicht

Hier eine kurze Beschreibung des Eintrags.

## Details

- **Eigenschaft 1:** Wert
- **Eigenschaft 2:** Wert

## Hintergrund

Weiterer Text mit *kursiver* und **fetter** Formatierung.

## Tabelle (Beispiel)

| Spalte A | Spalte B |
|----------|----------|
| Wert 1   | Wert 2   |
`;

function openWikiEditor(entryId) {
  state.ui.wikiEditId = entryId;
  state.ui.wikiPendingImages = [];
  state.ui.wikiExistingImages = [];
  clearWikiParent();

  const panel       = document.getElementById('wiki-editor-panel');
  const titleEl     = document.getElementById('wiki-editor-title');
  const titleInput  = document.getElementById('wiki-ed-title');
  const typeSelect  = document.getElementById('wiki-ed-type');
  const worldSelect = document.getElementById('wiki-ed-world');
  const bodyArea    = document.getElementById('wiki-ed-body');
  const errEl       = document.getElementById('wiki-editor-error');
  if (!panel) return;

  worldSelect.innerHTML = state.worlds.map(w =>
    `<option value="${w.id}">${escHtml(w.name)}</option>`
  ).join('');

  const spoilerBtn = document.getElementById('wiki-toolbar-spoiler');
  if (entryId) {
    titleEl.textContent = 'Eintrag bearbeiten';
    worldSelect.disabled = true;
    api('GET', `/wiki/${entryId}`).then(entry => {
      titleInput.value  = entry.title;
      typeSelect.value  = entry.type;
      worldSelect.value = entry.worldId;
      bodyArea.value    = entry.body || '';
      state.ui.wikiExistingImages = (entry.images || []).map(img => ({
        id: img.id, caption: img.caption || '', sortOrder: img.sortOrder
      }));
      if (spoilerBtn) spoilerBtn.style.display = entry.canReadSpoilers ? '' : 'none';
      if (entry.parentId) {
        selectWikiParent(entry.parentId, entry.parentTitle);
      }
      renderWikiImagePreviews();
    }).catch(e => alert('Fehler: ' + e.message));
  } else {
    titleEl.textContent = 'Neuer Wiki-Eintrag';
    titleInput.value    = '';
    typeSelect.value    = 'TERM';
    worldSelect.disabled = false;
    if (state.ui.wikiActiveWorldId) worldSelect.value = state.ui.wikiActiveWorldId;
    bodyArea.value = WIKI_DEFAULT_MARKDOWN;
    // New entries: creator always gets full access including spoilers
    if (spoilerBtn) spoilerBtn.style.display = '';
  }

  renderWikiImagePreviews();
  if (errEl) errEl.style.display = 'none';
  document.getElementById('wiki-article-panel').style.display = 'none';
  panel.style.display = '';
}

function closeWikiEditor() {
  const panel = document.getElementById('wiki-editor-panel');
  if (panel) panel.style.display = 'none';
  state.ui.wikiPendingImages = [];
  state.ui.wikiExistingImages = [];
}

function clearWikiParent() {
  state.ui.wikiEditParentId = null;
  const idInput   = document.getElementById('wiki-ed-parent-id');
  const textInput = document.getElementById('wiki-ed-parent-input');
  const dropdown  = document.getElementById('wiki-parent-dropdown');
  const selected  = document.getElementById('wiki-parent-selected');
  if (idInput)   idInput.value = '';
  if (textInput) { textInput.value = ''; textInput.style.display = ''; textInput.focus(); }
  if (dropdown)  dropdown.style.display = 'none';
  if (selected)  selected.style.display = 'none';
}

function selectWikiParent(id, title) {
  state.ui.wikiEditParentId = id;
  const idInput   = document.getElementById('wiki-ed-parent-id');
  const textInput = document.getElementById('wiki-ed-parent-input');
  const dropdown  = document.getElementById('wiki-parent-dropdown');
  const selected  = document.getElementById('wiki-parent-selected');
  const label     = document.getElementById('wiki-parent-selected-label');
  if (idInput)   idInput.value = id;
  if (textInput) { textInput.value = ''; textInput.style.display = 'none'; }
  if (dropdown)  dropdown.style.display = 'none';
  if (label)     label.textContent = title;
  if (selected)  selected.style.display = '';
}

function onWikiParentSearch(value) {
  const dropdown = document.getElementById('wiki-parent-dropdown');
  if (!dropdown) return;
  const worldIdEl = document.getElementById('wiki-ed-world');
  const worldId   = worldIdEl ? parseInt(worldIdEl.value) : null;
  const selfId    = state.ui.wikiEditId;
  const q = value.trim().toLowerCase();
  if (!q) { dropdown.style.display = 'none'; return; }

  const matches = state.wikiAllEntries
    .filter(e => e.worldId === worldId && e.id !== selfId && e.title.toLowerCase().includes(q))
    .slice(0, 10);

  if (!matches.length) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = matches.map(e => {
    const safeTitle = escHtml(e.title);
    return `
      <div class="wiki-parent-option" data-id="${e.id}" data-title="${safeTitle}" onclick="selectWikiParentFromEl(this)">
        <span class="wiki-type-badge wiki-type-${e.type.toLowerCase()} wiki-type-badge--sm">${escHtml(e.type)}</span>
        ${safeTitle}
      </div>
    `;
  }).join('');
  dropdown.style.display = '';
}

function selectWikiParentFromEl(el) {
  selectWikiParent(parseInt(el.dataset.id), el.dataset.title);
}

async function saveWikiEntry() {
  const titleInput  = document.getElementById('wiki-ed-title');
  const typeSelect  = document.getElementById('wiki-ed-type');
  const worldSelect = document.getElementById('wiki-ed-world');
  const bodyArea    = document.getElementById('wiki-ed-body');

  const title = titleInput.value.trim();
  if (!title) { showWikiEditorError('Titel ist erforderlich.'); return; }

  const parentIdVal = document.getElementById('wiki-ed-parent-id').value;
  const payload = {
    title,
    type:    typeSelect.value,
    worldId: parseInt(worldSelect.value),
    body:    bodyArea.value,
    parentId: parentIdVal ? parseInt(parentIdVal) : null
  };

  try {
    let saved;
    if (state.ui.wikiEditId) {
      saved = await api('PUT', `/wiki/${state.ui.wikiEditId}`, payload);
    } else {
      saved = await api('POST', '/wiki', payload);
    }

    for (const img of state.ui.wikiExistingImages) {
      try { await api('PUT', `/wiki/images/${img.id}`, { caption: img.caption }); }
      catch(e) { /* caption update failure is non-fatal */ }
    }

    for (const pending of state.ui.wikiPendingImages) {
      const fd = new FormData();
      fd.append('file', pending.file);
      try {
        const imgDto = await apiUpload(`/wiki/${saved.id}/images`, fd);
        if (pending.caption) {
          await api('PUT', `/wiki/images/${imgDto.id}`, { caption: pending.caption });
        }
      } catch(e) { /* image upload failures are non-fatal */ }
    }

    closeWikiEditor();
    await loadWikiEntries();
    if (state.ui.wikiActiveWorldId) await loadWikiGraph(state.ui.wikiActiveWorldId);
    await loadWikiTitles();
    await loadWikiArticle(saved.id, true);
  } catch(e) { showWikiEditorError(e.message); }
}

function showWikiEditorError(msg) {
  const el = document.getElementById('wiki-editor-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
}

function onWikiImageSelect(event) {
  for (const file of event.target.files) {
    state.ui.wikiPendingImages.push({ file, caption: '' });
  }
  renderWikiImagePreviews();
}

function renderWikiImagePreviews() {
  const list = document.getElementById('wiki-img-preview-list');
  if (!list) return;

  const existingHtml = state.ui.wikiExistingImages.map((img, i) => `
    <div class="wiki-img-preview-item">
      <img src="/api/wiki/images/${img.id}" class="wiki-img-preview-thumb">
      <input type="text" placeholder="Beschriftung" value="${escHtml(img.caption)}"
             oninput="state.ui.wikiExistingImages[${i}].caption=this.value">
      <button onclick="removeWikiExistingImage(${i})" title="Bild löschen">✕</button>
    </div>
  `).join('');

  const pendingHtml = state.ui.wikiPendingImages.map((img, i) => `
    <div class="wiki-img-preview-item">
      <img src="${URL.createObjectURL(img.file)}" class="wiki-img-preview-thumb">
      <input type="text" placeholder="Beschriftung" value="${escHtml(img.caption)}"
             oninput="state.ui.wikiPendingImages[${i}].caption=this.value">
      <button onclick="removeWikiPendingImage(${i})" title="Bild entfernen">✕</button>
    </div>
  `).join('');

  list.innerHTML = existingHtml + pendingHtml;
}

async function removeWikiExistingImage(i) {
  const img = state.ui.wikiExistingImages[i];
  if (!img) return;
  try {
    await api('DELETE', `/wiki/images/${img.id}`);
    state.ui.wikiExistingImages.splice(i, 1);
    renderWikiImagePreviews();
  } catch(e) { alert('Fehler beim Löschen: ' + e.message); }
}

function removeWikiPendingImage(i) {
  state.ui.wikiPendingImages.splice(i, 1);
  renderWikiImagePreviews();
}

function initWikiImageDrop() {
  const area = document.getElementById('wiki-img-area');
  if (!area || area.dataset.dropInit) return;
  area.dataset.dropInit = '1';
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const errors = [];
    for (const file of e.dataTransfer.files) {
      if (file.type !== 'image/webp') {
        errors.push(`"${file.name}" ist kein WebP-Bild.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`"${file.name}" ist größer als 10 MB.`);
        continue;
      }
      state.ui.wikiPendingImages.push({ file, caption: '' });
    }
    if (errors.length) alert('Fehler beim Hochladen:\n' + errors.join('\n'));
    renderWikiImagePreviews();
  });
}

function wikiToolbar(action) {
  const ta = document.getElementById('wiki-ed-body');
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  let insert  = '';

  switch(action) {
    case 'bold':    insert = `**${sel || 'Text'}**`; break;
    case 'italic':  insert = `*${sel || 'Text'}*`; break;
    case 'ul':      insert = `\n- ${sel || 'Eintrag'}\n`; break;
    case 'ol':      insert = `\n1. ${sel || 'Eintrag'}\n`; break;
    case 'table':   insert = `\n| Spalte 1 | Spalte 2 |\n|---|---|\n| Zelle | Zelle |\n`; break;
    case 'spoiler': {
      const name = prompt('Name des Spoiler-Blocks:');
      if (!name) return;
      insert = `\n:::spoiler ${name}\n${sel || 'Geheimer Inhalt'}\n:::\n`;
      break;
    }
  }

  ta.setRangeText(insert, start, end, 'end');
  ta.focus();
}

/* ══════════════════════════════════════
   WIKI — AUTO-LINKING IN EVENTS
══════════════════════════════════════ */
function linkifyWikiTitles(html, excludeId) {
  if (!state.wikiTitles || !state.wikiTitles.length) return html;
  const sorted = [...state.wikiTitles]
    .filter(t => t.id !== excludeId)
    .sort((a, b) => b.title.length - a.title.length);

  // Work on DOM text nodes so bold/italic/other tags are handled correctly
  // and we never accidentally match inside HTML attributes.
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentNode;
      while (p && p !== temp) {
        if (p.tagName === 'A') return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    let result = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let modified = false;
    for (const { id, title } of sorted) {
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'gi');
      const next = result.replace(re, match =>
        `<a class="wiki-inline-link" href="#" data-wiki-id="${id}" onclick="openWikiFromEvent(${id});return false">${match}</a>`
      );
      if (next !== result) { result = next; modified = true; }
    }
    if (modified) {
      const span = document.createElement('span');
      span.innerHTML = result;
      textNode.parentNode.replaceChild(span, textNode);
    }
  }

  return temp.innerHTML;
}

function openWikiFromEvent(entryId) {
  showPage('wiki');
  loadWikiArticle(entryId);
}

/* ══════════════════════════════════════
   WIKI — PREVIEW TOOLTIP
══════════════════════════════════════ */
let _wikiTipTimer = null;
let _wikiTipEl    = null;
const _wikiTipCache = {};

/**
 * Starts (or continues) the 1-second hover timer for a wiki preview tooltip.
 * Does nothing if the same element is already being tracked.
 * @param {Element} el   - element with data-wiki-id attribute
 * @param {number}  x    - clientX of the triggering mouse event
 * @param {number}  y    - clientY of the triggering mouse event
 */
function _startWikiTip(el, x, y) {
  if (el === _wikiTipEl) return;
  _hideWikiTip();
  _wikiTipEl = el;
  _wikiTipTimer = setTimeout(async () => {
    const id = el.dataset.wikiId;
    try {
      if (!_wikiTipCache[id]) {
        const res = await api('GET', `/wiki/${id}/preview`);
        _wikiTipCache[id] = res.preview || '';
      }
      if (_wikiTipEl !== el) return; // navigated away while fetching
      const title = el.dataset.wikiTitle || el.textContent.replace(/\s+/g, ' ').trim();
      const tip   = document.getElementById('wiki-preview-tip');
      if (!tip) return;
      tip.querySelector('.wpt-title').textContent = title;
      tip.querySelector('.wpt-text').innerHTML    = _wikiTipCache[id]
        ? marked.parse(_wikiTipCache[id])
        : '<em>…</em>';
      tip.hidden = false;
      _posWikiTip(x, y);
    } catch (e) { /* ignore fetch errors */ }
  }, 1000);
}

/** Hides the tooltip and cancels any pending timer. */
function _hideWikiTip() {
  clearTimeout(_wikiTipTimer);
  _wikiTipTimer = null;
  _wikiTipEl    = null;
  const tip = document.getElementById('wiki-preview-tip');
  if (tip) tip.hidden = true;
}

/**
 * Repositions the tooltip near the cursor, keeping it within the viewport.
 * @param {number} x - clientX
 * @param {number} y - clientY
 */
function _posWikiTip(x, y) {
  const tip = document.getElementById('wiki-preview-tip');
  if (!tip || tip.hidden) return;
  const m = 14;
  let left = x + m;
  let top  = y + m;
  if (left + tip.offsetWidth  > window.innerWidth  - m) left = x - tip.offsetWidth  - m;
  if (top  + tip.offsetHeight > window.innerHeight - m) top  = y - tip.offsetHeight - m;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}

// Delegated listeners — work for any [data-wiki-id] element regardless of when it was created
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-wiki-id]');
  if (el) _startWikiTip(el, e.clientX, e.clientY);
  else    _hideWikiTip();
});
document.addEventListener('mousemove', e => { _posWikiTip(e.clientX, e.clientY); });

/* ══════════════════════════════════════
   MAP — INITIALISATION
══════════════════════════════════════ */
async function loadPoiTypes() {
  try {
    state.map.poiTypes = await api('GET', '/poi-types');
  } catch (e) { console.error('Failed to load POI types', e); }
}

async function loadMapData(worldId) {
  try {
    const pois = await api('GET', `/worlds/${worldId}/map/pois`);
    if (state.ui.activeWorldId !== worldId) return; // stale — world changed while loading
    state.map.pois = pois;
  } catch (e) { console.error('Failed to load map POIs', e); }

  if (state.ui.activeWorldId !== worldId) return;
  if (state.map.bgUrl) { URL.revokeObjectURL(state.map.bgUrl); state.map.bgUrl = null; }
  state.map.bgScale = 1.0;
  try {
    const res = await fetch(`/api/worlds/${worldId}/map/background`);
    if (state.ui.activeWorldId !== worldId) return; // stale
    if (res.ok) {
      state.map.bgScale = parseFloat(res.headers.get('X-Bg-Scale') || '1.0');
      const blob = await res.blob();
      state.map.bgUrl = URL.createObjectURL(blob);
    }
  } catch (e) { /* no background set */ }
}

async function initMapPage() {
  const worldId = state.ui.activeWorldId;
  if (!worldId) return;

  // Clean up resize handler from any previous map page visit
  if (window._mapResizeHandler) {
    window.removeEventListener('resize', window._mapResizeHandler);
    window._mapResizeHandler = null;
  }

  // Reset ruler, tool, and viewport on page load; bgScale is loaded from server inside loadMapData
  state.map.activeTool = 'interact';
  state.map.ruler      = null;
  state.map.rulerStep  = 0;
  state.map.rulerStart = null;
  state.map.zoom       = 1.0;
  state.map.panX       = 0;
  state.map.panY       = 0;

  await Promise.all([loadPoiTypes(), loadMapData(worldId)]);

  // Sync slider with the scale loaded from the server
  const scaleSlider = document.getElementById('map-bg-scale');
  const scaleVal    = document.getElementById('map-bg-scale-val');
  if (scaleSlider) scaleSlider.value = state.map.bgScale;
  if (scaleVal)    scaleVal.textContent = Math.round(state.map.bgScale * 100) + '%';
  // Set initial zoom so the full bgScale-extended image fits in the canvas
  state.map.zoom = Math.max(0.25, Math.min(4.0, 1.0 / state.map.bgScale));
  const zoomSlider = document.getElementById('map-zoom-slider');
  const zoomVal    = document.getElementById('map-zoom-val');
  if (zoomSlider) zoomSlider.value = Math.round(state.map.zoom * 100);
  if (zoomVal)    zoomVal.textContent = Math.round(state.map.zoom * 100) + '%';
  renderPoiTypeSidebar();
  renderMap();
  renderRuler();
  bindMapCanvasEvents();
  applyAuthUI();

  // Re-render POIs on window resize so image-relative coordinates stay accurate
  // as the container dimensions (and thus letterbox bounds) change.
  let _mapResizeTimer = null;
  window._mapResizeHandler = () => {
    clearTimeout(_mapResizeTimer);
    _mapResizeTimer = setTimeout(renderMapPois, 100);
  };
  window.addEventListener('resize', window._mapResizeHandler);
  const scaleLbl = document.getElementById('map-scale-label');
  if (scaleLbl) {
    const mpc = getMapMilesPerCell();
    scaleLbl.textContent = `1 Feld = ${mpc} Meilen`;
    scaleLbl.dataset.tooltip =
      `zu Fuß               ≈ 3 Meilen/Stunde\n` +
      `zu Pferd             ≈ 5 Meilen/Stunde\n` +
      `mit Kutsche (Straße) ≈ 6 Meilen/Stunde`;
  }
}

function renderPoiTypeSidebar() {
  const el = document.getElementById('map-poi-type-list');
  if (!el) return;
  const canPlace = canEditActiveWorld();
  el.innerHTML = state.map.poiTypes.map(t => `
    <button class="map-tool poi-type-btn" data-type-id="${t.id}"
            onclick="setMapTool('place-${t.id}')"
            ${!canPlace ? 'disabled title="Keine Berechtigung"' : ''}>
      <span class="map-tool-sym">${poiShapeHtml(t.shape, t.icon)}</span> ${escHtml(t.name)}
      ${state.auth.isAdmin ? `<span class="poi-type-edit-link" onclick="event.stopPropagation();openPoiTypeManager(${t.id})" title="Bearbeiten">✎</span>` : ''}
    </button>
  `).join('');
}

function setMapTool(tool) {
  state.map.activeTool = tool;
  if (tool !== 'ruler') {
    state.map.rulerStep  = 0;
    state.map.rulerStart = null;
    state.map.ruler      = null;
    renderRuler();
  }
  document.querySelectorAll('.map-tool').forEach(btn => btn.classList.remove('active'));
  const btnIds = { interact: 'map-tool-interact', edit: 'map-tool-edit', ruler: 'map-tool-ruler' };
  if (btnIds[tool]) {
    document.getElementById(btnIds[tool])?.classList.add('active');
  } else if (tool.startsWith('place-')) {
    const typeId = parseInt(tool.split('-')[1], 10);
    document.querySelector(`.poi-type-btn[data-type-id="${typeId}"]`)?.classList.add('active');
  }
  const wrap = document.getElementById('map-canvas-wrap');
  if (wrap) {
    if      (tool === 'interact')                            wrap.style.cursor = 'grab';
    else if (tool === 'ruler' || tool.startsWith('place-')) wrap.style.cursor = 'crosshair';
    else                                                    wrap.style.cursor = '';
  }
}

function openMapBgUpload() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/worlds/${state.ui.activeWorldId}/map/background`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload fehlgeschlagen (' + res.status + ')');
      if (state.map.bgUrl) { URL.revokeObjectURL(state.map.bgUrl); state.map.bgUrl = null; }
      const bgRes = await fetch(`/api/worlds/${state.ui.activeWorldId}/map/background`);
      if (bgRes.ok) {
        state.map.bgScale = parseFloat(bgRes.headers.get('X-Bg-Scale') || '1.0');
        const scaleSlider = document.getElementById('map-bg-scale');
        const scaleVal    = document.getElementById('map-bg-scale-val');
        if (scaleSlider) scaleSlider.value = state.map.bgScale;
        if (scaleVal)    scaleVal.textContent = Math.round(state.map.bgScale * 100) + '%';
        state.map.bgUrl = URL.createObjectURL(await bgRes.blob());
      }
      renderMap();
    } catch (e) { alert('Fehler beim Hochladen: ' + e.message); }
  };
  input.click();
}

let _bgScaleTimer = null;

function setMapBgScale(scale) {
  state.map.bgScale = scale;
  const val = document.getElementById('map-bg-scale-val');
  if (val) val.textContent = Math.round(scale * 100) + '%';
  const scaleVal2 = scale !== 1.0 ? `scale(${scale})` : '';
  const bgImg = document.getElementById('map-bg-img');
  if (bgImg) bgImg.style.transform = scaleVal2;
  const grid = document.getElementById('map-grid');
  if (grid) grid.style.transform = scaleVal2;

  // Persist after 500 ms of slider inactivity (admin only)
  clearTimeout(_bgScaleTimer);
  _bgScaleTimer = setTimeout(async () => {
    try {
      await api('PATCH', `/worlds/${state.ui.activeWorldId}/map/background/scale`, { scale });
    } catch (e) {
      console.error('[setMapBgScale] save failed', e);
    }
  }, 500);
}

/* ══════════════════════════════════════
   MAP — RENDERING
══════════════════════════════════════ */
function renderMap() {
  const bgImg = document.getElementById('map-bg-img');
  if (bgImg) {
    if (state.map.bgUrl) {
      bgImg.src = state.map.bgUrl;
      bgImg.style.display = '';
      bgImg.style.transform = state.map.bgScale !== 1.0 ? `scale(${state.map.bgScale})` : '';
      // Re-render POIs once the image has loaded so letterbox bounds are accurate
      bgImg.onload = () => renderMapPois();
    } else {
      bgImg.style.display = 'none';
      bgImg.onload = null;
    }
  }
  const grid = document.getElementById('map-grid');
  if (grid) grid.style.transform = state.map.bgScale !== 1.0 ? `scale(${state.map.bgScale})` : '';

  renderMapPois();
  applyMapViewport();
}

/**
 * Re-renders only the POI elements into the POI layer.
 * Called from renderMap and on window resize / image load to keep
 * POI positions accurate after letterbox bounds change.
 */
function renderMapPois() {
  const layer = document.getElementById('map-pois-layer');
  if (!layer) return;
  layer.innerHTML = '';
  layer.style.pointerEvents = 'none';
  for (const poi of state.map.pois) {
    layer.appendChild(buildPoiElement(poi));
  }
}

/**
 * Applies the current zoom and pan transform to the map viewport element.
 */
function applyMapViewport() {
  const vp = document.getElementById('map-viewport');
  if (vp) vp.style.transform = `translate(${state.map.panX}px, ${state.map.panY}px) scale(${state.map.zoom})`;
}

/**
 * Sets the map zoom level, clamped to [0.25, 4.0], and syncs the zoom slider.
 * @param {number} zoom - desired zoom level as a multiplier (1.0 = 100%)
 */
function setMapZoom(zoom) {
  state.map.zoom = Math.max(0.25, Math.min(4.0, zoom));
  const slider = document.getElementById('map-zoom-slider');
  const val    = document.getElementById('map-zoom-val');
  if (slider) slider.value = Math.round(state.map.zoom * 100);
  if (val)    val.textContent = Math.round(state.map.zoom * 100) + '%';
  applyMapViewport();
}

/**
 * Returns the rendered image bounds as fractions of the map-canvas-wrap,
 * accounting for object-fit:contain letterboxing.
 * Falls back to {x:0,y:0,w:1,h:1} (full container) when the image is not loaded.
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function getImageBoundsInViewport() {
  const img  = document.getElementById('map-bg-img');
  const wrap = document.getElementById('map-canvas-wrap');
  if (!img || !img.naturalWidth || !img.naturalHeight || !wrap) {
    console.debug('[getImageBoundsInViewport] ← fallback (image not loaded), naturalW=%o naturalH=%o', img?.naturalWidth, img?.naturalHeight);
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const cW = wrap.clientWidth;
  const cH = wrap.clientHeight;
  if (!cW || !cH) {
    console.debug('[getImageBoundsInViewport] ← fallback (canvas not sized), cW=%o cH=%o', cW, cH);
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const imgA = img.naturalWidth / img.naturalHeight;
  const cA   = cW / cH;
  let imgW, imgH, imgX, imgY;
  if (cA > imgA) {
    // Container wider than image: letterbox left/right
    imgH = cH; imgW = cH * imgA; imgX = (cW - imgW) / 2; imgY = 0;
  } else {
    // Container taller than image: letterbox top/bottom
    imgW = cW; imgH = cW / imgA; imgX = 0; imgY = (cH - imgH) / 2;
  }
  const ib = { x: imgX / cW, y: imgY / cH, w: imgW / cW, h: imgH / cH };
  console.debug('[getImageBoundsInViewport] canvas=%ox%o img=%ox%o ib=', cW, cH, img.naturalWidth, img.naturalHeight, ib);
  return ib;
}

/**
 * Converts screen coordinates to map percentage position relative to the image,
 * accounting for zoom, pan, and object-fit:contain letterboxing.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ xPct: number, yPct: number }}
 */
function screenToMapPct(clientX, clientY) {
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return { xPct: 0, yPct: 0 };
  const rect   = wrap.getBoundingClientRect();
  const ib     = getImageBoundsInViewport();
  const cxFrac = 0.5 + (clientX - rect.left - rect.width  / 2 - state.map.panX) / (rect.width  * state.map.zoom);
  const cyFrac = 0.5 + (clientY - rect.top  - rect.height / 2 - state.map.panY) / (rect.height * state.map.zoom);
  const result = { xPct: (cxFrac - ib.x) / ib.w, yPct: (cyFrac - ib.y) / ib.h };
  console.debug('[screenToMapPct] click=(%o,%o) rect=%ox%o zoom=%o pan=(%o,%o) cFrac=(%o,%o) →', clientX, clientY, rect.width, rect.height, state.map.zoom, state.map.panX, state.map.panY, cxFrac, cyFrac, result);
  return result;
}

function buildPoiElement(poi) {
  const wrap = document.createElement('div');
  const gc = gesinnungClass(poi.gesinnung);
  wrap.className = 'map-poi' + (gc ? ' ' + gc : '');
  wrap.dataset.poiId = poi.id;
  const ib = getImageBoundsInViewport();
  const leftPct  = (ib.x + poi.xPct * ib.w) * 100;
  const topPct   = (ib.y + poi.yPct * ib.h) * 100;
  console.debug('[buildPoiElement] poi#%o stored=(%o,%o) ib=', poi.id, poi.xPct, poi.yPct, ib, '→ left=%o% top=%o%', leftPct, topPct);
  wrap.style.left = leftPct + '%';
  wrap.style.top  = topPct  + '%';
  wrap.style.pointerEvents = 'auto';

  if (poi.poiTypeShape === 'TEXT') {
    // TEXT POI: no icon pin, just styled text centered on the placed point
    wrap.classList.add('map-poi--text');
    if (poi.label) {
      const linked = wikiLinkCheck(poi.label, state.ui.activeWorldId);
      const txt = document.createElement('span');
      txt.className   = 'map-poi-text' + (linked ? ' wiki-linked' : '');
      txt.textContent = poi.label;
      if (poi.textBold)   txt.style.fontWeight = 'bold';
      if (poi.textItalic) txt.style.fontStyle  = 'italic';
      if (poi.textSize)   txt.style.fontSize   = poi.textSize + 'px';
      if (linked) {
        const entry = state.wikiTitles.find(w =>
          w.worldId === state.ui.activeWorldId && w.title.toLowerCase() === poi.label.trim().toLowerCase()
        );
        if (entry) {
          txt.dataset.wikiId    = entry.id;
          txt.dataset.wikiTitle = entry.title;
        }
        txt.title = 'Wiki-Artikel öffnen';
        txt.addEventListener('click', e => {
          e.stopPropagation();
          if (entry) openWikiFromEvent(entry.id);
        });
      }
      wrap.appendChild(txt);
    }
  } else {
    // Standard POI: icon pin + optional label below
    const icon = document.createElement('span');
    icon.className = 'map-poi-pin';
    icon.innerHTML = poiShapeHtml(poi.poiTypeShape, poi.poiTypeIcon);
    wrap.appendChild(icon);

    if (poi.label) {
      const linked = wikiLinkCheck(poi.label, state.ui.activeWorldId);
      const lbl = document.createElement('span');
      lbl.className   = 'map-poi-label' + (linked ? ' wiki-linked' : '');
      lbl.textContent = poi.label;
      if (linked) {
        const entry = state.wikiTitles.find(w =>
          w.worldId === state.ui.activeWorldId && w.title.toLowerCase() === poi.label.trim().toLowerCase()
        );
        if (entry) {
          lbl.dataset.wikiId    = entry.id;
          lbl.dataset.wikiTitle = entry.title;
        }
        lbl.title = 'Wiki-Artikel öffnen';
        lbl.addEventListener('click', e => {
          e.stopPropagation();
          if (entry) openWikiFromEvent(entry.id);
        });
      }
      wrap.appendChild(lbl);
    }
  }

  wrap.addEventListener('click', e => {
    e.stopPropagation();
    if (state.map.activeTool === 'edit') openPoiDialog(poi.id);
  });

  attachPoiDrag(wrap, poi);
  return wrap;
}

function gesinnungClass(g) {
  if (g === 'FRIENDLY') return 'poi-friendly';
  if (g === 'HOSTILE')  return 'poi-hostile';
  if (g === 'NEUTRAL')  return 'poi-neutral';
  return '';
}

function wikiLinkCheck(label, worldId) {
  if (!label || !state.wikiTitles || !state.wikiTitles.length) return false;
  const lower = label.toLowerCase();
  return state.wikiTitles.some(e => e.worldId === worldId && e.title.toLowerCase() === lower);
}

function bindMapCanvasEvents() {
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap || wrap._mapBound) return;
  wrap._mapBound = true;

  // Left-click: ruler or POI placement, using zoom/pan-aware coordinate conversion
  wrap.addEventListener('click', e => {
    if (e.target.closest('.map-poi')) return;
    const { xPct, yPct } = screenToMapPct(e.clientX, e.clientY);

    if (state.map.activeTool === 'ruler') {
      handleRulerClick(xPct, yPct);
    } else if (state.map.activeTool.startsWith('place-')) {
      if (!isFinite(xPct) || !isFinite(yPct)) return;
      state.map.pendingX = xPct;
      state.map.pendingY = yPct;
      openPoiDialog(null);
    }
  });

  // Right-click: suppress context menu; cancel ruler or start pan drag
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (state.map.activeTool === 'ruler') {
      state.map.rulerStep  = 0;
      state.map.rulerStart = null;
      renderRuler();
    }
  });

  // Right-click drag: pan the viewport
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 2) return;
    e.preventDefault();
    const startX    = e.clientX;
    const startY    = e.clientY;
    const startPanX = state.map.panX;
    const startPanY = state.map.panY;
    wrap.style.cursor = 'grabbing';

    function onPanMove(e) {
      state.map.panX = startPanX + (e.clientX - startX);
      state.map.panY = startPanY + (e.clientY - startY);
      applyMapViewport();
    }

    function onPanUp() {
      document.removeEventListener('mousemove', onPanMove);
      document.removeEventListener('mouseup',   onPanUp);
      // Restore cursor based on active tool
      const tool = state.map.activeTool;
      wrap.style.cursor = (tool === 'ruler' || tool.startsWith('place-')) ? 'crosshair' : 'grab';
    }

    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup',   onPanUp);
  });

  // Mouse wheel: zoom in/out
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setMapZoom(state.map.zoom + delta);
  }, { passive: false });
}

/* ══════════════════════════════════════
   MAP — POI DRAG
══════════════════════════════════════ */
function attachPoiDrag(el, poi) {
  const canEdit = state.auth.isAdmin || poi.createdByUserId === state.auth.userId;
  if (!canEdit) return;

  let dragging = false;
  let startX, startY, origLeft, origTop;

  el.addEventListener('mousedown', e => {
    if (state.map.activeTool !== 'interact') return;
    e.preventDefault();
    dragging = false;
    startX    = e.clientX;
    startY    = e.clientY;
    origLeft  = el.style.left;
    origTop   = el.style.top;

    function onMove(e) {
      const wrap = document.getElementById('map-canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dragging = true;
      if (!dragging) return;
      const newX = (parseFloat(origLeft) / 100) + dx / (rect.width  * state.map.zoom);
      const newY = (parseFloat(origTop)  / 100) + dy / (rect.height * state.map.zoom);
      el.style.left = newX * 100 + '%';
      el.style.top  = newY * 100 + '%';
    }

    async function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      if (!dragging) return;
      const wrap = document.getElementById('map-canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newCxFrac = (parseFloat(origLeft) / 100) + dx / (rect.width  * state.map.zoom);
      const newCyFrac = (parseFloat(origTop)  / 100) + dy / (rect.height * state.map.zoom);
      const ib = getImageBoundsInViewport();
      const newX = (newCxFrac - ib.x) / ib.w;
      const newY = (newCyFrac - ib.y) / ib.h;
      try {
        const updated = await api('PUT', `/worlds/${state.ui.activeWorldId}/map/pois/${poi.id}`, { xPct: newX, yPct: newY });
        const idx = state.map.pois.findIndex(p => p.id === poi.id);
        if (idx >= 0) state.map.pois[idx] = updated;
        renderMap();
      } catch (ex) {
        el.style.left = origLeft;
        el.style.top  = origTop;
        alert('Fehler beim Verschieben: ' + ex.message);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

/* ══════════════════════════════════════
   MAP — POI DIALOG
══════════════════════════════════════ */
function openPoiDialog(poiId) {
  state.map.editPoiId = poiId;

  const modal     = document.getElementById('poi-modal');
  const title     = document.getElementById('poi-modal-title');
  const gesGrp    = document.getElementById('poi-gesinnung-grp');
  const delBtn    = document.getElementById('poi-delete-btn');
  const errEl     = document.getElementById('poi-modal-err');
  const wikiHint  = document.getElementById('poi-wiki-hint');
  const labelInp  = document.getElementById('poi-label-inp');

  if (!modal) return;
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (wikiHint) wikiHint.style.display = 'none';

  const textGrp   = document.getElementById('poi-text-grp');
  const boldInp   = document.getElementById('poi-text-bold');
  const italicInp = document.getElementById('poi-text-italic');
  const sizeInp   = document.getElementById('poi-text-size');

  if (poiId) {
    const poi  = state.map.pois.find(p => p.id === poiId);
    if (!poi) return;
    const type   = state.map.poiTypes.find(t => t.id === poi.poiTypeId);
    const isText = type?.shape === 'TEXT';
    title.textContent = (type ? type.icon + ' ' + type.name : 'POI') + ' bearbeiten';
    if (labelInp) labelInp.value = poi.label || '';
    state.map.selectedGesinnung = poi.gesinnung || null;
    if (gesGrp)  gesGrp.style.display  = type?.hasGesinnung ? '' : 'none';
    if (textGrp) textGrp.style.display = isText ? '' : 'none';
    if (isText) {
      if (boldInp)   boldInp.checked = poi.textBold   ?? false;
      if (italicInp) italicInp.checked = poi.textItalic ?? false;
      if (sizeInp)   sizeInp.value   = poi.textSize   ?? 14;
    }
    const canDelete = state.auth.isAdmin || canDeleteActiveWorld();
    if (delBtn) delBtn.style.display = canDelete ? '' : 'none';
  } else {
    const typeId = parseInt(state.map.activeTool.split('-')[1], 10);
    const type   = state.map.poiTypes.find(t => t.id === typeId);
    const isText = type?.shape === 'TEXT';
    title.textContent = (type ? type.icon + ' ' + type.name : 'POI') + ' platzieren';
    if (labelInp) labelInp.value = '';
    state.map.selectedGesinnung = null;
    if (gesGrp)  gesGrp.style.display  = type?.hasGesinnung ? '' : 'none';
    if (textGrp) textGrp.style.display = isText ? '' : 'none';
    if (isText) {
      if (boldInp)   boldInp.checked   = false;
      if (italicInp) italicInp.checked = false;
      if (sizeInp)   sizeInp.value     = 14;
    }
    if (delBtn) delBtn.style.display = 'none';
  }

  updateGesinnungButtons();

  if (labelInp) {
    labelInp.oninput = () => {
      const linked = wikiLinkCheck(labelInp.value.trim(), state.ui.activeWorldId);
      if (wikiHint) wikiHint.style.display = linked ? '' : 'none';
    };
  }

  modal.classList.add('open');
  if (labelInp) labelInp.focus();
}

function updateGesinnungButtons() {
  document.querySelectorAll('.poi-gesinnung-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === state.map.selectedGesinnung);
  });
}

function selectGesinnung(value) {
  state.map.selectedGesinnung = state.map.selectedGesinnung === value ? null : value;
  updateGesinnungButtons();
}

function closePoiModal() {
  const modal = document.getElementById('poi-modal');
  if (modal) modal.classList.remove('open');
  state.map.editPoiId  = null;
  state.map.pendingX   = null;
  state.map.pendingY   = null;
}

async function savePoiModal() {
  const errEl   = document.getElementById('poi-modal-err');
  const labelInp = document.getElementById('poi-label-inp');
  const label   = labelInp ? labelInp.value.trim() : '';

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  try {
    if (state.map.editPoiId) {
      const poi    = state.map.pois.find(p => p.id === state.map.editPoiId);
      const type   = poi ? state.map.poiTypes.find(t => t.id === poi.poiTypeId) : null;
      const isText = type?.shape === 'TEXT';
      const body   = { label: label || null };
      if (type?.hasGesinnung) body.gesinnung = state.map.selectedGesinnung || null;
      if (isText) {
        body.textBold   = document.getElementById('poi-text-bold')?.checked   ?? false;
        body.textItalic = document.getElementById('poi-text-italic')?.checked ?? false;
        body.textSize   = parseInt(document.getElementById('poi-text-size')?.value || '14', 10);
      }
      const updated = await api('PUT', `/worlds/${state.ui.activeWorldId}/map/pois/${state.map.editPoiId}`, body);
      const idx = state.map.pois.findIndex(p => p.id === state.map.editPoiId);
      if (idx >= 0) state.map.pois[idx] = updated;
    } else {
      if (state.map.pendingX == null || state.map.pendingY == null ||
          !isFinite(state.map.pendingX) || !isFinite(state.map.pendingY)) {
        if (errEl) { errEl.textContent = 'Fehler: Position fehlt – bitte erneut auf die Karte klicken.'; errEl.style.display = ''; }
        return;
      }
      const typeId = parseInt(state.map.activeTool.split('-')[1], 10);
      const type   = state.map.poiTypes.find(t => t.id === typeId);
      const isText = type?.shape === 'TEXT';
      const body = {
        poiTypeId: typeId,
        xPct:      state.map.pendingX,
        yPct:      state.map.pendingY,
        label:     label || null,
        gesinnung: (type?.hasGesinnung && state.map.selectedGesinnung) ? state.map.selectedGesinnung : null,
      };
      if (isText) {
        body.textBold   = document.getElementById('poi-text-bold')?.checked   ?? false;
        body.textItalic = document.getElementById('poi-text-italic')?.checked ?? false;
        body.textSize   = parseInt(document.getElementById('poi-text-size')?.value || '14', 10);
      }
      const created = await api('POST', `/worlds/${state.ui.activeWorldId}/map/pois`, body);
      state.map.pois.push(created);
      setMapTool('interact');
    }
    closePoiModal();
    renderMap();
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ''; }
  }
}

async function deleteCurrentPoi() {
  if (!state.map.editPoiId) return;
  if (!confirm('POI wirklich löschen?')) return;
  try {
    await api('DELETE', `/worlds/${state.ui.activeWorldId}/map/pois/${state.map.editPoiId}`);
    state.map.pois = state.map.pois.filter(p => p.id !== state.map.editPoiId);
    closePoiModal();
    renderMap();
  } catch (e) { alert('Fehler: ' + e.message); }
}

/* ══════════════════════════════════════
   MAP — RULER TOOL
══════════════════════════════════════ */
const MAP_CELL_PX = 44;

/** Returns the miles-per-cell scale for the active world (default 5). */
function getMapMilesPerCell() {
  const world = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return (world?.milesPerCell) || 5;
}

function handleRulerClick(xPct, yPct) {
  if (state.map.rulerStep === 0) {
    state.map.rulerStart = { x: xPct, y: yPct };
    state.map.rulerStep  = 1;
    state.map.ruler      = null;
    renderRuler();
  } else {
    const wrap = document.getElementById('map-canvas-wrap');
    if (!wrap) return;
    const rect  = wrap.getBoundingClientRect();
    const dx    = (xPct - state.map.rulerStart.x) * rect.width;
    const dy    = (yPct - state.map.rulerStart.y) * rect.height;
    const miles = (Math.sqrt(dx * dx + dy * dy) / (MAP_CELL_PX * state.map.bgScale)) * getMapMilesPerCell();
    state.map.ruler      = { x1: state.map.rulerStart.x, y1: state.map.rulerStart.y, x2: xPct, y2: yPct, miles };
    state.map.rulerStep  = 0;
    state.map.rulerStart = null;
    renderRuler();
  }
}

function renderRuler() {
  const svg = document.getElementById('map-ruler-svg');
  if (!svg) return;
  // Remove all children except <defs>
  Array.from(svg.childNodes).forEach(n => { if (n.tagName !== 'defs') svg.removeChild(n); });

  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();

  // Waiting for second click — show start dot
  if (state.map.rulerStep === 1 && state.map.rulerStart) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', state.map.rulerStart.x * rect.width);
    c.setAttribute('cy', state.map.rulerStart.y * rect.height);
    c.setAttribute('r',  5);
    c.setAttribute('fill', 'var(--gold)');
    c.setAttribute('opacity', '0.85');
    svg.appendChild(c);
    return;
  }

  if (!state.map.ruler) return;
  const { x1, y1, x2, y2, miles } = state.map.ruler;
  const px1 = x1 * rect.width,  py1 = y1 * rect.height;
  const px2 = x2 * rect.width,  py2 = y2 * rect.height;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', px1); line.setAttribute('y1', py1);
  line.setAttribute('x2', px2); line.setAttribute('y2', py2);
  line.setAttribute('stroke', 'var(--gold)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-dasharray', '6 3');
  line.setAttribute('marker-start', 'url(#ruler-dot)');
  line.setAttribute('marker-end',   'url(#ruler-dot)');
  svg.appendChild(line);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', (px1 + px2) / 2);
  text.setAttribute('y', (py1 + py2) / 2 - 8);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', 'var(--gold)');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-weight', 'bold');
  text.textContent = miles < 10
    ? miles.toFixed(1) + ' Meilen'
    : Math.round(miles) + ' Meilen';
  svg.appendChild(text);
}

/* ══════════════════════════════════════
   MAP — POI TYPE MANAGER (Admin)
══════════════════════════════════════ */
const POI_ICON_PALETTE = ['⭐','●','?','▲','🏰','⛪','🌲','🌊','🏔','🗡','💀','🔥','🏺','💎','🐉','🚢','🌙','☀','🌿'];

/**
 * Returns the inner HTML for a POI symbol — inline SVG for shaped types, escaped emoji for ICON.
 * @param {string} shape  - 'STAR', 'CIRCLE', 'TRIANGLE', 'QUESTION', or 'ICON'
 * @param {string} icon   - emoji fallback used when shape is 'ICON'
 */
function poiShapeHtml(shape, icon) {
  switch (shape) {
    case 'STAR':
      return `<svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg"><polygon points="14,3 16.9,10 24.5,10.6 18.8,15.6 20.5,22.9 14,19 7.5,22.9 9.2,15.6 3.5,10.6 11.1,10" fill="currentColor"/></svg>`;
    case 'CIRCLE':
      return `<svg viewBox="0 0 28 28" width="17" height="17" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="11" fill="currentColor"/></svg>`;
    case 'TRIANGLE':
      return `<svg viewBox="0 0 28 28" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><polygon points="14,3 25,23 3,23" fill="currentColor"/></svg>`;
    case 'QUESTION':
      return `<svg viewBox="0 0 28 28" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><text x="14" y="21" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">?</text></svg>`;
    default:
      return escHtml(icon || '●');
  }
}

function openPoiTypeManager(editTypeId) {
  const modal      = document.getElementById('poi-type-modal');
  const title      = document.getElementById('poi-type-modal-title');
  const nameInp    = document.getElementById('ptm-name');
  const iconCustom = document.getElementById('ptm-icon-custom');
  const hasGes     = document.getElementById('ptm-has-gesinnung');
  const hasLbl     = document.getElementById('ptm-has-label');
  const delBtn     = document.getElementById('ptm-delete-btn');
  const palette    = document.getElementById('ptm-icon-palette');

  if (!modal || !title) return;

  if (palette) {
    palette.innerHTML = POI_ICON_PALETTE.map(ic =>
      `<button class="ptm-icon-chip" data-icon="${ic}" onclick="selectPtmIcon('${ic}')" title="${ic}">${ic}</button>`
    ).join('');
  }

  if (editTypeId) {
    const t = state.map.poiTypes.find(x => x.id === editTypeId);
    if (!t) return;
    modal.dataset.editTypeId = editTypeId;
    title.textContent        = t.name + ' bearbeiten';
    if (nameInp)    nameInp.value    = t.name;
    if (iconCustom) iconCustom.value = POI_ICON_PALETTE.includes(t.icon) ? '' : t.icon;
    if (hasGes)     hasGes.checked   = t.hasGesinnung;
    if (hasLbl)     hasLbl.checked   = t.hasLabel;
    selectPtmShape(t.shape || 'ICON');
    selectPtmIcon(t.icon);
    if (delBtn) delBtn.style.display = t.isDefault ? 'none' : '';
  } else {
    delete modal.dataset.editTypeId;
    title.textContent = 'POI-Typ anlegen';
    if (nameInp)    nameInp.value    = '';
    if (iconCustom) iconCustom.value = '';
    if (hasGes)     hasGes.checked   = true;
    if (hasLbl)     hasLbl.checked   = true;
    if (palette)    palette.querySelectorAll('.ptm-icon-chip').forEach(b => b.classList.remove('active'));
    selectPtmShape('ICON');
    if (delBtn)     delBtn.style.display = 'none';
  }

  modal.classList.add('open');
  if (nameInp) nameInp.focus();
}

function selectPtmShape(shape) {
  document.querySelectorAll('.ptm-shape-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.shape === shape);
  });
  const iconGrp = document.getElementById('ptm-icon-grp');
  if (iconGrp) iconGrp.style.display = shape === 'ICON' ? '' : 'none';
}

function selectPtmIcon(icon) {
  document.querySelectorAll('.ptm-icon-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.icon === icon);
  });
  // If it's a custom icon, clear the chip selection and populate the custom field
  const iconCustom = document.getElementById('ptm-icon-custom');
  if (iconCustom && !POI_ICON_PALETTE.includes(icon)) iconCustom.value = icon;
}

function closePoiTypeModal() {
  const modal = document.getElementById('poi-type-modal');
  if (modal) modal.classList.remove('open');
}

async function savePoiTypeModal() {
  const modal      = document.getElementById('poi-type-modal');
  const nameInp    = document.getElementById('ptm-name');
  const iconCustom = document.getElementById('ptm-icon-custom');
  const hasGes     = document.getElementById('ptm-has-gesinnung');
  const hasLbl     = document.getElementById('ptm-has-label');

  const name = nameInp?.value.trim();
  if (!name) { alert('Bitte einen Namen eingeben.'); return; }

  const selectedChip  = document.querySelector('.ptm-icon-chip.active');
  const icon          = selectedChip ? selectedChip.dataset.icon : (iconCustom?.value.trim() || '●');
  const selectedShape = document.querySelector('.ptm-shape-chip.active')?.dataset.shape || 'ICON';

  const body = {
    name,
    icon,
    shape:        selectedShape,
    hasGesinnung: hasGes?.checked ?? true,
    hasLabel:     hasLbl?.checked ?? true,
  };

  try {
    const editTypeId = modal?.dataset.editTypeId ? parseInt(modal.dataset.editTypeId, 10) : null;
    let result;
    if (editTypeId) {
      result = await api('PUT', `/poi-types/${editTypeId}`, body);
      const idx = state.map.poiTypes.findIndex(t => t.id === editTypeId);
      if (idx >= 0) state.map.poiTypes[idx] = result;
    } else {
      result = await api('POST', '/poi-types', body);
      state.map.poiTypes.push(result);
    }
    closePoiTypeModal();
    renderPoiTypeSidebar();
    renderMap();
  } catch (e) { alert('Fehler: ' + e.message); }
}

async function deletePoiType() {
  const modal      = document.getElementById('poi-type-modal');
  const editTypeId = modal?.dataset.editTypeId ? parseInt(modal.dataset.editTypeId, 10) : null;
  if (!editTypeId) return;
  if (!confirm('POI-Typ wirklich löschen? Bestehende POIs dieses Typs bleiben erhalten.')) return;
  try {
    await api('DELETE', `/poi-types/${editTypeId}`);
    state.map.poiTypes = state.map.poiTypes.filter(t => t.id !== editTypeId);
    closePoiTypeModal();
    renderPoiTypeSidebar();
  } catch (e) { alert('Fehler: ' + e.message); }
}
