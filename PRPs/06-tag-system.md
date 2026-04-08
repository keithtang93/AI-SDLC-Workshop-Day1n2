# PRP 06: Tag System

## Feature Overview
Add user-defined, color-coded tags that can be managed independently and attached to todos through a many-to-many relationship. Tags must support display, editing, deletion, and filtering.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Search and filtering features will consume the tag model defined here.

## User Stories
- As a user, I can create tags with a name and color.
- As a user, I can edit or delete existing tags.
- As a user, I can assign multiple tags to a todo.
- As a user, I can click or select a tag to filter my todos.

## User Flow
1. User opens a `Manage Tags` modal.
2. User creates a tag with a unique name and chosen color.
3. Tag appears as an available option in create/edit todo forms.
4. User assigns one or more tags to a todo.
5. Todo list shows tag badges.
6. User edits a tag and all linked todo badges update.
7. User deletes a tag and associations are removed safely.

## Technical Requirements

### Data Model
- Create `tags` table with fields:
  - `id`
  - `user_id`
  - `name`
  - `color`
  - `created_at`
  - `updated_at`
- Create join table `todo_tags` with:
  - `todo_id`
  - `tag_id`
- Enforce unique tag names per user.

### Validation Rules
- Tag name is required, trimmed, and unique per user.
- Color must be a valid hex string or approved color format.
- Todo-tag assignment must only allow tags owned by the same user.

### API Endpoints
- `GET /api/tags`
- `POST /api/tags`
- `PUT /api/tags/[id]`
- `DELETE /api/tags/[id]`
- `POST /api/todos/[id]/tags`
- `DELETE /api/todos/[id]/tags`

### Relationship Behavior
- A todo may have zero to many tags.
- A tag may belong to zero to many todos.
- Deleting a tag removes join-table records but does not delete todos.
- Deleting a todo removes its join-table records.

### Interface Surface
- Tag management modal with create, edit, delete flows.
- Tag selector in todo create/edit forms.
- Tag badges on todo rows.
- Tag filter dropdown and/or click-to-filter badge interaction.
- Active tag filter indicator with clear action.

## UI Components
- Tag badges must use readable contrast against custom colors.
- Selected tags in forms should be clearly differentiated from unselected tags.

## Edge Cases
- Duplicate tag name creation.
- Invalid color value.
- Tag renamed while filters are active.
- Deleting a tag currently used by many todos.
- Cross-user tag access attempts.

## Acceptance Criteria
- Users can create, edit, and delete tags.
- Tags are unique per user.
- Users can assign multiple tags to a todo.
- Todo rows display colored tag badges.
- Deleting a tag removes it from all todos without deleting the todos themselves.
- Filtering by tag returns the correct subset.

## Testing Requirements

### E2E
- Create tag.
- Edit tag name and color.
- Delete tag.
- Assign multiple tags to a todo.
- Filter by tag and clear the filter.
- Reject duplicate tag name creation.

### Unit
- Tag name normalization and uniqueness validation.
- Color validation helper.
- Join-table mapping behavior.

## Out of Scope
- Shared tags across users.
- Hierarchical tags.
- Tag analytics.

## Success Metrics
- Tag CRUD remains stable with many associations.
- Tag badge rendering remains readable in light and dark mode.
- Tag filtering integrates cleanly with other filters.