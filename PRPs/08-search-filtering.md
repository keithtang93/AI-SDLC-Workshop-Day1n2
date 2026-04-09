---
id: PRP-08
title: Search & Filtering
status: ready-for-build
depends_on: [PRP-01, PRP-02, PRP-06]
test_file: tests/09-search-filtering.spec.ts
---

# PRP 08: Search & Filtering

## Feature Overview

Implement fast, real-time search and multi-criteria filtering so users can narrow large todo lists without page reloads or extra API requests.

This feature is primarily **client-side** and should follow these rules:

- filtering updates instantly with no submit button
- matching is case-insensitive
- active filters combine with AND logic
- search should cover titles, subtasks, and tag names when available

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Real-time client-side search, AND-based filters, clear/reset behavior, and empty states |
| **Depends on** | `PRP-01` list rendering, `PRP-02` priority fields, and `PRP-06` tag data |
| **Pre-read** | `app/page.tsx`, `lib/db.ts`, `PRPs/02-priority-system.md`, `PRPs/06-tag-system.md` |
| **Do not drift into** | Server-side full-text search or optional preset features unless explicitly requested |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/09-search-filtering.spec.ts` |

---

## Why This Feature Matters

As the todo list grows, speed of retrieval matters as much as speed of capture. Search and filters make the app useful beyond a short list of tasks and help users focus on the right slice of work quickly.

---

## User Stories

### Core user stories
- As a user, I can search todos by text in real time.
- As a user, I can filter by priority and tag.
- As a user, I can combine filters to narrow results precisely.

### Supporting user stories
- As a user, I can clear all filters with one action.
- As a user, I get a clear empty state when nothing matches.
- *(Optional stretch)* As a user, I can save useful filter combinations as browser-local presets.

---

## Canonical Acceptance Criteria

- [ ] Search is case-insensitive
- [ ] Includes tag names in search
- [ ] Filters combine with AND
- [ ] Real-time updates
- [ ] Clear message for empty results

---

## User Flow

1. User types into the search bar.
2. The list updates after a short debounce, without a submit action.
3. User optionally selects a priority and/or tag filter.
4. User can expand advanced filters for completion status and due-date range.
5. If no todos match, the UI shows a helpful empty state instead of blank sections.
6. User can clear all filters immediately; saving the current combination as a preset is an optional stretch enhancement.

---

## Technical Requirements

### 1. File Ownership

- `app/page.tsx` - search state, filter state, derived filtered list, and optional preset UI
- `lib/db.ts` - expose any fields needed by the client (`tags`, `subtasks`, `priority`, `due_date`)
- `tests/09-search-filtering.spec.ts` - E2E coverage and performance checks

### 2. Filtering Model

Recommended state shape:

```ts
interface TodoFilters {
  query: string
  priority: 'all' | Priority
  tagId: 'all' | string
  completion: 'all' | 'complete' | 'incomplete'
  dueFrom: string
  dueTo: string
}
```

### 3. Performance Rules

- Debounce text input by about `300ms`
- Keep the filtering client-side for normal list sizes
- Use memoized derived state if the list becomes large

---

## API Contract

No new backend endpoints are required for the base version. Search and filters should operate over the already-fetched todo list returned by `GET /api/todos`.

If the list becomes very large in the future, a server-side search API can be introduced later, but that is out of scope for this PRP.

---

## Frontend / UX Requirements

### Search Bar
- Full-width search input with placeholder such as `Search todos and subtasks...`
- Case-insensitive partial matching
- Clear (`✕`) action when text exists

### Quick Filters
- `All Priorities` dropdown
- `All Tags` dropdown
- `Advanced` toggle for extra filters

### Advanced Filters
- completion status (`all`, `incomplete`, `completed`)
- due-date range (`from`, `to`)
- *(Optional stretch)* saved filter presets stored in `localStorage`

### Filter Summary and Empty State
- Show active filter indicators or values clearly
- Render a friendly empty state message such as `No todos match your current filters.`
- Provide `Clear All` for instant reset

---

## Step-by-Step Implementation Plan

1. **Add search and filter state to `app/page.tsx`**
   - query
   - priority
   - tag
   - completion status
   - date range

2. **Create a debounced search input**
   - use `setTimeout` or a small reusable debounce hook
   - update results without a submit button

3. **Build a single filter pipeline**
   - title and subtask text matching
   - tag-name inclusion
   - priority filtering
   - completion filtering
   - date-range filtering

4. **Apply AND logic consistently**
   - a todo must satisfy every active filter to remain visible

5. **Add `Clear All` and summary UI**
   - reset all filters to their defaults with one click

6. **Optional enhancement: add preset save/load/delete**
   - store presets in `localStorage`
   - apply them instantly when clicked
   - keep this separate from the base acceptance criteria

7. **Add empty-state handling**
   - hide empty sections where appropriate
   - show a helpful message when all results are filtered out

8. **Add E2E coverage**
   - search by title
   - search by tag name
   - combine multiple filters
   - clear/reset flows

---

## Edge Cases

1. Search query with special characters
2. Search that only matches a subtask title
3. Active tag filter after the tag has been deleted
4. Date range with only a `from` or only a `to` value
5. No results across all three sections
6. Large todo lists should still filter quickly and not feel laggy

---

## Testing Requirements

### Required E2E scenarios
- Search by todo title
- Search by tag name
- Filter by priority
- Filter by tag
- Combine filters using AND behavior
- Clear all filters
- Confirm acceptable performance with large lists

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/09-search-filtering.spec.ts
```

---

## Security and Quality Notes

- Since filtering is client-side, keep user data scoped before it reaches the UI
- Avoid expensive re-renders by deriving filtered lists efficiently
- Do not rely on search alone for access control; the API must already enforce ownership

---

## Out of Scope

This PRP does **not** define:
- server-side full-text search
- analytics/reporting over search history

---

## Success Metrics

- Users can find matching todos instantly while typing
- Combined filters feel predictable and transparent
- Empty states and reset actions reduce frustration

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./06-tag-system.md`
- `./02-priority-system.md`
