# PRP 09: Export & Import

## Feature Overview
Provide a reliable way to export todo data for backup or transfer and re-import it later while preserving relationships such as subtasks and tags. The JSON contract must be versioned and validated, and import logic must safely remap IDs.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Depends on [05-subtasks-progress.md](05-subtasks-progress.md) and [06-tag-system.md](06-tag-system.md).
- Should remain compatible with recurring, priority, and reminder fields when they exist.

## User Stories
- As a user, I can export my todo data to a file for backup.
- As a user, I can import a valid export file and restore my data.
- As a user, the import process preserves relationships and avoids obvious duplication errors.
- As a user, invalid import files fail with clear errors.

## User Flow
1. User clicks `Export`.
2. App requests `GET /api/todos/export` and downloads a JSON file.
3. User stores or transfers the file.
4. User clicks `Import` and selects a JSON export file.
5. App validates the file client-side where helpful and posts it to `POST /api/todos/import`.
6. Server validates schema, remaps IDs, reuses matching tags where appropriate, and creates new records.
7. UI refreshes and shows success counts.

## Technical Requirements

### Export Contract
- `GET /api/todos/export`
- Response should include a versioned JSON payload with:
  - todos
  - subtasks
  - tags
  - todo-tag associations or an equivalent denormalized structure
- Include all supported todo metadata fields used by the application.

### Import Contract
- `POST /api/todos/import`
- Accepts the current export schema version.
- Rejects malformed JSON, unsupported versions, and missing required fields.
- Creates new rows under the current authenticated user.

### Import Rules
- Imported todo IDs must be remapped.
- Imported subtask and association references must use remapped IDs.
- Tag name conflicts should reuse existing user-owned tags where documented, rather than creating duplicates blindly.
- Import should preserve todo properties such as priority, recurrence, reminders, and completion state when present in the contract.

### Interface Surface
- Export button.
- Import button with file picker.
- Success and error messaging with counts.
- Optional import validation preview if implemented.

## UI Components
- Export should feel immediate and deterministic.
- Import errors must be actionable rather than generic failures.

## Edge Cases
- Invalid JSON syntax.
- Unsupported export version.
- Missing nested arrays.
- Duplicate tag names in imported data.
- Partial failure during import causing inconsistent relationships.
- User imports the same file multiple times.

## Acceptance Criteria
- Export produces a valid JSON payload with versioning.
- Import validates schema before persisting records.
- Imported todos, subtasks, and tag associations are preserved correctly.
- Existing matching tags are reused when conflict resolution says they should be.
- Error messages are clear for invalid files.

## Testing Requirements

### E2E
- Export current todos.
- Import a valid export file.
- Verify imported todos appear immediately.
- Verify subtasks and tag relationships remain intact.
- Import invalid JSON and verify clear failure handling.

### Unit
- Export schema generation.
- Import schema validation.
- ID remapping logic.
- Tag conflict resolution logic.

## Out of Scope
- CSV import.
- Partial selective import UI.
- Cross-user merging strategies beyond current-user import.

## Success Metrics
- Export files are stable and human-inspectable.
- Import reliably restores relational integrity.
- Failures are safe and never leave partial, broken data visible to users.