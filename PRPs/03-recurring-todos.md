# PRP 03: Recurring Todos

## Feature Overview
Allow users to create repeating todos with daily, weekly, monthly, or yearly recurrence. Completing a recurring todo must create the next instance automatically while preserving supported metadata and using Singapore timezone calculations.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md).
- Depends on [02-priority-system.md](02-priority-system.md) so recurring instances preserve priority.
- Future tag and reminder features must inherit metadata according to this PRP.

## User Stories
- As a user, I can mark a todo as recurring and choose a recurrence pattern.
- As a user, I must supply a due date for recurring todos.
- As a user, when I complete a recurring todo, the next occurrence is created automatically.
- As a user, the next occurrence keeps the expected metadata from the prior one.

## User Flow
1. User creates or edits a todo and enables `Repeat`.
2. User selects one pattern: daily, weekly, monthly, yearly.
3. UI requires a due date before submission succeeds.
4. Todo displays a recurring badge in the list.
5. User marks the recurring todo complete.
6. Server updates the current instance and creates a new incomplete instance with the next due date.
7. User sees the completed item in Completed and the new instance in Pending or Overdue depending on date.

## Technical Requirements

### Data Model
- Add fields to `todos`:
  - `is_recurring`
  - `recurrence_pattern`
- Define type:

```ts
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

### Validation Rules
- Recurring todos require a valid due date.
- `recurrence_pattern` is required when `is_recurring` is true.
- Non-recurring todos must not require recurrence fields.
- Reject unsupported patterns.

### Recurrence Logic
- Compute next due date from the current due date in Singapore timezone, not from browser local timezone.
- Pattern behavior:
  - Daily: +1 day
  - Weekly: +7 days
  - Monthly: same calendar day next month with safe rollover handling
  - Yearly: same calendar day next year with leap-year-safe handling
- Next instance inherits:
  - title
  - priority
  - reminder settings when that feature exists
  - tag associations when that feature exists
  - recurrence fields
- Next instance is created only when the current recurring todo is marked completed.

### API Behavior
- `POST /api/todos` and `PUT /api/todos/[id]` accept recurrence fields.
- Completion handling in `PUT /api/todos/[id]` must branch for recurring items.
- Response payload should make it possible for the UI to refresh both the completed item and the newly created instance.

### Interface Surface
- `Repeat` checkbox in create/edit forms.
- Recurrence pattern dropdown shown only when repeat is enabled.
- Disabled or hidden recurrence controls when repeat is off.
- Recurring badge, for example `Recurring: weekly`.

## UI Components
- Due date input must remain visible and clearly required when repeat is enabled.
- Badge should be distinguishable from priority and reminder badges.

## Edge Cases
- User enables recurring but omits due date.
- Month-end rollover, such as January 31 to February.
- Leap year handling for yearly recurrence.
- Repeated completion requests due to stale client retries causing duplicate next instances.
- User disables recurrence on an existing recurring todo.

## Acceptance Criteria
- User can create daily, weekly, monthly, and yearly recurring todos.
- Recurring todos cannot be saved without a due date.
- Completing a recurring todo creates exactly one next instance.
- New instance receives the correct next due date and inherits supported metadata.
- User can disable recurring behavior on edit.

## Testing Requirements

### E2E
- Create recurring todos for all four patterns.
- Reject recurring todo creation without due date.
- Complete each recurring pattern and verify next instance creation.
- Verify inherited priority and reminder fields where applicable.
- Disable recurring on an existing todo and verify no new instance is created on completion.

### Unit
- Next due date calculation for each recurrence pattern.
- Month-end and leap-year date logic.
- Duplicate-prevention logic for repeated completion requests.

## Out of Scope
- Custom recurrence intervals.
- Business-day recurrence.
- Editing an entire recurring series.

## Success Metrics
- All recurrence calculations pass unit tests in Singapore timezone.
- Recurring completion never produces duplicate next instances.
- Recurring todos remain understandable in the main list UI.