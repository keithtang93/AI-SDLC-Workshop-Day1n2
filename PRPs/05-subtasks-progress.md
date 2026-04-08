# PRP 05: Subtasks & Progress Tracking

## Feature Overview
Enable users to break a todo into smaller checklist items, track completion independently of the parent todo, and visualize progress with both text and a progress bar.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Template and export/import features must respect the subtask model defined here.

## User Stories
- As a user, I can expand a todo to see its subtasks.
- As a user, I can add multiple subtasks to a parent todo.
- As a user, I can toggle subtask completion independently of the parent todo.
- As a user, I can delete individual subtasks.
- As a user, I can see progress as both a count and a percentage.

## User Flow
1. User expands a todo's subtasks section.
2. User enters a subtask title and adds it.
3. UI sends `POST /api/todos/[id]/subtasks` and updates the visible list.
4. User toggles one or more subtask checkboxes.
5. UI sends `PUT /api/subtasks/[id]` and updates progress immediately.
6. User deletes a subtask with `DELETE /api/subtasks/[id]`.
7. If the parent todo is deleted, all subtasks are removed through cascade behavior.

## Technical Requirements

### Data Model
- Create `subtasks` table with fields:
  - `id`
  - `todo_id`
  - `title`
  - `completed`
  - `position`
  - `created_at`
  - `updated_at`
- `todo_id` must use foreign key cascade delete.
- `position` preserves display order.

### Validation Rules
- Subtask title is required, trimmed, and non-empty.
- Parent todo must belong to the authenticated user.
- Position should be assigned deterministically for newly created subtasks.

### API Endpoints
- `POST /api/todos/[id]/subtasks`
  - Creates a subtask for a user-owned todo.
- `PUT /api/subtasks/[id]`
  - Updates title and/or completion state.
- `DELETE /api/subtasks/[id]`
  - Deletes a subtask.

### Progress Rules
- Progress percentage = `(completed_subtasks / total_subtasks) * 100`.
- Display text should follow `X/Y completed` or `X/Y subtasks` consistently.
- Parent todo completion remains independent unless explicitly designed otherwise.
- Green bar at 100%, blue or equivalent non-success color otherwise.

### Interface Surface
- Expand/collapse control per todo.
- Subtask input and add action.
- Subtask rows with checkbox and delete action.
- Progress text and progress bar visible even when subtasks are collapsed if subtasks exist.

## UI Components
- Expanded state should be easy to scan and should not disrupt the main todo actions.
- Progress UI should update in real time after subtask changes.

## Edge Cases
- User adds many subtasks.
- Duplicate subtask titles under the same todo.
- Last subtask deleted causing progress UI to disappear cleanly.
- Parent todo deleted while subtask API requests are in flight.
- Stale ordering or position conflicts after rapid creates.

## Acceptance Criteria
- User can add unlimited subtasks to a todo.
- User can toggle subtask completion independently.
- Progress bar and text update immediately after subtask changes.
- Subtask deletion works without breaking parent todo state.
- Deleting a todo deletes all its subtasks.

## Testing Requirements

### E2E
- Expand and collapse subtasks section.
- Add multiple subtasks.
- Toggle subtask completion and verify progress updates.
- Delete a subtask.
- Delete a parent todo and verify cascade delete.

### Unit
- Progress calculation helper.
- Subtask title validation.
- Position assignment logic.

## Out of Scope
- Drag-and-drop reordering.
- Nested subtasks.
- Auto-completing parent when all subtasks are complete.

## Success Metrics
- Progress calculations are deterministic and easy to verify.
- Cascade deletion works reliably.
- Expanded and collapsed states remain responsive with realistic subtask counts.