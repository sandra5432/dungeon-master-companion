# Handoff: Ideenkammer (Idea Board)

## Overview

The **Ideenkammer** is a new module for the *Seekarten der Zeit* D&D campaign companion app (Pardur). It is a collaborative idea board where players track ideas in three states: **Entwurf → In Arbeit → Vollendet**. Ideas can have descriptions (Markdown), images, comments (Markdown + image attachments), tags, upvotes, an activity log, and auto-/manual-linked Wiki pages. When an idea is set to *Vollendet*, a Wiki stub is automatically created.

---

## About the Design File

`Idea Board.html` is a **high-fidelity, interactive HTML prototype**. It is a design reference — not production code. The task is to **recreate this design in the existing Pardur Spring Boot / Vanilla JS codebase** (`backend/src/main/resources/static/`), following the conventions in `CLAUDE.md` exactly.

**Fidelity:** High-fidelity. Pixel-perfect colors, typography, spacing, interactions, and transitions should be matched using the existing CSS custom-property token system already defined in `app.css`.

---

## Target Environment

- **Backend:** Java 21 / Spring Boot 3, REST API under `/api/`
- **Frontend:** Vanilla JS SPA, `index.html` + `js/app.js` + `css/app.css`
- **Auth:** Session-based (`JSESSIONID`), `state.auth.isAdmin` / `state.auth.loggedIn`
- **Design tokens:** Reuse existing CSS variables from `app.css` — do **not** introduce new color literals
- **Nav:** Add `Ideenkammer` as a new `nav-link` entry after `Marktplatz`, wiring `showPage('ideas')`

---

## Design Tokens (from `app.css`)

All existing tokens apply. New status tokens to add to both `:root[data-theme="dark"]` and `light`:

```css
/* dark */
--draft: #8a7a44; --draft2: #b89a54;
--doing: #4a8ab8; --doing2: #6aaad8;
--done:  #4a8a6a; --done2:  #8ac8a0;
--overdue: #b85a4a;

/* light */
--draft: #7a5820; --draft2: #a07830;
--doing: #2060a0; --doing2: #3880c8;
--done:  #2a7a4a; --done2:  #3a9a6a;
--overdue: #a83a2a;
```

---

## Database Schema

Add the following Flyway migration (e.g. `V14__ideenkammer.sql`):

```sql
CREATE TABLE ideas (
  id           INT           AUTO_INCREMENT PRIMARY KEY,
  world_id     INT           NOT NULL,
  title        VARCHAR(255)  NOT NULL,
  description  TEXT,
  status       ENUM('draft','doing','done') NOT NULL DEFAULT 'draft',
  creator_code VARCHAR(3)    NOT NULL,
  due_at       DATE          NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_idea_world   FOREIGN KEY (world_id)     REFERENCES worlds(id)    ON DELETE CASCADE,
  CONSTRAINT fk_idea_creator FOREIGN KEY (creator_code) REFERENCES creators(code) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_tags (
  idea_id  INT         NOT NULL,
  tag_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (idea_id, tag_name),
  CONSTRAINT fk_itag_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_idea_tags_name ON idea_tags(tag_name);

CREATE TABLE idea_votes (
  idea_id      INT        NOT NULL,
  creator_code VARCHAR(3) NOT NULL,
  created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idea_id, creator_code),
  CONSTRAINT fk_ivote_idea    FOREIGN KEY (idea_id)      REFERENCES ideas(id)       ON DELETE CASCADE,
  CONSTRAINT fk_ivote_creator FOREIGN KEY (creator_code) REFERENCES creators(code)  ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_images (
  id         INT           AUTO_INCREMENT PRIMARY KEY,
  idea_id    INT           NOT NULL,
  filename   VARCHAR(255)  NOT NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iimg_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_comments (
  id           INT        AUTO_INCREMENT PRIMARY KEY,
  idea_id      INT        NOT NULL,
  creator_code VARCHAR(3) NOT NULL,
  body         TEXT       NOT NULL,
  created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_icmt_idea    FOREIGN KEY (idea_id)      REFERENCES ideas(id)       ON DELETE CASCADE,
  CONSTRAINT fk_icmt_creator FOREIGN KEY (creator_code) REFERENCES creators(code)  ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_comment_images (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  comment_id INT          NOT NULL,
  filename   VARCHAR(255) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_icimg_cmt FOREIGN KEY (comment_id) REFERENCES idea_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_activity (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  idea_id      INT          NOT NULL,
  actor_code   VARCHAR(3)   NOT NULL,
  type         ENUM('created','status','comment') NOT NULL,
  from_status  VARCHAR(20)  NULL,
  to_status    VARCHAR(20)  NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iact_idea  FOREIGN KEY (idea_id)    REFERENCES ideas(id)       ON DELETE CASCADE,
  CONSTRAINT fk_iact_actor FOREIGN KEY (actor_code) REFERENCES creators(code)  ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## API Endpoints

All scoped under `/api/worlds/{worldId}/ideas`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`    | `/api/worlds/{worldId}/ideas`                          | None   | All ideas for world → `IdeaDto[]` |
| `GET`    | `/api/worlds/{worldId}/ideas/{id}`                     | None   | Single idea → `IdeaDto` |
| `POST`   | `/api/worlds/{worldId}/ideas`                          | Login  | Create idea (status=draft) → `201 IdeaDto` |
| `PUT`    | `/api/worlds/{worldId}/ideas/{id}`                     | Owner/Admin | Update title, description, dueAt, tags → `IdeaDto` |
| `PATCH`  | `/api/worlds/{worldId}/ideas/{id}/status`              | Owner/Admin | `{ status }` → `IdeaDto`; triggers activity log entry + wiki stub if done |
| `DELETE` | `/api/worlds/{worldId}/ideas/{id}`                     | Owner/Admin | Delete → `204` |
| `POST`   | `/api/worlds/{worldId}/ideas/{id}/votes`               | Login  | Toggle vote for current user → `IdeaDto` |
| `GET`    | `/api/worlds/{worldId}/ideas/{id}/comments`            | None   | Comments newest-first → `IdeaCommentDto[]` |
| `POST`   | `/api/worlds/{worldId}/ideas/{id}/comments`            | Login  | Add comment → `201 IdeaCommentDto` |
| `GET`    | `/api/worlds/{worldId}/ideas/{id}/activity`            | None   | Activity log → `IdeaActivityDto[]` |
| `GET`    | `/api/worlds/{worldId}/ideas/tags`                     | None   | All tags with counts → `TagCountDto[]` |

### Key DTOs

**IdeaDto:**
```json
{
  "id": 1,
  "worldId": 1,
  "title": "Unterarten von Ozeandrachen ausarbeiten",
  "description": "Wir brauchen mindestens **drei Unterarten**...",
  "status": "doing",
  "creatorCode": "SK",
  "creatorName": "Sven K.",
  "creatorColor": "#3a7abf",
  "dueAt": "2026-05-15",
  "tags": ["Drachen", "Encounter", "Weltenbau"],
  "votes": ["MM", "AL", "RV"],
  "voteCount": 3,
  "commentCount": 3,
  "imageCount": 2,
  "createdAt": "2026-03-02T10:00:00"
}
```

**CreateIdeaRequest:** `{ title, description?, dueAt?, tags[] }`

**UpdateStatusRequest:** `{ status: "draft"|"doing"|"done" }`

**IdeaCommentDto:** `{ id, creatorCode, creatorName, creatorColor, body, imageFilenames[], createdAt }`

**IdeaActivityDto:** `{ id, actorCode, actorName, actorColor, type, fromStatus?, toStatus?, createdAt }`

---

## Frontend: New Page `page-ideas`

### HTML Structure to add to `index.html`

```html
<!-- Add nav link -->
<button class="nav-link" id="nav-ideas" onclick="showPage('ideas')">Ideenkammer</button>

<!-- New page (add after existing pages) -->
<div class="page" id="page-ideas">
  <div id="ideas-tag-filter-bar"></div>
  <div class="ideas-rope-wrap">
    <div class="ideas-rope-rail">
      <div class="ideas-rope-col" data-status="draft">
        <div class="ideas-rope-knot draft">...</div>
        <div class="ideas-col-lbl">Entwurf</div>
        <div class="ideas-col-cnt" data-count="draft">
          <span data-cnt></span>
          <button class="ideas-rope-add user-action-only" id="ideas-add-btn">+</button>
        </div>
        <div class="ideas-cards" data-status="draft"></div>
      </div>
      <!-- repeat for doing / done -->
    </div>
  </div>
</div>

<!-- Detail panel (can reuse existing #detail-panel pattern) -->
<div class="ideas-detail-panel" id="ideas-detail-panel">...</div>

<!-- New idea modal -->
<div class="modal-bg" id="ideas-modal-bg">...</div>

<!-- Wiki stub toast -->
<div class="wiki-toast" id="wiki-toast">...</div>
```

### JavaScript additions to `app.js`

Add to `state`:
```js
state.ideas = {
  list: [],           // IdeaDto[]
  tagFilter: new Set(),
  sortByVotes: false,
  detailId: null,
  commentsExpanded: {},
};
```

Add to init sequence:
```js
await api('GET', `/worlds/${state.ui.activeWorldId}/ideas`) → state.ideas.list
```

Re-fetch on world switch.

---

## Views & Components

### 1. Rope Layout (Main Board)

Three equal columns connected by a horizontal decorative rope at the top.

**Rope rail:**
- CSS Grid, `grid-template-columns: 1fr 1fr 1fr`
- Horizontal rope: `::before` pseudo-element, `repeating-linear-gradient` using `--rope` and `--rope2` tokens, height `3px`, positioned at `top: 30px`
- Responsive: stack to 1 column below `680px`

**Column knot (header):**
- Centered circle, `58×58px`, background `var(--bg-sb)`, ring border colored by status (`--draft2` / `--doing2` / `--done2`)
- Inner filled circle `36×36px` with roman numeral (I / II / III), background `var(--draft)` / `var(--doing)` / `var(--done)`
- Column label below knot: `Cinzel` `0.62rem`, color `var(--t2)`
- Counter below label: `JetBrains Mono` `0.6rem`, color `var(--t3)`; Entwurf column adds a gold `+` circle button (22×22px) for logged-in users

**Drop zones:**
- `dragover` → add class `drop-over`: light gold background tint + gold border
- `drop` → PATCH status, add activity entry, trigger wiki toast if done

### 2. Idea Card

```
┌─────────────────────────────────────┐
│ Title                          ● ◎  │  ← title (Cinzel 0.8rem) + status dot
│ [Tag] [Tag] [Tag]                   │  ← tag chips (conditional, compact hides)
│ Description preview (2 lines)       │  ← italic Crimson Pro (compact hides)
│ [AV] Name  · 💬3  🖼2  ◈1  ◆ 3    │  ← meta row
└─────────────────────────────────────┘
```

- Background: `var(--bg-c)`, border `1px solid var(--bd)`, border-radius `5px`, padding `12px 13px 11px`
- Hover: `var(--bg-ch)`, border `var(--bd-s)`, `translateY(-2px)`, `box-shadow: var(--sh)`
- Active/selected: gold outline `box-shadow: 0 0 0 1px var(--gold)`
- Draggable when logged in; `cursor: grab`; dragging state: `opacity: 0.45`
- **Status dot** (top right): 8×8px circle, `box-shadow: 0 0 0 2px var(--{status}2)`
- **Tag chips:** `Cinzel` `0.5rem`, `var(--tag-bg)` background, `var(--tag-bd)` border, `var(--blue2)` text, padding `2px 7px`, border-radius `2px`; hidden in compact mode
- **Vote button:** inline-flex, `JetBrains Mono` `0.62rem`, border `1px solid var(--bd)`, background `var(--bg-s)`, color `var(--t3)`; voted state: gold background tint, gold border, `var(--gold2)` text; click toggles vote via API (logged-in only)
- **Compact mode:** hides tags, description, meta row; title font shrinks to `0.72rem`

### 3. Tag Filter Bar

Horizontal strip above the rope rail:

- `Cinzel` `0.56rem` label "Tags"
- "Alle" reset button
- One button per tag (collected from all ideas)
- Active: `var(--tag-bg)` background, `var(--tag-bd)` border, `var(--blue2)` text
- "◆ Nach Beliebtheit" sort toggle button, right-aligned, gold when active
- Multiple tags use OR logic

### 4. Detail Panel (Slide-in)

Same pattern as existing Chronik detail panel: `position: fixed; top: 60px; right: 0; width: 440px; height: calc(100vh - 60px)`. Slides in with `transform: translateX(0)`.

Sections top-to-bottom:

#### a) Overdue indicator (if applicable)
`JetBrains Mono` `0.65rem`, `var(--overdue)`, "● Frist überschritten"

#### b) Title
`Cinzel` `1.2rem` `font-weight: 700`

#### c) Meta row
Avatar + creator name + "angelegt {date}" + due date (or "ohne Frist")

#### d) Progress bar + status buttons
- Bar: 3 equal segments, colored up to current status
- Three buttons: "Entwurf" / "In Arbeit" / "Vollendet"
- Current status button: tinted background + colored border + colored text (see CSS above)
- Non-current: `var(--t2)` text, clickable if canEdit (owner or admin)
- Disabled appearance: `opacity: 0.5; cursor: not-allowed`

#### e) Beschreibung
`md-body` — rendered Markdown (see Markdown section below)

#### f) Bilder
3-column image grid; placeholder stripes until real uploads; "+ Bild anhängen" for owners

#### g) Kommentare
- Newest first, max 2 visible; "▾ N ältere anzeigen" expander
- Each comment: creator avatar (28×28px circle), name + timestamp, Markdown body, optional image grid
- Compose box (logged-in only): textarea + "📎 Bild anhängen" + Send button
- Logged-out: italic note "Melde dich an um zu kommentieren."

#### h) Aktivität
Compact log, newest first:

| Icon | Event |
|------|-------|
| ✦ gold circle | Angelegt von **Name** |
| ⇢ blue circle | **Name** hat Status geändert: Entwurf → In Arbeit |
| ✓ green circle | **Name** hat Status geändert: … → Vollendet |
| Creator avatar | **Name** hat kommentiert |

Each entry shows a relative timestamp below.

#### i) Edit / Delete buttons
Only visible if `canEdit` (creator or admin). Danger styling on Delete.

### 5. Wiki Stub Toast

Appears when an idea reaches *Vollendet*:

- Fixed, bottom-center, `transform: translateX(-50%)`
- Slides up + fades in on `.show` class; auto-dismisses after 5 seconds
- Border: `1px solid var(--done2)`
- Contains: ◈ icon · "Wiki-Stub angelegt: **{title}**" · "Seite öffnen" link · ✕ close button
- Server-side: create an empty wiki page record with the idea title when status → done

---

## Markdown Rendering

The existing `app.js` has no Markdown renderer. Add a lightweight inline renderer supporting:
- `**bold**` → `<strong>`
- `*italic*` → `<em>`
- `` `code` `` → `<code>`
- `# / ## / ###` → headings
- `- item` → `<ul><li>`
- `1. item` → `<ol><li>`
- `> quote` → `<blockquote>`
- `---` → `<hr>`
- `[text](WikiTitle)` → `<a class="wiki" href="#wiki/{slug}">` (manual wiki link)
- Plain mention of any wiki page title → auto-linked as `<a class="wiki auto">`

**Wiki auto-link logic:**
Load all wiki page titles from `GET /api/worlds/{worldId}/wiki/pages` (titles only). After rendering Markdown, scan plain-text nodes for title matches and wrap in wiki links. Sort by title length descending so longer titles win over shorter overlapping ones.

---

## Auth Rules

| Action | Requirement |
|--------|-------------|
| View ideas | Public |
| Create idea | Logged in |
| Edit idea / change status | Creator OR admin |
| Delete idea | Creator OR admin |
| Vote | Logged in |
| Comment | Logged in |

Frontend: gate via `state.auth.loggedIn` / `state.auth.isAdmin` + `idea.creatorCode === state.auth.userId`. Backend: enforce independently — never rely on frontend visibility alone.

---

## CSS Classes to Add to `app.css`

See `Idea Board.html` `<style>` block for the complete set. Key class groups:

- `.ideas-rope-*` — rope rail, knots, columns, cards container
- `.icard` — idea card + states (`.dragging`, `.active`, `.compact`)
- `.icard-tag`, `.icard-tags` — tag chips on card
- `.vote-btn`, `.vote-btn.voted` — vote button
- `.tag-filter-bar`, `.tfb`, `.sort-btn` — filter bar
- `.detail-panel` (already exists in Chronik — reuse or scope as `.ideas-detail-panel`)
- `.dp-progress`, `.dp-step-btn`, `.dp-step-btn.current.{status}` — progress bar
- `.act-log`, `.act-entry`, `.act-ico` — activity log
- `.wiki-toast` — stub toast
- `.cmt-attach-btn`, `.cmt-attach-chip`, `.cmt-attach-row` — comment image attachment
- `.md-body` — rendered Markdown typography

---

## Files in this Package

| File | Description |
|------|-------------|
| `Idea Board.html` | Full hi-fi interactive prototype — open in browser to explore all interactions |
| `README.md` | This document |

---

## Key Implementation Notes

1. **Reuse existing patterns** — the rope/knot visual, detail panel slide-in, modal pattern, and tag chip styles all exist in `seekarten_unified.html`. Port directly, don't reinvent.
2. **Vote is a toggle** — `POST /ideas/{id}/votes` checks if current user already voted; if yes, removes; if no, adds. Returns updated `IdeaDto`.
3. **Activity log is server-authoritative** — the frontend never writes directly to activity; it is created server-side on status changes, comment creation, and idea creation.
4. **Wiki stub on Vollendet** — when `PATCH /ideas/{id}/status` sets `status=done`, the service layer should create a wiki page stub (`INSERT IGNORE INTO wiki_pages (world_id, title, slug, body) VALUES (...)`) so the page exists for linking. The API response should include a flag `wikiStubCreated: true` so the frontend knows to show the toast.
5. **Tag filter = OR logic** — a filtered view shows ideas that have *any* of the selected tags.
6. **Sort by votes** — client-side sort of the already-fetched list; no server pagination needed at this scale.
7. **Drag-and-drop status change** — `dragstart` on card sets a drag ID; `drop` on a column calls PATCH status. Update activity log and show wiki toast if dropped into *done*.
