/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const state = {
  worlds: [],
  events: [],
  undated: [],
  items: [],
  creators: {},
  auth: { isAdmin: false, username: null },
  ui: {
    activeWorldId: null,
    activeTags: new Set(),
    activeCreators: new Set(),
    activeTypes: new Set(),
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
  }
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

function showPage(p) {
  state.ui.currentPage = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  if (p !== 'timeline') closeDetail();
  if (p === 'items') renderItems();
}

/* ══════════════════════════════════════
   ADMIN VISIBILITY
══════════════════════════════════════ */
function updateAdminVisibility() {
  const isAdmin = state.auth.isAdmin;
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  const btnLogin  = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const navUser   = document.getElementById('nav-user');

  if (isAdmin) {
    if (btnLogin)  btnLogin.style.display  = 'none';
    if (btnLogout) btnLogout.style.display = '';
    if (navUser) {
      navUser.style.display = '';
      navUser.textContent   = state.auth.username || '';
    }
  } else {
    if (btnLogin)  btnLogin.style.display  = '';
    if (btnLogout) btnLogout.style.display = 'none';
    if (navUser)   navUser.style.display   = 'none';
  }
}

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
    return `<button class="world-btn${isActive ? ' active' : ''}" onclick="selectWorld(${w.id})">
      <span>${escHtml(w.name)}</span>${editBtns}
    </button>`;
  }).join('');
}

async function selectWorld(worldId) {
  state.ui.activeWorldId = worldId;
  localStorage.setItem('activeWorldId', worldId);
  state.events  = [];
  state.undated = [];
  state.ui.activeTags    = new Set();
  state.ui.activeCreators = new Set();
  state.ui.activeTypes   = new Set();

  try {
    const [events, undated] = await Promise.all([
      api('GET', `/worlds/${worldId}/events`),
      api('GET', `/worlds/${worldId}/events/unpositioned`),
    ]);
    state.events  = events;
    state.undated = undated;
  } catch (e) {
    console.error('Failed to load world events', e);
  }
  renderTimeline();
  renderWorldSelector();
}

/* ══════════════════════════════════════
   TIMELINE
══════════════════════════════════════ */
function isVisible(ev) {
  if (state.ui.activeTags.size > 0 && !ev.tags.some(t => state.ui.activeTags.has(t))) return false;
  if (state.ui.activeCreators.size > 0 && !state.ui.activeCreators.has(ev.creatorCode)) return false;
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
    renderCreatorList();
    renderUndated();
    return;
  }

  const isAdmin = state.auth.isAdmin;
  const groups = groupEvents(state.events);
  let html = '';

  groups.forEach((grp, gi) => {
    const side = gi % 2 === 0 ? 'right' : 'left';
    let predecessorId = null;
    if (gi > 0) {
      const prev = groups[gi - 1];
      predecessorId = prev.type === 'single' ? prev.event.id : prev.events[prev.events.length - 1].id;
    }
    const predStr = predecessorId !== null ? predecessorId : 'null';

    if (isAdmin) {
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
      const dragAttrs = isAdmin ? `draggable="true" ondragstart="onTLDragStart(event,${ev.id})" ondragend="onTLDragEnd(event)"` : '';
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
        const dragAttrs = isAdmin ? `draggable="true" ondragstart="onTLDragStart(event,${ev.id})" ondragend="onTLDragEnd(event)"` : '';
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

  // Final rope gap (after all events)
  const lastPredecessor = state.events.length > 0 ? state.events[state.events.length - 1].id : null;
  const lastPredStr = lastPredecessor !== null ? lastPredecessor : 'null';
  if (isAdmin) {
    html += `<div class="rope-gap" data-gap="${groups.length}" data-predecessor="${lastPredStr}" onclick="onRopeClick(event,${lastPredStr})"><div class="rope-gap-hint">✦ Hier eintragen</div></div>`;
  } else {
    html += `<div class="rope-gap" style="pointer-events:none"></div>`;
  }

  tl.innerHTML = html;
  tl.classList.toggle('compact', state.ui.compact);

  // Wire drag-over for rope gaps (admin only)
  if (isAdmin) {
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
  renderCreatorList();
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

/* ══════════════════════════════════════
   FILTERS
══════════════════════════════════════ */
function renderTagList() {
  const counts = allTagCounts();
  document.getElementById('tag-list').innerHTML =
    Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `<button class="tag-fb${state.ui.activeTags.has(t) ? ' on' : ''}" onclick="toggleTag('${escHtml(t)}')">${escHtml(t)}<span class="tag-count">${c}</span></button>`)
    .join('');
}

function renderCreatorList() {
  const used = [...new Set(state.events.map(e => e.creatorCode).filter(Boolean))];
  document.getElementById('creator-list').innerHTML = used.map(c => {
    const cr = state.creators[c] || { name: c, color: '#888' };
    return `<button class="creator-fb${state.ui.activeCreators.has(c) ? ' on' : ''}" onclick="toggleCreator('${escHtml(c)}')">
      <span class="creator-nm">${escHtml(cr.name || c)}</span>
    </button>`;
  }).join('');
}

function toggleTag(t)     { state.ui.activeTags.has(t) ? state.ui.activeTags.delete(t) : state.ui.activeTags.add(t); renderTimeline(); }
function clearTags()      { state.ui.activeTags.clear(); renderTimeline(); }
function toggleCreator(c) { state.ui.activeCreators.has(c) ? state.ui.activeCreators.delete(c) : state.ui.activeCreators.add(c); renderTimeline(); }
function clearCreators()  { state.ui.activeCreators.clear(); renderTimeline(); }

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
  const isAdmin = state.auth.isAdmin;
  el.innerHTML = state.undated.map(ev => {
    const cr    = state.creators[ev.creatorCode] || { name: ev.creatorCode || '?', color: '#888' };
    const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'undated';
    const draggable = isAdmin ? 'draggable="true"' : '';
    return `<div class="undated-card${isAct ? ' active' : ''}"
              ${draggable}
              data-uid="${ev.id}"
              onmousedown="onUndatedMouseDown(event)"
              ondragstart="onUndatedDragStart(event,${ev.id})"
              ondragend="onUndatedDragEnd(event)"
              onclick="onUndatedClick(event,${ev.id})">
      <div class="undated-ttl">${escHtml(ev.title)}</div>
      <div class="undated-tags">${(ev.tags || []).map(t => '<span class="undated-tag">' + escHtml(t) + '</span>').join('')}</div>
      <div class="undated-cr"><div class="undated-av" style="background:${escHtml(cr.color || '#888')}">${escHtml(ev.creatorCode || '?')}</div>${escHtml(cr.name || ev.creatorCode || '?')}</div>
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
  if (!state.auth.isAdmin) { e.preventDefault(); return; }
  didDrag = true;
  state.ui.dragId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  setTimeout(() => {
    const card = document.querySelector('.undated-card[data-uid="' + id + '"]');
    if (card) card.classList.add('dragging');
  }, 0);
}

function onUndatedDragEnd(e) {
  state.ui.dragId = null;
  document.querySelectorAll('.undated-card.dragging').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.rope-gap.drop-over').forEach(g => g.classList.remove('drop-over'));
}

function onTLDragStart(e, id) {
  if (!state.auth.isAdmin) { e.preventDefault(); return; }
  state.ui.dragId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  const target = e.target.closest('.event-card, .group-ev-item');
  if (target) setTimeout(() => target.classList.add('tl-dragging'), 0);
}

function onTLDragEnd(e) {
  state.ui.dragId = null;
  document.querySelectorAll('.tl-dragging').forEach(c => c.classList.remove('tl-dragging'));
  document.querySelectorAll('.rope-gap.drop-over').forEach(g => g.classList.remove('drop-over'));
}

function onUndatedClick(e, id) {
  const dx = Math.abs(e.clientX - mouseDownX);
  const dy = Math.abs(e.clientY - mouseDownY);
  if (didDrag || dx > 6 || dy > 6) return;
  e.stopPropagation();
  if (state.ui.detailId === id && state.ui.detailSource === 'undated') { closeDetail(); return; }
  populateDetail(id, 'undated');
  openDetailPanel();
}

/* ══════════════════════════════════════
   ROPE CLICK
══════════════════════════════════════ */
function onRopeClick(e, afterEventId) {
  if (state.ui.dragId !== null) return;
  if (!state.auth.isAdmin) return;
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
  if (state.ui.detailId === id && state.ui.detailSource === 'tl') { closeDetail(); return; }
  populateDetail(id, 'tl');
  openDetailPanel();
}

function populateDetail(id, source) {
  const ev = (source === 'undated' ? state.undated : state.events).find(x => x.id === id);
  if (!ev) return;
  state.ui.detailId     = id;
  state.ui.detailSource = source;
  const cr      = state.creators[ev.creatorCode] || { name: ev.creatorCode || '?', color: '#888' };
  const dateLbl = source === 'undated' ? 'Datum unbekannt' : (ev.displayDate || '');
  document.getElementById('dp-title').textContent = ev.title;
  document.getElementById('dp-date').textContent  = dateLbl;
  const descEl = document.getElementById('dp-desc');
  if (ev.description && ev.description.trim()) {
    descEl.innerHTML = renderDesc(ev.description);
    descEl.className = 'detail-desc';
  } else {
    descEl.textContent = 'Noch keine Beschreibung eingetragen.';
    descEl.className   = 'detail-desc empty';
  }
  document.getElementById('dp-tags').innerHTML = (ev.tags || []).map(t => '<span class="detail-tag">' + escHtml(t) + '</span>').join('');
  const charsEl = document.getElementById('dp-chars');
  if (charsEl) {
    if (ev.characters && ev.characters.length > 0) {
      charsEl.innerHTML = '<div style="font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:5px">Charaktere</div>' +
        ev.characters.map(c => '<span class="detail-tag" style="color:var(--gold2);border-color:rgba(200,168,75,.38)">' + escHtml(c) + '</span>').join(' ');
      charsEl.style.display = '';
    } else {
      charsEl.style.display = 'none';
    }
  }
  document.getElementById('dp-meta').innerHTML = `
    <div class="detail-type"><div class="detail-type-dot ${escHtml(ev.type)}"></div>${ev.type === 'world' ? 'Weltereignis' : 'Lokales Ereignis'}</div>
    <div class="detail-creator">${escHtml(cr.name || ev.creatorCode || '?')}</div>`;

  const dpEdit = document.getElementById('dp-edit');
  const dpDel  = document.getElementById('dp-del');
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
  ['f-ti','f-tg','f-cr','f-chars'].forEach(id => document.getElementById(id).value = '');
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
  document.getElementById('f-cr').value    = ev.creatorCode || '';
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

function openAddWorldModal() {
  editWorldId = null; editSource = 'world';
  document.getElementById('m-title').textContent = 'Welt hinzufügen';
  showForms(false, false, false, false, true, false);
  setSaveBtn('Erstellen', false);
  document.getElementById('fw-n').value = '';
  document.getElementById('fw-d').value = '';
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
  document.getElementById('fw-n').value = w.name || '';
  document.getElementById('fw-d').value = w.description || '';
  openModal();
}

function openDeleteWorldConfirm(worldId, e) {
  if (e) e.stopPropagation();
  const w = state.worlds.find(x => x.id === worldId);
  if (!w) return;
  editWorldId = worldId; editSource = 'world-del';
  document.getElementById('m-title').textContent = 'Welt löschen';
  document.getElementById('del-txt').innerHTML =
    'Soll die Welt <span class="del-confirm-name">„' + escHtml(w.name) + '"</span> und alle darin enthaltenen Ereignisse wirklich entfernt werden?';
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
      isAdmin: result.admin || result.isAdmin || false,
      username: result.username || null
    };
    hideLoginModal();
    updateAdminVisibility();
    renderTimeline();
    renderItems();
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
  state.auth = { isAdmin: false, username: null };
  updateAdminVisibility();
  renderTimeline();
  renderItems();
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
    const name = document.getElementById('fw-n').value.trim();
    const desc = document.getElementById('fw-d').value.trim();
    if (!name) { alert('Weltname ist Pflicht'); return; }
    try {
      if (editWorldId != null) {
        const updated = await api('PUT', '/worlds/' + editWorldId, { name, description: desc });
        const idx = state.worlds.findIndex(w => w.id === editWorldId);
        if (idx > -1) state.worlds[idx] = updated;
      } else {
        const created = await api('POST', '/worlds', { name, description: desc });
        state.worlds.push(created);
        if (!state.ui.activeWorldId) await selectWorld(created.id);
      }
      closeModal();
      renderWorldSelector();
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
      renderWorldSelector();
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
  const creator    = document.getElementById('f-cr').value.trim().toUpperCase();
  if (!title)   { alert('Titel ist Pflicht'); return; }
  if (!creator) { alert('Ersteller-Kürzel ist Pflicht'); return; }
  const tags       = tagsRaw  ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)  : [];
  const characters = charsRaw ? charsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = { title, type, tags, characters, description: desc, creatorCode: creator, dateLabel: dateStr || null };

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

  const isAdmin = state.auth.isAdmin;
  document.getElementById('items-body').innerHTML = f.map((it, i) => `
    <tr style="animation-delay:${i * .04}s">
      <td><span class="i-name">${escHtml(it.name)}</span></td>
      <td class="col-price"><span class="i-price">${(it.price || 0).toLocaleString('de-DE')} ⚜</span></td>
      <td>${(it.tags || []).map(t => `<span class="ev-tag">${escHtml(t)}</span>`).join('')}</td>
      <td class="i-link"><a href="${escHtml(it.url || '#')}" target="_blank">${escHtml(it.url || '—')}</a></td>
      ${isAdmin ? `<td><div class="act-btns">
        <button class="act-btn" title="Bearbeiten" onclick="openEditItem(${it.id})">✎</button>
        <button class="act-btn del" title="Löschen" onclick="openDeleteItem(${it.id})">✕</button>
      </div></td>` : ''}
    </tr>`).join('');

  document.getElementById('item-count').textContent = f.length + ' Eintr' + (f.length === 1 ? 'ag' : 'äge');
}

function sortBy(k) {
  if (state.ui.sortKey === k) state.ui.sortDir *= -1;
  else { state.ui.sortKey = k; state.ui.sortDir = 1; }
  renderItems();
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
async function init() {
  applyThemeFromStorage();
  try {
    const [authStatus, creatorsArr, worlds] = await Promise.all([
      api('GET', '/auth/status'),
      api('GET', '/creators'),
      api('GET', '/worlds'),
    ]);
    state.auth = {
      isAdmin: authStatus.admin || authStatus.isAdmin || false,
      username: authStatus.username || null
    };
    state.creators = {};
    (creatorsArr || []).forEach(c => { state.creators[c.code] = c; });
    state.worlds = worlds || [];

    const savedWorldId = parseInt(localStorage.getItem('activeWorldId'));
    state.ui.activeWorldId = (savedWorldId && state.worlds.find(w => w.id === savedWorldId))
      ? savedWorldId : (state.worlds[0]?.id ?? null);

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

    renderWorldSelector();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    updateAdminVisibility();
    // Start on timeline page
    showPage('timeline');
  } catch (e) {
    console.error('Init failed', e);
    // Still try to render what we have
    renderWorldSelector();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    updateAdminVisibility();
    showPage('timeline');
  }
}

document.addEventListener('DOMContentLoaded', init);
