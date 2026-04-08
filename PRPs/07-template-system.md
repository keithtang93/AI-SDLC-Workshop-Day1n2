# PRP 07: Template System

## Feature Overview
Allow users to save reusable todo configurations as templates and quickly create new todos from them. Templates should capture recurring settings, priority, reminders, and optional serialized subtasks while excluding user-specific runtime data like exact due dates.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Depends on [03-recurring-todos.md](03-recurring-todos.md), [04-reminders-notifications.md](04-reminders-notifications.md), [05-subtasks-progress.md](05-subtasks-progress.md), and [06-tag-system.md](06-tag-system.md) where those fields are supported by the implementation.

## User Stories
- As a user, I can save a todo configuration as a template.
- As a user, I can categorize and describe templates.
- As a user, I can browse and use templates to create todos quickly.
- As a user, a todo created from a template preserves the intended settings.

## User Flow
1. User fills out a todo form or selects an existing todo pattern.
2. User chooses `Save as Template`.
3. User enters template name, optional description, and optional category.
4. App stores the template definition.
5. User later opens a template picker or manager.
6. User previews template details and chooses `Use`.
7. App creates a new todo using the stored template contract.

## Technical Requirements

### Data Model
- Create `templates` table scoped by `user_id`.
- Suggested fields:
  - `id`
  - `user_id`
  - `name`
  - `description`
  - `category`
  - `title_template`
  - `priority`
  - `is_recurring`
  - `recurrence_pattern`
  - `reminder_minutes`
  - `subtasks_json`
  - `created_at`
  - `updated_at`

### Validation Rules
- Template name is required and trimmed.
- Stored enum fields must match existing todo constraints.
- `subtasks_json` must serialize a valid array structure when present.

### API Endpoints
- `GET /api/templates`
- `POST /api/templates`
- `PUT /api/templates/[id]`
- `DELETE /api/templates/[id]`
- `POST /api/templates/[id]/use`

### Template Use Rules
- Creating from a template must create a new todo, not mutate the template.
- Template should preserve:
  - title pattern
  - priority
  - recurrence settings
  - reminder setting
  - category and description for display
  - subtasks when supported
- Template should not preserve:
  - original todo ID
  - completion state
  - original user association beyond the current user
  - sent notification timestamps
- Due dates should be blank by default unless a documented offset mechanism is explicitly implemented.

### Interface Surface
- `Save as Template` action from create form or todo actions.
- Save template modal with name, description, category.
- Template manager modal with list, preview, use, edit, and delete actions.
- Category filter in template browser.

## UI Components
- Template preview must show the important behavioral settings before use.
- Using a template should be a fast path with minimal extra prompts.

## Edge Cases
- Saving a template with invalid serialized subtasks.
- Template references features not yet enabled in the current build.
- Duplicate template names if naming uniqueness is enforced.
- User deletes a template after many todos have already been created from it.

## Acceptance Criteria
- User can save a template from a valid todo configuration.
- User can browse, edit, and delete templates.
- Using a template creates a new todo with preserved supported metadata.
- Subtasks serialize and restore correctly if included.
- Category filtering works in the template browser.

## Testing Requirements

### E2E
- Save a todo as a template.
- Create a todo from a saved template.
- Verify template preserves priority, recurrence, and reminder settings.
- Verify subtasks are created from serialized data.
- Edit and delete templates.

### Unit
- Subtask JSON serialization and deserialization.
- Template payload validation.
- Template-to-todo mapping logic.

## Out of Scope
- Team-shared templates.
- Template version history.
- Conditional template logic.

## Success Metrics
- Template use materially reduces repeated todo setup steps.
- Serialized subtask restoration is deterministic and testable.
- Template CRUD stays isolated from normal todo CRUD.