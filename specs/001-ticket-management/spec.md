# Feature Specification: Ticket Management

**Feature Branch**: `001-ticket-management`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Ticket Management module for a Customer Support CRM. Support teams lose
track of customer requests. Each request needs one owner, a clear status, and a full history.
A single support supervisor (no login) creates tickets, lists and filters them, views details,
assigns agents, changes status through a fixed flow, and adds internal notes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a customer request as a ticket (Priority: P1)

The supervisor receives a customer request and records it as a ticket: customer name, email,
optional phone, subject, description, category, and priority. If a customer with that email
already exists, the ticket is linked to that existing customer instead of creating a duplicate.
The new ticket starts as Open and receives a readable number (e.g., TCK-0001).

**Why this priority**: Without capturing requests, nothing else in the module has value. This is
the minimum that stops requests from being lost.

**Independent Test**: Create a ticket with valid data and confirm it is saved with status Open,
a TCK number, the correct customer, and a "ticket created" history entry.

**Acceptance Scenarios**:

1. **Given** no existing tickets, **When** the supervisor submits a valid ticket, **Then** the
   ticket is saved with number TCK-0001, status Open, no assigned agent, and one history entry
   describing its creation.
2. **Given** a customer with email `sara@example.com` exists, **When** a new ticket is submitted
   with the same email (any letter case), **Then** the ticket is linked to that existing customer
   and no new customer is created.
3. **Given** the form is submitted with a missing customer name, an invalid email, a missing
   subject, a missing category, or a missing priority, **When** the supervisor submits, **Then** no
   ticket is created and an error message is shown next to each invalid field.
4. **Given** the form is submitted with a category or priority outside the fixed lists, **When**
   the supervisor submits, **Then** the ticket is rejected with a field-level error.
5. **Given** ticket TCK-0007 is the latest ticket, **When** a new ticket is created, **Then** it
   receives TCK-0008.

---

### User Story 2 - Find tickets in a list (Priority: P1)

The supervisor sees all tickets in a paginated list (15 per page) showing ticket number,
subject, customer, status, priority, category, assigned agent, and creation date. They can
filter by status, priority, category, and assigned agent, and search by text in the subject or
ticket number.

**Why this priority**: Supervisors must be able to see what is open and who owns it; this is
the core "don't lose track" capability.

**Independent Test**: Create 20 tickets with varied attributes; confirm pagination, each filter,
the search, and filter combinations return exactly the expected tickets.

**Acceptance Scenarios**:

1. **Given** 20 tickets exist, **When** the supervisor opens the list, **Then** page 1 shows 15
   tickets (newest first) and page 2 shows the remaining 5.
2. **Given** tickets with mixed statuses, **When** the supervisor filters by status "In Progress",
   **Then** only In Progress tickets are shown.
3. **Given** tickets with mixed priorities, categories, and agents, **When** the supervisor
   applies a priority, category, or agent filter, **Then** only matching tickets are shown.
4. **Given** several filters and a search term are applied together, **When** the list loads,
   **Then** only tickets matching all of them are shown.
5. **Given** a ticket with subject "Refund not received", **When** the supervisor searches
   "refund", **Then** that ticket is shown.
6. **Given** ticket TCK-0012 exists, **When** the supervisor searches "TCK-0012" or "0012",
   **Then** that ticket is shown.
7. **Given** no tickets match the filters, **When** the list loads, **Then** an empty-state
   message is shown instead of an empty table.

---

### User Story 3 - View full ticket details (Priority: P1)

The supervisor opens one ticket and sees its number, subject, description, category, priority,
status, creation date, customer details (name, email, phone), assigned agent, internal notes,
and full history in time order.

**Why this priority**: Owners and history are only useful if they can be seen in one place.

**Independent Test**: Open an existing ticket with notes and history and confirm all listed
details appear correctly.

**Acceptance Scenarios**:

1. **Given** a ticket with an agent, two notes, and four history entries, **When** the supervisor
   opens it, **Then** all of these are shown with correct values and timestamps.
2. **Given** a ticket with no agent and no notes, **When** it is opened, **Then** the page shows
   "Unassigned" and an empty notes message.
3. **Given** a ticket that does not exist, **When** the supervisor opens its address, **Then** a
   clear "ticket not found" message is shown.

---

### User Story 4 - Assign or reassign an owner (Priority: P2)

The supervisor assigns a ticket to one of the predefined agents, or reassigns it to a different
agent. Each change is recorded in history.

**Why this priority**: Ownership is a stated goal, and it is a prerequisite for moving a ticket
to In Progress.

**Independent Test**: Assign an agent to an Open ticket, then reassign to another agent; confirm
the current agent and two history entries.

**Acceptance Scenarios**:

1. **Given** an unassigned ticket, **When** the supervisor assigns agent "Omar", **Then** Omar is
   the assigned agent and history records "Assigned to Omar".
2. **Given** a ticket assigned to Omar, **When** the supervisor reassigns it to "Lina", **Then**
   Lina is the assigned agent and history records "Reassigned from Omar to Lina".
3. **Given** a ticket assigned to Omar, **When** the supervisor assigns Omar again, **Then** the
   request is rejected with a message that the ticket is already assigned to that agent, and no
   history entry is added.
4. **Given** an agent that does not exist, **When** the supervisor tries to assign it, **Then**
   the request is rejected with a field-level error.
5. **Given** a Closed ticket, **When** the supervisor tries to assign or reassign it, **Then** the
   request is rejected with a message that closed tickets are read-only.

---

### User Story 5 - Move a ticket through its status flow (Priority: P2)

The supervisor changes a ticket's status. Only these moves are allowed: Open → In Progress,
In Progress → Resolved, Resolved → Closed, and Resolved → In Progress (reopen). Every change is
recorded in history.

**Why this priority**: A clear, controlled status is a stated goal, but it builds on tickets and
assignment existing first.

**Independent Test**: Take an assigned ticket through Open → In Progress → Resolved → In Progress
→ Resolved → Closed, then confirm each move succeeded and was recorded; attempt invalid moves and
confirm they are rejected.

**Acceptance Scenarios**:

1. **Given** an Open ticket with an assigned agent, **When** the supervisor moves it to
   In Progress, **Then** the status changes and history records "Status changed from Open to
   In Progress".
2. **Given** an Open ticket with no agent, **When** the supervisor moves it to In Progress,
   **Then** the move is rejected with the message that an agent must be assigned first.
3. **Given** an In Progress ticket, **When** moved to Resolved, **Then** the move succeeds.
4. **Given** a Resolved ticket, **When** moved to Closed, **Then** the move succeeds.
5. **Given** a Resolved ticket, **When** moved back to In Progress, **Then** the move succeeds
   and history records it as a reopen.
6. **Given** an Open ticket, **When** the supervisor tries to move it directly to Resolved or
   Closed, **Then** the move is rejected with a message naming the current and requested status.
7. **Given** an In Progress ticket, **When** moved to Open or Closed, **Then** the move is rejected.
8. **Given** any ticket, **When** the supervisor requests its current status again, **Then** the
   move is rejected.
9. **Given** a Closed ticket, **When** any status change is attempted, **Then** it is rejected
   with a message that closed tickets are read-only.
10. **Given** a status change fails for any reason, **When** the ticket is reloaded, **Then** its
    status and history are unchanged.

---

### User Story 6 - Add internal notes (Priority: P3)

The supervisor adds internal notes to a ticket to record progress or context. Notes are shown
on the ticket, newest last, and each note adds a history entry.

**Why this priority**: Useful context, but the module still meets its core goal without it.

**Independent Test**: Add a note to an Open ticket and confirm it appears on the ticket with a
timestamp and a matching history entry.

**Acceptance Scenarios**:

1. **Given** an open ticket, **When** the supervisor adds the note "Called customer, awaiting
   invoice copy", **Then** the note is shown on the ticket with its time and history records
   "Note added".
2. **Given** an empty or whitespace-only note, **When** submitted, **Then** it is rejected with a
   field-level error.
3. **Given** a Closed ticket, **When** the supervisor tries to add a note, **Then** it is rejected
   with a message that closed tickets are read-only.

---

### Edge Cases

- Two tickets created at the same moment MUST still receive distinct, sequential numbers.
- Ticket numbers continue past TCK-9999 (e.g., TCK-10000) without breaking.
- A ticket number is never reused, even if numbering would otherwise collide.
- When an existing customer's email is reused with a different name or phone, the existing
  customer record is kept unchanged and the ticket links to it.
- Requesting a page number beyond the last page shows the empty state, not an error.
- Unknown filter values (e.g., status "Pending") are rejected with a clear message rather than
  silently ignored.
- Search text containing special characters (e.g., `%`, `_`, quotes) is treated as plain text.
- Customer-supplied text (subject, description, notes) containing markup is displayed as plain
  text, never interpreted.
- Actions on a ticket that does not exist return a "ticket not found" message.
- If the screen shows stale data (e.g., ticket closed in another tab), the rejected action shows
  the rule's message and the latest ticket state can be reloaded.

## Requirements *(mandatory)*

### Functional Requirements

**Ticket creation**

- **FR-001**: System MUST allow the supervisor to create a ticket with customer name, customer
  email, optional customer phone, subject, optional description, category, and priority.
- **FR-002**: System MUST require customer name, a valid customer email, subject, category, and
  priority, and MUST show a field-level error for each missing or invalid field.
- **FR-003**: System MUST accept only the fixed categories (Billing, Technical, Account, General)
  and priorities (Low, Medium, High, Urgent).
- **FR-004**: System MUST match customers by email, case-insensitively; if a match exists the
  ticket MUST link to that customer, otherwise a new customer MUST be created.
- **FR-005**: System MUST set every new ticket's status to Open and leave it unassigned.
- **FR-006**: System MUST give each ticket a unique, sequential, never-reused number in the
  format `TCK-` followed by at least four zero-padded digits.

**Listing and search**

- **FR-007**: System MUST list tickets 15 per page, newest first, with total count and page
  navigation.
- **FR-008**: System MUST support filtering by status, priority, category, and assigned agent,
  including an "unassigned" option for agent, combinable with each other.
- **FR-009**: System MUST support a case-insensitive partial text search on subject and ticket
  number, combinable with filters.
- **FR-010**: System MUST show an empty-state message when no tickets match.

**Ticket details**

- **FR-011**: System MUST show a single ticket with its fields, customer details, assigned agent,
  notes (oldest first), and full history (oldest first) with timestamps.
- **FR-012**: System MUST show a "ticket not found" message for a ticket that does not exist.

**Assignment**

- **FR-013**: System MUST allow assigning an unassigned ticket, or reassigning an assigned ticket,
  to one of the predefined agents.
- **FR-014**: System MUST reject assignment to a non-existent agent and assignment to the agent
  already assigned.
- **FR-015**: Removing an agent from a ticket (unassigning) is not supported.

**Status flow**

- **FR-016**: System MUST allow only these status moves: Open → In Progress, In Progress →
  Resolved, Resolved → Closed, Resolved → In Progress.
- **FR-017**: System MUST reject every other move (including moving to the current status) with a
  message naming the current and requested status.
- **FR-018**: System MUST reject a move to In Progress when the ticket has no assigned agent.

**Notes**

- **FR-019**: System MUST allow adding an internal note of 1 to 2,000 non-whitespace-only
  characters to a ticket.

**Closed tickets**

- **FR-020**: System MUST treat a Closed ticket as read-only: assignment, status changes, and
  notes MUST be rejected with a message that closed tickets cannot be changed.

**History**

- **FR-021**: System MUST add a history entry with timestamp and human-readable description for
  every ticket creation, assignment or reassignment, status change, and note.
- **FR-022**: History entries MUST be append-only; they cannot be edited or deleted.
- **FR-023**: A status change and its history entry MUST be saved together: if either fails,
  neither is saved. The same applies to assignment and notes.

**General**

- **FR-024**: System MUST display all user-entered text as plain text.
- **FR-025**: Every screen that loads data MUST show loading, empty, error, and not-found states
  as applicable.

### Key Entities

- **Customer**: The person who raised the request. Name, email (unique, case-insensitive),
  optional phone. Has many tickets.
- **Agent**: A predefined support agent who can own tickets. Name and email. Not created or
  edited in this module. Owns zero or more tickets.
- **Ticket**: A customer request. Number (TCK-####), subject, optional description, category,
  priority, status, creation and update times. Belongs to one customer; has zero or one
  assigned agent; has many notes and history entries.
- **Note**: Internal text attached to one ticket, with creation time.
- **History Entry**: An immutable record of one event on a ticket: event type (created, assigned,
  status changed, note added), human-readable description, timestamp, and where relevant the
  previous and new value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The supervisor can log a new customer request as a ticket in under 1 minute.
- **SC-002**: The supervisor can locate any ticket by number or subject keyword in under
  10 seconds using search and filters.
- **SC-003**: 100% of tickets beyond the Open state have exactly one assigned agent.
- **SC-004**: 100% of ticket creations, assignments, status changes, and notes appear in the
  ticket's history; no history entry is ever missing or orphaned.
- **SC-005**: 100% of disallowed status moves and changes to Closed tickets are rejected with a
  message that explains why.
- **SC-006**: Every acceptance scenario in this specification is covered by an automated test that
  passes.
- **SC-007**: The ticket list and ticket details appear within 2 seconds with up to 10,000 tickets.

## Assumptions

- A single supervisor uses the system; there is no login, and all actions are attributed to
  "Supervisor".
- Agents are predefined (seeded sample data, e.g., 3–5 agents) and are not managed in this module.
- Ticket description is optional; the user's required-field list did not include it.
- Field limits: customer name and subject up to 255 characters; email up to 255; phone up to
  30 characters; description up to 5,000; note up to 2,000.
- When an existing customer's email is reused, the existing name and phone are not overwritten.
- Ticket subject, description, category, and priority are not editable after creation (not
  requested).
- Notes are internal only and cannot be edited or deleted.
- Times are displayed in the server's configured timezone.
- Out of scope: login and roles, SLA, email/WhatsApp/SMS channels, AI features, knowledge base,
  customer portal, reports, attachments, multi-branch, ticket deletion, and agent management.
