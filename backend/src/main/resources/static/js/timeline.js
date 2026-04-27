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
      itemTagCounts = await api('GET', '/items/tags');
      renderItemTagFilter();
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
      itemTagCounts = await api('GET', '/items/tags');
      renderItemTagFilter();
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

