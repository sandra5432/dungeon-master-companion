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

// ── Epoch helpers ────────────────────────────────────────────────────────────

/** Fixed palette of 7 epoch colours. */
const EPOCH_PALETTE = ['#c8a84b','#3c6fa8','#4a9b6f','#7850b0','#9b4a6f','#3a8fa0','#b87340'];

/**
 * Converts a hex colour string to an rgba string with 0.09 alpha.
 * @param {string} hex
 * @returns {string}
 */
function epochBgRgba(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},0.09)`;
}

/**
 * Returns the epoch that contains this event, or null.
 * @param {Object} ev - event with sequenceOrder field
 * @param {Array}  epochs - sorted by startPosition ASC
 * @returns {Object|null}
 */
function epochForEvent(ev, epochs) {
  if (!ev || ev.sequenceOrder == null) return null;
  return epochs.find(ep =>
    ev.sequenceOrder > ep.startPosition &&
    (ep.endPosition == null || ev.sequenceOrder < ep.endPosition)
  ) ?? null;
}

/**
 * Groups annotated group objects into epoch sections.
 * Returns array of { epoch, groups[] }.
 * @param {Array} groups - each must have _firstEvent set
 * @param {Array} epochs
 * @returns {Array}
 */
function buildEpochSections(groups, epochs) {
  const sections = [];
  let current = null;
  for (const g of groups) {
    const ep = epochForEvent(g._firstEvent, epochs);
    const epId = ep ? ep.id : null;
    if (!current || (current.epoch ? current.epoch.id : null) !== epId) {
      current = { epoch: ep, groups: [] };
      sections.push(current);
    }
    current.groups.push(g);
  }
  return sections;
}

/**
 * Toggles collapsed state of an epoch band and persists to localStorage.
 * @param {number} epochId
 */
function toggleEpochCollapse(epochId) {
  console.debug('[toggleEpochCollapse] →', epochId);
  if (state.ui.collapsedEpochs.has(epochId)) {
    state.ui.collapsedEpochs.delete(epochId);
  } else {
    state.ui.collapsedEpochs.add(epochId);
  }
  localStorage.setItem(
    'collapsedEpochs_' + state.ui.activeWorldId,
    JSON.stringify([...state.ui.collapsedEpochs])
  );
  renderTimeline();
  console.debug('[toggleEpochCollapse] ← done');
}

/**
 * Renders the epoch management list in the right sidebar (#epoch-list).
 * Reads: state.epochs, state.auth
 * Writes: #epoch-list
 */
function renderEpochList() {
  console.debug('[renderEpochList] → epochs:', state.epochs.length);
  const el = document.getElementById('epoch-list');
  if (!el) return;
  const canEdit = canEditActiveWorld();
  if (state.epochs.length === 0) {
    el.textContent = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:0.7rem;color:var(--t3);font-style:italic';
    empty.textContent = 'Keine Epochen';
    el.appendChild(empty);
    return;
  }
  const rows = state.epochs.map(ep => {
    const isOpen = ep.endPosition == null;
    const row = document.createElement('div');
    row.className = 'ep-list-row';
    const swatch = document.createElement('div');
    swatch.className = 'ep-list-swatch';
    swatch.style.background = ep.color;
    row.appendChild(swatch);
    const lbl = document.createElement('span');
    lbl.className = 'ep-list-label';
    lbl.style.color = ep.color;
    lbl.textContent = ep.label;
    row.appendChild(lbl);
    if (isOpen) {
      const inf = document.createElement('span');
      inf.className = 'ep-list-infinity';
      inf.textContent = '∞';
      row.appendChild(inf);
    }
    if (canEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'world-edit-only ep-list-btn';
      editBtn.title = 'Bearbeiten';
      editBtn.textContent = '✎';
      editBtn.onclick = () => openEditEpochModal(ep.id);
      row.appendChild(editBtn);
      const delBtn = document.createElement('button');
      delBtn.className = 'world-edit-only ep-list-btn';
      delBtn.title = 'Löschen';
      delBtn.textContent = '✕';
      delBtn.onclick = () => openDeleteEpochModal(ep.id);
      row.appendChild(delBtn);
    }
    return row;
  });
  el.replaceChildren(...rows);
  console.debug('[renderEpochList] ← done');
}

/**
 * Renders the 7-swatch colour picker into #fe-color-picker.
 * Reads: state.ui.epochDraftColor
 * Writes: #fe-color-picker
 */
function renderEpochColorPicker() {
  console.debug('[renderEpochColorPicker] →', state.ui.epochDraftColor);
  const el = document.getElementById('fe-color-picker');
  if (!el) return;
  const swatches = EPOCH_PALETTE.map(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ep-swatch' + (c === state.ui.epochDraftColor ? ' ep-swatch--active' : '');
    btn.style.background = c;
    btn.style.color = c;
    btn.title = c;
    btn.onclick = () => selectEpochColor(c);
    return btn;
  });
  el.replaceChildren(...swatches);
}

/**
 * Selects an epoch colour swatch, updates draft state, re-renders picker.
 * @param {string} color - hex colour string
 */
function selectEpochColor(color) {
  state.ui.epochDraftColor = color;
  renderEpochColorPicker();
  updateEpochPreview();
}

/**
 * Populates the start/end event dropdowns in the epoch modal (oldest-first).
 * Events already covered by another epoch are excluded to prevent overlap.
 * In edit mode (editEpochId set) the current epoch's own events remain available.
 * Reads: state.events, state.epochs, editEpochId
 * Writes: #fe-start, #fe-end
 */
function populateEpochDropdowns() {
  console.debug('[populateEpochDropdowns] →');
  const sorted = [...state.events]
    .filter(e => e.sequenceOrder != null)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const otherEpochs = editEpochId != null
    ? state.epochs.filter(ep => ep.id !== editEpochId)
    : state.epochs;
  const available = sorted.filter(e => !epochForEvent(e, otherEpochs));

  const startEl = document.getElementById('fe-start');
  const endEl   = document.getElementById('fe-end');

  const makeOpts = () => available.map(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.title + (e.dateLabel ? ' (' + e.dateLabel + ')' : '');
    return opt;
  });

  if (startEl) startEl.replaceChildren(...makeOpts());
  if (endEl) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— Offen (bis heute) —';
    endEl.replaceChildren(blank, ...makeOpts());
  }

  startEl?.addEventListener('change', updateEpochPreview);
  endEl?.addEventListener('change', updateEpochPreview);
}

/**
 * Updates the epoch preview strip based on current dropdown selections.
 * Reads: #fe-start, #fe-end, state.events, state.ui.epochDraftColor
 * Writes: #fe-preview
 */
function updateEpochPreview() {
  const startId = parseInt(document.getElementById('fe-start')?.value, 10);
  const endId   = parseInt(document.getElementById('fe-end')?.value, 10);
  const prev    = document.getElementById('fe-preview');
  if (!prev || isNaN(startId)) { if (prev) prev.style.display = 'none'; return; }

  const sorted = [...state.events]
    .filter(e => e.sequenceOrder != null)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const startEv = sorted.find(e => e.id === startId);
  if (!startEv) { prev.style.display = 'none'; return; }

  let covered;
  if (!endId || isNaN(endId)) {
    covered = sorted.filter(e => e.sequenceOrder >= startEv.sequenceOrder);
  } else {
    const endEv = sorted.find(e => e.id === endId);
    if (!endEv) { prev.style.display = 'none'; return; }
    covered = sorted.filter(e =>
      e.sequenceOrder >= startEv.sequenceOrder && e.sequenceOrder <= endEv.sequenceOrder
    );
  }

  const color = state.ui.epochDraftColor;
  prev.style.display = 'block';
  prev.style.setProperty('--ep-preview-color', color);
  prev.style.borderLeftColor = color;
  const endTitle = endId && !isNaN(endId) ? (sorted.find(e => e.id === endId) || {}).title || '' : 'offen';
  prev.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = covered.length + ' Ereignis' + (covered.length === 1 ? '' : 'se');
  prev.append('Umfasst: ', strong, ' — ' + (startEv.title || '') + ' → ' + endTitle);
}

/**
 * Opens the modal to create a new epoch.
 */
function openAddEpochModal() {
  console.debug('[openAddEpochModal] →');
  editEpochId = null;
  editSource  = 'ep';
  state.ui.epochDraftColor = '#c8a84b';
  document.getElementById('m-title').textContent = 'Epoche anlegen';
  showForms(false, false, false, false, false, false, true);
  setSaveBtn('Anlegen', false);
  document.getElementById('fe-label').value = '';
  populateEpochDropdowns();
  renderEpochColorPicker();
  document.getElementById('fe-preview').style.display = 'none';
  openModal();
  console.debug('[openAddEpochModal] ← done');
}

/**
 * Opens the modal to edit an existing epoch, pre-filled with current values.
 * @param {number} epochId
 */
function openEditEpochModal(epochId) {
  console.debug('[openEditEpochModal] →', epochId);
  const ep = state.epochs.find(e => e.id === epochId);
  if (!ep) return;
  editEpochId = epochId;
  editSource  = 'ep';
  state.ui.epochDraftColor = ep.color;
  document.getElementById('m-title').textContent = 'Epoche bearbeiten';
  showForms(false, false, false, false, false, false, true);
  setSaveBtn('Speichern', false);
  document.getElementById('fe-label').value = ep.label;
  populateEpochDropdowns();
  renderEpochColorPicker();

  const sorted = [...state.events]
    .filter(e => e.sequenceOrder != null)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const startEv = sorted.find(e =>
    e.sequenceOrder > ep.startPosition &&
    (ep.endPosition == null || e.sequenceOrder < ep.endPosition)
  );
  if (startEv) document.getElementById('fe-start').value = startEv.id;

  if (ep.endPosition != null) {
    const endEv = [...sorted].reverse().find(e =>
      e.sequenceOrder < ep.endPosition && e.sequenceOrder > ep.startPosition
    );
    if (endEv) document.getElementById('fe-end').value = endEv.id;
  }

  updateEpochPreview();
  openModal();
  console.debug('[openEditEpochModal] ← done');
}

/**
 * Opens the delete confirmation modal for an epoch.
 * @param {number} epochId
 */
function openDeleteEpochModal(epochId) {
  console.debug('[openDeleteEpochModal] →', epochId);
  const ep = state.epochs.find(e => e.id === epochId);
  if (!ep) return;
  editEpochId = epochId;
  editSource  = 'ep-del';
  document.getElementById('m-title').textContent = 'Epoche löschen';
  showForms(false, false, true, false, false, false);
  const fDel = document.getElementById('f-del');
  fDel.textContent = '';
  const p1 = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = '"' + ep.label + '"';
  p1.append('Soll die Epoche ', strong, ' wirklich entfernt werden?');
  const p2 = document.createElement('p');
  p2.style.cssText = 'font-size:0.78rem;color:var(--t3)';
  p2.textContent = 'Die Ereignisse selbst bleiben erhalten — nur die Epochen-Markierung wird gelöscht.';
  fDel.append(p1, p2);
  setSaveBtn('Endgültig löschen', true);
  openModal();
  console.debug('[openDeleteEpochModal] ← done');
}

function renderTimeline() {
  const tl  = document.getElementById('timeline');
  if (!tl) return;

  if (!state.ui.activeWorldId) {
    tl.innerHTML = '<div style="text-align:center;padding:40px;font-style:italic;color:var(--t3)">Keine Welt ausgewählt.</div>';
    renderTagList();
    renderCharList();
    renderUndated();
    renderMobTlFilters();
    renderTimelineMobileList();
    return;
  }

  const isAdmin = state.auth.isAdmin;
  // Reversed: newest events on top
  const groups = groupEvents(state.events).reverse();

  function lastEventId(grp) {
    return grp.type === 'single' ? grp.event.id : grp.events[grp.events.length - 1].id;
  }

  /** Renders HTML for one group (rope gap + event row), using grp._gi for side/delay. */
  function renderGroupHtml(grp) {
    const gi = grp._gi;
    const side = gi % 2 === 0 ? 'right' : 'left';
    const predecessorId = lastEventId(grp);
    const predStr = predecessorId !== null ? predecessorId : 'null';
    let h = canEditActiveWorld()
      ? `<div class="rope-gap" data-gap="${gi}" data-predecessor="${predStr}" onclick="onRopeClick(event,${predStr})"><div class="rope-gap-hint">✦ Hier eintragen</div></div>`
      : `<div class="rope-gap" style="pointer-events:none"></div>`;

    if (grp.type === 'single') {
      const ev = grp.event;
      const vis = isVisible(ev);
      const dateLbl = ev.displayDate || ev.dateLabel || '';
      const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'tl';
      const dateBadge = dateLbl ? `<span class="ev-date-badge">${escHtml(dateLbl)}</span>` : '';
      const dragAttrs = state.auth.loggedIn ? `draggable="true" ondragstart="onTLDragStart(event,${ev.id})" ondragend="onTLDragEnd(event)"` : '';
      h += `<div class="event-row ${side}${vis ? '' : ' hidden'}" data-id="${ev.id}">
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
      h += `<div class="event-row ${side}${anyVisible ? '' : ' hidden'}">
        <div class="event-node ${escHtml(firstType)}">${firstType === 'world' ? wSVG() : lSVG()}</div>
        <div class="event-conn"></div>
        <div class="event-card event-group-card${groupActive ? ' active' : ''}" style="animation-delay:${gi * .05}s">
          <div class="event-group-date">${escHtml(grp.dateLabel)}</div>
          <div class="group-ev-list">${itemsHtml}</div>
        </div>
      </div>`;
    }
    return h;
  }

  // Annotate groups with global index and firstEvent for epoch assignment
  groups.forEach((grp, gi) => {
    grp._gi = gi;
    grp._firstEvent = grp.type === 'single' ? grp.event : (grp.events ? grp.events[0] : null);
  });

  const sections = buildEpochSections(groups, state.epochs);
  let html = '';

  for (const section of sections) {
    const innerHtml = section.groups.map(renderGroupHtml).join('');
    if (!section.epoch) {
      html += `<div class="epoch-plain-row"><div class="epoch-band-spacer"></div><div class="epoch-plain-events">${innerHtml}</div></div>`;
    } else {
      const ep = section.epoch;
      const collapsed = state.ui.collapsedEpochs.has(ep.id);
      const bgRgba = epochBgRgba(ep.color);
      const openClass = ep.endPosition == null ? ' epoch-band--open' : '';
      const canEditEpoch = canEditActiveWorld();
      const epochEditBtns = canEditEpoch
        ? `<button class="epoch-strip-btn" onclick="openEditEpochModal(${ep.id})" title="Bearbeiten">✎</button><button class="epoch-strip-btn epoch-strip-btn--del" onclick="openDeleteEpochModal(${ep.id})" title="Löschen">✕</button>`
        : '';
      if (collapsed) {
        const count = section.groups.reduce((n, g) => n + (g.type === 'single' ? 1 : (g.events ? g.events.length : 0)), 0);
        html += `<div class="epoch-band collapsed${openClass}" data-epoch-id="${ep.id}" style="--ep-color:${escHtml(ep.color)};--ep-bg:${bgRgba}">
          <div class="epoch-band-strip">
            <button class="epoch-collapse-btn" onclick="toggleEpochCollapse(${ep.id})">▶</button>
          </div>
          <div class="epoch-band-collapsed-row">
            <span class="epoch-band-collapsed-name">${escHtml(ep.label)}</span>
            <span class="epoch-band-collapsed-count">${count} Ereignis${count === 1 ? '' : 'se'}</span>
            ${epochEditBtns ? `<span class="epoch-row-actions">${epochEditBtns}</span>` : ''}
          </div>
        </div>`;
      } else {
        html += `<div class="epoch-band${openClass}" data-epoch-id="${ep.id}" style="--ep-color:${escHtml(ep.color)};--ep-bg:${bgRgba}">
          <div class="epoch-band-strip">
            <button class="epoch-collapse-btn" onclick="toggleEpochCollapse(${ep.id})">▼</button>
            <span class="epoch-band-label">${escHtml(ep.label)}</span>
            ${epochEditBtns}
          </div>
          <div class="epoch-band-events">${innerHtml}</div>
        </div>`;
      }
    }
  }

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
  renderMobTlFilters();
  renderTimelineMobileList();
  renderEpochList();

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

/**
 * Renders type and tag filter chips in the collapsible mobile filter panel.
 * Reads: state.ui.activeTypes, state.ui.activeTags, state.events
 * Writes: #mob-tl-filter-row, #mob-tl-tag-row, #mob-tl-filter-badge
 */
function renderMobTlFilters() {
  console.debug('[renderMobTlFilters] →');
  const row = document.getElementById('mob-tl-filter-row');
  if (!row) return;

  const typeLabels = { world: 'Weltereignis', local: 'Lokales Ereignis' };
  const allTypes = [...new Set((state.events || []).map(e => e.type).filter(Boolean))].sort();
  while (row.firstChild) row.removeChild(row.firstChild);
  const allChip = document.createElement('button');
  allChip.className = 'mob-tl-chip' + (state.ui.activeTypes.size === 0 ? ' active' : '');
  allChip.textContent = 'Alle Typen';
  allChip.onclick = () => { state.ui.activeTypes.clear(); renderTimeline(); };
  row.appendChild(allChip);
  allTypes.forEach(type => {
    const chip = document.createElement('button');
    chip.className = 'mob-tl-chip' + (state.ui.activeTypes.has(type) ? ' active' : '');
    chip.textContent = typeLabels[type] || type;
    chip.onclick = () => {
      state.ui.activeTypes.has(type) ? state.ui.activeTypes.delete(type) : state.ui.activeTypes.add(type);
      renderTimeline();
    };
    row.appendChild(chip);
  });

  // Tag chips
  const tagRow = document.getElementById('mob-tl-tag-row');
  if (tagRow) {
    while (tagRow.firstChild) tagRow.removeChild(tagRow.firstChild);
    const counts = allTagCounts();
    const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (tags.length > 0) {
      const clearTagChip = document.createElement('button');
      clearTagChip.className = 'mob-tl-chip' + (state.ui.activeTags.size === 0 ? ' active' : '');
      clearTagChip.textContent = 'Alle Tags';
      clearTagChip.onclick = () => { state.ui.activeTags.clear(); renderTimeline(); };
      tagRow.appendChild(clearTagChip);
      tags.forEach(([t, c]) => {
        const chip = document.createElement('button');
        chip.className = 'mob-tl-chip' + (state.ui.activeTags.has(t) ? ' active' : '');
        chip.textContent = t + ' ' + c;
        chip.onclick = () => {
          state.ui.activeTags.has(t) ? state.ui.activeTags.delete(t) : state.ui.activeTags.add(t);
          renderTimeline();
        };
        tagRow.appendChild(chip);
      });
    }
  }

  // Update badge on toggle button
  const activeCount = state.ui.activeTypes.size + state.ui.activeTags.size + state.ui.activeChars.size;
  const badge = document.getElementById('mob-tl-filter-badge');
  if (badge) {
    badge.style.display = activeCount > 0 ? '' : 'none';
    badge.className = 'mob-tl-filter-badge';
    badge.textContent = activeCount;
  }

  console.debug('[renderMobTlFilters] ← types:', allTypes.length);
}

/**
 * Toggles the mobile timeline filter panel open/closed.
 */
function toggleMobTlFilter() {
  console.debug('[toggleMobTlFilter] →');
  const panel = document.getElementById('mob-tl-filter-panel');
  const toggle = document.getElementById('mob-tl-filter-toggle');
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? '' : 'none';
  if (toggle) toggle.classList.toggle('open', open);
  console.debug('[toggleMobTlFilter] ←', open ? 'opened' : 'closed');
}

/**
 * Renders a flat list of timeline events for mobile (no rope).
 * Reads: state.events, state.ui (activeTags, activeTypes, activeChars, detailId, detailSource)
 * Writes: #mob-tl-list
 */
function renderTimelineMobileList() {
  console.debug('[renderTimelineMobileList] →');
  const container = document.getElementById('mob-tl-list');
  if (!container) return;

  const visible = state.events.filter(ev => isVisible(ev)).slice().reverse();

  if (visible.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = 'padding:16px;color:var(--t3);font-size:0.85rem';
    p.textContent = state.events.length === 0 ? 'Keine Ereignisse vorhanden.' : 'Kein Ereignis entspricht den aktiven Filtern.';
    container.replaceChildren(p);
    console.debug('[renderTimelineMobileList] ← empty');
    return;
  }

  let prevEpochId = undefined;
  const html = visible.map(ev => {
    const ep = epochForEvent(ev, state.epochs);
    const epId = ep ? ep.id : null;
    let chipHtml = '';
    if (epId !== prevEpochId) {
      prevEpochId = epId;
      if (ep) {
        const collapsed = state.ui.collapsedEpochs.has(ep.id);
        const count = collapsed
          ? visible.filter(e => epochForEvent(e, state.epochs)?.id === ep.id).length
          : 0;
        chipHtml = `<div class="mob-epoch-chip" style="--ep-color:${escHtml(ep.color)}">${escHtml(ep.label)}${collapsed ? `<span class="mob-epoch-chip-count">(${count} Ereignisse)</span>` : ''}</div>`;
      }
    }
    if (ep && state.ui.collapsedEpochs.has(ep.id)) return chipHtml; // collapsed: only show chip on first entry
    const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'tl';
    const dateLbl = ev.displayDate || ev.dateLabel || '';
    const dateBadge = dateLbl ? `<span class="ev-date-badge">${escHtml(dateLbl)}</span>` : '';
    return chipHtml + `<div class="mob-tl-card${isAct ? ' active' : ''}" data-id="${ev.id}" onclick="onTLCardClick(event,${ev.id})">
      <div class="mob-tl-card-dot ${escHtml(ev.type)}"></div>
      <div class="mob-tl-card-body">
        <div class="ev-title">${dateBadge}${escHtml(ev.title)}</div>
        <div class="ev-tags">${(ev.tags || []).map(t => '<span class="ev-tag">' + escHtml(t) + '</span>').join('')}</div>
        ${ev.description ? '<div class="ev-desc-preview">' + escHtml(ev.description) + '</div>' : ''}
      </div>
    </div>`;
  }).join('');

  const frag = document.createRange().createContextualFragment(html);
  container.replaceChildren(frag);
  console.debug('[renderTimelineMobileList] ← rendered:', visible.length);
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
  if (!state.undated.length) {
    el.innerHTML = '<div class="undated-empty">Keine Einträge</div>';
    const mc = document.getElementById('mob-undated-chip');
    if (mc) mc.style.display = 'none';
    const ms = document.getElementById('mob-undated-section');
    if (ms) ms.style.display = 'none';
    const ml = document.getElementById('mob-undated-list');
    if (ml) ml.innerHTML = '';
    return;
  }
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
  // Sync mobile undated chip
  const mobChip = document.getElementById('mob-undated-chip');
  const mobList = document.getElementById('mob-undated-list');
  const mobCount = document.getElementById('mob-undated-count');
  if (mobChip) {
    const count = state.undated.length;
    mobChip.style.display = count > 0 ? '' : 'none';
    if (mobCount) mobCount.textContent = count;
  }
  if (mobList) {
    mobList.innerHTML = state.undated.map(ev => {
      const isAct = state.ui.detailId === ev.id && state.ui.detailSource === 'undated';
      return `<div class="undated-card${isAct ? ' active' : ''}"
                data-uid="${ev.id}"
                onclick="onUndatedClick(event,${ev.id})">
        <div class="undated-ttl">${escHtml(ev.title)}</div>
        <div class="undated-tags">${(ev.tags || []).map(t => '<span class="undated-tag">' + escHtml(t) + '</span>').join('')}</div>
      </div>`;
    }).join('');
  }
}

/**
 * Toggles the mobile undated-events section open/closed.
 */
function toggleMobUndated() {
  console.debug('[toggleMobUndated] →');
  const section = document.getElementById('mob-undated-section');
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  console.debug('[toggleMobUndated] ←', isOpen ? 'closed' : 'opened');
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
  openDetailSheet(id);
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

/**
 * Opens the timeline detail panel as a bottom sheet on mobile, or as the
 * fixed side panel on desktop. Activates the backdrop on mobile.
 * @param {number|string} eventId - ID of the event to display
 */
function openDetailSheet(eventId) {
  console.debug('[openDetailSheet] →', eventId);
  openDetailPanel();
  if (window.innerWidth <= 768) {
    const backdrop = document.getElementById('mob-sheet-backdrop');
    if (backdrop) {
      backdrop.classList.add('open');
      backdrop.onclick = closeDetailSheet;
    }
  }
  console.debug('[openDetailSheet] ← done');
}

/**
 * Closes the timeline detail bottom sheet and hides the backdrop.
 */
function closeDetailSheet() {
  console.debug('[closeDetailSheet] →');
  closeDetail();
  const backdrop = document.getElementById('mob-sheet-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    backdrop.onclick = null;
  }
  console.debug('[closeDetailSheet] ← done');
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
function showForms(tl, it, del, drop, world, login, ep = false) {
  document.getElementById('f-tl').style.display    = tl    ? 'grid'  : 'none';
  document.getElementById('f-it').style.display    = it    ? 'grid'  : 'none';
  document.getElementById('f-del').style.display   = del   ? 'block' : 'none';
  document.getElementById('f-drop').style.display  = drop  ? 'block' : 'none';
  document.getElementById('f-world').style.display = world ? 'block' : 'none';
  document.getElementById('f-login').style.display = login ? 'block' : 'none';
  const epEl = document.getElementById('f-ep');
  if (epEl) epEl.style.display = ep ? 'grid' : 'none';
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
  editEpochId = null;
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
    const rememberMe = document.getElementById('fl-remember')?.checked || false;
    if (!username || !password) { alert('Benutzername und Passwort sind Pflicht'); return; }
    await doLogin(username, password, rememberMe);
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

  // EPOCH create/edit
  if (editSource === 'ep') {
    const label   = document.getElementById('fe-label').value.trim();
    const color   = state.ui.epochDraftColor;
    const startId = parseInt(document.getElementById('fe-start').value, 10);
    const endVal  = document.getElementById('fe-end').value;
    const endId   = endVal ? parseInt(endVal, 10) : null;
    if (!label)       { alert('Epochenname ist Pflicht'); return; }
    if (isNaN(startId)) { alert('Erstes Ereignis ist Pflicht'); return; }
    const body = { label, color, startAtEventId: startId, endAfterEventId: endId || null };
    try {
      const wid = state.ui.activeWorldId;
      if (editEpochId != null) {
        const updated = await api('PUT', `/worlds/${wid}/epochs/${editEpochId}`, body);
        const idx = state.epochs.findIndex(e => e.id === editEpochId);
        if (idx > -1) state.epochs[idx] = updated; else state.epochs.push(updated);
      } else {
        const created = await api('POST', `/worlds/${wid}/epochs`, body);
        state.epochs.push(created);
        state.epochs.sort((a, b) => a.startPosition - b.startPosition);
      }
      closeModal();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }

  // EPOCH delete
  if (editSource === 'ep-del') {
    try {
      await api('DELETE', `/worlds/${state.ui.activeWorldId}/epochs/${editEpochId}`);
      state.epochs = state.epochs.filter(e => e.id !== editEpochId);
      closeModal();
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
    // Reload epochs — positional fences may reference updated sequence orders
    try {
      state.epochs = await api('GET', `/worlds/${state.ui.activeWorldId}/epochs`);
    } catch (epErr) { console.warn('[_saveEntry] epoch reload failed', epErr); }
    closeModal();
    renderTimeline();
  } catch (e) { alert('Fehler: ' + e.message); }
}

