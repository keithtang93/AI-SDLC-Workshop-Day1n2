---
id: PRP-03
title: Recurring Todos
status: ready-for-build
depends_on: [PRP-01, PRP-02]
test_file: tests/04-recurring-todos.spec.ts
---

# PRP 03: Recurring Todos

## Feature Overview

Implement recurring todos so a task can automatically reproduce itself on a schedule when completed. Supported patterns are `daily`, `weekly`, `monthly`, and `yearly`.

Project rules for this feature:

- Use Singapore time for all date calculations via `lib/timezone.ts`
- Keep database operations synchronous in `lib/db.ts`
- Handle recurrence primarily through `PUT /api/todos/[id]`
- Preserve user scoping on every create/update operation

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Recurrence fields, due-date calculation, completion-triggered next-instance creation, and metadata inheritance |
| **Depends on** | `PRP-01` CRUD behavior and `PRP-02` priority retention |
| **Pre-read** | `PRPs/01-todo-crud-operations.md`, `lib/timezone.ts`, `app/api/todos/[id]/route.ts`, `lib/db.ts` |
| **Do not drift into** | Notification delivery, calendar rendering, or background scheduling systems |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/04-recurring-todos.spec.ts` |

---

## Why This Feature Matters

Recurring tasks are central to personal productivity: bills, meetings, habits, reviews, and maintenance work all repeat. This feature must feel automatic and trustworthy, especially around due-date calculation and metadata inheritance.

---

## User Stories

### Core user stories
- As a user, I can mark a todo as repeating daily, weekly, monthly, or yearly.
- As a user, I can complete a recurring todo and automatically get the next occurrence.
- As a user, the next occurrence keeps the same settings so I do not re-enter them every time.

### Supporting user stories
- As a user, recurring todos clearly show that they repeat.
- As a user, I cannot create a recurring todo without a due date.
- As a user, I can disable recurrence later if the task stops repeating.

---

## Canonical Acceptance Criteria

- [ ] All four patterns work correctly
- [ ] Next instance created on completion
- [ ] Metadata inherited properly
- [ ] Date calculations accurate (Singapore timezone)
- [ ] Can disable recurring on existing todo

---

## User Flow

1. User enables a `Repeat` checkbox on the create or edit form.
2. User chooses one pattern: `daily`, `weekly`, `monthly`, or `yearly`.
3. User provides a due date (required for recurring tasks).
4. The todo appears with a `🔄` recurrence badge.
5. When the user marks the todo complete:
   - the current item becomes completed
   - the system calculates the next due date in Singapore time
   - a new incomplete todo is created with inherited metadata
6. If the user later disables recurrence, future completions no longer generate a new instance.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - recurrence fields and helper DB methods
- `lib/timezone.ts` - safe date calculation helpers
- `app/api/todos/route.ts` - create validation
- `app/api/todos/[id]/route.ts` - completion and next-instance logic
- `app/page.tsx` - repeat checkbox and recurrence dropdown
- `tests/04-recurring-todos.spec.ts` - E2E coverage

### 2. Data Model

Use these shared fields:

```ts
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface Todo {
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern | null
  due_date?: string | null
}
```

### 3. Validation Rules

- `is_recurring = true` requires a valid `due_date`
- `recurrence_pattern` must be one of the four supported strings
- If `is_recurring = false`, clear `recurrence_pattern`
- Do not allow business logic to use raw `new Date()` without Singapore normalization

### 4. Next-Date Rules

Recommended recurrence behavior:

| Pattern | Rule |
|---------|------|
| Daily | add 1 day |
| Weekly | add 7 days |
| Monthly | same calendar day next month when possible; otherwise clamp to month end |
| Yearly | same calendar day next year; handle leap years safely |

---

## API Contract

### `POST /api/todos`

**Request body**

```json
{
  "title": "Pay rent",
  "dueDate": "2026-04-30T09:00:00+08:00",
  "isRecurring": true,
  "recurrencePattern": "monthly"
}
```

**Validation failures**
- `400` recurring todo missing due date
- `400` invalid recurrence pattern

### `PUT /api/todos/[id]`

This route owns the completion flow.

**When toggling completion on a recurring todo:**
- mark the current todo complete
- calculate the next due date
- create a new todo with:
  - same title
  - same priority
  - same reminder offset
  - same recurrence values
  - same tags, if the tag system exists

**Response expectation**
- return the updated todo and, when applicable, the newly created next instance

---

## Frontend / UX Requirements

### Create and Edit Form
- Add a `Repeat` checkbox
- Show the recurrence dropdown only when the box is enabled
- Disable or hide impossible options when no due date exists

### Visual Display
- Show a purple or clearly distinct `🔄 daily|weekly|monthly|yearly` badge
- Keep the badge visible in both list view and edit state

### Completion Behavior
- Marking a recurring todo complete should still feel instant
- The newly generated occurrence should appear in the correct section after refresh or optimistic update

---

## Step-by-Step Implementation Plan

1. **Confirm fields in `lib/db.ts`**
   - `is_recurring`
   - `recurrence_pattern`
   - shared `RecurrencePattern` type

2. **Add create validation in `POST /api/todos`**
   - recurring requires due date
   - pattern must be valid

3. **Create a date-calculation helper**
   - prefer `lib/timezone.ts`
   - safely handle month-end and leap-year cases

4. **Enhance `PUT /api/todos/[id]`**
   - detect completion transition from `false -> true`
   - only generate the next instance once per completion action

5. **Preserve metadata**
   - inherit priority, reminder, recurrence settings, and tags

6. **Update `app/page.tsx` form controls**
   - repeat checkbox
   - recurrence dropdown
   - validation messages

7. **Add badge rendering in the list**
   - clear label and consistent styling

8. **Write Playwright coverage**
   - create all four pattern types
   - complete one and verify next instance details

---

## Edge Cases

1. Monthly recurrence from the 29th, 30th, or 31st
2. Leap-day yearly recurrence (`Feb 29`)
3. Completing an overdue recurring todo should still create the next valid instance
4. Turning recurrence off should prevent future auto-generation
5. Editing the pattern on an existing todo should update future behavior only
6. Duplicate next-instance creation must not occur on double-submit

---

## Testing Requirements

### Required E2E scenarios
- Create daily, weekly, monthly, and yearly recurring todos
- Complete a recurring todo and verify the next instance appears
- Verify inherited priority, reminder, and tag metadata
- Disable recurrence on an existing todo
- Verify Singapore-time due-date calculation for edge dates

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/04-recurring-todos.spec.ts
```

---

## Security and Quality Notes

- Scope completion and generated records to the logged-in user only
- Guard against duplicate writes from rapid double clicks
- Keep recurrence logic deterministic and testable

---

## Out of Scope

This PRP does **not** define:
- browser notifications (see `04-reminders-notifications.md`)
- subtasks and progress (see `05-subtasks-progress.md`)
- calendar rendering (see `10-calendar-view.md`)

---

## Success Metrics

- All four patterns generate correct future dates
- Completion reliably creates exactly one next instance
- Repeating tasks remain low-friction to manage over time

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
