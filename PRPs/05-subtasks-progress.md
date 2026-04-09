---
id: PRP-05
title: Subtasks & Progress Tracking
status: ready-for-build
depends_on: [PRP-01]
test_file: tests/06-subtasks-progress.spec.ts
---

# PRP 05: Subtasks & Progress Tracking

## Feature Overview

Implement subtasks so users can break one todo into smaller checklist items and track completion progress visually. The parent todo remains the main object; subtasks provide structure beneath it.

This feature must follow the app's existing patterns:

- `lib/db.ts` remains the DB source of truth
- All API routes require `getSession()` and user scoping
- Deleting a parent todo must cascade to child subtasks
- The UI should update progress immediately after every subtask action

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Subtask CRUD, expandable checklist UI, real-time progress bar, and parent cascade delete |
| **Depends on** | `PRP-01` todo ownership and delete behavior |
| **Pre-read** | `lib/db.ts`, `app/page.tsx`, `tests/helpers.ts`, `.github/copilot-instructions.md` |
| **Do not drift into** | Nested subtasks, drag-to-reorder UX, or subtask due dates |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/06-subtasks-progress.spec.ts` |

---

## Why This Feature Matters

Many real tasks are not single-step actions. Subtasks turn the app from a simple list into a useful execution tool, while progress bars give users quick feedback on how much is already done.

---

## User Stories

### Core user stories
- As a user, I can add multiple subtasks to a todo.
- As a user, I can toggle each subtask complete or incomplete.
- As a user, I can see overall progress for the parent todo.

### Supporting user stories
- As a user, I can delete a subtask I no longer need.
- As a user, subtasks preserve their order.
- As a user, deleting the parent todo removes all its subtasks automatically.

---

## Canonical Acceptance Criteria

- [ ] Can add unlimited subtasks
- [ ] Can toggle completion
- [ ] Progress updates in real-time
- [ ] Visual progress bar accurate
- [ ] Cascade delete works

---

## User Flow

1. User clicks `▶ Subtasks` on a todo.
2. The subtasks panel expands.
3. User adds one or more checklist items.
4. Each item can be toggled complete or deleted individually.
5. The progress text and bar update immediately.
6. If the parent todo is deleted, all subtasks disappear with it.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - `subtasks` table, `Subtask` interface, CRUD helpers
- `app/api/todos/[id]/subtasks/route.ts` - create subtasks for a todo
- `app/api/subtasks/[id]/route.ts` - update/delete a single subtask
- `app/page.tsx` - expandable UI and progress bar
- `tests/06-subtasks-progress.spec.ts` - E2E coverage

### 2. Data Model

Recommended table shape:

```ts
export interface Subtask {
  id: string
  todo_id: string
  title: string
  completed: boolean
  position: number
  created_at: string
}
```

Relationship rule:
- `subtasks.todo_id` references `todos.id` with **CASCADE delete**

### 3. Validation Rules

- `title` is required and trimmed
- Empty or whitespace-only subtask titles are rejected
- `position` should be an integer and stable for ordering
- Updates must only affect subtasks owned indirectly by the current user

---

## API Contract

### `POST /api/todos/[id]/subtasks`
Create a subtask for the current user's todo.

**Request body**

```json
{
  "title": "Draft agenda",
  "position": 0
}
```

### `PUT /api/subtasks/[id]`
Update fields such as:

```json
{
  "title": "Draft final agenda",
  "completed": true
}
```

### `DELETE /api/subtasks/[id]`
Delete a single subtask.

**Common failure cases**
- `400` invalid title or position
- `401` unauthenticated
- `404` subtask not found for current user

---

## Frontend / UX Requirements

### Expand / Collapse Behavior
- Default label: `▶ Subtasks`
- Expanded label: `▼ Subtasks`
- Keep the section simple and fast to scan

### Subtask List
- Checkbox on the left
- Title in the center
- Delete action on the right
- Add-subtask input at the bottom of the expanded panel

### Progress Display
- Show progress text such as `3/7 subtasks`
- Show a visual bar using:

```ts
const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
```

- Blue bar for in-progress states, green at 100%

---

## Step-by-Step Implementation Plan

1. **Create `subtasks` table in `lib/db.ts`**
   - include foreign key with cascade behavior
   - add indexes as needed for `todo_id`

2. **Add `subtaskDB` methods**
   - `create`
   - `findByTodoId`
   - `update`
   - `remove`

3. **Implement API routes**
   - create under the current todo
   - update/delete by subtask id with ownership checks

4. **Build expandable UI in `app/page.tsx`**
   - local state for expanded todo ids
   - add-subtask input and actions

5. **Render progress information**
   - compute `completed / total`
   - update immediately after toggle or delete

6. **Verify cascade delete**
   - delete parent todo and confirm subtasks vanish

7. **Add Playwright coverage**
   - add, toggle, delete, and cascade scenarios

---

## Edge Cases

1. Adding the first subtask to a todo with none
2. Deleting the last remaining subtask
3. Zero subtasks should not produce divide-by-zero errors
4. Very long subtask titles should wrap cleanly
5. Rapid toggles should not desynchronize progress
6. Subtask ordering should remain stable after multiple inserts/deletes

---

## Testing Requirements

### Required E2E scenarios
- Expand and collapse the subtask panel
- Add multiple subtasks to one todo
- Toggle subtask completion and verify progress changes
- Delete a subtask and confirm the count updates
- Delete a parent todo and verify cascade behavior

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/06-subtasks-progress.spec.ts
```

---

## Security and Quality Notes

- Always verify parent ownership before creating a subtask
- Use prepared statements for all subtask queries
- Keep progress derived from data rather than storing redundant counters

---

## Out of Scope

This PRP does **not** define:
- template serialization rules (see `07-template-system.md`)
- global search/filter logic (see `08-search-filtering.md`)

---

## Success Metrics

- Users can manage nested checklist items without confusion
- Progress bars remain accurate under all common actions
- Parent deletion always cleans up child subtasks

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
