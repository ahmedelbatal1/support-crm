# Proposed Fixes from /speckit-analyze

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-07 | **Status**: Applied 2026-10-07 (I2: recommended option)

These are the suggested edits for findings C1, C2, I1, and I2 from the `/speckit-analyze` report.
None of them has been applied. Line numbers refer to the files as they were when this list was
written.

| ID | Severity | Summary | Files |
|----|----------|---------|-------|
| C1 | CRITICAL | `/meta` does not go through an API Resource (Constitution III) | tasks.md, contracts/api.md, plan.md |
| C2 | CRITICAL | Pages that depend on `/meta` lack loading and error states (Constitution VII) | tasks.md |
| I1 | MEDIUM | Frontend hard-codes status strings | data-model.md, tasks.md, contracts/api.md, research.md |
| I2 | MEDIUM | "Attributed to Supervisor" assumption has no implementation (spec decision) | spec.md |

---

## C1 — `/meta` must go through an API Resource (Constitution III)

**Why:** Constitution III says all response bodies must be shaped by API Resource classes. `/meta`
is the only endpoint that returns a plain array, and the only one without the `{ "data": ... }`
wrapper. Fixing it makes all 8 endpoints follow the rule and use the same shape.

### 1. `specs/001-ticket-management/tasks.md` — T012 (lines 166–169)

Current:

```markdown
- [ ] T012 Create the reference-data endpoints and tests:
  - `backend/app/Http/Controllers/Api/MetaController.php` (invokable). It returns `statuses`,
    `priorities`, and `categories` from the enums' `options()`, plus `transitions` as a map of
    value → [values], built from `TicketStatus::allowedTransitions()`.
```

New:

```markdown
- [ ] T012 Create the reference-data endpoints and tests:
  - `backend/app/Http/Resources/MetaResource.php`. It builds `statuses`, `priorities`, and
    `categories` from the enums' `options()`, plus `transitions` as a map of value → [values]
    from `TicketStatus::allowedTransitions()`.
  - `backend/app/Http/Controllers/Api/MetaController.php` (invokable). It returns
    `new MetaResource(null)`, so the response is wrapped in `data` like every other endpoint.
```

### 2. `specs/001-ticket-management/contracts/api.md` — `GET /meta` body (from line 165)

Current:

```json
{
  "statuses":   [ { "value": "open", "label": "Open" }, "..." ],
  "priorities": [ { "value": "low", "label": "Low" }, "..." ],
  "categories": [ { "value": "billing", "label": "Billing" }, "..." ],
  "transitions": {
    "open": ["in_progress"],
    "in_progress": ["resolved"],
    "resolved": ["closed", "in_progress"],
    "closed": []
  }
}
```

New:

```json
{
  "data": {
    "statuses":   [ { "value": "open", "label": "Open" }, "..." ],
    "priorities": [ { "value": "low", "label": "Low" }, "..." ],
    "categories": [ { "value": "billing", "label": "Billing" }, "..." ],
    "transitions": {
      "open": ["in_progress"],
      "in_progress": ["resolved"],
      "resolved": ["closed", "in_progress"],
      "closed": []
    }
  }
}
```

### 3. `specs/001-ticket-management/plan.md` — Project Structure (line 127)

Current:

```text
│   │       └── HistoryResource.php
```

New:

```text
│   │       ├── HistoryResource.php
│   │       └── MetaResource.php           # enums → statuses/priorities/categories/transitions
```

### 4. `specs/001-ticket-management/plan.md` — Constitution Check row III (line 67)

Current:

```markdown
All bodies go through `TicketResource`, `NoteResource`, `AgentResource`, `CustomerResource`, and `HistoryResource`.
```

New:

```markdown
All bodies go through `TicketResource`, `NoteResource`, `AgentResource`, `CustomerResource`, `HistoryResource`, and `MetaResource`.
```

---

## C2 — Pages that depend on `/meta` must show loading and error states (Constitution VII)

**Why:** Constitution VII says every data-driven view must handle loading, empty, error, and 404
states. The create page and the list filters build their dropdowns from `/meta` and `/agents`.
Right now no task says what happens while those load or if they fail, so the user would see empty
dropdowns with no explanation.

### 1. `specs/001-ticket-management/tasks.md` — T034 (lines 480–487)

Current:

```markdown
  - Inputs: customer name, email, phone, subject, description, and category/priority selects
    from `meta`.
  - A `FieldError` under each input.
  - The submit button is disabled while saving.
  - On success it routes to `/tickets/{id}`.

  Tests in `frontend/src/__tests__/pages/TicketCreate.spec.js` (422 errors render under the
  matching inputs; a successful submit redirects).
```

New:

```markdown
  - Calls `loadReferenceData()` on mount. While `metaLoading` is true, it shows
    `StateMessage type="loading"` instead of the form. If `metaError` is set, it shows
    `StateMessage type="error"` with a retry that calls `loadReferenceData()` again.
  - Inputs: customer name, email, phone, subject, description, and category/priority selects
    from `meta`.
  - A `FieldError` under each input.
  - The submit button is disabled while saving.
  - On success it routes to `/tickets/{id}`.

  Tests in `frontend/src/__tests__/pages/TicketCreate.spec.js`: the loading state, the
  reference-data error with retry, 422 errors rendered under the matching inputs, and a
  successful submit redirecting.
```

### 2. `specs/001-ticket-management/tasks.md` — T030 (lines 450–451)

Current:

```markdown
  - Uses `StateMessage` for loading, empty ("No tickets match these filters."), and error (with
    retry).
```

New:

```markdown
  - Uses `StateMessage` for loading, empty ("No tickets match these filters."), and error (with
    retry).
  - Calls `loadReferenceData()` on mount. If it fails, it shows an inline error above the filters
    with a retry, and the ticket table still loads.
```

---

## I1 — Remove hard-coded status strings from the frontend

**Why:** T035–T037 compare against `'closed'`, `'resolved'`, and `'in_progress'` in JavaScript.
That contradicts T039's own sweep ("no hard-coded status strings outside the enums") and
Constitution II's rule that the enums are the single source of truth. If the backend sends whether
the ticket is closed and the button text for each move, the frontend never has to compare status
strings.

### 1. `specs/001-ticket-management/data-model.md` — TicketStatus methods (lines 19–20)

Current:

```markdown
Methods: `label(): string`, `allowedTransitions(): array<self>`, `canTransitionTo(self): bool`,
`isClosed(): bool`.
```

New:

```markdown
Methods: `label(): string`, `allowedTransitions(): array<self>`, `canTransitionTo(self): bool`,
`isClosed(): bool`, `actionLabel(self $to): string` (button text for a move: "Reopen" for
resolved → in_progress, otherwise the target's label).
```

### 2. `specs/001-ticket-management/tasks.md` — T005 (lines 83 and 86)

Current (line 83):

```markdown
    `isClosed(): bool`; and a static `options(): array` returning `[{value, label}]`.
```

New:

```markdown
    `isClosed(): bool`; `actionLabel(self $to): string` ("Reopen" for resolved → in_progress,
    otherwise `$to->label()`); and a static `options(): array` returning `[{value, label}]`.
```

Current (line 86):

```markdown
    return true, including that same-status moves are false. It also covers labels, `isClosed()`,
```

New:

```markdown
    return true, including that same-status moves are false. It also covers labels, `isClosed()`,
    `actionLabel()` for all 4 allowed moves,
```

### 3. `specs/001-ticket-management/tasks.md` — T011 (line 161)

Current:

```markdown
    - `allowed_transitions` as `[{value, label}]`.
```

New:

```markdown
    - `is_closed` as a boolean from `$this->status->isClosed()`.
    - `allowed_transitions` as `[{value, label, action_label}]`, where `action_label` comes from
      `TicketStatus::actionLabel()`.
```

### 4. `specs/001-ticket-management/contracts/api.md` — Ticket example (line 41) and notes (line 57)

Current (line 41):

```json
  "allowed_transitions": [{ "value": "in_progress", "label": "In Progress" }],
```

New:

```json
  "is_closed": false,
  "allowed_transitions": [
    { "value": "in_progress", "label": "In Progress", "action_label": "In Progress" }
  ],
```

Current (line 57):

```markdown
- `allowed_transitions` is `[]` when the ticket is Closed.
```

New:

```markdown
- `is_closed` is `true` and `allowed_transitions` is `[]` when the ticket is Closed.
- `action_label` is the button text; it is "Reopen" for Resolved → In Progress.
```

### 5. `specs/001-ticket-management/research.md` — R9 (line 87)

Current:

```markdown
- **Decision**: `TicketResource` includes `allowed_transitions` (an array of `{value, label}`),
```

New:

```markdown
- **Decision**: `TicketResource` includes `is_closed` and `allowed_transitions` (an array of
  `{value, label, action_label}`),
```

### 6. `specs/001-ticket-management/tasks.md` — T035 (line 495)

Current:

```markdown
  `frontend/src/pages/TicketDetail.vue`, hidden when the status is `closed`. Tests in
```

New:

```markdown
  `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. Tests in
```

### 7. `specs/001-ticket-management/tasks.md` — T036 (lines 503 and 507)

Current (line 503):

```markdown
  per `ticket.allowed_transitions` entry only** ("Reopen" label for resolved → in_progress), shows
```

New:

```markdown
  per `ticket.allowed_transitions` entry only**, labelled with its `action_label`, and shows
```

Current (line 507):

```markdown
  "In Progress", a resolved ticket shows "Closed" + "Reopen", a closed ticket shows no buttons, and
```

New:

```markdown
  "In Progress", a resolved ticket shows two buttons labelled from `action_label` ("Closed",
  "Reopen"), a closed ticket shows no buttons, and
```

### 8. `specs/001-ticket-management/tasks.md` — T037 (line 516)

Current:

```markdown
  render it in `frontend/src/pages/TicketDetail.vue`, hidden when closed. Tests in
```

New:

```markdown
  render it in `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. Tests in
```

---

## I2 — The "attributed to Supervisor" assumption *(spec decision)*

**Why:** The spec says every action is attributed to "Supervisor", but no field, history text, or
task does that, so the plan and tasks don't deliver what the spec claims. With only one user,
recording who acted adds no information. Removing the claim is the simpler option
(Constitution VIII) and needs only one edit.

### `specs/001-ticket-management/spec.md` — Assumptions (lines 309–310)

Current:

```markdown
- A single supervisor uses the system; there is no login, and all actions are attributed to
  "Supervisor".
```

New (recommended):

```markdown
- A single supervisor uses the system and there is no login, so actions are not attributed to a
  person; each history entry records what changed and when.
```

**Other option:** keep attribution. Then append " by Supervisor" to every history description
template in `data-model.md` (History descriptions table), and change T013, T017, T019, T021, and
their tests to expect it. That's about 6 more edits for no practical benefit.

---

## Summary

- **Files touched when applied:** `tasks.md` (T005, T011, T012, T030, T034, T035, T036, T037),
  `contracts/api.md`, `data-model.md`, `research.md`, `plan.md`, and one assumption in `spec.md`.
- **Task count:** unchanged at 42.
- **Effect:** C1 and C2 clear both critical findings from the analysis.
- **Not included here:** I3, I4, G1, G2, G3, and the low-severity findings from the analysis report.
- **Next step:** after applying, re-run `/speckit-analyze` to confirm.
