# Timeline Epochs — Design Spec

**Date:** 2026-05-18  
**Status:** Approved  

---

## Overview

Epochs are named, collapsible spans of the timeline. Each epoch covers a contiguous range of events between two positional boundaries. They are visualised as coloured vertical bands on the left edge of the timeline's centre column. An epoch can be open-ended (no end boundary), meaning it spans from its defined start to the top of the timeline and automatically includes every new event added until a closing boundary is set.

---

## Key Design Decisions

### Boundaries are positional BigDecimal fences, not event ID references

When a user defines epoch boundaries by picking events, the service computes a midpoint value between adjacent events' `sequence_order` values and stores that as `start_position` / `end_position`. The stored value never changes automatically. When events are dragged:

- The event's `sequence_order` changes; the fence stays put.
- An event that crosses a fence naturally enters or leaves the epoch.
- The "sticky" behaviour ("sticks to the event that wasn't moved") emerges automatically because only the dragged event's seq changes.

Example — epoch with `end_position = 3500`, events at seq 3000 (L) and 4000 (F):
- Drag L to seq 4500 → L crosses fence → leaves epoch. Fence still at 3500; F (4000) remains outside. Epoch now contains only events below 3500. ✓
- Drag F to seq 5500 → F moves further away, doesn't cross fence. Epoch unchanged. ✓
- Drag F to seq 2500 → F crosses fence → enters epoch. Fence still at 3500; L (3000) stays inside. ✓

### Timeline direction

`sequence_order` ASC = oldest (shown at bottom). Events are displayed newest-first (reversed). Therefore:

- `start_position` = the **older/lower** boundary (bottom of band on screen) — **required**
- `end_position` = the **newer/higher** boundary (top of band on screen) — **optional** (NULL = open-ended, spans to present)

An epoch without a start has no visual extent — start is always required.

### Sequential, non-overlapping epochs

Epochs must not overlap. Validation is enforced in the service on create/update.

### Permissions

Same as events: any user with edit rights to the world can create, edit, and delete epochs.

### Collapse state

Stored in `localStorage` per world, per user's session. Never persisted server-side.

---

## Data Model

### New table: `timeline_epochs`

```sql
-- V27__timeline_epochs.sql
CREATE TABLE timeline_epochs (
    id                   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    world_id             INT          NOT NULL,
    label                VARCHAR(100) NOT NULL,
    start_position       DECIMAL(20,10) NOT NULL,
    end_position         DECIMAL(20,10) NULL,
    created_by_user_id   INT          NULL,
    created_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_epoch_world      FOREIGN KEY (world_id)           REFERENCES worlds(id)         ON DELETE CASCADE,
    CONSTRAINT fk_epoch_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)          ON DELETE SET NULL
);
```

No changes to `timeline_events`.

### Membership rule

Event E belongs to epoch K when:
```
E.sequence_order > K.start_position
AND (K.end_position IS NULL OR E.sequence_order < K.end_position)
```

---

## Backend

### Entity — `TimelineEpoch`

```
com.pardur.model.TimelineEpoch
```

Fields: `id` (Integer), `world` (ManyToOne World), `label` (String, 100), `startPosition` (BigDecimal NOT NULL), `endPosition` (BigDecimal nullable), `createdBy` (ManyToOne User nullable), `createdAt` (LocalDateTime).

### DTOs

**`EpochDto`** (response): `id`, `worldId`, `label`, `startPosition`, `endPosition`, `createdByUserId`

**`CreateEpochRequest`** (request):
- `label` — `@NotBlank @Size(max=100)`
- `startAtEventId` — `@NotNull` — the oldest/first event **in** the epoch
- `endAfterEventId` — nullable — the newest/last event **in** the epoch; null = open-ended

**`UpdateEpochRequest`**: same fields as create.

### Endpoints — added to `TimelineController`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/worlds/{worldId}/epochs` | List all epochs for a world (ordered by `start_position ASC`) |
| `POST` | `/worlds/{worldId}/epochs` | Create epoch |
| `PUT` | `/worlds/{worldId}/epochs/{epochId}` | Update label and/or boundaries |
| `DELETE` | `/worlds/{worldId}/epochs/{epochId}` | Delete epoch |

All require read permission for GET; edit permission for POST/PUT/DELETE.

### Service — `TimelineService` (new methods)

**Position computation** (used in create and update):

```java
// startAtEventId → start_position
TimelineEvent startEvent = findEvent(startAtEventId);
Optional<TimelineEvent> pred = eventRepository
    .findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(worldId, startEvent.getSequenceOrder());
BigDecimal startPos = pred.isPresent()
    ? startEvent.getSequenceOrder().add(pred.get().getSequenceOrder()).divide(TWO, 10, HALF_UP)
    : startEvent.getSequenceOrder().subtract(new BigDecimal("1000"));

// endAfterEventId → end_position (nullable)
BigDecimal endPos = null;
if (endAfterEventId != null) {
    TimelineEvent endEvent = findEvent(endAfterEventId);
    Optional<TimelineEvent> succ = eventRepository
        .findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(worldId, endEvent.getSequenceOrder());
    endPos = succ.isPresent()
        ? endEvent.getSequenceOrder().add(succ.get().getSequenceOrder()).divide(TWO, 10, HALF_UP)
        : endEvent.getSequenceOrder().add(new BigDecimal("1000"));
}
```

**Overlap validation**: after computing the new `start_position` and `end_position`, check that no existing epoch (excluding the one being updated) overlaps:
- Overlap exists when: `existing.startPosition < newEndPos (or newEndPos is null)` AND `existing.endPosition > newStartPos (or existing.endPosition is null)`
- Throw `400 Bad Request` if overlap detected.

**Validation**: if `endAfterEventId` is provided, verify its `sequence_order > startEvent.sequence_order`. Throw `400` otherwise.

---

## Frontend

### State

```js
// In the global state object (core.js / app.js):
state.epochs  = [];                        // EpochDto[] — loaded alongside state.events
state.ui.collapsedEpochs = new Set();      // epoch IDs currently collapsed
```

Load collapse state from localStorage on world select:
```js
const stored = localStorage.getItem('collapsedEpochs_' + worldId);
state.ui.collapsedEpochs = new Set(stored ? JSON.parse(stored) : []);
```

### Loading

In `selectWorld(worldId)` (and in `saveEntry` after event create/edit), fetch:
```js
state.epochs = await api('GET', `/worlds/${worldId}/epochs`);
```
Fetch epochs in parallel with events.

### Epoch membership — helper function

```js
/**
 * Returns the epoch that contains this event, or null.
 * @param {Object} ev - event with sequenceOrder field
 * @param {Array} epochs - sorted by startPosition ASC
 */
function epochForEvent(ev, epochs) {
  if (!ev.sequenceOrder) return null;
  return epochs.find(ep =>
    ev.sequenceOrder > ep.startPosition &&
    (ep.endPosition == null || ev.sequenceOrder < ep.endPosition)
  ) ?? null;
}
```

### `renderTimeline()` — structural change

After computing `groups` (existing logic), build an **epoch-grouped** structure before generating HTML:

```
epochSections = [
  { epoch: null,    groups: [...ungrouped groups...] },
  { epoch: epochA,  groups: [...groups in epochA...] },
  { epoch: null,    groups: [...ungrouped groups...] },
  { epoch: epochB,  groups: [...groups in epochB...] },
  ...
]
```

Groups whose first event belongs to epoch X are assigned to X. The assignment uses `epochForEvent` on the first event of each group. If a date-label group straddles an epoch boundary (first event in epoch A, later events in epoch B), the entire group is assigned to epoch A — midpoint boundaries make this an unlikely edge case in practice.

For each `epochSection`:
- If `epoch == null`: render groups normally (no band wrapper, 28px left spacer column empty)
- If `epoch != null` and collapsed: render a single collapsed row with event count
- If `epoch != null` and expanded: wrap event rows in a band container

### HTML structure

**Expanded epoch:**
```html
<div class="epoch-band" data-epoch-id="1" data-color-idx="0">
  <div class="epoch-band-strip">
    <button class="epoch-collapse-btn" onclick="toggleEpochCollapse(1)">▼</button>
    <span class="epoch-band-label">Zeitalter der Magie</span>
  </div>
  <div class="epoch-band-events">
    <!-- rope-gap and event-row elements rendered normally here -->
  </div>
</div>
```

**Collapsed epoch:**
```html
<div class="epoch-band collapsed" data-epoch-id="2" data-color-idx="1">
  <div class="epoch-band-strip">
    <button class="epoch-collapse-btn" onclick="toggleEpochCollapse(2)">▶</button>
  </div>
  <div class="epoch-band-collapsed-row">
    <span class="epoch-band-collapsed-name">Der Krieg</span>
    <span class="epoch-band-collapsed-count">4 Ereignisse</span>
  </div>
</div>
```

**Open-ended indicator:** when `epoch.endPosition == null`, add class `epoch-band--open` to the band div. CSS applies a faded gradient and `⋯` marker at the top.

**Events outside any epoch:** wrapped in a plain `<div class="epoch-band-spacer">` that provides the 28px left column spacing but no background or label.

### CSS

```css
/* Colour palette — indexed 0–4 */
.epoch-band[data-color-idx="0"] { --ep-color: #c8a84b; --ep-bg: rgba(200,168,75,0.09); }
.epoch-band[data-color-idx="1"] { --ep-color: #3c6fa8; --ep-bg: rgba(60,111,168,0.09); }
.epoch-band[data-color-idx="2"] { --ep-color: #4a9b6f; --ep-bg: rgba(74,155,111,0.09); }
.epoch-band[data-color-idx="3"] { --ep-color: #7850b0; --ep-bg: rgba(120,80,176,0.09); }
.epoch-band[data-color-idx="4"] { --ep-color: #9b4a6f; --ep-bg: rgba(155,74,111,0.09); }

.epoch-band {
  display: flex;
}
.epoch-band-strip {
  width: 28px;
  flex-shrink: 0;
  background: var(--ep-bg);
  border-left: 3px solid var(--ep-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  gap: 4px;
}
.epoch-band-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  color: var(--ep-color);
  opacity: 0.65;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex: 1;
  display: flex;
  align-items: center;
}
.epoch-collapse-btn {
  background: color-mix(in srgb, var(--ep-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--ep-color) 50%, transparent);
  border-radius: 2px;
  color: var(--ep-color);
  font-size: 0.6rem;
  padding: 1px 3px;
  cursor: pointer;
  line-height: 1;
}
.epoch-band-events { flex: 1; }

/* Collapsed state */
.epoch-band.collapsed .epoch-band-strip { padding: 6px 0; }
.epoch-band-collapsed-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--ep-bg);
}
.epoch-band-collapsed-name { color: var(--ep-color); font-size: 0.72rem; font-weight: 600; }
.epoch-band-collapsed-count { color: var(--t3); font-size: 0.7rem; }

/* Open-ended band */
.epoch-band--open .epoch-band-strip::before {
  content: '⋯';
  color: var(--ep-color);
  opacity: 0.5;
  font-size: 0.75rem;
  position: absolute;
  top: 0;
}
.epoch-band-spacer { width: 28px; flex-shrink: 0; }
```

### Colour index assignment

Assigned by the epoch's position in `state.epochs` (sorted by `startPosition ASC`), modulo 5. Computed at render time — not stored.

### `toggleEpochCollapse(epochId)`

```js
function toggleEpochCollapse(epochId) {
  state.ui.collapsedEpochs.has(epochId)
    ? state.ui.collapsedEpochs.delete(epochId)
    : state.ui.collapsedEpochs.add(epochId);
  localStorage.setItem(
    'collapsedEpochs_' + state.ui.activeWorldId,
    JSON.stringify([...state.ui.collapsedEpochs])
  );
  renderTimeline();
}
```

### Sidebar — Epochs section

Added to the left sidebar in `index.html`, below the Charaktere section:

```html
<div style="margin-top:16px" id="epoch-section">
  <div class="sb-title">
    <span>Epochen</span>
    <button class="world-edit-only" onclick="openAddEpochModal()" style="display:none">+</button>
  </div>
  <div id="epoch-list"></div>
</div>
```

`renderEpochList()` — renders epoch entries with edit/delete buttons (edit-only users). Called from `renderTimeline()`.

### Epoch modal

Reuses the existing `#modal` pattern. New form `#f-ep` (hidden by default):

```html
<div id="f-ep" style="display:none;grid-template-columns:1fr;gap:12px">
  <div class="fl-row">
    <label>Epochenname</label>
    <input id="fe-label" class="fl-inp" maxlength="100" />
  </div>
  <div class="fl-row">
    <label>Erstes Ereignis <span class="fl-hint">(ältestes in der Epoche)</span></label>
    <select id="fe-start" class="fl-inp"></select>
  </div>
  <div class="fl-row">
    <label>Letztes Ereignis <span class="fl-hint">(leer = offen bis heute)</span></label>
    <select id="fe-end" class="fl-inp">
      <option value="">— Offen (bis heute) —</option>
    </select>
  </div>
</div>
```

Both dropdowns list `state.events` sorted oldest-first (by `sequenceOrder ASC`). The end dropdown has a leading "open-ended" option.

`showForms()` gains an `ep` parameter.

### Mobile (`renderTimelineMobileList()`)

Between consecutive events where the epoch changes, insert an epoch header chip:
```html
<div class="mob-epoch-chip" style="--ep-color: #c8a84b">Zeitalter der Magie</div>
```
Collapsed epochs show only the chip with a count; all their events are skipped.

---

## Error Handling

| Condition | Response |
|-----------|----------|
| `startAtEventId` not found | 404 |
| `endAfterEventId` not found | 404 |
| End event older than start event | 400 "Letztes Ereignis muss nach dem ersten liegen" |
| Epoch overlaps existing epoch | 400 "Epoche überschneidet sich mit einer bestehenden" |
| Delete epoch referenced by nothing | 204 (always succeeds) |

---

## Migration

**`V27__timeline_epochs.sql`** — creates `timeline_epochs` as above. No data migration needed.

---

## Out of Scope

- Epochs on undated (unpositioned) events — only positioned events are covered
- Per-user custom epoch colours
- Epoch reordering via drag-and-drop (order is implicit from `start_position`)
- Epoch visibility in the wiki or map sections
- Mobile drag-and-drop within collapsed epochs
