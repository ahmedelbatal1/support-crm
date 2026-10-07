<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: all template placeholders replaced (initial ratification)
- Added principles:
  I. Scope Discipline
  II. Separation of Concerns
  III. API Consistency
  IV. Test Coverage (NON-NEGOTIABLE)
  V. Data Integrity
  VI. Security
  VII. Frontend Architecture
  VIII. Simplicity
  IX. Git Discipline
  X. Accountable AI Usage
- Added sections: Technology Stack & Constraints; Development Workflow & Quality Gates; Governance
- Removed sections: none
- Templates: dependent templates read the constitution at runtime; none modified by this command
- Follow-up TODOs: docs/ai-usage.md must exist before the first AI-assisted commit (Principle X)
-->

# Support CRM Constitution

Customer Support CRM sample, scoped to the Ticket Management module only.

## Core Principles

### I. Scope Discipline

- The project MUST deliver exactly one module (Ticket Management) end to end: backend API,
  frontend UI, and tests.
- Features not described in the active spec MUST NOT be built. Explicitly out of scope:
  authentication, SLA tracking, AI features, inbound channels (email, chat, etc.), and reports.
- Any scope addition MUST go through a spec change first, never directly into code.

**Rationale**: A small, complete module demonstrates quality better than many partial ones.

### II. Separation of Concerns

- Laravel controllers MUST stay thin: receive the request, delegate, return a resource.
- Input validation MUST live in Form Request classes, not in controllers or models.
- Business rules (e.g., allowed status transitions, history recording) MUST live in a
  dedicated service class.
- PHP enums MUST be the single source of truth for ticket status, priority, and category;
  validation rules, services, resources, and seeders MUST reference the enums rather than
  hard-coded strings.

**Rationale**: Each rule has one home, so it is easy to find, test, and change.

### III. API Consistency

- The backend MUST expose a JSON REST API.
- Successful creation MUST return HTTP 201.
- Validation failures and business-rule violations MUST return HTTP 422 with field-level
  errors in Laravel's standard `errors` format.
- Missing resources MUST return HTTP 404 as JSON, never an HTML page.
- All response bodies MUST be shaped by API Resource classes; models MUST NOT be returned raw.

**Rationale**: A predictable contract lets the frontend handle every response uniformly.

### IV. Test Coverage (NON-NEGOTIABLE)

- Every acceptance criterion in the spec MUST be covered by at least one PHPUnit feature test.
- Status transition rules MUST have unit tests covering both allowed and rejected transitions.
- The test suite MUST run against SQLite in memory and MUST NOT depend on a local MySQL server.
- A task is not complete until its tests pass.

**Rationale**: Acceptance criteria are only met when a test proves it.

### V. Data Integrity

- A ticket status change and its corresponding history entry MUST be written inside a single
  database transaction; either both persist or neither does.
- Writes spanning more than one table MUST use a transaction.

**Rationale**: Ticket history is an audit trail; it must never disagree with the ticket.

### VI. Security

- All input MUST be validated before use.
- Models MUST declare `$fillable`; mass assignment through `$guarded = []` is forbidden.
- Raw SQL containing user input is forbidden; use Eloquent or the query builder with bindings.
- The frontend MUST NOT render user-supplied text with `v-html`.
- `.env` files, credentials, and secrets MUST NEVER be committed; only `.env.example` is tracked.

**Rationale**: These rules close the most common injection, XSS, and leakage paths by default.

### VII. Frontend Architecture

- The frontend MUST use Vue 3 with the Composition API, Pinia for state, and Vue Router for
  navigation.
- Components MUST NOT call URLs directly; all HTTP access MUST go through a dedicated API layer
  (e.g., `src/api/`).
- Every data-driven view MUST handle loading, empty, error, and not-found (404) states.

**Rationale**: A single API layer isolates backend changes; explicit states prevent blank or
broken screens.

### VIII. Simplicity

- The simplest solution that satisfies the spec MUST be preferred (YAGNI).
- New Composer or npm packages MUST NOT be added without a stated reason in the plan or commit
  message, and only when the framework cannot reasonably do the job.

**Rationale**: Fewer moving parts mean less to review, test, and maintain.

### IX. Git Discipline

- Each task MUST be delivered as one focused commit.
- Commit messages MUST follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`, `refactor:`).
- Commits MUST NOT mix unrelated changes.

**Rationale**: Small, labeled commits make history reviewable and changes easy to revert.

### X. Accountable AI Usage

- Every AI-generated change MUST be reviewed line by line by a human before commit.
- Every AI-generated change MUST be covered by passing tests before commit.
- Every AI-assisted task MUST be logged in `docs/ai-usage.md` (what was generated, what was
  changed during review, and how it was verified).

**Rationale**: The developer remains accountable for all code, regardless of who wrote it.

## Technology Stack & Constraints

- **Backend**: Laravel (PHP) in `backend/`, JSON REST API, Eloquent ORM, PHPUnit.
- **Frontend**: Vue 3 (Composition API), Pinia, Vue Router in `frontend/`.
- **Test database**: SQLite in memory.
- **Module boundary**: Ticket Management only (tickets, status, priority, category, status
  history). Anything beyond this boundary requires a constitution or spec amendment.

## Development Workflow & Quality Gates

- Work follows the Spec Kit flow: specify → clarify (as needed) → plan → tasks → implement.
- The plan's Constitution Check MUST pass before implementation; any violation MUST be
  justified in the plan's Complexity Tracking table.
- Before each commit:
  1. The full backend test suite passes.
  2. The change is limited to a single task.
  3. No secrets or `.env` files are staged.
  4. If AI assisted, the review is done and `docs/ai-usage.md` is updated.
- Reviews MUST check controllers for business logic, components for direct URL calls, and
  user text for `v-html` usage.

## Governance

- This constitution supersedes all other project practices. Where a spec, plan, or task
  conflicts with it, the constitution wins until it is amended.
- Amendments MUST be made via `/speckit-constitution`, recorded with a Sync Impact Report, and
  committed separately with a `docs:` commit.
- Versioning follows semantic versioning:
  - MAJOR: removal or incompatible redefinition of a principle.
  - MINOR: a new principle or section, or materially expanded guidance.
  - PATCH: clarifications and wording fixes.
- Compliance is verified at plan time (Constitution Check), at review time for every commit,
  and by `/speckit-analyze` before implementation.

**Version**: 1.0.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-07
