# API Contract: Ticket Management

**Base URL**: `http://localhost:8000/api` · **Format**: JSON · **Auth**: none

All responses are JSON, including errors, regardless of the `Accept` header.

## Common shapes

### Error: 422 (validation or business rule)

```json
{
  "message": "Cannot change status from Open to Resolved.",
  "errors": { "status": ["Cannot change status from Open to Resolved."] }
}
```

### Error: 404

```json
{ "message": "Ticket not found." }
```

### Enum value object

```json
{ "value": "in_progress", "label": "In Progress" }
```

### Ticket (TicketResource)

```json
{
  "id": 12,
  "number": "TCK-0012",
  "subject": "Refund not received",
  "description": "Paid twice in September.",
  "status": { "value": "open", "label": "Open" },
  "priority": { "value": "high", "label": "High" },
  "category": { "value": "billing", "label": "Billing" },
  "is_closed": false,
  "allowed_transitions": [
    { "value": "in_progress", "label": "In Progress", "action_label": "In Progress" }
  ],
  "customer": { "id": 3, "name": "Sara Ali", "email": "sara@example.com", "phone": null },
  "agent": { "id": 2, "name": "Omar Hassan", "email": "omar@example.com" },
  "notes": [ { "id": 5, "body": "Called customer.", "created_at": "2026-10-07T09:15:00+03:00" } ],
  "history": [
    {
      "id": 40, "event": "created", "description": "Ticket TCK-0012 created",
      "old_value": null, "new_value": null, "created_at": "2026-10-07T09:00:00+03:00"
    }
  ],
  "created_at": "2026-10-07T09:00:00+03:00",
  "updated_at": "2026-10-07T09:15:00+03:00"
}
```

- `agent` is `null` when the ticket is unassigned.
- `is_closed` is `true` and `allowed_transitions` is `[]` when the ticket is Closed.
- `action_label` is the button text; it is "Reopen" for Resolved → In Progress.
- `notes` and `history` appear **only** on the single-ticket responses (show, create, assign,
  status). They are omitted in the list.

---

## GET /tickets

Lists tickets, newest first, 15 per page.

| Query      | Type   | Notes                                              |
|------------|--------|----------------------------------------------------|
| `status`   | enum   | `open`, `in_progress`, `resolved`, `closed`        |
| `priority` | enum   | `low`, `medium`, `high`, `urgent`                  |
| `category` | enum   | `billing`, `technical`, `account`, `general`       |
| `agent_id` | int \| `none` | `none` = unassigned                         |
| `search`   | string | max 100; partial, case-insensitive on subject or number |
| `page`     | int    | ≥ 1; a page past the last returns empty `data`     |

**200**

```json
{
  "data": [ /* Ticket without notes/history */ ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": { "current_page": 1, "last_page": 2, "per_page": 15, "total": 20, "from": 1, "to": 15 }
}
```

**422**: an unknown filter value (for example `status=pending`) or an unknown `agent_id`.

## POST /tickets

**Body**

```json
{
  "customer_name": "Sara Ali",
  "customer_email": "Sara@Example.com",
  "customer_phone": "+966500000000",
  "subject": "Refund not received",
  "description": "Paid twice in September.",
  "category": "billing",
  "priority": "high"
}
```

Required: `customer_name`, `customer_email`, `subject`, `category`, `priority`.

**201**: `{ "data": Ticket }` with `status=open`, `agent=null`, and one `created` history entry.
**422**: field errors keyed by the body field names above.

## GET /tickets/{id}

**200**: `{ "data": Ticket }` with notes and history (both oldest first).
**404**: ticket not found.

## PATCH /tickets/{id}/assign

**Body**: `{ "agent_id": 2 }`

**200**: `{ "data": Ticket }` with the new agent and an `assigned` history entry.
**422**:

- `agent_id` is missing or does not exist → `errors.agent_id`
- same agent as the current one → `errors.agent_id`: "Ticket is already assigned to Omar Hassan."
- the ticket is Closed → `errors.agent_id`: "Closed tickets cannot be changed."

**404**: ticket not found.

## PATCH /tickets/{id}/status

**Body**: `{ "status": "in_progress" }`

**200**: `{ "data": Ticket }` with the new status and a `status_changed` history entry.
**422** (`errors.status`):

- the value is missing or not a known status
- the move is not allowed → "Cannot change status from {Current} to {Requested}."
- the target is In Progress with no agent → "Assign an agent before moving the ticket to In Progress."
- the ticket is Closed → "Closed tickets cannot be changed."

**404**: ticket not found.

## POST /tickets/{id}/notes

**Body**: `{ "body": "Called customer, awaiting invoice copy." }`

**201**: `{ "data": { "id": 7, "body": "...", "created_at": "..." } }`. A `note_added` history
entry is recorded.
**422** (`errors.body`): the note is missing, whitespace-only, or over 2,000 characters; or the
ticket is Closed.
**404**: ticket not found.

## GET /agents

**200**

```json
{ "data": [ { "id": 1, "name": "Omar Hassan", "email": "omar@example.com" } ] }
```

Sorted by name.

## GET /meta

**200**

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

Every value here is built from the PHP enums.
