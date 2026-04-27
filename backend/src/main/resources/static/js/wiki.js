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
    if (file.type !== 'image/webp') {
      showWikiEditorError(`"${file.name}" ist kein WebP-Bild. Bitte nur WebP-Dateien hochladen.`);
      event.target.value = '';
      return;
    }
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

