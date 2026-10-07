# Research: Ticket Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-07

All Technical Context items were known from user input or the existing scaffold. The entries
below record the decisions that the spec and input left open.

## R1. Laravel version

- **Decision**: Target the installed Laravel **12.x** (12.69.3) on PHP 8.2.26.
- **Rationale**: The request said Laravel 11, but `backend/` is already scaffolded on Laravel 12.
  Laravel 12 keeps the 11 application structure (`bootstrap/app.php`, `routes/api.php`, no
  `Kernel`), so every design choice below applies unchanged. Downgrading would add work for no
  benefit (Constitution VIII).
- **Alternatives considered**: Re-scaffold on Laravel 11. Rejected because it adds churn and has no
  functional difference for this module.

## R2. Ticket number generation (TCK-0001)

- **Decision**: Insert the ticket, then set `number = 'TCK-' . str_pad($id, 4, '0', STR_PAD_LEFT)`
  inside the same transaction. `number` is a nullable, unique column that is always filled before
  the transaction commits.
- **Rationale**: The auto-increment id is already unique, sequential, concurrency-safe, and never
  reused (MySQL 8 persists the counter). It handles TCK-10000+ naturally (FR-006, edge cases).
- **Alternatives considered**: `MAX(number)+1` (racy under concurrent creates, needs locking); a
  separate counter table (extra table, no benefit).

## R3. Business-rule errors (invalid transition, closed ticket, missing agent, same agent)

- **Decision**: Add one exception class, `App\Exceptions\TicketRuleException`, with named
  constructors: `invalidTransition($from, $to)`, `closed()`, `agentRequired()`, and
  `alreadyAssigned($agent)`. Each carries a field key (`status`, `agent_id`, `body`). Its
  `render()` returns 422 in Laravel's validation shape: `{ "message": ..., "errors": { field: [msg] } }`.
- **Rationale**: The frontend can show rule failures under the same inputs as validation errors.
  One class keeps the codebase small (Constitution III, VIII).
- **Alternatives considered**: One class per rule (four near-identical classes); validating rules
  inside Form Requests (puts business rules outside the service, violating Constitution II).

## R4. Where transitions live

- **Decision**: `TicketStatus::allowedTransitions(): array` and
  `TicketStatus::canTransitionTo(self $to): bool` are defined on the enum.
  `TicketService::changeStatus()` calls them and also checks the closed-ticket and agent-required
  rules.
- **Rationale**: The enum is the single source of truth (Constitution II). The enum methods are pure
  and can be unit-tested without a database (Constitution IV).

## R5. 404 handling

- **Decision**: In `bootstrap/app.php`, use `shouldRenderJsonWhen(fn ($r) => $r->is('api/*'))` and
  render `NotFoundHttpException` for `api/*` as `{ "message": "Ticket not found." }` when the
  previous exception is a `ModelNotFoundException` for `Ticket`; otherwise
  `{ "message": "Resource not found." }`.
- **Rationale**: Every API 404 is JSON regardless of the `Accept` header (Constitution III, FR-012).

## R6. Concurrency on state changes

- **Decision**: Each service mutation runs in `DB::transaction()`, re-reads the ticket with
  `lockForUpdate()`, validates the rules against the fresh row, then writes the change and the
  history entry.
- **Rationale**: Two tabs cannot both close or reopen the same ticket, and a change is never saved
  without its history entry (FR-023, Constitution V). SQLite ignores the lock, which is harmless in
  tests.

## R7. Customer reuse by email

- **Decision**: Lower-case and trim the email in `StoreTicketRequest::prepareForValidation()`. The
  service then calls `Customer::firstOrCreate(['email' => $email], ['name' => ..., 'phone' => ...])`
  inside the create transaction. `customers.email` is unique.
- **Rationale**: This gives case-insensitive matching (FR-004) and does not overwrite existing
  customer data (assumption in the spec).

## R8. List filters and search

- **Decision**: `ListTicketsRequest` validates `status`, `priority`, and `category` with
  `Rule::enum`, `agent_id` as `exists:agents,id` or the literal `none`, `search` as a string up to
  100 characters, and `page` as an integer of at least 1. The query uses `when()` clauses combined
  with AND. Search uses `where(subject LIKE ? OR number LIKE ?)` with `%`, `_`, and `\` escaped.
  Results are sorted by `id DESC` and paginated with `paginate(15)`.
- **Rationale**: Unknown filter values return 422 (edge case). The LIKE input is escaped and
  bound, never raw (Constitution VI). MySQL's default `utf8mb4_unicode_ci` collation and SQLite's
  ASCII LIKE are both case-insensitive (FR-009).
- **Alternatives considered**: Full-text index or Scout (overkill, extra package).

## R9. Allowed next statuses for the UI

- **Decision**: `TicketResource` includes `is_closed` and `allowed_transitions` (an array of
  `{value, label, action_label}`),
  which is empty when the ticket is Closed. `GET /api/meta` also returns the full transition map.
- **Rationale**: Status buttons render exactly what the backend allows, with no duplicate rule
  table in JavaScript.

## R10. CORS

- **Decision**: Publish `config/cors.php` (`php artisan config:publish cors`) and set
  `allowed_origins` from `env('FRONTEND_URL', 'http://localhost:5173')`, with paths `api/*`.
- **Rationale**: Only the Vite dev server is allowed instead of `*`. No package is needed because
  CORS handling is built into Laravel.

## R11. Unused scaffold pieces

- **Decision**: Replace the default `/user` route in `routes/api.php` (it uses `auth:sanctum`).
  Leave `laravel/sanctum` installed but unused, because removing it is outside this module's scope.
  The Vue scaffold's `stores/counter.js` and sample test are replaced.
- **Rationale**: Authentication is out of scope (Constitution I). No new dependencies are added on
  either side (Constitution VIII).

## R12. Seed data

- **Decision**: `AgentSeeder` creates 5 agents and `CustomerSeeder` creates 10 customers (both via
  factories). `TicketSeeder` creates 30 tickets **through `TicketService`**, then applies random
  valid assignments, transitions, and notes.
- **Rationale**: All seeded tickets get correct numbers and consistent history. Factories alone
  would produce tickets whose history does not match their status.

## R13. Frontend structure and state

- **Decision**:
  - `src/api/http.js` sets up an Axios instance with `baseURL = import.meta.env.VITE_API_URL ??
    'http://localhost:8000/api'` and `Accept: application/json`. A response interceptor normalizes
    errors to `{ status, message, errors }`.
  - `src/api/tickets.js` and `src/api/meta.js` expose one function per endpoint.
  - The single Pinia store, `src/stores/tickets.js`, holds the list, filters, pagination, the
    current ticket, meta and agents, plus `loading` and `error` flags.
  - List filters are synced to the URL query string, so back navigation and refresh keep them.
- **Rationale**: Components never touch URLs (Constitution VII). One store meets the user's request.
- **Alternatives considered**: Per-page local state only (loses filters on back navigation).

## R14. Frontend testing

- **Decision**: Vitest with `@vue/test-utils` and jsdom (already installed). Store tests mock
  `src/api/*`. Component tests cover status buttons (only allowed transitions), 422 field errors
  under inputs, and the loading, empty, error, and 404 states.
- **Rationale**: Uses existing dev dependencies and needs no new packages.
