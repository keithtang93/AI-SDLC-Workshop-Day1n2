# PRP 06: Tag System

## Feature Overview

Implement a user-specific tag system so todos can be labeled with custom names and colors, assigned to multiple tasks, and used for filtering and organization.

Core conventions for this feature:

- Tags are scoped to `session.userId`
- Use a many-to-many relation through `todo_tags`
- Keep CRUD logic in `lib/db.ts` and REST routes under `app/api/`
- Render tags as colored pills across the UI

---

## Why This Feature Matters

Tags are lightweight organization. They help users group work by project, context, or life area without forcing a rigid folder structure.

---

## User Stories

### Core user stories
- As a user, I can create custom tags with names and colors.
- As a user, I can assign multiple tags to a todo.
- As a user, I can filter todos by tag.

### Supporting user stories
- As a user, editing a tag updates all places where it appears.
- As a user, deleting a tag removes it from todos without breaking those todos.
- As a user, I cannot create duplicate tag names for myself.

---

## Canonical Acceptance Criteria

- [ ] Tags unique per user
- [ ] Custom colors work
- [ ] Editing tag updates all todos
- [ ] Deleting tag removes from todos
- [ ] Filter works correctly

---

## User Flow

1. User opens `Manage Tags` from the main page.
2. User creates a tag by entering a name and choosing a color.
3. Tag becomes available in the todo create/edit form.
4. User selects one or more tags on a todo.
5. Assigned tags render as colored pills on the todo card.
6. User can filter the list by tag or edit/delete the tag later.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - `tags` and `todo_tags` tables, interfaces, CRUD helpers
- `app/api/tags/route.ts` - create/list tags
- `app/api/tags/[id]/route.ts` - update/delete a tag
- `app/api/todos/[id]/tags/route.ts` - attach/detach tags to a todo
- `app/page.tsx` - tag modal, selection UI, tag pills, filters
- `tests/07-tag-system.spec.ts` - E2E coverage

### 2. Data Model

Suggested shared interfaces:

```ts
export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface TodoTag {
  todo_id: string
  tag_id: string
}
```

DB rules:
- tag names must be unique **per user**
- `todo_tags` should enforce unique `(todo_id, tag_id)` pairs
- deleting a tag should remove join-table rows cleanly

### 3. Validation Rules

- `name` is required and trimmed
- `color` should be a valid hex color such as `#3B82F6`
- Reject duplicate names for the same user
- Tag operations must never affect another user's data

---

## API Contract

### `GET /api/tags`
Return all tags for the current user.

### `POST /api/tags`

```json
{
  "name": "Work",
  "color": "#3B82F6"
}
```

### `PUT /api/tags/[id]`
Update the tag name and/or color.

### `DELETE /api/tags/[id]`
Delete the tag and remove its `todo_tags` associations.

### `POST /api/todos/[id]/tags`
Attach one or more tag ids to a todo.

### `DELETE /api/todos/[id]/tags`
Detach a tag from a todo.

---

## Frontend / UX Requirements

### Manage Tags Modal
- Button label such as `+ Manage Tags`
- Inputs for `name` and `color`
- List of existing tags with `Edit` and `Delete`
- Default color should be `#3B82F6`

### Todo Form Integration
- Show available tags as selectable pills
- Multi-select must be easy to scan and tap
- Selected tags should show a checkmark or filled state

### Todo Card Display
- Render tag pills after the priority and recurrence badges
- Preserve the chosen custom color while keeping text readable

### Filtering
- Add an `All Tags` dropdown or click-to-filter interaction
- Tag filters combine with other filters using AND logic

---

## Step-by-Step Implementation Plan

1. **Add tables in `lib/db.ts`**
   - `tags`
   - `todo_tags`
   - enforce uniqueness and foreign keys

2. **Create DB helpers**
   - `tagDB.create/findAll/update/remove`
   - `todoTagDB.add/remove/findByTodo`

3. **Implement tag CRUD routes**
   - list, create, edit, delete

4. **Implement todo-tag association routes**
   - attach tags to a todo
   - remove tag links cleanly

5. **Build `Manage Tags` modal in `app/page.tsx`**
   - create/edit/delete within one focused UI

6. **Add tag selection to create/edit forms**
   - support multi-select and prefilled values

7. **Render tag badges and filter controls**
   - colored pills on todos
   - filter by selected tag

8. **Add E2E coverage**
   - create, edit, delete, assign, and filter flows

---

## Edge Cases

1. Duplicate tag name for the same user must be rejected
2. Same name can exist for different users
3. Invalid hex color should be rejected or normalized
4. Deleting a tag should not delete the todo itself
5. Filtering by a deleted tag should reset gracefully
6. Many tags on one todo should wrap correctly on smaller screens

---

## Testing Requirements

### Required E2E scenarios
- Create a new tag
- Edit the tag's name and color
- Delete a tag and verify it disappears from linked todos
- Assign multiple tags to a todo
- Filter the list by a tag
- Confirm duplicate-name validation

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/07-tag-system.spec.ts
```

---

## Security and Quality Notes

- Scope every tag query by `session.userId`
- Use prepared statements for joins and lookups
- Validate color input and keep names sanitized/trimmed

---

## Out of Scope

This PRP does **not** define:
- saved search presets (see `08-search-filtering.md`)
- template save/use behavior (see `07-template-system.md`)
- export/import relationship remapping (see `09-export-import.md`)

---

## Success Metrics

- Users can manage custom labels without collisions or confusion
- Tags update consistently across all linked todos
- Tag filtering is fast and accurate

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
