# Post Audit API

Run `mysql -u root -p skillforexport < scripts/add-post-audit.sql` before deploying this code. The script is idempotent. The existing `skills4e-worker` process dispatches up to 100 posts and 100 questions every 30 seconds; opening a unit list also dispatches up to 50 of each. Set `POST_AUDIT_ENABLED=false` to disable the worker polling, or adjust `POST_AUDIT_DISPATCH_INTERVAL_MS`.

All endpoints below require `Authorization: Bearer <token>`. An `admin` can review and checkpoint. Only a granted superadmin can configure units, change copy count, dispatch on demand, or assign a specific item. Check `GET /api/admin/users/me` for `data.isSuperAdmin`.

## Setup (superadmin)

1. `POST /api/admin/post-audit/units` with `{ "name": "Unit A", "sortOrder": 0 }`. Repeat for as many units as needed.
2. `PUT /api/admin/post-audit/settings` with `{ "copiesPerItem": 2 }`. Each new item is assigned to up to two active units. The value must be 1-20 and is capped by the active unit count.
3. `GET /api/admin/post-audit/units` returns `{ "success": true, "data": { "settings": { "copiesPerItem": 2 }, "units": [...] } }`. Each unit includes `total`, `pending`, and `checked` counts.
4. `PATCH /api/admin/post-audit/units/:id` accepts `name`, `sortOrder`, and/or `isActive`. Deactivation stops new automatic assignments but preserves existing work and history.
5. `POST /api/admin/post-audit/dispatch` with optional `{ "limit": 500 }` processes a batch of unassigned historical posts and questions. Repeat until the response reports zero processed for both types when catching up a large existing database.

## Assign a specific post or question (superadmin)

`POST /api/admin/post-audit/items/:type/:id/assign`

`type` is `post` or `question`. Body:

```json
{ "unitIds": ["unit-a-id", "unit-b-id"], "replace": true }
```

`replace: false` (default) adds units. `replace: true` makes the chosen units authoritative and prevents automatic dispatch from re-adding others. Reviewed or reported assignments cannot be removed. The response has `data.assignments`.

## Review (any admin)

- `GET /api/admin/post-audit/units/:id/items?status=pending&page=1&per_page=20`
- `GET /api/admin/post-audit/units/:id/items?status=checked&page=1&per_page=20`

`data` contains `current_page`, `last_page`, `per_page`, `total`, and `data`. Each row has an assignment `id`, `item_type`, `item_id`, `item` (post/question title and body), `author`, `auditor`, `report`, `assigned_at`, `checked_at`, and `checked_by`. Use the **assignment ID**, not the post ID, for report and checkpoint actions. Render the list in the returned newest-first order.

To flag an assigned item, call `POST /api/admin/post-audit/units/:id/items/:assignmentId/report` with `{ "reason": "Spam", "details": "Optional notes" }`. This creates a normal `generic_reports` row and anonymously notifies the content owner. It does not automatically suspend or remove the content.

To move pending work into checked history, call `POST /api/admin/post-audit/units/:id/checkpoint`:

- Body `{}` checkpoints all currently pending rows in that unit.
- Body `{ "throughAssignmentId": "assignment-id" }` checkpoints that row and all rows above it in the newest-first pending list.

The response includes `data.checkedCount`. A checkpoint changes only the chosen unit's assignments; the same post or question remains pending in other units. Reports and checked history remain available after checkpointing.

Errors use `{ "success": false, "error": { "code": "..." } }`. Common codes: `unauthorized` (401), `forbidden` (403), `unit_not_found` or `assignment_not_found` (404), and `assignment_already_checked`, `assignment_already_reported`, or `reviewed_assignment_cannot_be_removed` (409).

## Admin accounts

Run `scripts/add-super-admins.sql` once with the email of an existing admin account to grant the first superadmin. The script does not create that account. Thereafter, an authenticated superadmin can manage admin accounts through these routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/admin/users/me` | Return `{ "success": true, "data": { "isAdmin": true, "isSuperAdmin": true } }` for the current token. |
| GET | `/api/admin/users` | List admin accounts, including `isSuperAdmin`. Superadmin only. |
| POST | `/api/admin/users` | Create an admin with `{ "email": "admin@example.com", "password": "Password1" }`. Returns 201 with `data.id`, `data.email`, `data.role`, and `data.isSuperAdmin: false`. Superadmin only. |
| PUT | `/api/admin/users/:id/super-admin` | Grant superadmin access to an existing admin. Returns `data: { "id": "...", "isSuperAdmin": true }`. Superadmin only. |

Passwords require at least eight characters and one digit. There is no revoke, delete-admin, or assign-auditor-to-unit endpoint here; do not show controls for those actions. Any admin can review any audit unit. Never expose the initial SQL grant or accept a `role`/`isSuperAdmin` value in the create-admin form.

## Frontend handoff prompt

> Implement the admin account and post-audit pages using the existing admin application's layout and API client. Send `Authorization: Bearer <token>` on every request. On load, call `GET /api/admin/users/me`; use `data.isAdmin` to gate audit review and `data.isSuperAdmin` to show account management and audit configuration. Handle 401 by requesting sign-in and 403 with an access-denied state. Do not assume the account's role from a locally stored label.
>
> For superadmins, add an Admin Users page: list accounts via `GET /api/admin/users`, create one with email and password via `POST /api/admin/users`, and offer a clearly confirmed Grant Superadmin action via `PUT /api/admin/users/:id/super-admin`. The password must have at least eight characters and a digit. Refresh the list after changes. Do not offer revoke, delete, or password viewing, because those APIs do not exist.
>
> Add a Post Audit configuration view for superadmins: load `GET /api/admin/post-audit/units`, create units, edit their name/order/active status, set `copiesPerItem` from 1 to 20 (up to the active-unit count), and optionally trigger `POST /api/admin/post-audit/dispatch` for historical content. Show each unit's total/pending/checked counts. Keep historical assignments visible after deactivation.
>
> Add Post Audit review for all admins: open a unit and show pending and checked tabs from `GET /api/admin/post-audit/units/:id/items?status=pending|checked&page=1&per_page=20`. Show the returned content, author, auditor, timestamps, and report status. Keep the API's newest-first order. Report an item with its **assignment ID** using `POST /api/admin/post-audit/units/:id/items/:assignmentId/report`, and checkpoint all pending items or through a chosen assignment with `POST /api/admin/post-audit/units/:id/checkpoint`. Confirm bulk checkpointing, refresh counts/lists after mutations, and surface API errors without claiming a report suspends content. Superadmins may also assign a specific post/question using `POST /api/admin/post-audit/items/:type/:id/assign`.
>
> Use the response and error shapes documented above. Do not invent endpoints or infer whether an item is checked from its position in a list. Test with one ordinary admin and one superadmin so hidden controls and 403 states are covered.
