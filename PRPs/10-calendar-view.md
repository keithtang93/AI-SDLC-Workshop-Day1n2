# PRP 10: Calendar View

## Feature Overview

Visual calendar showing todos by due date. Monthly grid layout with navigation. Singapore public holidays highlighted. Click day to see todos for that day. URL state (`?month=YYYY-MM`) enables bookmarking. Overdue todos shown in red. Todo counts per day. Toggle between Todo List and Calendar views.

**Core Capabilities:**

- Monthly calendar grid (Sun-Sat columns)
- Today highlighted
- Singapore holidays marked with 🇸🇬 and color
- Todo counts per day
- Overdue todos shown in red font
- Due today shown in blue
- Future todos in gray
- Click day to see detailed list
- Previous/Next month navigation
- "Today" button
- URL bookmarkable with month parameter
- Responsive design for mobile

---

## User Stories

### Story 1: Visual Planning

**As a user, I want to see my todos on a calendar, so that I can visualize my schedule.**

- Acceptance: Click Calendar icon
- Monthly view displayed
- Todos appear on their due dates
- Today highlighted

### Story 2: Holiday Awareness

**As a user in Singapore, I want to see public holidays, so that I don't schedule during holidays.**

- Acceptance: Singapore public holidays marked
- Icon 🇸🇬 displayed
- Holiday name in tooltip on hover
- Styling distinct from regular days

### Story 3: Overdue Tracking

**As a user, I want to see overdue todos, so that I can prioritize catching up.**

- Acceptance: Overdue todos shown in red
- "Overdue (3)" badge on calendar day
- Click day to open detailed list
- Clear visual distinction

### Story 4: Month Navigation

**As a user, I want to navigate months, so that I can plan ahead.**

- Acceptance: "< Prev" and "Next >" buttons
- "Today" button jumps to current month
- Month/year displayed
- Month changes update URL

### Story 5: Bookmarkable Calendar

**As a user, I want to bookmark specific months, so that I can return to them.**

- Acceptance: URL contains month (`?month=2025-03`)
- Navigating to URL shows that month
- Copy URL and share with others

---

## User Flow

### View Calendar

1. User opens application on Calendar tab
2. Calendar view displays for current month
3. Grid shows 7 columns (Sun-Sat)
4. Today highlighted with blue circle/border
5. Days with todos show count (e.g., "2 todos")
6. Days with Singapore holidays show 🇸🇬 icon
7. Overdue todos shown in red text

### Navigate Months

1. User clicks "< Prev" button
2. Calendar updates to previous month
3. URL updates to `?month=2025-02`
4. Todos load for new month
5. User can click "Next >" to move forward
6. Or click "Today" to return to current month

### Click Day

1. User clicks on calendar day with todos
2. Modal or sidebar opens showing:
   - Day title (e.g., "March 15, 2025")
   - Holiday name if applicable
   - List of todos for that day
   - Ability to mark complete/incomplete
   - Ability to edit or delete
3. User closes modal
4. Calendar remains on same month

### View Holiday Details

1. User hovers over 🇸🇬 icon on holiday
2. Tooltip shows holiday name (e.g., "Good Friday")
3. If no todos on holiday, message: "No todos scheduled"

---

## Technical Requirements

### Database: Holidays Table

Contains Singapore public holidays for reference (pre-populated via seed script):

```sql
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (date IS NOT NULL AND TRIM(name) != '')
);
```

**Sample data:**

```
2025-01-01 | New Year's Day
2025-02-29 | Chinese New Year
2025-04-10 | Good Friday
2025-05-01 | Labour Day
2025-06-02 | Hari Raya Puasa
2025-08-09 | National Day
2025-10-01 | Deepavali
2025-12-25 | Christmas Day
```

### Calendar Generation

```typescript
import { getSingaporeNow, formatSingaporeDate } from "@/lib/timezone";

interface CalendarDay {
  date: Date;
  day: number; // 1-31
  month: number; // 1-12
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: Todo[];
  overdueCount: number;
  dueCount: number;
  holiday?: { name: string; date: string };
}

interface CalendarMonth {
  month: number;
  year: number;
  days: CalendarDay[][]; // weeks array
  startDay: number; // 0-6, day of week for 1st of month
}

function generateCalendar(month: number, year: number): CalendarMonth {
  const today = getSingaporeNow();
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDay = firstDay.getDay(); // 0=Sunday

  const days: CalendarDay[][] = [];
  let week: CalendarDay[] = [];

  // Padding days from previous month
  for (let i = 0; i < startDay; i++) {
    const date = new Date(year, month - 1, -i);
    week.push({
      date,
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      isCurrentMonth: false,
      isToday: false,
      todos: [],
      overdueCount: 0,
      dueCount: 0,
    });
  }
  week.reverse();

  // Days in current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = formatSingaporeDate(date, "yyyy-MM-dd");

    week.push({
      date,
      day,
      month,
      year,
      isCurrentMonth: true,
      isToday: formatSingaporeDate(today, "yyyy-MM-dd") === dateStr,
      todos: [], // Will be populated from DB
      overdueCount: 0,
      dueCount: 0,
      holiday: getHolidayForDate(dateStr), // From holidays table
    });

    if (week.length === 7) {
      days.push(week);
      week = [];
    }
  }

  // Padding days from next month
  while (week.length > 0 && week.length < 7) {
    const date = new Date(year, month, week.length - startDay);
    week.push({
      date,
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      isCurrentMonth: false,
      isToday: false,
      todos: [],
      overdueCount: 0,
      dueCount: 0,
    });
  }
  if (week.length > 0) {
    days.push(week);
  }

  return {
    month,
    year,
    days,
    startDay,
  };
}

// Populate todos on calendar
function enrichCalendarWithTodos(
  calendar: CalendarMonth,
  todos: Todo[],
): CalendarMonth {
  const today = getSingaporeNow();

  // Create date map for faster lookup
  const dateMap = new Map<string, CalendarDay[]>();
  for (const week of calendar.days) {
    for (const day of week) {
      if (day.isCurrentMonth) {
        const key = formatSingaporeDate(day.date, "yyyy-MM-dd");
        if (!dateMap.has(key)) {
          dateMap.set(key, []);
        }
        dateMap.get(key)!.push(day);
      }
    }
  }

  // Place todos
  for (const todo of todos) {
    if (todo.due_date) {
      const dateStr = formatSingaporeDate(
        new Date(todo.due_date),
        "yyyy-MM-dd",
      );
      const daysForDate = dateMap.get(dateStr);

      if (daysForDate) {
        for (const day of daysForDate) {
          day.todos.push(todo);

          if (!todo.completed) {
            const dueDate = new Date(todo.due_date);
            const todayStr = formatSingaporeDate(today, "yyyy-MM-dd");
            const dueDateStr = formatSingaporeDate(dueDate, "yyyy-MM-dd");

            if (dueDateStr < todayStr) {
              day.overdueCount++;
            } else if (dueDateStr === todayStr) {
              day.dueCount++;
            }
          }
        }
      }
    }
  }

  return calendar;
}
```

### API Endpoint

```typescript
// GET /api/calendar?month=2025-03
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthStr =
    searchParams.get("month") ||
    formatSingaporeDate(getSingaporeNow(), "yyyy-MM");
  const [year, month] = monthStr.split("-").map(Number);

  // Generate calendar
  let calendar = generateCalendar(month, year);

  // Fetch todos for month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const todos = getTodosByDateRange(session.userId, firstDay, lastDay);

  // Enrich with todos
  calendar = enrichCalendarWithTodos(calendar, todos);

  // Fetch holidays
  const holidays = getHolidaysByDateRange(firstDay, lastDay);

  return NextResponse.json({
    calendar,
    holidays,
    month: `${year}-${String(month).padStart(2, "0")}`,
  });
}
```

### Date Utilities

```typescript
import { getSingaporeNow, formatSingaporeDate } from "@/lib/timezone";

export function getDayName(date: Date): string {
  const options = { weekday: "short" };
  return date.toLocaleDateString("en-SG", options as any);
}

export function getMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  } as any);
}

export function isToday(date: Date): boolean {
  const today = getSingaporeNow();
  return (
    formatSingaporeDate(date, "yyyy-MM-dd") ===
    formatSingaporeDate(today, "yyyy-MM-dd")
  );
}

export function isOverdue(date: Date): boolean {
  const today = getSingaporeNow();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}
```

---

## UI Components

### Calendar Grid

```tsx
import { CalendarMonth, CalendarDay } from "@/lib/calendar";

interface CalendarGridProps {
  calendar: CalendarMonth;
  onDayClick: (date: Date) => void;
  holidays: Record<string, string>; // dateStr -> holiday name
}

export function CalendarGrid({
  calendar,
  onDayClick,
  holidays,
}: CalendarGridProps) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((name) => (
          <div key={name} className="text-center font-bold text-sm p-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendar.days.flat().map((day, idx) => (
          <CalendarDayCell
            key={idx}
            day={day}
            holiday={holidays[formatDate(day.date)]}
            onClick={() => onDayClick(day.date)}
          />
        ))}
      </div>
    </div>
  );
}

function CalendarDayCell({
  day,
  holiday,
  onClick,
}: {
  day: CalendarDay;
  holiday?: string;
  onClick: () => void;
}) {
  const hasOverdue = day.overdueCount > 0;
  const hasDueToday = day.dueCount > 0;

  return (
    <div
      onClick={onClick}
      className={`
        aspect-square p-2 rounded cursor-pointer transition
        ${!day.isCurrentMonth ? "bg-gray-100 dark:bg-gray-700 text-gray-400" : ""}
        ${day.isToday ? "ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-900/20" : ""}
        ${holiday ? "bg-red-50 dark:bg-red-900/20" : ""}
        hover:bg-blue-100 dark:hover:bg-blue-700
      `}
    >
      <div className="flex flex-col h-full">
        {/* Holiday icon and date */}
        <div className="flex items-start justify-between">
          {holiday && (
            <span className="text-lg" title={holiday}>
              🇸🇬
            </span>
          )}
          <span
            className={`text-sm font-bold ${hasOverdue ? "text-red-600" : ""}`}
          >
            {day.day}
          </span>
        </div>

        {/* Todo counts */}
        {(day.todos.length > 0 || day.overdueCount > 0) && (
          <div className="mt-auto text-xs space-y-0.5">
            {day.overdueCount > 0 && (
              <div className="text-red-600 font-medium">
                Overdue ({day.overdueCount})
              </div>
            )}
            {day.dueCount > 0 && (
              <div className="text-blue-600">Due ({day.dueCount})</div>
            )}
            {day.todos.length - day.overdueCount - day.dueCount > 0 && (
              <div className="text-gray-500">
                +{day.todos.length - day.overdueCount - day.dueCount}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Calendar Header with Navigation

```tsx
interface CalendarHeaderProps {
  month: number;
  year: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarHeader({
  month,
  year,
  onPrevious,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  const monthYear = getMonthYear(month, year);

  return (
    <div className="flex items-center justify-between pb-4 border-b">
      <button
        onClick={onPrevious}
        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
      >
        ← Prev
      </button>

      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">{monthYear}</h2>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onToday}
          className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Today
        </button>
        <button
          onClick={onNext}
          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
```

### Day Details Modal

```tsx
interface DayDetailsModalProps {
  date: Date;
  todos: Todo[];
  holiday?: string;
  onClose: () => void;
  onTodoClick: (todoId: number) => void;
}

export function DayDetailsModal({
  date,
  todos,
  holiday,
  onClose,
  onTodoClick,
}: DayDetailsModalProps) {
  const dateStr = formatSingaporeDate(date, "MMMM dd, yyyy");

  return (
    <Modal isOpen onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">{dateStr}</h2>
          {holiday && <p className="text-sm text-red-600">🇸🇬 {holiday}</p>}
        </div>

        {todos.length === 0 ? (
          <p className="text-gray-500">No todos scheduled</p>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => onTodoClick(todo.id)}
                className={`p-3 border rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                  todo.completed ? "line-through text-gray-400" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    readOnly
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{todo.title}</p>
                    {todo.priority === "high" && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

---

## Edge Cases

1. **February 29th**: Leap years handled correctly
2. **Month boundaries**: Padding days from adjacent months shown in gray
3. **No todos this month**: Calendar displays empty
4. **Multiple todos same day**: All shown with count badges
5. **Holiday on weekend**: Still displayed
6. **Past months**: Can navigate back, no todos (no future recalculation)
7. **Future years**: Support 10+ years ahead
8. **Mobile**: Responsive, touch-friendly

---

## Acceptance Criteria

- [ ] Calendar displays current month by default
- [ ] Days arranged Sun-Sat
- [ ] Today highlighted with blue ring
- [ ] Singapore holidays marked with 🇸🇬
- [ ] Todos placed on correct due dates
- [ ] Overdue todos shown in red
- [ ] Todo counts displayed per day
- [ ] "Prev/Next" navigation works
- [ ] "Today" button works
- [ ] URL contains `?month=YYYY-MM`
- [ ] URL changes navigate to month
- [ ] Click day opens detail modal
- [ ] Holiday names shown on hover/modal

---

## Testing Requirements

### Unit Tests

1. **generateCalendar**
   - Correct month/year displayed
   - Correct start day
   - Padding days from adjacent months
   - Today highlighted

2. **enrichCalendarWithTodos**
   - Todos placed on correct dates
   - Overdue count correct
   - Due count correct

3. **Date Utilities**
   - isToday correct
   - isOverdue correct
   - getDayName correct

### E2E Tests (Playwright)

1. **Test: View Current Month**

   ```
   - Navigate to /calendar
   - Verify today highlighted
   - Verify current month displayed
   - Verify todos visible
   ```

2. **Test: Navigate Months**

   ```
   - Click "Next"
   - Verify month changed
   - Verify URL updated
   - Click "Prev" twice
   - Verify back to original
   ```

3. **Test: Holiday Display**

   ```
   - Navigate to month with holiday
   - Verify 🇸🇬 icon displayed
   - Hover/click to see holiday name
   - Verify color distinct
   ```

4. **Test: Bookmark Month**
   ```
   - Navigate to /calendar?month=2025-06
   - Verify June displayed
   - Manual URL navigation works
   ```

---

## Out of Scope

- ❌ Year view
- ❌ Week view
- ❌ Agenda view
- ❌ Multi-timezone display
- ❌ Event creation directly on calendar
- ❌ Drag-to-reschedule
- ❌ Color-coded priorities on calendar
- ❌ Calendar sync (Google Calendar, iCal)

---

## Success Metrics

1. **Correctness**: All todos appear on correct dates
2. **Performance**: Calendar renders < 300ms even with 1000 todos
3. **UX**: Holidays obvious, navigation intuitive
4. **Accessibility**: Keyboard navigation, screen reader support
