/* ══════════════════════════════════════
   IDEENKAMMER
   State: state.ideas
   DOM: #page-ideas, #ideas-detail-panel, #ideas-modal-bg, #wiki-stub-toast
══════════════════════════════════════ */


let ideaEditId = null;          // null = new idea, number = editing existing
let ideaDragId = null;          // id of card being dragged
let wikiStubToastTimer = null;
let wikiStubTitle      = null;
let ideaPendingImages  = [];    // File[] staged for upload when creating a new idea

/* ── Initialise ── */

/**
 * Entry point called by showPage('ideas'). Loads all ideas across all worlds and renders the board.
 */
async function initIdeasPage() {
  console.debug('[initIdeasPage] →');
  try {
    state.ideas.list = await api('GET', '/ideas');
    renderIdeasBoard();
    console.debug('[initIdeasPage] ← loaded', state.ideas.list.length, 'ideas');
  } catch (e) {
    console.error('[initIdeasPage] failed', e);
    alert('Fehler beim Laden der Ideenkammer: ' + e.message);
  }
}

/* ── Board rendering ── */

/**
 * Renders the complete board: tag filter bar + all three columns.
 */
function renderIdeasBoard() {
  console.debug('[renderIdeasBoard] →');
  renderIdeasTagFilterBar();
  renderIdeasColumns();
  // re-render detail panel if open
  if (state.ideas.detailId) {
    const idea = state.ideas.list.find(i => i.id === state.ideas.detailId);
    if (idea) renderIdeaDetail(idea);
    else closeIdeaDetail();
  }
  // sync add button visibility
  const addBtn = document.getElementById('ideas-add-btn');
  if (addBtn) addBtn.style.display = state.auth.loggedIn ? '' : 'none';
  console.debug('[renderIdeasBoard] ← done');
}

/**
 * Renders the tag filter bar above the board.
 * World names are always present in the tag list (even if no idea uses them yet).
 * Reads: state.ideas.list, state.ideas.tagFilter, state.worlds, state.ideas.sortByVotes, state.ideas.compact
 * Writes: #ideas-tag-filter-bar
 */
function renderIdeasTagFilterBar() {
  console.debug('[renderIdeasTagFilterBar] →');
  const bar = document.getElementById('ideas-tag-filter-bar');
  if (!bar) return;

  // World names are always available as tags; idea tags are merged in on top
  const tagSet = new Set((state.worlds || []).map(w => w.name.toLowerCase()));
  state.ideas.list.forEach(i => (i.tags || []).forEach(t => tagSet.add(t)));
  const tags = Array.from(tagSet).sort();

  const allActive = state.ideas.tagFilter.size === 0;

  bar.innerHTML = `
    <span class="ideas-tfb-label">Tags</span>
    <button class="ideas-tfb-btn${allActive ? ' active' : ''}" onclick="ideasClearTagFilter()">Alle</button>
    ${tags.map(t => `
      <button class="ideas-tfb-btn${state.ideas.tagFilter.has(t) ? ' active' : ''}"
              onclick="ideasToggleTag('${escHtml(t)}')">${escHtml(t)}</button>
    `).join('')}
    <button class="ideas-mine-btn${state.ideas.onlyMine ? ' active' : ''}" id="ideas-mine-btn" onclick="ideasToggleOnlyMine()">Nur meine</button>
    <button class="ideas-sort-btn${state.ideas.sortByVotes ? ' active' : ''}" onclick="ideasToggleSortByVotes()">◆ Nach Beliebtheit</button>
    <button class="ideas-compact-btn${state.ideas.compact ? ' active' : ''}" onclick="ideasToggleCompact()">Kompakt</button>
  `;
  console.debug('[renderIdeasTagFilterBar] ← done');
}

/**
 * Renders ideas into all three status columns, applying tag filter and sort.
 * Reads: state.ideas.list, state.ideas.tagFilter, state.ideas.sortByVotes, state.ideas.compact
 * Writes: #ideas-cards-draft, #ideas-cards-doing, #ideas-cards-done, #ideas-cnt-*
 */
function renderIdeasColumns() {
  console.debug('[renderIdeasColumns] →');
  const statuses = ['draft', 'doing', 'done'];
  statuses.forEach(status => {
    let ideas = state.ideas.list.filter(i => i.status === status);

    // Tag filter (OR logic)
    if (state.ideas.tagFilter.size > 0) {
      ideas = ideas.filter(i => (i.tags || []).some(t => state.ideas.tagFilter.has(t)));
    }

    // Only-mine filter
    if (state.ideas.onlyMine && state.auth.userId != null) {
      ideas = ideas.filter(i => i.createdByUserId === state.auth.userId);
    }

    // Sort by votes descending
    if (state.ideas.sortByVotes) {
      ideas = [...ideas].sort((a, b) => b.voteCount - a.voteCount);
    }

    const container = document.getElementById('ideas-cards-' + status);
    const counter   = document.getElementById('ideas-cnt-' + status);
    if (!container) return;

    counter.textContent = ideas.length;
    container.innerHTML = ideas.map(idea => renderIdeaCardHtml(idea)).join('');

    // Wire drag & drop on column
    container.ondragover  = e => { e.preventDefault(); container.classList.add('drop-over'); };
    container.ondragleave = e => { if (!container.contains(e.relatedTarget)) container.classList.remove('drop-over'); };
    container.ondrop      = e => { e.preventDefault(); container.classList.remove('drop-over'); handleIdeaDrop(status); };

    // Wire card events
    container.querySelectorAll('.icard').forEach(card => {
      const id = parseInt(card.dataset.id, 10);
      card.onclick = ev => {
        if (ev.target.closest('.icard-vote-btn')) return;
        openIdeaDetail(id);
      };
      card.ondragstart = e => {
        ideaDragId = id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      };
      card.ondragend = () => { card.classList.remove('dragging'); ideaDragId = null; };
    });

    // Wire vote buttons
    container.querySelectorAll('.icard-vote-btn').forEach(btn => {
      const id = parseInt(btn.dataset.id, 10);
      btn.onclick = e => { e.stopPropagation(); toggleIdeaVote(id); };
    });
  });
  // Apply compact class to all idea cards
  document.querySelectorAll('.icard').forEach(card => {
    card.classList.toggle('compact', !!state.ideas.compact);
  });
  console.debug('[renderIdeasColumns] ← done');
}

/**
 * Returns the HTML string for a single idea card.
 * @param {Object} idea  IdeaDto
 * @returns {string}
 */
function renderIdeaCardHtml(idea) {
  const canDrag = state.auth.loggedIn
    && (state.auth.isAdmin || idea.createdByUserId === state.auth.userId);
  const isActive = state.ideas.detailId === idea.id;
  const initials = (idea.creatorUsername || '?').substring(0, 2).toUpperCase();
  const color = idea.creatorColorHex || '#888';

  const tagsHtml = (idea.tags || []).length > 0
    ? `<div class="icard-tags">${idea.tags.map(t => `<span class="icard-tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';

  const descHtml = idea.description
    ? `<div class="icard-desc">${escHtml(idea.description)}</div>`
    : '';

  const voteClass = idea.votedByMe ? ' voted' : '';
  const thumbUrl = idea.firstImageId
    ? `/api/ideas/${idea.id}/images/${idea.firstImageId}/data`
    : null;

  const bodyHtml = `
      <div class="icard-header">
        <span class="icard-title">${escHtml(idea.title)}</span>
        <span class="icard-dot ${idea.status}"></span>
      </div>
      ${tagsHtml}
      ${descHtml}
      <div class="icard-meta">
        <div class="icard-avatar" style="background:${escHtml(color)}">${escHtml(initials)}</div>
        <span>${escHtml(idea.creatorUsername || '')}</span>
        ${idea.commentCount > 0 ? `<span class="icard-meta-sep">·</span><span>💬 ${idea.commentCount}</span>` : ''}
        ${idea.imageCount > 0 ? `<span class="icard-meta-sep">·</span><span class="icard-img-count">🖼 ${idea.imageCount}</span>` : ''}
        <button class="icard-vote-btn${voteClass}" data-id="${idea.id}" title="Abstimmen">
          ◆ ${idea.voteCount}
        </button>
      </div>`;

  if (thumbUrl) {
    return `
    <div class="icard icard-has-thumb${isActive ? ' active' : ''}" data-id="${idea.id}"
         draggable="${canDrag}" tabindex="0">
      <img class="icard-thumb" src="${thumbUrl}" alt="" draggable="false">
      <div class="icard-body">${bodyHtml}</div>
    </div>`;
  }

  return `
    <div class="icard${isActive ? ' active' : ''}" data-id="${idea.id}"
         draggable="${canDrag}" tabindex="0">
      ${bodyHtml}
    </div>`;
}

/* ── Tag filter + sort + compact ── */

/** Clears the tag filter and re-renders the board. */
function ideasClearTagFilter() {
  console.debug('[ideasClearTagFilter] →');
  state.ideas.tagFilter.clear();
  renderIdeasBoard();
}

/**
 * Toggles a single tag in the filter and re-renders.
 * @param {string} tag
 */
function ideasToggleTag(tag) {
  console.debug('[ideasToggleTag] →', tag);
  state.ideas.tagFilter.has(tag) ? state.ideas.tagFilter.delete(tag) : state.ideas.tagFilter.add(tag);
  renderIdeasBoard();
}

/** Toggles sort-by-votes and re-renders the board. */
function ideasToggleSortByVotes() {
  console.debug('[ideasToggleSortByVotes] →');
  state.ideas.sortByVotes = !state.ideas.sortByVotes;
  renderIdeasBoard();
}

/** Toggles compact mode and re-renders the board. */
function ideasToggleCompact() {
  console.debug('[ideasToggleCompact] →');
  state.ideas.compact = !state.ideas.compact;
  renderIdeasBoard();
}

/** Toggles "only mine" filter and re-renders the board. */
function ideasToggleOnlyMine() {
  console.debug('[ideasToggleOnlyMine] →');
  state.ideas.onlyMine = !state.ideas.onlyMine;
  renderIdeasBoard();
}

/* ── Drag & drop ── */

/**
 * Handles a drop event on a status column — patches the dragged idea's status.
 * @param {string} newStatus  'draft' | 'doing' | 'done'
 */
async function handleIdeaDrop(newStatus) {
  console.debug('[handleIdeaDrop] →', ideaDragId, '->', newStatus);
  if (!ideaDragId) return;
  const idea = state.ideas.list.find(i => i.id === ideaDragId);
  if (!idea || idea.status === newStatus) return;
  const canChange = state.auth.isAdmin || idea.createdByUserId === state.auth.userId;
  if (!canChange) return;
  try {
    const updated = await api('PATCH', `/ideas/${ideaDragId}/status`, { status: newStatus });
    updateIdeaInList(updated);
    renderIdeasBoard();
    if (updated.wikiStubCreated) showWikiStubToast(updated.title);
    console.debug('[handleIdeaDrop] ← done');
  } catch (e) {
    console.error('[handleIdeaDrop] failed', e);
    alert('Fehler: ' + e.message);
  }
}

/* ── Detail panel ── */

/**
 * Opens the detail panel and loads all content for the given idea.
 * @param {number} id  Idea ID
 */
/**
 * Opens the detail panel and loads all content for the given idea.
 *
 * @param {number}  id    Idea ID to open.
 * @param {boolean} push  Whether to update the browser URL to /ideas/{id}.
 *                        Pass false when called from navigateToUrl (URL is already set).
 *                        Defaults to true for normal user-initiated clicks.
 */
async function openIdeaDetail(id, push = true) {
  console.debug('[openIdeaDetail] →', id);
  // Update the URL so the open idea can be bookmarked or shared.
  // Guard on currentPage so switching away from ideas does not clobber an unrelated URL.
  if (push && state.ui.currentPage === 'ideas') pushUrl('/ideas/' + id);
  state.ideas.detailId = id;
  state.ideas.commentsExpanded = false;
  const panel = document.getElementById('ideas-detail-panel');
  panel.classList.add('open');

  const idea = state.ideas.list.find(i => i.id === id);
  if (idea) renderIdeaDetail(idea);

  // Load comments, activity, and images in parallel
  try {
    const [comments, activity, images] = await Promise.all([
      api('GET', `/ideas/${id}/comments`),
      api('GET', `/ideas/${id}/activity`),
      api('GET', `/ideas/${id}/images`),
    ]);
    renderIdeaDetailFull(idea, comments, activity, images);
  } catch (e) {
    console.error('[openIdeaDetail] failed to load detail data', e);
  }

  // highlight active card
  document.querySelectorAll('.icard').forEach(c => c.classList.toggle('active', parseInt(c.dataset.id) === id));
  console.debug('[openIdeaDetail] ← done');
}

/**
 * Closes the detail panel and clears the selected idea from state.
 * Restores the URL to /ideas when called while on the ideas page,
 * so the address bar no longer points at a specific idea.
 * Does NOT push a URL when called from selectWorld() during a world switch,
 * because the world navigation sets its own URL immediately after.
 */
function closeIdeaDetail() {
  console.debug('[closeIdeaDetail] →');
  // Only push /ideas when we are actually on the ideas page.
  // closeIdeaDetail() is also called from selectWorld() during world switches,
  // where pushing /ideas would overwrite the world URL being set.
  if (state.ui.currentPage === 'ideas') pushUrl('/ideas');
  state.ideas.detailId = null;
  document.getElementById('ideas-detail-panel').classList.remove('open');
  document.querySelectorAll('.icard').forEach(c => c.classList.remove('active'));
  console.debug('[closeIdeaDetail] ← done');
}

/**
 * Renders the detail panel skeleton for an idea (without comments/activity).
 * Reads: idea, state.auth
 * Writes: #idp-inner
 * @param {Object} idea  IdeaDto
 */
function renderIdeaDetail(idea) {
  console.debug('[renderIdeaDetail] →', idea.id);
  const inner = document.getElementById('idp-inner');
  if (!inner) return;

  const canEdit = state.auth.isAdmin || idea.createdByUserId === state.auth.userId;
  const isOverdue = idea.dueAt && new Date(idea.dueAt) < new Date() && idea.status !== 'done';
  const initials = (idea.creatorUsername || '?').substring(0, 2).toUpperCase();
  const color = idea.creatorColorHex || '#888';

  const statusLabels = { draft: 'Entwurf', doing: 'In Arbeit', done: 'Vollendet' };
  const segFilled = { draft: ['draft', 'doing', 'done'].indexOf(idea.status) >= 0,
                      doing: ['draft', 'doing', 'done'].indexOf(idea.status) >= 1,
                      done:  ['draft', 'doing', 'done'].indexOf(idea.status) >= 2 };

  const tagsHtml = (idea.tags || []).length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        ${idea.tags.map(t => `<span class="icard-tag">${escHtml(t)}</span>`).join('')}
       </div>`
    : '';

  const dueLbl = idea.dueAt ? `Frist: ${idea.dueAt}` : 'ohne Frist';
  const descHtml = idea.description
    ? `<div class="idp-section-lbl">Beschreibung</div>
       <div class="md-body">${renderMarkdown(idea.description)}</div>`
    : '';

  inner.innerHTML = `
    ${isOverdue ? '<div class="idp-overdue">● Frist überschritten</div>' : ''}
    <div class="idp-title">${escHtml(idea.title)}</div>
    <div class="idp-meta">
      <div class="idp-avatar" style="background:${escHtml(color)}">${escHtml(initials)}</div>
      <span>${escHtml(idea.creatorUsername || '')}</span>
      <span style="opacity:.4">·</span>
      <span>${escHtml(dueLbl)}</span>
    </div>
    ${tagsHtml}

    <div class="idp-progress">
      <div class="idp-progress-bar">
        <div class="idp-bar-seg ${segFilled.draft ? 'filled draft' : ''}"></div>
        <div class="idp-bar-seg ${segFilled.doing ? 'filled doing' : ''}"></div>
        <div class="idp-bar-seg ${segFilled.done  ? 'filled done'  : ''}"></div>
      </div>
      <div class="idp-step-btns">
        ${['draft','doing','done'].map(s => `
          <button class="idp-step-btn${idea.status === s ? ' current ' + s : ''}"
                  ${!canEdit ? 'disabled' : ''}
                  onclick="changeIdeaStatus(${idea.id}, '${s}')">
            ${statusLabels[s]}
          </button>`).join('')}
      </div>
    </div>

    ${descHtml}

    <hr class="idp-divider">
    <div id="idp-images-section">
      <div class="idp-section-lbl">Bilder</div>
      <div id="idp-images-gallery" class="idp-images-gallery"></div>
      ${canEdit ? `
        <label id="idp-image-upload-btn" class="idp-img-add-btn" for="idp-image-upload-input">+ Bild anhängen</label>
        <input type="file" id="idp-image-upload-input" accept="image/webp" style="display:none"
               onchange="uploadIdeaImage(${idea.id})">
      ` : ''}
    </div>

    <hr class="idp-divider">
    <div class="idp-section-lbl">Kommentare</div>
    <div id="idp-comments-area"><div style="color:var(--t3);font-size:.75rem">Wird geladen…</div></div>

    <hr class="idp-divider">
    <div class="idp-section-lbl">Aktivität</div>
    <div id="idp-activity-area"><div style="color:var(--t3);font-size:.75rem">Wird geladen…</div></div>

    ${canEdit ? `
    <div class="idp-actions">
      <button class="btn" onclick="openIdeaModal(${idea.id})">Bearbeiten</button>
      <button class="btn btn-danger" onclick="confirmDeleteIdea(${idea.id})">Löschen</button>
    </div>` : ''}
  `;
  console.debug('[renderIdeaDetail] ← done');
}

/**
 * Renders the detail panel with comments, activity, and images loaded.
 * @param {Object} idea
 * @param {Array}  comments  IdeaCommentDto[]
 * @param {Array}  activity  IdeaActivityDto[]
 * @param {Array}  images    IdeaImageDto[]
 */
function renderIdeaDetailFull(idea, comments, activity, images) {
  console.debug('[renderIdeaDetailFull] →', idea?.id, 'comments:', comments?.length, 'activity:', activity?.length, 'images:', images?.length);
  const canEdit = state.auth.isAdmin || idea.createdByUserId === state.auth.userId;
  renderIdeaImages(idea.id, images || [], canEdit);
  renderIdeaComments(idea.id, comments);
  renderIdeaActivity(activity);
  console.debug('[renderIdeaDetailFull] ← done');
}

/* ── Images ── */

/**
 * Renders the image gallery inside the detail panel.
 * Reads: images array, canEdit flag
 * Writes: #idp-images-gallery
 * @param {number}  ideaId
 * @param {Array}   images   IdeaImageDto[]
 * @param {boolean} canEdit
 */
function renderIdeaImages(ideaId, images, canEdit) {
  console.debug('[renderIdeaImages] →', ideaId, images?.length);
  const gallery = document.getElementById('idp-images-gallery');
  if (!gallery) return;

  if (!images || images.length === 0) {
    gallery.innerHTML = `<span style="color:var(--t3);font-size:.75rem;font-style:italic">Keine Bilder.</span>`;
    console.debug('[renderIdeaImages] ← empty');
    return;
  }

  gallery.innerHTML = images.map(img => `
    <div class="idp-image-thumb" data-image-id="${img.id}">
      <img src="/api/ideas/${ideaId}/images/${img.id}/data"
           alt="${escHtml(img.originalFilename)}" loading="lazy">
      ${canEdit ? `<button class="idp-image-delete-btn" title="Bild löschen" onclick="deleteIdeaImage(${ideaId}, ${img.id})">✕</button>` : ''}
    </div>
  `).join('');
  console.debug('[renderIdeaImages] ← done');
}

/**
 * Uploads the file selected in #idp-image-upload-input for the given idea.
 * @param {number} ideaId
 */
async function uploadIdeaImage(ideaId) {
  console.debug('[uploadIdeaImage] →', ideaId);
  const input = document.getElementById('idp-image-upload-input');
  if (!input || !input.files || input.files.length === 0) return;
  const file = input.files[0];

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`/api/ideas/${ideaId}/images`, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    // Reload images and update idea in list for the badge count
    const [images, updatedIdea] = await Promise.all([
      api('GET', `/ideas/${ideaId}/images`),
      api('GET', `/ideas/${ideaId}`),
    ]);
    const canEdit = state.auth.isAdmin || updatedIdea.createdByUserId === state.auth.userId;
    renderIdeaImages(ideaId, images, canEdit);
    updateIdeaInList(updatedIdea);
    renderIdeasColumns();
    console.debug('[uploadIdeaImage] ← done');
  } catch (e) {
    console.error('[uploadIdeaImage] failed', e);
    alert('Fehler beim Hochladen: ' + e.message);
  } finally {
    if (input) input.value = '';
  }
}

/**
 * Deletes a single image from an idea and refreshes the gallery.
 * @param {number} ideaId
 * @param {number} imageId
 */
async function deleteIdeaImage(ideaId, imageId) {
  console.debug('[deleteIdeaImage] →', ideaId, imageId);
  try {
    await api('DELETE', `/ideas/${ideaId}/images/${imageId}`);
    const [images, updatedIdea] = await Promise.all([
      api('GET', `/ideas/${ideaId}/images`),
      api('GET', `/ideas/${ideaId}`),
    ]);
    const canEdit = state.auth.isAdmin || updatedIdea.createdByUserId === state.auth.userId;
    renderIdeaImages(ideaId, images, canEdit);
    updateIdeaInList(updatedIdea);
    renderIdeasColumns();
    console.debug('[deleteIdeaImage] ← done');
  } catch (e) {
    console.error('[deleteIdeaImage] failed', e);
    alert('Fehler beim Löschen: ' + e.message);
  }
}

/**
 * Renders the comments section inside the detail panel.
 * @param {number} ideaId
 * @param {Array}  comments  IdeaCommentDto[]
 */
function renderIdeaComments(ideaId, comments) {
  console.debug('[renderIdeaComments] →', ideaId, comments?.length);
  const area = document.getElementById('idp-comments-area');
  if (!area) return;

  const visibleCount = state.ideas.commentsExpanded ? comments.length : 2;
  const shown = comments.slice(0, visibleCount);
  const hiddenCount = comments.length - shown.length;

  const commentsHtml = shown.map(c => {
    const initials = (c.creatorUsername || '?').substring(0, 2).toUpperCase();
    const color = c.creatorColorHex || '#888';
    return `
      <div class="idp-comment">
        <div class="idp-cmt-avatar" style="background:${escHtml(color)}">${escHtml(initials)}</div>
        <div class="idp-cmt-body">
          <div class="idp-cmt-header">
            <strong>${escHtml(c.creatorUsername || '')}</strong>
            · <span>${relTime(c.createdAt)}</span>
          </div>
          <div class="md-body">${renderMarkdown(c.body)}</div>
        </div>
      </div>`;
  }).join('');

  const expanderHtml = hiddenCount > 0
    ? `<button class="idp-cmt-expander" onclick="ideasExpandComments(${ideaId})">▾ ${hiddenCount} ältere anzeigen</button>`
    : '';

  const composeHtml = state.auth.loggedIn
    ? `<div class="idp-cmt-compose">
        <textarea id="idp-cmt-input" placeholder="Kommentar schreiben…"></textarea>
        <div class="idp-cmt-compose-actions">
          <button class="btn btn-primary" onclick="submitIdeaComment(${ideaId})">Senden</button>
        </div>
       </div>`
    : `<p class="idp-guest-note">Melde dich an um zu kommentieren.</p>`;

  area.innerHTML = expanderHtml + commentsHtml + composeHtml;
  console.debug('[renderIdeaComments] ← done');
}

/**
 * Expands all comments for an idea.
 * @param {number} ideaId
 */
async function ideasExpandComments(ideaId) {
  console.debug('[ideasExpandComments] →', ideaId);
  state.ideas.commentsExpanded = true;
  try {
    const comments = await api('GET', `/ideas/${ideaId}/comments`);
    renderIdeaComments(ideaId, comments);
    console.debug('[ideasExpandComments] ← done');
  } catch (e) {
    console.error('[ideasExpandComments] failed', e);
  }
}

/**
 * Submits a new comment for the given idea.
 * @param {number} ideaId
 */
async function submitIdeaComment(ideaId) {
  console.debug('[submitIdeaComment] →', ideaId);
  const input = document.getElementById('idp-cmt-input');
  const body = input ? input.value.trim() : '';
  if (!body) return;
  try {
    await api('POST', `/ideas/${ideaId}/comments`, { body });
    // Reload idea list (comment count changed) + comments
    const [updatedIdea, comments, activity] = await Promise.all([
      api('GET', `/ideas/${ideaId}`),
      api('GET', `/ideas/${ideaId}/comments`),
      api('GET', `/ideas/${ideaId}/activity`),
    ]);
    updateIdeaInList(updatedIdea);
    renderIdeasColumns();
    renderIdeaComments(ideaId, comments);
    renderIdeaActivity(activity);
    console.debug('[submitIdeaComment] ← done');
  } catch (e) {
    console.error('[submitIdeaComment] failed', e);
    alert('Fehler: ' + e.message);
  }
}

/**
 * Renders the activity log inside the detail panel.
 * @param {Array} activity  IdeaActivityDto[]
 */
function renderIdeaActivity(activity) {
  console.debug('[renderIdeaActivity] →', activity?.length);
  const area = document.getElementById('idp-activity-area');
  if (!area) return;

  if (!activity || activity.length === 0) {
    area.innerHTML = '<span style="color:var(--t3);font-size:.72rem">Keine Aktivitäten.</span>';
    return;
  }

  const statusLabels = { draft: 'Entwurf', doing: 'In Arbeit', done: 'Vollendet' };

  area.innerHTML = `<div class="ideas-act-log">${activity.map(a => {
    let icoClass = 'comment';
    let icoText  = '💬';
    let text = '';

    if (a.type === 'created') {
      icoClass = 'created'; icoText = '✦';
      text = `<strong>${escHtml(a.actorUsername)}</strong> hat die Idee angelegt`;
    } else if (a.type === 'status') {
      const toDone = a.toStatus === 'done';
      icoClass = `status${toDone ? ' done' : ''}`;
      icoText  = toDone ? '✓' : '⇢';
      const from = statusLabels[a.fromStatus] || a.fromStatus;
      const to   = statusLabels[a.toStatus]   || a.toStatus;
      text = `<strong>${escHtml(a.actorUsername)}</strong> hat Status geändert: ${escHtml(from)} → ${escHtml(to)}`;
    } else {
      icoClass = 'comment';
      const initials = (a.actorUsername || '?').substring(0, 2).toUpperCase();
      const color = a.actorColorHex || '#888';
      icoText = `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${escHtml(color)};font-size:.45rem;color:#fff">${escHtml(initials)}</div>`;
      text = `<strong>${escHtml(a.actorUsername)}</strong> hat kommentiert`;
    }

    return `
      <div class="ideas-act-entry">
        <div class="ideas-act-ico ${icoClass}">${icoText}</div>
        <div class="ideas-act-text">
          ${text}
          <span class="ideas-act-time">${relTime(a.createdAt)}</span>
        </div>
      </div>`;
  }).join('')}</div>`;
  console.debug('[renderIdeaActivity] ← done');
}

/* ── Status change ── */

/**
 * Changes the status of an idea via the step buttons in the detail panel.
 * @param {number} id
 * @param {string} status  'draft' | 'doing' | 'done'
 */
async function changeIdeaStatus(id, status) {
  console.debug('[changeIdeaStatus] →', id, status);
  try {
    const updated = await api('PATCH', `/ideas/${id}/status`, { status });
    updateIdeaInList(updated);
    renderIdeasBoard();
    if (updated.wikiStubCreated) showWikiStubToast(updated.title);
    console.debug('[changeIdeaStatus] ← done');
  } catch (e) {
    console.error('[changeIdeaStatus] failed', e);
    alert('Fehler: ' + e.message);
  }
}

/* ── Vote ── */

/**
 * Toggles the current user's vote on an idea.
 * @param {number} id
 */
async function toggleIdeaVote(id) {
  console.debug('[toggleIdeaVote] →', id);
  try {
    const updated = await api('POST', `/ideas/${id}/votes`);
    updateIdeaInList(updated);
    renderIdeasBoard();
    console.debug('[toggleIdeaVote] ← done', 'votes:', updated.voteCount);
  } catch (e) {
    console.error('[toggleIdeaVote] failed', e);
    alert('Fehler: ' + e.message);
  }
}

/* ── Create / edit modal ── */

/**
 * Opens the create/edit modal. Pass null for a new idea, or an idea ID to edit.
 * @param {number|null} ideaId
 */
function openIdeaModal(ideaId) {
  console.debug('[openIdeaModal] →', ideaId);
  ideaEditId = ideaId || null;

  const modal = document.getElementById('ideas-modal-bg');
  const title = document.getElementById('ideas-modal-title');
  const fTitle = document.getElementById('idea-f-title');
  const fDesc  = document.getElementById('idea-f-desc');
  const fDue   = document.getElementById('idea-f-due');
  const fTags  = document.getElementById('idea-f-tags');
  const errEl  = document.getElementById('ideas-modal-err');

  // Reset
  fTitle.value = '';
  fDesc.value  = '';
  fDue.value   = '';
  fTags.value  = '';
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  // Reset pending images
  ideaPendingImages = [];
  const imgInput = document.getElementById('idea-f-images');
  if (imgInput) imgInput.value = '';
  renderIdeasModalImagePreviews();

  // Show image picker only when creating (not editing)
  const imgSection = document.getElementById('ideas-modal-img-section');
  if (imgSection) imgSection.style.display = ideaId ? 'none' : '';

  // Populate default tag suggestions from known worlds
  const defaultTagsEl = document.getElementById('ideas-default-tags');
  if (defaultTagsEl) {
    const worldTags = (state.worlds || []).map(w => w.name.toLowerCase());
    defaultTagsEl.innerHTML = worldTags.map(t =>
      `<button type="button" class="ideas-default-tag" onclick="ideasAddDefaultTag('${escHtml(t)}')">${escHtml(t)}</button>`
    ).join('');
  }

  if (ideaId) {
    const idea = state.ideas.list.find(i => i.id === ideaId);
    if (idea) {
      title.textContent = 'Idee bearbeiten';
      fTitle.value = idea.title;
      fDesc.value  = idea.description || '';
      fDue.value   = idea.dueAt || '';
      fTags.value  = (idea.tags || []).join(', ');
    }
  } else {
    title.textContent = 'Neue Idee';
  }

  modal.classList.add('open');
  fTitle.focus();
  console.debug('[openIdeaModal] ← done');
}

/** Closes the idea create/edit modal. */
function closeIdeaModal() {
  console.debug('[closeIdeaModal] →');
  document.getElementById('ideas-modal-bg').classList.remove('open');
  ideaEditId = null;
  ideaPendingImages = [];
  console.debug('[closeIdeaModal] ← done');
}

/**
 * Appends a default tag to the tags input field.
 * @param {string} tag
 */
function ideasAddDefaultTag(tag) {
  const input = document.getElementById('idea-f-tags');
  if (!input) return;
  const existing = input.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!existing.includes(tag)) {
    input.value = [...existing, tag].join(', ');
  }
}

/**
 * Called when the user picks files in the modal image input.
 * Adds valid image files to ideaPendingImages and re-renders previews.
 */
function ideasAddPendingImages() {
  console.debug('[ideasAddPendingImages] →');
  const input = document.getElementById('idea-f-images');
  if (!input || !input.files) return;
  for (const file of input.files) {
    if (file.type !== 'image/webp') { alert(`„${file.name}" ist kein WebP-Bild und wird übersprungen.`); continue; }
    if (file.size > 5 * 1024 * 1024) { alert(`„${file.name}" ist größer als 5 MB und wird übersprungen.`); continue; }
    ideaPendingImages.push(file);
  }
  input.value = '';
  renderIdeasModalImagePreviews();
  console.debug('[ideasAddPendingImages] ←', ideaPendingImages.length, 'pending');
}

/**
 * Removes a file from the pending images list by index and re-renders previews.
 * @param {number} index
 */
function ideasRemovePendingImage(index) {
  ideaPendingImages.splice(index, 1);
  renderIdeasModalImagePreviews();
}

/**
 * Renders thumbnail previews of all staged images inside the modal.
 * Writes: #ideas-modal-img-previews
 */
function renderIdeasModalImagePreviews() {
  const container = document.getElementById('ideas-modal-img-previews');
  if (!container) return;
  if (ideaPendingImages.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = ideaPendingImages.map((file, i) => {
    const url = URL.createObjectURL(file);
    return `
      <div class="ideas-modal-img-thumb">
        <img src="${url}" alt="${escHtml(file.name)}" onload="URL.revokeObjectURL(this.src)">
        <button type="button" class="ideas-modal-img-remove" onclick="ideasRemovePendingImage(${i})" title="Entfernen">✕</button>
      </div>`;
  }).join('');
}

/** Saves the idea modal (create or update). */
async function saveIdeaModal() {
  console.debug('[saveIdeaModal] →', ideaEditId);
  const fTitle = document.getElementById('idea-f-title');
  const fDesc  = document.getElementById('idea-f-desc');
  const fDue   = document.getElementById('idea-f-due');
  const fTags  = document.getElementById('idea-f-tags');
  const errEl  = document.getElementById('ideas-modal-err');

  const title = fTitle.value.trim();
  if (!title) {
    errEl.textContent = 'Titel ist Pflichtfeld.';
    errEl.style.display = '';
    return;
  }

  const tags = fTags.value.split(',').map(t => t.trim()).filter(Boolean);
  const body = {
    title,
    description: fDesc.value.trim() || null,
    dueAt: fDue.value || null,
    tags,
  };

  try {
    let updated;
    if (ideaEditId) {
      updated = await api('PUT', `/ideas/${ideaEditId}`, body);
      updateIdeaInList(updated);
      closeIdeaModal();
      renderIdeasBoard();
    } else {
      updated = await api('POST', '/ideas', body);
      state.ideas.list.unshift(updated);

      // Upload any staged images before opening the detail panel
      const filesToUpload = ideaPendingImages.slice();
      closeIdeaModal();
      renderIdeasBoard();
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await fetch(`/api/ideas/${updated.id}/images`, {
            method: 'POST', body: fd, credentials: 'same-origin',
          });
          if (!res.ok) console.warn('[saveIdeaModal] image upload failed:', res.status);
        } catch (imgErr) {
          console.warn('[saveIdeaModal] image upload error:', imgErr);
        }
      }
      if (filesToUpload.length > 0) {
        try {
          const refreshed = await api('GET', `/ideas/${updated.id}`);
          updateIdeaInList(refreshed);
          renderIdeasBoard();
        } catch (_) {}
      }
      openIdeaDetail(updated.id);
    }
    console.debug('[saveIdeaModal] ← done', updated.id);
  } catch (e) {
    console.error('[saveIdeaModal] failed', e);
    if (errEl) { errEl.textContent = 'Fehler: ' + e.message; errEl.style.display = ''; }
  }
}

/* ── Delete ── */

/**
 * Asks for confirmation and deletes an idea.
 * @param {number} id
 */
async function confirmDeleteIdea(id) {
  console.debug('[confirmDeleteIdea] →', id);
  const idea = state.ideas.list.find(i => i.id === id);
  if (!confirm(`Idee „${idea?.title || id}" wirklich löschen?`)) return;
  try {
    await api('DELETE', `/ideas/${id}`);
    state.ideas.list = state.ideas.list.filter(i => i.id !== id);
    closeIdeaDetail();
    renderIdeasBoard();
    console.debug('[confirmDeleteIdea] ← done');
  } catch (e) {
    console.error('[confirmDeleteIdea] failed', e);
    alert('Fehler: ' + e.message);
  }
}

/* ── Wiki stub toast ── */

/**
 * Shows the wiki-stub-created toast for 5 seconds.
 * @param {string} title  Title of the created wiki stub
 */
function showWikiStubToast(title) {
  console.debug('[showWikiStubToast] →', title);
  wikiStubTitle = title;
  const toast = document.getElementById('wiki-stub-toast');
  const textEl = document.getElementById('wiki-stub-toast-text');
  if (textEl) textEl.textContent = `Wiki-Stub angelegt: ${title}`;
  toast.classList.add('show');
  clearTimeout(wikiStubToastTimer);
  wikiStubToastTimer = setTimeout(closeWikiStubToast, 5000);
  console.debug('[showWikiStubToast] ← done');
}

/** Closes the wiki stub toast. */
function closeWikiStubToast() {
  console.debug('[closeWikiStubToast] →');
  document.getElementById('wiki-stub-toast').classList.remove('show');
  clearTimeout(wikiStubToastTimer);
  console.debug('[closeWikiStubToast] ← done');
}

/**
 * Navigates to the wiki page for the stub title and performs a search.
 */
function openWikiStubLink() {
  console.debug('[openWikiStubLink] →', wikiStubTitle);
  closeWikiStubToast();
  showPage('wiki');
  if (wikiStubTitle) {
    setTimeout(() => {
      const searchEl = document.getElementById('wiki-search');
      if (searchEl) {
        searchEl.value = wikiStubTitle;
        onWikiSearch(wikiStubTitle);
      }
    }, 200);
  }
  console.debug('[openWikiStubLink] ← done');
}

/* ── Markdown renderer ── */

/**
 * Renders a Markdown string to safe HTML. Supports bold, italic, code, headings, lists, blockquote, hr, wiki links.
 * @param {string} md  Raw Markdown text
 * @returns {string}   HTML string
 */
function renderMarkdown(md) {
  if (!md) return '';
  let html = escHtml(md);

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // HR
  html = html.replace(/^---$/gm, '<hr>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bold + italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Wiki links [text](WikiTitle)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, target) => {
    const slug = encodeURIComponent(target);
    return `<a class="wiki" onclick="openWikiByTitle('${escHtml(target)}')">${text}</a>`;
  });

  // Unordered list
  html = html.replace(/((?:^- .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered list
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs — wrap double-newline separated blocks
  html = html.split(/\n\n+/).map(block => {
    if (/^<(h[123]|ul|ol|hr|blockquote)/.test(block)) return block;
    return block ? `<p>${block.replace(/\n/g, '<br>')}</p>` : '';
  }).join('\n');

  return html;
}

/**
 * Navigates to the wiki and opens the entry matching the given title.
 * @param {string} title
 */
function openWikiByTitle(title) {
  console.debug('[openWikiByTitle] →', title);
  showPage('wiki');
  setTimeout(() => {
    const searchEl = document.getElementById('wiki-search');
    if (searchEl) { searchEl.value = title; onWikiSearch(title); }
  }, 200);
}

/* ── Helpers ── */

/**
 * Updates or inserts an idea in state.ideas.list by id.
 * @param {Object} updated  IdeaDto
 */
function updateIdeaInList(updated) {
  const idx = state.ideas.list.findIndex(i => i.id === updated.id);
  if (idx !== -1) state.ideas.list[idx] = updated;
  else state.ideas.list.unshift(updated);
}

/**
 * Returns a relative time string for a timestamp (ISO string or LocalDateTime array).
 * @param {string|Array} ts
 * @returns {string}
 */
function relTime(ts) {
  if (!ts) return '';
  const date = Array.isArray(ts) ? new Date(ts[0], ts[1]-1, ts[2], ts[3]||0, ts[4]||0, ts[5]||0) : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return 'gerade eben';
  if (diff < 3600) return Math.floor(diff / 60) + ' Min. ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' Std. ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' Tage ago';
  return date.toLocaleDateString('de-DE');
}
