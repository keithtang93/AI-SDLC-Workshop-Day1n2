---
id: PRP-07
title: Template System
status: ready-for-build
depends_on: [PRP-01, PRP-03, PRP-05]
test_file: tests/08-template-system.spec.ts # Create if needed
---

# PRP 07: Template System

## Feature Overview

Implement reusable todo templates so users can save common task patterns and recreate them instantly with the same defaults, recurrence behavior, reminders, and optional serialized subtasks.

Project conventions for this feature:

- Persist templates in SQLite via `lib/db.ts`
- Keep template usage scoped to `session.userId`
- Recreate template subtasks from JSON when a template is used
- Use Singapore-aware due-date logic when generating dates from offsets

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Save template, browse/use template, restore metadata, and recreate serialized subtasks |
| **Depends on** | `PRP-01` todos, `PRP-03` recurrence, and `PRP-05` subtask structure |
| **Pre-read** | `lib/db.ts`, `app/page.tsx`, `PRPs/03-recurring-todos.md`, `PRPs/05-subtasks-progress.md` |
| **Do not drift into** | Shared/public templates, template syncing, or workflow automation beyond one-click reuse |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/08-template-system.spec.ts` |

---

## Why This Feature Matters

Templates reduce repetitive data entry and turn the app into a productivity system rather than just a scratchpad. This is especially valuable for recurring work routines, onboarding checklists, and standard operating procedures.

---

## User Stories

### Core user stories
- As a user, I can save a todo pattern as a named template.
- As a user, I can create a new todo from a saved template in one step.
- As a user, the new todo inherits the template's default settings.

### Supporting user stories
- As a user, I can organize templates by category.
- As a user, I can preview template details before using one.
- As a user, I can delete old templates without affecting existing todos.

---

## Canonical Acceptance Criteria

- [ ] Can save current todo as template
- [ ] Templates include all metadata
- [ ] Using template creates new todo
- [ ] Subtasks recreated from JSON
- [ ] Category filtering works

---

## User Flow

1. User fills in a todo form with desired defaults.
2. User clicks `💾 Save as Template`.
3. User enters a template name, optional description, and optional category.
4. The template is stored for the current user.
5. Later, the user chooses `Use Template` from the form or template modal.
6. The app creates a new todo using the template's saved metadata and recreates any serialized subtasks.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - `templates` table, `Template` interface, CRUD helpers
- `app/api/templates/route.ts` - create/list templates
- `app/api/templates/[id]/route.ts` - update/delete template
- `app/api/templates/[id]/use/route.ts` - create a todo from a template
- `app/page.tsx` - save-template UI and quick-use dropdown
- `tests/08-template-system.spec.ts` - E2E coverage

### 2. Data Model

Recommended interface:

```ts
export interface Template {
  id: string
  user_id: string
  name: string
  description?: string | null
  category?: string | null
  title_template: string
  priority: Priority
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
  due_date_offset_days?: number | null
  subtasks_json?: string | null
  created_at: string
  updated_at: string
}
```

Subtasks should serialize to JSON like:

```json
[
  { "title": "Prepare notes", "position": 0 },
  { "title": "Share follow-up", "position": 1 }
]
```

### 3. Validation Rules

- Template `name` is required and trimmed
- Template `title_template` is required
- If the template is recurring, `recurrence_pattern` must be valid
- `subtasks_json` must parse into a safe array structure when present

---

## API Contract

### `GET /api/templates`
Return all templates for the current user, optionally filterable by category.

### `POST /api/templates`
Create a template from the current form state.

```json
{
  "name": "Weekly Review",
  "description": "Default checklist for Friday review",
  "category": "Work",
  "titleTemplate": "Weekly Review",
  "priority": "medium",
  "isRecurring": true,
  "recurrencePattern": "weekly",
  "reminderMinutes": 60,
  "subtasks": [
    { "title": "Review wins", "position": 0 },
    { "title": "Plan next week", "position": 1 }
  ]
}
```

### `PUT /api/templates/[id]`
Edit template metadata and defaults.

### `DELETE /api/templates/[id]`
Delete a template only; do not touch existing todos created from it.

### `POST /api/templates/[id]/use`
Create a new todo from the template.

**Expected behavior**
- create a todo for the current user
- apply stored priority, reminder, and recurrence settings
- recreate subtasks from JSON if present
- optionally compute due date from a configured offset

---

## Frontend / UX Requirements

### Save as Template Flow
- Show `💾 Save as Template` when the title field is populated
- Use a small modal for `name`, `description`, and `category`
- Confirm success with a toast or inline message

### Template Usage
- Provide a `Use Template` dropdown near the form
- Provide a fuller template manager modal for browsing, filtering, and deleting templates
- Display category, priority, recurrence, and reminder info in previews

### Category Handling
- Support simple text categories such as `Work`, `Personal`, `Finance`
- Allow optional category filtering in the template manager

---

## Step-by-Step Implementation Plan

1. **Create the `templates` table in `lib/db.ts`**
   - include fields for metadata, recurrence, reminder, and serialized subtasks

2. **Add `templateDB` CRUD helpers**
   - `create/findAll/findById/update/remove`

3. **Create template API routes**
   - list, create, update, delete, and `use`

4. **Serialize subtasks safely**
   - convert an array of `{ title, position }` into JSON on save
   - validate and recreate them when using a template

5. **Add save-template UI to `app/page.tsx`**
   - modal for naming and categorizing templates

6. **Add quick-use and manager UI**
   - dropdown for quick creation
   - manager modal for browse/use/delete flows

7. **Handle due-date offset logic**
   - if templates support an offset, compute it using Singapore time helpers

8. **Add E2E coverage**
   - save template, use template, verify subtasks and metadata, delete template

---

## Edge Cases

1. Template has no category
2. Template has no subtasks
3. Template contains malformed serialized subtasks and must be rejected
4. Using a template twice should create two independent todos
5. Deleting a template must not affect already-created todos
6. Long template names or descriptions should still render correctly

---

## Testing Requirements

### Required E2E scenarios
- Save a todo as a template
- Use a template to create a new todo
- Verify priority, recurrence, reminder, and subtasks are restored
- Filter templates by category
- Delete a template without affecting existing todos

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/08-template-system.spec.ts
```

---

## Security and Quality Notes

- Validate template ownership on every route
- Sanitize serialized subtasks before parsing
- Keep template application idempotent per user action

---

## Out of Scope

This PRP does **not** define:
- generic search/filter presets (see `08-search-filtering.md`)
- export/import backup flow (see `09-export-import.md`)

---

## Success Metrics

- Common workflows can be recreated in one click
- Template reuse preserves important defaults without corruption
- Category browsing stays simple and fast

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./05-subtasks-progress.md`
- `./03-recurring-todos.md`
