# PRP 02: Priority System

## Feature Overview
Extend the base todo model with a three-level priority system that affects persistence, UI display, sorting, and filtering. The system must remain simple, explicit, and compatible with both light and dark mode.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Sorting behavior defined here becomes the default ordering for incomplete todos in all later features.

## User Stories
- As a user, I can assign High, Medium, or Low priority when creating or editing a todo.
- As a user, I see a color-coded badge for priority in the list UI.
- As a user, I can filter todos by priority.
- As a user, high-priority work appears first automatically.

## User Flow
1. User opens the create or edit form.
2. User selects one of three priority options.
3. UI submits the value with todo create or update requests.
4. List shows a color-coded badge beside the todo title.
5. Incomplete todos are sorted High, then Medium, then Low.
6. User optionally applies a priority filter to view a subset of todos.

## Technical Requirements

### Data Model
- Add `priority` to the `todos` table.
- Use a constrained type:

```ts
type Priority = 'high' | 'medium' | 'low';
```

- Default priority is `medium` for new todos.
- Migration must backfill existing rows safely.

### Validation Rules
- Accept only `high`, `medium`, or `low`.
- Reject unknown values with a 400 response.
- If omitted on create, persist `medium`.

### API Behavior
- `POST /api/todos` accepts optional `priority`.
- `PUT /api/todos/[id]` accepts priority updates.
- `GET /api/todos` includes priority in response payload.
- Filtering may occur client-side first, but the response contract must include the field consistently.

### Sorting Rules
- Priority rank order:
  - `high`
  - `medium`
  - `low`
- Within each priority bucket, sort by due date ascending, then creation date descending.

### Interface Surface
- Priority dropdown in create form.
- Priority dropdown in edit form.
- Priority badge component with color variants.
- Priority filter dropdown with `All Priorities` plus the three values.

## UI Components
- Badge styles:
  - High: red emphasis
  - Medium: yellow or amber emphasis
  - Low: blue emphasis
- Ensure dark mode contrast remains readable.
- Filter UI should combine cleanly with search and tag filtering added later.

## Edge Cases
- Existing todos missing priority after migration.
- Invalid priority injected through API clients.
- Priority update while filtered view is active and item should move in the list.
- Badge contrast failing in dark mode.

## Acceptance Criteria
- All todos persist one of three valid priorities.
- New todos default to Medium if no priority is selected.
- Priority badge is visible and understandable in light and dark mode.
- Sorting consistently places High above Medium above Low.
- Priority filter returns only matching todos.

## Testing Requirements

### E2E
- Create todos with each priority level.
- Edit an existing todo's priority.
- Verify incomplete todo sorting across mixed priorities.
- Filter by each priority level and clear the filter.
- Visual regression or manual verification of badge colors in light and dark mode.

### Unit
- Priority validation helper.
- Priority ranking and comparator logic.
- Defaulting logic for omitted priority.

## Out of Scope
- Custom priority labels.
- User-defined priority colors.
- Multi-select priority filters.

## Success Metrics
- Priority is consistently present in todo payloads.
- Sorting logic becomes deterministic and testable.
- Badge colors meet WCAG AA expectations for text contrast.