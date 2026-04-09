# PRP 03: Recurring Todos

## Feature Overview

Automatically create repeating tasks on schedules (daily, weekly, monthly, yearly). When a recurring todo is marked complete, a new instance is automatically created for the next occurrence with the same priority, tags, reminder offset, and recurrence pattern. Due dates are calculated based on Singapore timezone using `lib/timezone.ts`, and recurring todos require a due date.

**Core Capabilities:**

- Four recurrence patterns: Daily (every 1 day), Weekly (every 7 days), Monthly (same date, next month), Yearly (same month/date, next year)
- Next instance created only when current todo marked complete
- Metadata inheritance: priority, tags, reminder offset, recurrence pattern preserved
- Singapore timezone for all date calculations
- 🔄 badge display with pattern name (e.g., "🔄 weekly")
- Can toggle recurrence on/off and change patterns anytime
- Recurrence dropdown disabled if no due date set

---

## User Stories

### Story 1: Daily Recurring Habit

**As a productivity enthusiast, I want to create daily recurring todos for habits like exercise, so that I receive a new todo each day.**

- Acceptance: Select Daily pattern, complete todo, new instance appears next day at same time
- Pre-condition: Due date set in future
- Post-condition: New todo has same metadata, same time of day next day

### Story 2: Weekly Recurring Task

**As a project manager, I want to create weekly meetings that repeat, so that I don't have to manually recreate them.**

- Acceptance: Select Weekly pattern, complete on Wednesday, new instance appears next Wednesday
- Pre-condition: Due date set
- Post-condition: New instance 7 days after original due date

### Story 3: Monthly Recurring Bill

**As a homeowner, I want to track monthly bill payments, so that I never miss a payment deadline.**

- Acceptance: Set due date 15th of month, complete it, new instance appears 15th of next month
- Pre-condition: Due date set to specific day of month
- Post-condition: New instance on same day number next month (handling month-end edge cases)

### Story 4: Yearly Recurring Reminder

**As a person who plans ahead, I want annual recurring todos for birthdays and anniversaries, so that I remember important dates.**

- Acceptance: Set date to 12/25, complete it, next instance appears 12/25 next year
- Pre-condition: Due date set
- Post-condition: New instance preserves month and day exactly one year later

### Story 5: Metadata Inheritance

**As a user, I want my recurring todos to preserve settings each cycle, so that I don't have to reconfigure priority and reminders.**

- Acceptance: Create recurring todo with High priority and 1-hour reminder, complete it, new instance has same settings
- Pre-condition: Recurring todo with metadata set
- Post-condition: Priority, tags, and reminder offset copied to next instance

### Story 6: Toggle Recurrence

**As a user, I want to convert a recurring todo to non-recurring or vice versa, so that I can adapt to changing needs.**

- Acceptance: Edit recurring todo, uncheck Repeat, confirm becomes one-time todo
- Pre-condition: Recurring todo exists
- Post-condition: No new instance created on completion; can re-enable recurrence anytime

### Story 7: Recurrence Feedback

**As a user, I want to see which todos recur and their patterns, so that I know future instances will be created.**

- Acceptance: Recurring todos show 🔄 badge with pattern (e.g., "🔄 weekly")
- Pre-condition: Recurring todo created
- Post-condition: Badge visible on all displays (list, calendar, etc.)

---

## User Flow

### Create Recurring Todo

1. User enters title and selects priority
2. User sets future due date (required for recurrence)
3. User checks "Repeat" checkbox → recurrence dropdown becomes enabled
4. User selects pattern: Daily/Weekly/Monthly/Yearly
5. User optionally sets reminder
6. User clicks Add
7. Todo created with is_recurring=true and recurrence_pattern set
8. 🔄 badge appears with pattern label

### Complete Recurring Todo

1. User marks recurring todo complete by clicking checkbox
2. System detects is_recurring=true
3. System calculates next due date:
   - **Daily**: current_due_date + 1 day
   - **Weekly**: current_due_date + 7 days
   - **Monthly**: same day number, next month (2/29→3/29, handles month-end)
   - **Yearly**: same month/day, next year
4. System creates new todo with:
   - Same title
   - Same priority
   - Same tags (copied from associated tags)
   - Same reminder_minutes offset
   - Same is_recurring and recurrence_pattern
   - New calculated due_date
   - completed=false
   - is_recurring=true
5. Original todo moved to Completed section
6. New instance appears in Active section with next due date

### Edit Recurring Todo

1. User clicks Edit on recurring todo
2. Modal opens with:
   - Title field
   - Priority dropdown
   - Due date picker (future date required if recurrence enabled)
   - Repeat checkbox (checked)
   - Recurrence pattern dropdown (current pattern selected)
   - Reminder dropdown
3. User can:
   - Change title (affects only this instance)
   - Change priority (affects only this instance; next will inherit before this edit)
   - Change due date (next instance based on NEW date going forward)
   - Uncheck Repeat to convert to one-time todo
   - Change pattern (affects next instance going forward)
   - Change reminder (affects next instance going forward)
4. User clicks Update
5. Current instance updated in database
6. Next instance NOT created automatically (only on completion)

### Disable Recurrence

1. User clicks Edit on recurring todo
2. User unchecks "Repeat" checkbox
3. Dropdown becomes disabled
4. User clicks Update
5. Todo marked is_recurring=false
6. On next completion: stays in Completed, no new instance created
7. To re-enable: edit again, check Repeat, select pattern

### View Recurring Todo Information

1. User hovers on or expands todo details
2. System displays:
   - 🔄 badge with pattern: "🔄 daily", "🔄 weekly", "🔄 monthly", "🔄 yearly"
   - If reminder set: 🔔 badge
   - If due date: formatted due date using Singapore timezone
   - Progress indicator if has subtasks

---

## Technical Requirements

### Database Schema

Additions to todos table (from Feature 01):

```sql
-- Already in Feature 01:
ALTER TABLE todos ADD COLUMN is_recurring BOOLEAN DEFAULT 0;
ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL);

-- Indexes for performance
CREATE INDEX idx_todos_is_recurring ON todos(is_recurring);
CREATE INDEX idx_todos_user_recurring ON todos(user_id, is_recurring);
```

### API Endpoints

All endpoints from Feature 01; recurrence handled in completion logic:

**PUT /api/todos/[id]** — Special handling for completion of recurring todos

```typescript
export async function PUT(request: NextRequest) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const todo = db.getTodoById(id, session.userId);

  if (!todo) return notFound();

  // Update current instance
  const updated = {
    ...todo,
    ...body,
    updated_at: new Date().toISOString(),
  };

  db.updateTodo(id, updated);

  // If completing a recurring todo: create next instance
  if (body.completed === true && todo.is_recurring && todo.recurrence_pattern) {
    const nextDueDate = calculateNextDueDate(
      new Date(todo.due_date!),
      todo.recurrence_pattern,
    );

    db.createTodo({
      user_id: session.userId,
      title: todo.title,
      priority: todo.priority,
      due_date: nextDueDate.toISOString(),
      is_recurring: true,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      completed: false,
    });

    // Copy tags to new instance
    const tags = db.getTagsByTodoId(id);
    const newTodo = db.getTodoByTitle(todo.title, session.userId); // Get newly created
    tags.forEach((tag) => {
      db.addTagToTodo(newTodo.id, tag.id);
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
```

### Recurrence Calculation (Singapore Timezone)

```typescript
import { getSingaporeNow } from "@/lib/timezone";

type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

function calculateNextDueDate(
  currentDueDate: Date,
  pattern: RecurrencePattern,
): Date {
  // Always work in Singapore timezone
  const sg = getSingaporeNow();
  const current = new Date(currentDueDate);

  switch (pattern) {
    case "daily":
      current.setDate(current.getDate() + 1);
      return current;

    case "weekly":
      current.setDate(current.getDate() + 7);
      return current;

    case "monthly": {
      const day = current.getDate();
      current.setMonth(current.getMonth() + 1);
      // Handle month-end: If day doesn't exist in target month, use last day
      if (current.getDate() !== day) {
        current.setDate(0); // Last day of previous month
      }
      return current;
    }

    case "yearly":
      current.setFullYear(current.getFullYear() + 1);
      return current;

    default:
      throw new Error(`Unknown recurrence pattern: ${pattern}`);
  }
}
```

### Types

```typescript
type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

interface RecurringTodo extends Todo {
  is_recurring: true;
  recurrence_pattern: RecurrencePattern;
}

interface RecurrenceConfig {
  pattern: RecurrencePattern;
  nextDueDate: string; // ISO 8601
  daysUntilNext: number;
}

function getRecurrenceConfig(todo: Todo): RecurrenceConfig | null {
  if (!todo.is_recurring || !todo.recurrence_pattern) return null;

  const nextDueDate = calculateNextDueDate(
    new Date(todo.due_date!),
    todo.recurrence_pattern,
  );
  const now = getSingaporeNow();
  const daysUntilNext = Math.floor(
    (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    pattern: todo.recurrence_pattern,
    nextDueDate: nextDueDate.toISOString(),
    daysUntilNext,
  };
}
```

### Validation Rules

1. **Recurrence Requires Due Date**: If is_recurring=true, due_date must be set and in future
2. **Valid Patterns**: Only 'daily', 'weekly', 'monthly', 'yearly' allowed
3. **Pattern Match**: If is_recurring=true, recurrence_pattern must be set
4. **Future Dates**: Both current and next calculated due date must be future

---

## UI Components

### Recurrence Toggle & Selector

```tsx
interface RecurrenceControlProps {
  isRecurring: boolean;
  pattern: RecurrencePattern | null;
  dueDate: string | null;
  onToggle: (isRecurring: boolean) => void;
  onPatternChange: (pattern: RecurrencePattern) => void;
}

export function RecurrenceControl({
  isRecurring,
  pattern,
  dueDate,
  onToggle,
  onPatternChange,
}: RecurrenceControlProps) {
  const hasDate = !!dueDate;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={!hasDate}
          className="w-4 h-4"
        />
        <span>Repeat</span>
        {!hasDate && (
          <span className="text-xs text-gray-500">(Set due date first)</span>
        )}
      </label>

      {isRecurring && (
        <select
          value={pattern || "daily"}
          onChange={(e) => onPatternChange(e.target.value as RecurrencePattern)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      )}
    </div>
  );
}
```

### Recurrence Badge

```tsx
interface RecurrenceBadgeProps {
  pattern: RecurrencePattern;
}

export function RecurrenceBadge({ pattern }: RecurrenceBadgeProps) {
  const labels = {
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
    yearly: "yearly",
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">
      🔄 {labels[pattern]}
    </span>
  );
}
```

### Todo Item with Recurrence Display

```tsx
export function TodoItemWithRecurrence({ todo, ...props }: TodoItemProps) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={props.onComplete}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{todo.title}</span>
          {todo.is_recurring && (
            <RecurrenceBadge pattern={todo.recurrence_pattern!} />
          )}
        </div>
        {todo.due_date && (
          <div className="text-sm text-gray-600">
            Due: {formatSingaporeDate(new Date(todo.due_date))}
          </div>
        )}
      </div>
      <button onClick={props.onEdit}>Edit</button>
    </div>
  );
}
```

---

## Edge Cases

1. **Month-End Recurrence**: Monthly recurrence on 31st with months having 30 days handled by rounding to last day of month
2. **Leap Year**: February 29th yearly recurrence handled correctly (cycles back to Feb 28 in non-leap years)
3. **Timezone Daylight Saving**: Handled by Singapore timezone library (consistent Asia/Singapore)
4. **Complete While Editing**: If todo completed during edit, edit takes precedence; next instance created on next completion
5. **Recurring Without Due Date Initially**: Cannot set recurring without due date; form validation prevents
6. **Disable Recurrence Mid-Cycle**: If user disables recurrence: current instance still completes, no future instance created
7. **Very Far Future Dates**: Monthly/yearly patterns calculated correctly for dates 50+ years out
8. **Timezone Boundary**: If due date near midnight Singapore time, calculation respects boundary
9. **Database Constraints**: Enforced at schema level; bad data rejected with clear error
10. **Concurrent Completions**: If same todo marked complete twice simultaneously: last write wins

---

## Acceptance Criteria

- [ ] All four patterns (daily/weekly/monthly/yearly) create next instance correctly
- [ ] Next instance has correct due date per pattern (verified with unit tests)
- [ ] Metadata inherited on next instance: priority, tags, reminder_minutes, pattern
- [ ] 🔄 badge displays with correct pattern label
- [ ] Recurrence dropdown disabled if no due date set
- [ ] Cannot create recurring todo without due date
- [ ] Can edit recurring todo at any time without triggering next instance creation
- [ ] Can disable recurrence on existing recurring todo (must re-enable to restart cycle)
- [ ] Next instance only created on completion, not on edit or creation
- [ ] Monthly recurrence handles month-end correctly (31st, Feb dates)
- [ ] Yearly recurrence handles leap years (Feb 29)
- [ ] Singapore timezone enforced for all date calculations

---

## Testing Requirements

### Unit Tests

1. **Daily Recurrence**
   - Due date 12/1 2024 10:00 → next 12/2 2024 10:00
   - Due date at month boundary (1/31 → 2/1)
   - Due date at year boundary (12/31 → 1/1)

2. **Weekly Recurrence**
   - Due date 12/1 2024 → next 12/8 2024 (same time)
   - Due date 12/31 2024 → next 1/7 2025

3. **Monthly Recurrence**
   - Due date 12/15 2024 → next 1/15 2025
   - Due date 1/31 2024 → next 2/29 2024 (leap year)
   - Due date 3/31 2024 → next 4/30 2024 (month-end edge case)

4. **Yearly Recurrence**
   - Due date 2/29 2024 → next 2/28 2025 (non-leap year)
   - Due date 12/25 2024 → next 12/25 2025
   - Due date 2/29 2024 → next 2/29 2028 (leap year again)

5. **Metadata Inheritance**
   - Priority copied to next instance
   - Tags copied to next instance
   - reminder_minutes copied to next instance
   - recurrence_pattern copied to next instance

6. **Validation**
   - Cannot set recurring without due date
   - Pattern required if is_recurring=true
   - Only valid patterns accepted

### Integration Tests

1. **Create Recurring Todo**
   - POST /api/todos with is_recurring=true creates with pattern
   - Returns todo with is_recurring and pattern set

2. **Complete Recurring Todo**
   - PUT /api/todos/[id] with completed=true creates next instance
   - Next instance has correct due date
   - Next instance inherits metadata
   - Original todo moved to completed

3. **Edit Recurring Todo**
   - PUT /api/todos/[id] with title change updates only current
   - Changing pattern affects next instance
   - No premature instance creation on edit

4. **Disable Recurrence**
   - PUT /api/todos/[id] with is_recurring=false stops future creation
   - Completing non-recurring todo doesn't create next instance

### E2E Tests (Playwright)

1. **Test: Create Daily Recurring**

   ```
   - Create "Exercise" daily recurring, due tomorrow
   - Complete it
   - Verify next instance appears for next day
   - Metadata matches (priority, reminder badge)
   ```

2. **Test: Create Weekly Recurring**

   ```
   - Create "Team Meeting" weekly recurring
   - Complete it
   - Verify next instance appears 7 days later
   ```

3. **Test: Monthly Recurrence**

   ```
   - Create todo due 31st, recurring monthly
   - Complete at next month with 30 days
   - Verify next instance due on the 30th (or last day)
   ```

4. **Test: Edit Recurring (No Premature Creation)**

   ```
   - Create recurring todo
   - Edit title
   - Verify only one instance exists until completion
   ```

5. **Test: Disable Recurrence**

   ```
   - Create recurring todo
   - Edit and uncheck Repeat
   - Complete it
   - Verify no next instance created
   ```

6. **Test: Badge Display**
   ```
   - Create daily recurring
   - Verify 🔄 daily badge visible
   - Change to weekly
   - Verify badge updates to 🔄 weekly
   ```

---

## Out of Scope

- ❌ Custom recurrence (e.g., "every 2 weeks", "first Monday of month")
- ❌ RRULE format support (RFC 5545)
- ❌ Recurrence end dates ("repeat until 12/31/2025")
- ❌ Skip instances (recurrence exceptions)
- ❌ Weekday-only recurrence (Mon/Wed/Fri)
- ❌ Business day recurrence
- ❌ Recurrence time shifting (auto-adjust time each cycle)

---

## Success Metrics

1. **Correctness**: All test cases pass, date calculations accurate across patterns
2. **Performance**: Recurrence calculations < 50ms, next instance creation < 200ms
3. **Reliability**: No orphaned todos, CASCADE integrity maintained
4. **User Experience**: Clear 🔄 badge, intuitive pattern selection, disabled state obvious when no date
5. **Code Quality**: No type errors, clean calculation functions, well-documented
