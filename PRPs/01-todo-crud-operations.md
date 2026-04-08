# PRP 01: Todo CRUD Operations

## Feature Overview
Implement the core todo lifecycle for a Next.js 16 application backed by SQLite. This feature establishes the base todo model, authenticated CRUD API routes, Singapore-time-aware validation, and the primary list UI used by all later features.

## Dependencies
- Foundation feature. All later PRPs depend on the todo model and route patterns defined here.
- Must follow [.github/copilot-instructions.md](../.github/copilot-instructions.md) for Next.js 16 route params, synchronous `better-sqlite3` usage, and Singapore timezone handling.

## User Stories
- As an authenticated user, I can create a todo with a required title and optional due date.
- As an authenticated user, I can view all my todos grouped into Overdue, Pending, and Completed sections.
- As an authenticated user, I can edit a todo without losing its existing metadata.
- As an authenticated user, I can delete a todo and have dependent records removed safely.
- As an authenticated user, I can toggle a todo complete or incomplete and see the list update immediately.

## User Flow
1. User logs in and lands on the main todo page.
2. User enters a trimmed title, optionally selects a due date at least 1 minute in the future, and submits.
3. UI sends `POST /api/todos`, applies optimistic rendering, and refreshes authoritative data.
4. Todos render in three sections:
   - Overdue: due date in the past and not completed
   - Pending: incomplete and not overdue
   - Completed: completed todos
5. User can edit via modal or inline form backed by `PUT /api/todos/[id]`.
6. User can toggle completion and see the item move to the appropriate section.
7. User can delete a todo through a confirmation flow backed by `DELETE /api/todos/[id]`.

## Technical Requirements

### Data Model
- `todos` table must include at minimum:
  - `id`
  - `user_id`
  - `title`
  - `completed`
  - `due_date`
  - `created_at`
  - `updated_at`
- Use `user_id` scoping for all todo queries.
- Prepare the schema so later features can extend the record without breaking CRUD behavior.

### Validation Rules
- Title is required, trimmed, and cannot be empty after trimming.
- Due date is optional.
- If due date is provided, validate using Singapore timezone utilities from `lib/timezone.ts`.
- Minimum due date is 1 minute in the future relative to `getSingaporeNow()`.
- Reject malformed or unsupported payload fields with clear 400 responses.

### API Endpoints
- `POST /api/todos`
  - Auth required.
  - Accepts title and optional due date.
  - Returns created todo.
- `GET /api/todos`
  - Auth required.
  - Returns all todos for the current user with stable sorting.
- `GET /api/todos/[id]`
  - Auth required.
  - Returns a single user-owned todo.
- `PUT /api/todos/[id]`
  - Auth required.
  - Updates editable fields.
  - Supports completion toggle.
- `DELETE /api/todos/[id]`
  - Auth required.
  - Deletes the todo and cascades dependent relations such as subtasks and tag associations.

### Query and Sorting Rules
- Incomplete todos should sort by:
  - priority rank when that feature exists
  - due date ascending with nulls last
  - creation date descending as tie-breaker
- Completed todos should sort by most recently completed or updated first.

### Interface Surface
- Main todo input form with:
  - title input
  - optional due date picker
  - add button
- Todo list grouped into Overdue, Pending, and Completed sections.
- Completion checkbox.
- Edit modal or edit form.
- Delete confirmation dialog.
- Empty states for no todos and no results after filters.

### Implementation Notes
- Main UI likely lives in `app/page.tsx` per repo convention.
- API handlers must use `await params` in Next.js 16 parameterized routes.
- Database access is synchronous via `better-sqlite3`; avoid unnecessary async wrappers for DB calls.

## UI Components
- Create form at the top of the page.
- Section headers with counts for Overdue, Pending, and Completed.
- Todo row with checkbox, title, due date, and edit/delete actions.
- Due date display should support urgency-aware formatting in later enhancements.

## Edge Cases
- Whitespace-only title submission.
- Due date exactly at now or less than 1 minute ahead in Singapore time.
- User attempts to access another user's todo ID.
- Delete request for already-deleted todo.
- Toggle or edit request races with stale client state.
- Completed todo becomes incomplete and must be reclassified into Overdue or Pending.

## Acceptance Criteria
- User can create a todo with title only.
- User can create a todo with a valid future due date.
- User can fetch all and single todos scoped to the authenticated session.
- User can edit title and due date.
- User can toggle completion and the UI moves the item to the correct section.
- User can delete a todo and dependent records are removed safely.
- Validation rejects empty titles and invalid due dates with clear errors.
- List updates feel immediate through optimistic UI or fast refresh behavior.

## Testing Requirements

### E2E
- Create todo with title only.
- Create todo with valid due date.
- Edit todo title and due date.
- Toggle completion from pending to completed and back.
- Delete todo from each section.
- Reject past due date or less-than-one-minute future due date.
- Verify unauthorized access redirects or returns 401.

### Unit
- Title trimming and empty-title validation.
- Due date future validation using Singapore timezone.
- Section classification logic: overdue, pending, completed.
- Sorting behavior with null due dates and ties.

## Out of Scope
- Priority badges and filters.
- Recurring todo generation.
- Notifications.
- Tags, subtasks, templates, export/import, calendar, and authentication implementation details beyond requiring an authenticated session.

## Success Metrics
- Core CRUD flows pass consistently in Playwright.
- API responses remain under 300ms average in local testing for standard todo volumes.
- No cross-user data leakage.
- This PRP provides the stable contract for all later todo-related features.