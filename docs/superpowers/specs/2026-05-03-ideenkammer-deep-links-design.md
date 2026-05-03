# Design: Ideenkammer Deep Links

**Date:** 2026-05-03
**Status:** Approved

## Goal

Add URL-based deep linking to the Ideenkammer so that individual ideas can be shared and bookmarked. Navigating to `/ideas/42` opens the board with the detail panel for idea 42 already visible. Mirrors how the Timeline handles `/world/{worldId}/timeline/{eventId}`.

## URL Schema

```
/ideas          → Ideenkammer board, no detail panel open
/ideas/{id}     → Ideenkammer board + detail panel for idea {id} open
```

Spring Boot's `WebMvcConfig` already falls back to `index.html` for all non-API, non-static paths, so `/ideas/*` is handled without backend changes.

## Changes

### `core.js` — `parseUrl()`

Add a match for `/ideas` and `/ideas/{id}` **before** the existing world-route match:

```js
const mi = window.location.pathname.match(/^\/ideas(?:\/(\d+))?/);
if (mi) return { page: 'ideas', worldId: null, subId: mi[1] ? parseInt(mi[1], 10) : null };
```

The existing regex and fallback (`page: 'items'`) are unchanged.

### `core.js` — `showPage()`

Remove the existing `initIdeasPage()` call from `showPage`. Like `showPage('timeline')`, `showPage('ideas')` will only set up the DOM — data loading is the caller's responsibility:

```js
// remove this line:
if (p === 'ideas')  initIdeasPage();
```

### `core.js` — `navigateToUrl()`

Add a new `page === 'ideas'` case alongside the existing `timeline`, `wiki`, and `map` cases:

```js
} else if (page === 'ideas') {
  if (!state.auth.loggedIn) {
    if (push) pushUrl('/');
    showPage('items');
    return;
  }
  if (push) pushUrl(subId ? `/ideas/${subId}` : '/ideas');
  showPage('ideas');                                       // DOM setup only
  await initIdeasPage();                                   // load ideas list
  if (subId) await openIdeaDetail(subId, false);          // false = no URL push
}
```

Auth guard: unauthenticated users navigating to `/ideas/*` are redirected to `/`.

### `core.js` — new `selectIdeas()` function

Analogous to `selectSection()` for timeline/wiki/map tabs. Called from the nav button. Replaces the old implicit `showPage` + `initIdeasPage` chain.

```js
function selectIdeas() {
  pushUrl('/ideas');
  showPage('ideas');
  initIdeasPage();   // unawaited — fire and forget, same behaviour as before
}
```

### `index.html` — nav button

```html
<!-- before -->
<button ... onclick="showPage('ideas')">Ideenkammer</button>

<!-- after -->
<button ... onclick="selectIdeas()">Ideenkammer</button>
```

### `ideas.js` — `openIdeaDetail(id, push = true)`

Add an optional `push` parameter (default `true`). When called from user interaction, push the URL. When called from `navigateToUrl` (startup or popstate), pass `false` to avoid a double push.

```js
async function openIdeaDetail(id, push = true) {
  if (push && state.ui.currentPage === 'ideas') pushUrl('/ideas/' + id);
  // ... rest unchanged
}
```

The `state.ui.currentPage === 'ideas'` guard prevents updating the URL when `openIdeaDetail` is triggered from a non-ideas context (e.g. after wiki stub creation).

### `ideas.js` — `closeIdeaDetail()`

Push `/ideas` when closing the detail panel while on the ideas page:

```js
function closeIdeaDetail() {
  if (state.ui.currentPage === 'ideas') pushUrl('/ideas');
  // ... rest unchanged
}
```

## Browser Navigation (Back/Forward)

The existing `popstate` listener in `users.js` already handles this:

```js
window.addEventListener('popstate', () => { navigateToUrl(parseUrl(), false); });
```

With `parseUrl()` extended to recognise `/ideas/*`, back/forward works automatically:
- Back from `/ideas/42` → `/ideas` → detail panel closes, board stays
- Back from `/ideas` → previous page

## Sequence: Opening a Deep Link

1. User navigates to `/ideas/42` (direct link / reload)
2. `init()` calls `navigateToUrl(parseUrl(), false)`
3. `parseUrl()` returns `{ page: 'ideas', worldId: null, subId: 42 }`
4. `navigateToUrl` checks auth, calls `showPage('ideas')` → `initIdeasPage()` loads ideas list
5. After load: `openIdeaDetail(42, false)` opens detail panel
6. URL stays at `/ideas/42` (no push because `push=false`)

## Out of Scope

- No share button or copy-link UI — the URL in the address bar is the link
- No idea-level OG/meta tags for link previews
- No changes to the ideas API
