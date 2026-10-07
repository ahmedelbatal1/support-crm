# Quickstart: Ticket Management

Run and validation guide. Endpoint details are in [contracts/api.md](./contracts/api.md), and
tables and rules are in [data-model.md](./data-model.md).

## Prerequisites

- Windows with WAMP running (MySQL 8)
- PHP 8.2+ and Composer on `PATH`
- Node `^22.18` or `>=24.12` and npm

## 1. Backend setup

```powershell
cd backend
composer install
copy .env.example .env      # never commit .env
php artisan key:generate
```

Edit `backend/.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=support_crm
DB_USERNAME=root
DB_PASSWORD=
FRONTEND_URL=http://localhost:5173
```

Create the `support_crm` database in phpMyAdmin (utf8mb4_unicode_ci), then:

```powershell
php artisan migrate:fresh --seed   # 5 agents, 10 customers, 30 tickets
php artisan serve                  # http://localhost:8000
```

## 2. Frontend setup

```powershell
cd frontend
npm install
# optional: frontend/.env.local -> VITE_API_URL=http://localhost:8000/api
npm run dev                        # http://localhost:5173
```

## 3. Automated tests

```powershell
cd backend;  php artisan test      # SQLite in memory (phpunit.xml); MySQL not needed
cd frontend; npm run test:unit -- --run
```

Expected: all tests pass. The backend suite has at least one feature test per acceptance scenario
and unit tests for `TicketStatus` transitions.

## 4. API smoke checks

```powershell
curl http://localhost:8000/api/meta
curl "http://localhost:8000/api/tickets?status=open&page=1"
curl http://localhost:8000/api/tickets/999999          # expect 404 JSON
curl -X POST http://localhost:8000/api/tickets -H "Accept: application/json" -H "Content-Type: application/json" -d "{}"   # expect 422 with field errors
```

## 5. Manual end-to-end scenario (in the browser)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open `/tickets` | Page 1 shows 15 seeded tickets with pagination to page 2 |
| 2 | Filter Status = Open, then add a Priority filter | Only matching tickets; the URL query updates; refresh keeps the filters |
| 3 | Search `TCK-0001` | Exactly that ticket |
| 4 | Filters that match nothing | Empty-state message |
| 5 | Create a ticket with an empty form | Errors under name, email, subject, category, and priority |
| 6 | Create a valid ticket using an existing customer's email in upper case | Redirect to the detail page; status Open; "Unassigned"; history shows "created"; no duplicate customer |
| 7 | On an unassigned Open ticket | Status button "In Progress" is visible; clicking it shows the "Assign an agent first" error |
| 8 | Assign an agent, then reassign | Agent updates; history shows both entries |
| 9 | Move In Progress → Resolved → In Progress → Resolved → Closed | Only allowed buttons appear at each step; history shows every change |
| 10 | On the Closed ticket | No status buttons; assign and note forms disabled or hidden; a forced API call returns 422 |
| 11 | Add a note `<b>hi</b>` on an open ticket | Shown as literal text; history shows "Note added" |
| 12 | Open `/tickets/999999` and `/nope` | "Ticket not found" and the NotFound page |
| 13 | Stop `php artisan serve` and reload the list | Error state with a retry option |
