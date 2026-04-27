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

