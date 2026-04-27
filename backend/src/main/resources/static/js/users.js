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
    loadPoiTypes();
    loadWikiTitles();
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

