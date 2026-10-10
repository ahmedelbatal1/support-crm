# Proposed Fixes from /speckit-analyze (Part 3)

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-07 | **Status**: Applied 2026-10-10

These are the suggested edits for findings G1, G2, and G3 from the `/speckit-analyze` report. None
of them has been applied. Line numbers refer to the files after the
[analyze-fixes.md](./analyze-fixes.md) and [analyze-fixes-2.md](./analyze-fixes-2.md) edits were
applied. The low-severity fixes applied on 2026-10-10 (U1, I5, D1, I6, I7, I8) shifted some
`tasks.md` lines by a few rows, so match on the quoted text rather than the line numbers. G1's
"current" text was updated to reflect the I6 change to T041.

| ID | Severity | Summary | Files |
|----|----------|---------|-------|
| G1 | MEDIUM | SC-007 (≤2 s with 10,000 tickets) is never checked | tasks.md |
| G2 | MEDIUM | No reload after a rejected action (stale-data edge case) | tasks.md |
| G3 | LOW | History immutability (FR-022) is untested; rollback (FR-023) is tested only for status changes | data-model.md, tasks.md |

---

## G1 — Verify the 2-second target with 10,000 tickets (SC-007)

**Why:** SC-007 is a measurable target, but only the indexes in T008 support it, and nothing checks
it. A one-time timed check during the quickstart run proves it without adding code, packages, or a
task. It runs against a scratch database so the normal seed data stays untouched.

### `specs/001-ticket-management/tasks.md` — T041

Current (as changed by the I6 fix on 2026-10-10):

```markdown
- [ ] T041 Run the [quickstart.md](./quickstart.md) setup from scratch on WAMP, then do manual
  scenarios 1–13. Do not fix defects inside this task: add each one to this file as a new
  follow-up task (T043, T044, …) with its own `fix(...)` commit message. Log the results in
  `docs/ai-usage.md`.
```

New:

```markdown
- [ ] T041 Run the [quickstart.md](./quickstart.md) setup from scratch on WAMP, then do manual
  scenarios 1–13. Then check SC-007:
  - point `.env` at a scratch database `support_crm_perf` and run `php artisan migrate:fresh --seed`;
  - in `php artisan tinker`, run `App\Models\Ticket::factory()->count(10000)->create()`;
  - time `GET /api/tickets`, `GET /api/tickets?status=open&search=refund`, and
    `GET /api/tickets/{id}` with `curl -o NUL -s -w "%{time_total}"`, and confirm each takes
    under 2 s;
  - point `.env` back at `support_crm`.

  Do not fix defects inside this task: add each one to this file as a new follow-up task (T043,
  T044, …) with its own `fix(...)` commit message. Log the results, including the timings, in
  `docs/ai-usage.md`.
```

---

## G2 — Refresh the ticket after a rejected action (stale-data edge case)

**Why:** The spec's edge cases say that if the screen is out of date (for example, the ticket was
closed in another tab), the rejected action shows the rule's message and the latest state can be
reloaded. No task does this today. A silent re-fetch after any 422 brings the page up to date
without blanking it. The silent option is needed because a normal `fetchTicket` sets
`ticketLoading`, which would replace the page with a loading message and hide the error.

This edit also fixes a grammar slip in T036 introduced by the I1 edit ("…`action_label`, and shows
… on a 422, and disables …").

### 1. `specs/001-ticket-management/tasks.md` — T031 (lines 468–470)

Current:

```markdown
- [ ] T031 [US3] Extend `frontend/src/stores/tickets.js` with `currentTicket`, `ticketLoading`,
  `ticketError`, `ticketNotFound`, and `fetchTicket(id)`, which sets `ticketNotFound` on a 404.
  Tests go in the store spec.
```

New:

```markdown
- [ ] T031 [US3] Extend `frontend/src/stores/tickets.js` with `currentTicket`, `ticketLoading`,
  `ticketError`, `ticketNotFound`, and `fetchTicket(id, { silent = false } = {})`, which sets
  `ticketNotFound` on a 404. With `silent: true` it replaces `currentTicket` without touching
  `ticketLoading`, so the page doesn't flash a loading state. Tests go in the store spec,
  including the silent mode.
```

### 2. `specs/001-ticket-management/tasks.md` — T035 (lines 506–510)

Current:

```markdown
- [ ] T035 [US4] Add `assignAgent(id, agentId)` to `frontend/src/stores/tickets.js`; it replaces
  `currentTicket`. Create `frontend/src/components/AssignAgentForm.vue` (an agent select and an
  "Assign"/"Reassign" button, with a `FieldError` for `agent_id`) and render it in
  `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. Tests in
  `frontend/src/__tests__/components/AssignAgentForm.spec.js`.
```

New:

```markdown
- [ ] T035 [US4] Add `assignAgent(id, agentId)` to `frontend/src/stores/tickets.js`; it replaces
  `currentTicket`. Create `frontend/src/components/AssignAgentForm.vue` (an agent select and an
  "Assign"/"Reassign" button, with a `FieldError` for `agent_id`) and render it in
  `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. On a 422, it
  keeps the error message on screen and calls `fetchTicket(id, { silent: true })`, so the page
  shows the ticket's latest state (spec edge case: stale data). Tests in
  `frontend/src/__tests__/components/AssignAgentForm.spec.js`, including that a 422 triggers a
  silent re-fetch.
```

### 3. `specs/001-ticket-management/tasks.md` — T036 (lines 515–523)

Current:

```markdown
- [ ] T036 [US5] Add `changeStatus(id, status)` to `frontend/src/stores/tickets.js`; it replaces
  `currentTicket`. Create `frontend/src/components/StatusActions.vue`, which renders **one button
  per `ticket.allowed_transitions` entry only**, labelled with its `action_label`, and shows
  the `errors.status` message on a 422, and disables buttons while saving. Render it in
  `frontend/src/pages/TicketDetail.vue`. Tests in
  `frontend/src/__tests__/components/StatusActions.spec.js`: an open ticket shows only
  "In Progress", a resolved ticket shows two buttons labelled from `action_label` ("Closed",
  "Reopen"), a closed ticket shows no buttons, and
  a 422 message is displayed.
```

New:

```markdown
- [ ] T036 [US5] Add `changeStatus(id, status)` to `frontend/src/stores/tickets.js`; it replaces
  `currentTicket`. Create `frontend/src/components/StatusActions.vue`, which renders **one button
  per `ticket.allowed_transitions` entry only**, labelled with its `action_label`. It disables the
  buttons while saving. On a 422, it shows the `errors.status` message and calls
  `fetchTicket(id, { silent: true })`, so the page shows the ticket's latest state (spec edge
  case: stale data). Render it in `frontend/src/pages/TicketDetail.vue`. Tests in
  `frontend/src/__tests__/components/StatusActions.spec.js`: an open ticket shows only
  "In Progress", a resolved ticket shows two buttons labelled from `action_label` ("Closed",
  "Reopen"), a closed ticket shows no buttons, and a 422 shows its message and triggers a silent
  re-fetch.
```

### 4. `specs/001-ticket-management/tasks.md` — T037 (lines 528–533)

Current:

```markdown
- [ ] T037 [US6] Add `addNote(id, body)` to `frontend/src/stores/tickets.js`; it re-fetches the
  ticket so the notes and history update. Create `frontend/src/components/NoteForm.vue` (a
  textarea, a 2,000-character counter, and a `FieldError` for `body`; it clears on success) and
  render it in `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. Tests in
  `frontend/src/__tests__/components/NoteForm.spec.js`, including that `<b>hi</b>` renders as
  literal text.
```

New:

```markdown
- [ ] T037 [US6] Add `addNote(id, body)` to `frontend/src/stores/tickets.js`; it re-fetches the
  ticket so the notes and history update. Create `frontend/src/components/NoteForm.vue` (a
  textarea, a 2,000-character counter, and a `FieldError` for `body`; it clears on success) and
  render it in `frontend/src/pages/TicketDetail.vue`, hidden when `ticket.is_closed` is true. On a
  422, it keeps the error message and the typed text on screen and calls
  `fetchTicket(id, { silent: true })`, so the page shows the ticket's latest state (spec edge
  case: stale data). Tests in `frontend/src/__tests__/components/NoteForm.spec.js`, including
  that `<b>hi</b>` renders as literal text and that a 422 triggers a silent re-fetch.
```

---

## G3 — Prove that history can't be changed, and test rollback for assignment and notes

**Why:** FR-022 (history entries can't be edited or deleted) is only promised by "there is no code
path", so nothing stops a later change and nothing tests it. A small model guard turns the promise
into enforced, testable behavior. FR-023 (a change and its history entry are saved together or not
at all) applies to assignment and notes as much as to status changes, but only T019 has a rollback
test. Two extra tests close that gap using the same technique as T019.

### 1. `specs/001-ticket-management/data-model.md` — ticket_histories note (lines 124–125)

Current:

```markdown
`const UPDATED_AT = null`. `$fillable = [event, description, old_value, new_value]`. There is no
update or delete code path (FR-022).
```

New:

```markdown
`const UPDATED_AT = null`. `$fillable = [event, description, old_value, new_value]`. The model
blocks changes: `booted()` registers `updating` and `deleting` listeners that throw
`LogicException('Ticket history is append-only.')` (FR-022). Deleting a ticket still removes its
history, because the database foreign-key cascade does not fire model events.
```

### 2. `specs/001-ticket-management/tasks.md` — T009, the `TicketHistory` model (lines 137–141)

Current:

```markdown
  - `backend/app/Models/TicketHistory.php` with `const UPDATED_AT = null`,
    `$fillable = ['event','description','old_value','new_value']`, and `event` cast to
    TicketHistoryEvent.

  Both use `belongsTo(Ticket)`.
```

New:

```markdown
  - `backend/app/Models/TicketHistory.php` with `const UPDATED_AT = null`,
    `$fillable = ['event','description','old_value','new_value']`, `event` cast to
    TicketHistoryEvent, and a `booted()` method whose `updating` and `deleting` listeners throw
    `LogicException('Ticket history is append-only.')`.

  Both use `belongsTo(Ticket)`.

  Add `backend/tests/Feature/TicketHistoryTest.php`, asserting that updating or deleting a
  history row throws, and that deleting its ticket removes the history rows (FR-022).
```

### 3. `specs/001-ticket-management/tasks.md` — T017 (line 290)

Current:

```markdown
  Extend `backend/tests/Feature/TicketServiceTest.php` with assign cases.
```

New:

```markdown
  Extend `backend/tests/Feature/TicketServiceTest.php` with assign cases, including a rollback
  test (FR-023): with a `TicketHistory::creating` listener that throws, `agent_id` is unchanged
  after the exception.
```

### 4. `specs/001-ticket-management/tasks.md` — T021 (line 348)

Current:

```markdown
  "Note added". Extend `backend/tests/Feature/TicketServiceTest.php` with note cases.
```

New:

```markdown
  "Note added". Extend `backend/tests/Feature/TicketServiceTest.php` with note cases, including a
  rollback test (FR-023): with a `TicketHistory::creating` listener that throws, the ticket has no
  notes after the exception.
```

---

## Summary

- **Files touched when applied:** `tasks.md` (T009, T017, T021, T031, T035, T036, T037, T041) and
  `data-model.md` (the ticket_histories note).
- **Task count:** unchanged at 42. G3 adds one test file (`TicketHistoryTest.php`) inside T009.
- **Not included here:** the low-severity findings from the analysis report (D1, G4, I5–I9).
  I7 noted that the plan's structure doesn't list every test file; `TicketHistoryTest.php` would
  join that list.
- **Next step:** after applying, re-run `/speckit-analyze` to confirm.
