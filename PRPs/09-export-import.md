---
id: PRP-09
title: Export & Import
status: ready-for-build
depends_on: [PRP-01, PRP-05, PRP-06]
test_file: tests/10-export-import.spec.ts
---

# PRP 09: Export & Import

## Feature Overview

Implement JSON-based backup and restore for todos so users can safely move data between devices or keep offline backups. CSV export is an optional stretch goal for spreadsheet analysis and is not part of the core acceptance criteria.

Key conventions:

- All export/import operations are user-scoped
- JSON format is the canonical backup format
- Import must validate data before writing anything
- Relationships must be preserved through ID remapping

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | JSON export, validated JSON import, ID remapping, and relationship preservation |
| **Depends on** | `PRP-01` todo data plus `PRP-05` subtasks and `PRP-06` tags |
| **Pre-read** | `lib/db.ts`, `app/page.tsx`, `PRPs/05-subtasks-progress.md`, `PRPs/06-tag-system.md` |
| **Do not drift into** | Cloud sync, third-party formats, or CSV work unless explicitly requested as stretch |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/10-export-import.spec.ts` |

---

## Why This Feature Matters

User trust increases when data is portable and recoverable. Export/import also makes migrations, backups, and manual analysis practical without locking users into a single device.

---

## User Stories

### Core user stories
- As a user, I can export my todos as JSON for backup.
- As a user, I can import a valid JSON backup and restore my data.
- As a user, relationships between todos, subtasks, and tags remain intact after import.

### Supporting user stories
- As a user, I get clear success and error messages during import.
- As a user, duplicate tags are reused rather than recreated unnecessarily.
- *(Optional stretch)* As a user, I can also export CSV for spreadsheet analysis.

---

## Canonical Acceptance Criteria

- [ ] Export creates valid JSON
- [ ] Import validates format
- [ ] All relationships preserved
- [ ] No duplicate tags created
- [ ] Error messages clear

---

## User Flow

1. User clicks `Export JSON` to download a backup file.
2. The app generates a user-scoped export payload including todos and related data.
3. Later, the user clicks `Import` and selects a JSON file.
4. The API validates version, shape, and required fields.
5. New IDs are generated during import, while relationships are remapped safely.
6. Success or failure feedback appears immediately.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - export helpers, transactional import helpers, ID remapping support
- `app/api/todos/export/route.ts` - JSON export endpoint (`csv` optional stretch)
- `app/api/todos/import/route.ts` - validated import endpoint
- `app/page.tsx` - export buttons, import button, file picker, feedback UI
- `tests/10-export-import.spec.ts` - E2E coverage

### 2. Export Schema

Canonical JSON shape:

```json
{
  "version": 1,
  "exportedAt": "2026-04-08T10:00:00+08:00",
  "todos": [],
  "subtasks": [],
  "tags": [],
  "todoTags": []
}
```

### 3. Validation Rules

- Require a valid JSON object with a `version` field
- Validate todo enum values (`priority`, `recurrence_pattern`)
- Reject malformed or partially corrupted structures with clear errors
- Import should be transactional or safely staged to avoid partial writes

---

## API Contract

### `GET /api/todos/export`

**Behavior**
- require session
- return only the current user's data
- must support `format=json`; `format=csv` is optional stretch behavior

**Example**

```http
GET /api/todos/export?format=json
```

### `POST /api/todos/import`

**Behavior**
- require session
- validate the incoming JSON
- create new rows with new ids
- remap old todo ids to new ids for subtasks and tag associations
- reuse existing tags by name where appropriate to avoid duplicates

**Success response**

```json
{
  "success": true,
  "imported": {
    "todos": 12,
    "subtasks": 31,
    "tags": 5
  }
}
```

---

## Frontend / UX Requirements

### Export UI
- `Export JSON` button for full-fidelity backups
- *(Optional stretch)* `Export CSV` button for spreadsheet/reporting needs
- meaningful filename such as `todos-YYYY-MM-DD.json`

### Import UI
- `Import` button opens a file picker
- Validate file type and show an error for malformed JSON
- Refresh the visible todo list immediately after successful import

### Feedback
- success message should include counts
- error message should say what was wrong without exposing internals

---

## Step-by-Step Implementation Plan

1. **Define export payload helpers in `lib/db.ts`**
   - collect todos, subtasks, tags, and join-table rows for one user

2. **Create `GET /api/todos/export`**
   - format data to JSON
   - keep CSV generation clearly marked as an optional stretch enhancement if included

3. **Create import validation logic**
   - version check
   - schema check
   - enum validation

4. **Implement ID remapping**
   - generate new ids for todos/subtasks/tags as needed
   - maintain an old-to-new id map for relationships

5. **Reuse duplicate tags by name**
   - if a tag with the same name already exists for the user, link to it instead of creating another one

6. **Add UI controls in `app/page.tsx`**
   - export buttons
   - import file picker
   - success/error toasts

7. **Add E2E and unit coverage**
   - valid export/import
   - invalid JSON handling
   - relationship preservation

---

## Edge Cases

1. Import file is valid JSON but wrong schema
2. Import file is partially missing subtasks or tags
3. Duplicate tag names already exist for the current user
4. Empty export with zero todos
5. Large imports should remain stable and transactional
6. CSV export should not be accepted for import

---

## Testing Requirements

### Required scenarios
- Export valid JSON
- Import a valid backup file
- Reject malformed JSON with a clear error
- Verify subtasks and tag relationships are preserved
- Confirm imported todos appear immediately
- Unit-test the ID remapping helper

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/10-export-import.spec.ts
```

---

## Security and Quality Notes

- Never export or import another user's data
- Validate everything before writing to the database
- Use transactions or transaction-like staging to avoid half-imported states

---

## Out of Scope

This PRP does **not** define:
- cloud sync or background synchronization
- third-party import formats beyond the app's JSON schema

---

## Success Metrics

- Backups are portable and restorable without broken references
- Import failures are clear and non-destructive
- Duplicate tags are avoided automatically

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./05-subtasks-progress.md`
- `./06-tag-system.md`
