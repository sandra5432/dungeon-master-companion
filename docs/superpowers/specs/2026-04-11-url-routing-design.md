# URL Routing — Design Spec
_Date: 2026-04-11_

## Goal

Add History API–based deep linking so every navigable state in the app has a shareable URL and the browser back/forward buttons work correctly.

## URL Scheme

```
/                          → Marktplatz (items page)
/world/{id}/timeline       → Chronik for world {id}
/world/{id}/timeline/{eid} → Chronik for world {id}, event {eid} open in detail panel
/world/{id}/wiki           → Wiki list for world {id}
/world/{id}/wiki/{aid}     → Wiki article {aid} in world {id}
/world/{id}/map            → Map for world {id}
```

Unknown world IDs or article IDs fall back gracefully to the default page (Marktplatz or the world's timeline).

## Approach

History API (`history.pushState`) with a `popstate` listener. The Spring Boot server already has a catch-all in `WebMvcConfig.java` that forwards all non-file paths to `index.html`, so no backend changes are needed.

## New Helper Functions

Three pure utility functions added in a new `URL ROUTING` section of `app.js`:

### `buildUrl(worldId, section, subId?)`
Constructs a pathname string from parts. `subId` is optional (used for article and event IDs).

```js
buildUrl(2, 'wiki', 45)   // → '/world/2/wiki/45'
buildUrl(2, 'timeline')   // → '/world/2/timeline'
buildUrl(null, 'items')   // → '/'
```

### `parseUrl()`
Reads `window.location.pathname` and returns a plain object describing the current URL state.

```js
// /world/2/wiki/45  → { page: 'wiki',     worldId: 2, subId: 45 }
// /world/2/timeline → { page: 'timeline', worldId: 2, subId: null }
// /                 → { page: 'items',    worldId: null, subId: null }
```

Returns `{ page: 'items', worldId: null, subId: null }` for any unrecognised path.

### `pushUrl(path)`
Thin wrapper: `history.pushState(null, '', path)`. Centralises all pushState calls.

### `navigateToUrl(parsed, push)`
Navigates the app to the state described by `parsed` (output of `parseUrl()`). If `push` is `true`, calls `pushUrl` to add a history entry (used when the user clicks something). If `false`, only updates DOM/state without pushing (used on startup and popstate).

Handles unknown world IDs or sub-IDs gracefully: falls back to timeline for the first available world, or Marktplatz if no worlds exist.

## Touch Points in Existing Functions

Each navigation function gets a single `pushUrl(...)` call — no logic changes, just URL bookkeeping.

| Function | URL pushed |
|---|---|
| `showPage('items')` | `/` |
| `selectWorld(id)` | `/world/{id}/{section}` |
| `loadWikiArticle(id)` | `/world/{wikiActiveWorldId}/wiki/{id}` |
| `closeWikiArticle()` | `/world/{wikiActiveWorldId}/wiki` |
| `populateDetail(ev)` (on open) | `/world/{activeWorldId}/timeline/{ev.id}` |
| `closeDetail()` | `/world/{activeWorldId}/timeline` |

`pushUrl` is only called when the navigation is user-initiated. It is **not** called from `navigateToUrl` itself (avoids double-push on startup/popstate).

## Startup Routing

At the end of `init()`, after all data (worlds, events, items) is loaded, call:

```js
await navigateToUrl(parseUrl(), false);
```

This restores the URL's state — sets the active world, shows the right page, and opens the article or event if the URL contains a sub-ID. Replaces the current `showPage('timeline')` default call.

## Back / Forward Support

One listener registered once during `DOMContentLoaded`:

```js
window.addEventListener('popstate', () => navigateToUrl(parseUrl(), false));
```

`navigateToUrl` is reused from startup — same parsing, same navigation logic, no history push.

## Error Handling / Fallbacks

| Scenario | Behaviour |
|---|---|
| URL references non-existent world ID | Fall back to first available world's timeline |
| URL references non-existent article/event ID | Show the world's wiki/timeline list instead |
| No worlds exist | Show Marktplatz |
| Malformed path (e.g. `/world/abc/wiki`) | Treat as unknown, show Marktplatz |

## Out of Scope

- User management page (`/users`) — admin-only, not shareable
- Config page (`/config`) — admin-only, not shareable
- Search state / filter state — not encoded in the URL
