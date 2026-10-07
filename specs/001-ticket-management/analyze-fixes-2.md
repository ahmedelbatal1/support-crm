# Proposed Fixes from /speckit-analyze (Part 2)

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-07 | **Status**: Proposed, not applied

These are the suggested edits for findings I3 and I4 from the `/speckit-analyze` report. Neither
has been applied. Line numbers refer to the files after the
[analyze-fixes.md](./analyze-fixes.md) edits (C1, C2, I1, I2) were applied.

| ID | Severity | Summary | Files |
|----|----------|---------|-------|
| I3 | MEDIUM | Timezone rule in the spec contradicts the frontend formatter and the contract examples (spec decision) | spec.md, contracts/api.md, tasks.md |
| I4 | MEDIUM | `[P]` markers on T010 and T011 even though they depend on unfinished tasks | tasks.md |

---

## I3 — Timezone *(spec decision)*

**Why:** The spec says times are shown in the server's timezone, but T026 formats them with
`Intl.DateTimeFormat`, which uses the browser's timezone. The contract examples show `+03:00`
offsets, while Laravel sends UTC by default (`...Z`). The simplest consistent rule is to store and
send UTC and show times in the viewer's local time. That needs no backend config change and no
extra data from the API (Constitution VIII).

### 1. `specs/001-ticket-management/spec.md` — Assumptions (line 319)

Current:

```markdown
- Times are displayed in the server's configured timezone.
```

New (recommended):

```markdown
- Times are stored and sent in UTC and shown in the viewer's local time.
```

### 2. `specs/001-ticket-management/contracts/api.md` — Common shapes (after line 28)

Current (lines 24–30):

~~~markdown
### Enum value object

```json
{ "value": "in_progress", "label": "In Progress" }
```

### Ticket (TicketResource)
~~~

New:

~~~markdown
### Enum value object

```json
{ "value": "in_progress", "label": "In Progress" }
```

### Timestamps

All `*_at` fields are ISO 8601 in UTC, for example `"2026-10-07T06:00:00.000000Z"`. Clients
convert them to local time for display.

### Ticket (TicketResource)
~~~

### 3. `specs/001-ticket-management/contracts/api.md` — Ticket example timestamps (lines 47, 51, 54, 55)

Current:

```json
  "notes": [ { "id": 5, "body": "Called customer.", "created_at": "2026-10-07T09:15:00+03:00" } ],
```

```json
      "old_value": null, "new_value": null, "created_at": "2026-10-07T09:00:00+03:00"
```

```json
  "created_at": "2026-10-07T09:00:00+03:00",
  "updated_at": "2026-10-07T09:15:00+03:00"
```

New (the same moments, written in UTC):

```json
  "notes": [ { "id": 5, "body": "Called customer.", "created_at": "2026-10-07T06:15:00.000000Z" } ],
```

```json
      "old_value": null, "new_value": null, "created_at": "2026-10-07T06:00:00.000000Z"
```

```json
  "created_at": "2026-10-07T06:00:00.000000Z",
  "updated_at": "2026-10-07T06:15:00.000000Z"
```

### 4. `specs/001-ticket-management/tasks.md` — T026 (line 416)

Current:

```markdown
  - `frontend/src/utils/format.js` (`formatDateTime` via `Intl.DateTimeFormat`)
```

New:

```markdown
  - `frontend/src/utils/format.js` (`formatDateTime(iso, options = {})` via
    `Intl.DateTimeFormat` in the viewer's local timezone; tests pass `{ timeZone: 'UTC' }` so the
    results don't depend on the machine running them)
```

**Other option:** keep the server timezone. Set `APP_TIMEZONE=Asia/Riyadh` in T002's
`.env.example` (and confirm `config/app.php` reads it), expose that timezone through `/meta`, and
pass it to `Intl.DateTimeFormat` in `format.js`. That is more moving parts, and the contract
examples would still need offsets that match the configured zone.

---

## I4 — Wrong `[P]` (can run in parallel) markers in Phase 2

**Why:** `[P]` means a task has no dependency on an unfinished task. T010 needs the `TicketStatus`
and `Agent` types (T005, T007), and T011 needs all the enums and models (T005–T009). Leaving the
marker invites someone to start them too early. The dependency and parallel sections repeat the
same mistake, so they need the same correction.

### 1. `specs/001-ticket-management/tasks.md` — T010 header (line 143)

Current:

```markdown
- [ ] T010 [P] Create `backend/app/Exceptions/TicketRuleException.php`, which extends `RuntimeException`.
```

New:

```markdown
- [ ] T010 Create `backend/app/Exceptions/TicketRuleException.php`, which extends `RuntimeException`.
```

### 2. `specs/001-ticket-management/tasks.md` — T011 header (line 154)

Current:

```markdown
- [ ] T011 [P] Create the API resources in `backend/app/Http/Resources/`, following the shapes in
```

New:

```markdown
- [ ] T011 Create the API resources in `backend/app/Http/Resources/`, following the shapes in
```

### 3. `specs/001-ticket-management/tasks.md` — Phase Dependencies (lines 577–578)

Current:

```markdown
- **Phase 2 Foundational**: depends on Phase 1. T005, T006, T010, and T011 are [P], but T011
  needs T005–T009, and T008 needs T007.
```

New:

```markdown
- **Phase 2 Foundational**: depends on Phase 1. T005 and T006 are [P]. T007 → T008 → T009 run
  in order. T010 needs T005 and T007. T011 needs T005–T009. T012 needs T011.
```

### 4. `specs/001-ticket-management/tasks.md` — Parallel Opportunities (line 607)

Current:

```markdown
- In Phase 2, T005, T006, and T010 can run in parallel; T011 runs once the models exist.
```

New:

```markdown
- In Phase 2, T005 and T006 can run in parallel with each other and with T007.
```

### 5. `specs/001-ticket-management/tasks.md` — Parallel Example: Phase 2 (lines 617–621)

Current:

```text
Task: "T005 TicketStatus enum + TicketStatusTest in backend/app/Enums/TicketStatus.php"
Task: "T006 Priority/Category/HistoryEvent enums in backend/app/Enums/"
Task: "T010 TicketRuleException in backend/app/Exceptions/TicketRuleException.php"
```

New:

```text
Task: "T005 TicketStatus enum + TicketStatusTest in backend/app/Enums/TicketStatus.php"
Task: "T006 Priority/Category/HistoryEvent enums in backend/app/Enums/"
Task: "T007 customers and agents tables in backend/database/migrations/"
```

---

## Summary

- **Files touched when applied:** `spec.md` (one assumption), `contracts/api.md` (a new
  Timestamps section and 5 example values), and `tasks.md` (T010, T011, T026, plus the
  dependency, parallel, and example sections).
- **Task count:** unchanged at 42.
- **Not included here:** G1, G2, G3, and the low-severity findings from the analysis report.
- **Next step:** after applying, re-run `/speckit-analyze` to confirm.
