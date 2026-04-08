# PRP 02: Priority System

## Feature Overview

Implement a complete three-level priority system for todos so users can mark work as `high`, `medium`, or `low`, see that importance visually, and sort/filter tasks consistently across the app.

This PRP follows the project's non-negotiable rules:

- **Framework:** Next.js 16 App Router
- **Database:** SQLite via `better-sqlite3` (synchronous)
- **Timezone:** Singapore-only date handling through `lib/timezone.ts`
- **Source of truth:** `lib/db.ts` owns shared types and DB access
- **Main UI:** `app/page.tsx` remains the central todo experience

---

## Why This Feature Matters

Priority is the simplest way to surface urgent work without changing the todo model too much. It also unlocks clearer list ordering, better filtering, richer calendar rendering, and more useful templates and exports.

---

## User Stories

### Core user stories
- As a user, I can choose `High`, `Medium`, or `Low` when creating a todo.
- As a user, I can immediately recognize priority from color-coded badges.
- As a user, I can filter the list to show only one priority level.
- As a user, I can trust that urgent tasks appear before less urgent tasks.

### Supporting user stories
- As a user, I can edit a todo's priority after creation.
- As a user, I get a sensible default priority when I do not choose one.
- As a user, the priority styling still works in dark mode.

---

## Canonical Acceptance Criteria

- [ ] Three priority levels functional
- [ ] Color-coded badges visible
- [ ] Automatic sorting by priority works
- [ ] Filter shows only selected priority
- [ ] WCAG AA contrast compliance

---

## User Flow

1. User opens the create form on `app/page.tsx`.
2. User enters a title and optionally selects a priority from a dropdown.
3. On save, the API validates the value and defaults to `medium` if missing.
4. The todo appears with a colored badge:
   - `high` → red
   - `medium` → yellow/amber
   - `low` → blue
5. Todos are displayed in each section ordered by:
   1. priority (`high -> medium -> low`)
   2. due date (`earliest -> latest`)
   3. creation time (`newest -> oldest`)
6. User can later edit the priority or filter the list by a chosen level.

---

## Technical Requirements

### 1. File Ownership

Primary files for this feature:

- `lib/db.ts` - `Priority` type, defaulting, shared interfaces, sorting support
- `app/api/todos/route.ts` - create/list validation and response shape
- `app/api/todos/[id]/route.ts` - update validation
- `app/page.tsx` - priority dropdown, badge rendering, filter UI
- `tests/03-priority-system.spec.ts` - Playwright coverage for create/edit/filter/sort

### 2. Data Model

Use this shared type in `lib/db.ts`:

```ts
export type Priority = 'high' | 'medium' | 'low'
```

Todo records should continue to expose:

```ts
priority: Priority
```

### 3. Validation Rules

- Accept only `high`, `medium`, or `low`
- If omitted, default to `medium`
- Reject any other string with `400 Bad Request`
- Preserve existing priority when updating unrelated fields

### 4. Visual Mapping

Recommended badge mapping:

| Priority | Light mode | Dark mode | Meaning |
|----------|------------|-----------|---------|
| High | Red background / dark red text | Deep red background / light text | urgent |
| Medium | Amber background / brown text | Muted amber background / light text | default |
| Low | Blue background / navy text | Deep blue background / light text | flexible |

---

## API Contract

Priority uses the existing todo endpoints instead of introducing new routes.

### `POST /api/todos`

**Request body**

```json
{
  "title": "Submit expenses",
  "priority": "high"
}
```

**Behavior**
- Validate `priority` if present
- Default to `medium` if omitted
- Return the created todo with normalized priority

### `PUT /api/todos/[id]`

**Supported update**

```json
{
  "priority": "low"
}
```

**Failure cases**
- `400` invalid priority value
- `401` unauthenticated
- `404` todo not found for current user

### `GET /api/todos`

The response should either already be sorted or be easy for the client to sort by:
1. priority
2. due date
3. created time

---

## Frontend / UX Requirements

### Create and Edit Forms
- Add a `Priority` dropdown with `High`, `Medium`, and `Low`
- Default selection should be `Medium`
- Preserve current value in the edit modal

### Badge Rendering
- Show a small colored badge beside the todo title
- Badge label should be human-friendly (`High`, `Medium`, `Low`)
- Ensure color contrast meets WCAG AA in both light and dark modes

### Filtering
- Add a top-level dropdown such as `All Priorities`
- Filtering uses client-side AND logic with search and tag filters
- Keep selected value visible so the active filter is obvious

### Sorting
- High-priority items always appear above medium and low items within the same section
- When two items have the same priority, use due date then creation time

---

## Step-by-Step Implementation Plan

1. **Confirm schema in `lib/db.ts`**
   - Ensure `priority` exists on the `todos` table and `Todo` interface
   - Ensure default is `medium`

2. **Add validation to create/update routes**
   - Normalize incoming values to lowercase
   - Reject unsupported values early

3. **Implement sorting helper**
   - Add a reusable compare function for `high -> medium -> low`
   - Combine with due date and creation time ordering

4. **Update the create form in `app/page.tsx`**
   - Add the dropdown
   - Bind it to component state

5. **Update the edit experience**
   - Allow changing priority on an existing todo
   - Re-render the list immediately after a successful save

6. **Add badge UI**
   - Create consistent styling for all three levels
   - Reuse the same badge in list and calendar views when applicable

7. **Add priority filtering UI**
   - Add `All Priorities`, `High`, `Medium`, and `Low`
   - Combine cleanly with other filters

8. **Add E2E coverage**
   - Create todos with each priority
   - Verify display, ordering, and filter behavior

---

## Edge Cases

1. Missing `priority` should default safely to `medium`
2. Invalid string like `urgent` must be rejected
3. Mixed-case input like `HIGH` should normalize or be rejected consistently
4. Filtering should still work when no matching todos exist
5. Sorting should remain stable when multiple items share the same priority and due date
6. Badge colors must remain readable in dark mode

---

## Testing Requirements

### Required E2E scenarios
- Create a todo with each priority level
- Edit an existing todo's priority
- Filter by `High`, `Medium`, and `Low`
- Verify sort order `high -> medium -> low`
- Verify badge visibility in light and dark styling

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/03-priority-system.spec.ts
```

---

## Security and Quality Notes

- Never trust client-provided priority values without API validation
- Scope all reads and writes to `session.userId`
- Keep labels and color usage accessible; do not rely on color alone

---

## Out of Scope

This PRP does **not** define:
- recurring date generation logic (see `03-recurring-todos.md`)
- reminders and notifications (see `04-reminders-notifications.md`)
- tag-based organization (see `06-tag-system.md`)

---

## Success Metrics

- Users can assign and edit all three levels reliably
- Sorting surfaces urgent work first across sections
- Filtering is instant and predictable
- Badge contrast is accessible in both color schemes

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
