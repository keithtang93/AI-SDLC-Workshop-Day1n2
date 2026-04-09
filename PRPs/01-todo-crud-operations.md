---
id: PRP-01
title: Todo CRUD Operations
status: ready-for-build
depends_on: []
test_file: tests/02-todo-crud.spec.ts # Create if needed
---

# PRP 01: Todo CRUD Operations

## Feature Overview

Implement the foundational todo management flow for the app: users can create, read, update, complete, and delete todos from the main page. This feature is the base for later capabilities such as priority sorting, recurring todos, reminders, subtasks, tags, templates, export/import, and calendar views.

This project uses the following non-negotiable conventions:

- **Framework:** Next.js 16 App Router
- **Database:** SQLite via `better-sqlite3` (synchronous)
- **Auth:** WebAuthn / passkeys with JWT cookie sessions
- **Timezone:** **Singapore timezone only** via `lib/timezone.ts`
- **Main UI:** `app/page.tsx` is the primary client component for todo interactions
- **Server-side data access:** `lib/db.ts` is the single source of truth for database interfaces and CRUD methods

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Main-page todo CRUD, section sorting, completion toggle, edit flow, and cascade-safe delete |
| **Depends on** | None for core implementation; reuse the auth/session pattern for production-safe routes |
| **Pre-read** | `lib/db.ts`, `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`, `app/page.tsx`, `.github/copilot-instructions.md` |
| **Do not drift into** | Full tag CRUD, templates, calendar, or broad UI refactors |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/02-todo-crud.spec.ts` |

---

## Why This Feature Matters

Without reliable CRUD operations, none of the later features matter. This PRP should guide the implementer to deliver a correct, secure, and testable todo workflow that supports:

1. **Fast task capture** with just a title
2. **Richer task details** with priority, due date, recurrence, and reminders
3. **Clear organization** into Overdue / Pending / Completed sections
4. **Low-friction editing** after creation
5. **Safe cleanup** with cascade deletion of subtasks and tag links

---

## User Stories

### Core user stories
- As a user, I can create a todo with only a title so I can quickly capture tasks.
- As a user, I can optionally set priority, due date, recurring pattern, and reminder when creating a todo.
- As a user, I can see my todos sorted by priority and due date so urgent work surfaces first.
- As a user, I can mark a todo as complete and see it move into the Completed section.
- As a user, I can edit a todo after creation if the title, due date, or settings change.
- As a user, I can delete a todo and have its subtasks and tag associations removed automatically.

### Supporting user stories
- As a user, I receive clear validation when the title is empty or the due date is invalid.
- As a user, I can trust that time calculations use Singapore timezone consistently.
- As a user, I see the UI update immediately after a create, update, complete, or delete action.

---

## Canonical Acceptance Criteria

These requirements come directly from `EVALUATION.md` and should be reproduced verbatim in implementation reviews:

- [ ] Can create todo with just title
- [ ] Can create todo with priority, due date, recurring, reminder
- [ ] Todos sorted by priority and due date
- [ ] Completed todos move to Completed section
- [ ] Delete cascades to subtasks and tags

---

## User Flow

### Happy path
1. User authenticates with passkey and lands on `app/page.tsx`.
2. User enters a title in the create form.
3. User optionally selects:
   - priority (`high | medium | low`)
   - due date/time
   - repeat toggle + recurrence pattern
   - reminder offset
4. User clicks **Add**.
5. Frontend validates required fields before sending the request.
6. Backend validates session, title, and due date rules.
7. New todo is persisted in SQLite and returned to the client.
8. UI updates optimistically and renders the todo in the correct section.
9. User later edits, completes, uncompletes, or deletes the todo.

### Section behavior
- **Overdue:** due date is in the past and `completed = false`
- **Pending / Active:** due date is in the future or missing and `completed = false`
- **Completed:** `completed = true`

> `EVALUATION.md` uses the term **Active**, while `USER_GUIDE.md` often uses **Pending**. Treat these as the same middle section unless the UI intentionally renames it.

---

## Technical Requirements

### 1. File Ownership

Use these files as the primary implementation targets:

- `lib/db.ts` — todo types, schema, CRUD functions, migrations
- `lib/timezone.ts` — Singapore-aware date/time helpers
- `lib/auth.ts` — session handling (`getSession()`)
- `app/api/todos/route.ts` — create + list routes
- `app/api/todos/[id]/route.ts` — get one + update + delete routes
- `app/page.tsx` — create form, list rendering, edit flow, completion toggle, delete UI
- `tests/02-todo-crud.spec.ts` — Playwright CRUD coverage
- `tests/helpers.ts` — reusable browser helpers for login and todo actions

> Note: authentication uses `tests/01-authentication.spec.ts`, so the CRUD workflow intentionally starts at `tests/02-todo-crud.spec.ts`.

### 2. Data Model

The `todos` table and shared types in `lib/db.ts` should support the following shape:

```ts
export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
  id: string
  user_id: string
  title: string
  description?: string | null
  priority: Priority
  due_date?: string | null
  completed: boolean
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
  last_notification_sent?: string | null
  created_at: string
  updated_at: string
}
```

#### Related relationships
- `todos -> subtasks` is **one-to-many** with **CASCADE delete**
- `todos <-> tags` is **many-to-many** via `todo_tags`
- Deleting a todo must remove:
  - the todo row
  - all subtasks linked to it
  - all join-table rows in `todo_tags`

### 3. Validation Rules

#### Required
- `title` is mandatory
- Trim the title before validation and persistence
- Reject empty or whitespace-only titles

#### Due date rules
- Due date is optional
- If provided, it must be at least **1 minute in the future** using **Singapore time**
- Do **not** use raw `new Date()` for business validation; use `getSingaporeNow()` from `lib/timezone.ts`

#### Recurring rules
- If `is_recurring = true`, a valid due date is required
- `recurrence_pattern` must be one of: `daily`, `weekly`, `monthly`, `yearly`

#### Reminder rules
- Reminder is optional
- If a reminder is set, the todo should also have a due date
- Expected values align with the user guide:
  - `15`, `30`, `60`, `120`, `1440`, `2880`, `10080` minutes

#### Null safety
Use null coalescing when passing nullable database values through the app:

```ts
reminder_minutes: todo.reminder_minutes ?? null
```

---

## API Contract

All API routes must follow the project pattern:

```ts
const session = await getSession()
if (!session) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}
```

For dynamic routes in Next.js 16:

```ts
const { id } = await params
```

### `POST /api/todos`
Create a new todo.

**Request body**
```json
{
  "title": "Pay utilities",
  "priority": "high",
  "dueDate": "2026-04-09T09:00:00+08:00",
  "isRecurring": true,
  "recurrencePattern": "monthly",
  "reminderMinutes": 1440
}
```

**Success behavior**
- Persist todo for `session.userId`
- Default `priority` to `medium` if omitted
- Default `completed` to `false`
- Return created todo JSON

**Failure cases**
- `400` invalid title
- `400` invalid due date
- `400` recurring without due date
- `401` unauthenticated
- `500` database or server failure

### `GET /api/todos`
Return all todos for the logged-in user.

**Expected behavior**
- Only return items belonging to `session.userId`
- Include related display metadata needed by the UI
- Sort or return data in a way that allows the UI to group by section and order by:
  1. priority (`high -> medium -> low`)
  2. due date (`earliest -> latest`)
  3. creation time (`newest -> oldest`) as a stable fallback

### `GET /api/todos/[id]`
Return a single todo for the current user.

**Expected behavior**
- Reject access to other users' todos
- Return `404` if missing

### `PUT /api/todos/[id]`
Update title, due date, completion state, priority, recurrence, or reminder.

**Expected behavior**
- Re-run all relevant validation
- When toggling `completed`, move the item to the correct UI section on refresh
- If recurring completion logic exists in this route, ensure the next instance inherits:
  - priority
  - reminder offset
  - tags
  - recurrence pattern

### `DELETE /api/todos/[id]`
Delete a todo and all dependent relationships.

**Expected behavior**
- Delete the todo row
- Cascade delete subtasks
- Remove tag associations
- Return a success response the client can use for optimistic removal

---

## Frontend / UX Requirements

### Create Form
The main create form at the top of `app/page.tsx` should include:

- title input
- priority dropdown
- due date / time picker
- repeat checkbox
- recurrence dropdown (enabled only when repeat is on)
- reminder dropdown (disabled or guarded when no due date exists)
- add button

#### UX rules
- `title` field is the only required field
- show inline or toast validation errors for bad input
- disable impossible combinations where practical
- clear the form after a successful create
- keep the UI responsive with optimistic updates

### Todo List Rendering
Todos should appear in separate visual sections:

1. **Overdue**
   - red styling / warning treatment
   - only incomplete todos with due dates in the past
2. **Pending / Active**
   - incomplete todos with future due dates or no due date
3. **Completed**
   - completed todos

#### Sorting within sections
Apply this order consistently:
1. **Priority:** High → Medium → Low
2. **Due date:** earliest first
3. **Created time:** newest first when needed

### Todo Item Actions
Each todo item should support:

- toggle complete / incomplete
- edit fields in-place or via modal/form
- delete action
- display metadata badges for priority, recurrence, and reminder when present

#### Edit flow
A user should be able to change:
- title
- due date
- priority
- repeat setting
- recurrence pattern
- reminder
- tags (if the tag system is already available)

#### Delete flow
- Deletion is permanent
- If a confirmation dialog is used, keep it simple and explicit
- Remove the todo from the UI immediately after successful delete

---

## Step-by-Step Implementation Plan

1. **Finalize todo schema in `lib/db.ts`**
   - Define or confirm `Todo`, `Priority`, and `RecurrencePattern` types
   - Ensure the `todos` table contains all CRUD fields
   - Ensure foreign keys are enabled for cascade behavior
   - Add safe migrations with `db.exec()` and `ALTER TABLE` guards where required

2. **Add database CRUD methods**
   Create or confirm methods such as:

   ```ts
   const todoDB = {
     create(data) {},
     findAllByUser(userId) {},
     findById(id, userId) {},
     update(id, userId, data) {},
     remove(id, userId) {},
   }
   ```

   **Implementation notes**
   - Use prepared statements (`db.prepare()`)
   - Keep all DB access synchronous
   - Scope every query by `userId`
   - Avoid mutation-heavy helper code; return fresh objects

3. **Implement `POST` and `GET` in `app/api/todos/route.ts`**
   - read `request.json()`
   - validate payload
   - call DB methods
   - return JSON responses with proper status codes
   - surface helpful but non-sensitive error messages

4. **Implement `GET`, `PUT`, and `DELETE` in `app/api/todos/[id]/route.ts`**
   - use `const { id } = await params`
   - fetch the todo for the current user only
   - update allowed fields only
   - preserve recurrence/reminder logic when completing recurring items
   - delete with cascade behavior

5. **Build the main CRUD UI in `app/page.tsx`**
   - manage local state for form fields and todo lists
   - fetch todos on load
   - render sections for Overdue / Pending / Completed
   - support optimistic create/update/delete operations
   - handle loading and error states gracefully

6. **Implement completion and relocation behavior**
   - toggling the checkbox should update `completed`
   - completed items move into Completed
   - uncompleted items return to Overdue or Pending depending on due date

7. **Implement edit support**
   - open an edit form or modal
   - prefill current values
   - validate the updated payload
   - update local state immediately after the API succeeds

8. **Verify deletion cascade behavior**
   - delete a todo with subtasks and tags attached
   - confirm the parent disappears from the UI
   - confirm subtasks and `todo_tags` links are removed from the database

9. **Add Playwright coverage**
   - create `tests/02-todo-crud.spec.ts`
   - reuse helpers from `tests/helpers.ts`
   - verify real UI behavior rather than mocked state

---

## Edge Cases

Handle these explicitly:

1. **Whitespace title**
   - input like `'   '` should be rejected
2. **Past due date**
   - reject if less than one minute ahead of Singapore time
3. **Recurring without due date**
   - reject with clear validation
4. **Reminder without due date**
   - disable or reject based on UI/API rules
5. **Unauthorized access**
   - another user must not access or mutate a todo by ID
6. **Delete non-existent todo**
   - return `404`
7. **Null DB fields**
   - safely coalesce nullable values before returning JSON
8. **Large lists**
   - keep sort/group logic deterministic and stable
9. **Optimistic failure rollback**
   - if API call fails, restore the previous UI state and show feedback

---

## Testing Requirements

### Required E2E scenarios
Create or verify Playwright tests for:

- [ ] Create todo with title only
- [ ] Create todo with priority, due date, recurring, reminder
- [ ] Edit todo
- [ ] Toggle completion
- [ ] Delete todo
- [ ] Past due date validation

### Recommended extra coverage
- [ ] Unauthorized API access returns `401`
- [ ] Whitespace title returns `400`
- [ ] Recurring todo without due date is rejected
- [ ] Completed todo returns to correct section when unchecked
- [ ] Deleting a todo removes attached subtasks and tag associations

### Verification commands
Run these commands before considering the feature complete:

```bash
npm run lint
npm run build
npx playwright test tests/02-todo-crud.spec.ts
```

> Use fresh command output as proof of completion; do not mark the feature done without verification evidence.

---

## Security and Quality Notes

- Never trust client input; validate again in API routes
- Never expose another user's todos; always scope by `session.userId`
- Do not leak stack traces or internal SQL errors to the client
- Keep user-facing errors short and helpful
- Do not import `lib/db.ts` directly into client components
- Prefer immutable state updates in React

---

## Out of Scope

The CRUD feature may touch these concepts, but full implementation detail belongs to later PRPs:

- advanced priority filtering UI beyond base create/edit support
- full recurring engine refinements beyond CRUD completion logic
- reminder polling engine and browser notification lifecycle
- dedicated subtask management workflows
- full tag CRUD UI and search/filtering
- templates, export/import, and calendar view

---

## Success Metrics

This PRP is successful when:

1. The implementation satisfies all Feature 01 acceptance criteria in `EVALUATION.md`
2. A user can create, edit, complete, and delete todos from the main page
3. Due date behavior is Singapore-time correct
4. UI sorting and section movement behave predictably
5. Delete operations clean up dependent subtasks and tag links
6. The relevant Playwright CRUD tests pass

---

## Reference Sources

- `EVALUATION.md` — canonical checklist and acceptance criteria
- `USER_GUIDE.md` — user-facing behavior for create/edit/manage flows
- `.github/copilot-instructions.md` — project-wide architectural rules
- `PRPs/README.md` — PRP structure and feature dependency order

---

**Last Updated:** April 8, 2026
**Feature Owner:** Core Todo Foundation (`01`)
