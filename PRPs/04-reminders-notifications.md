# PRP 04: Reminders & Notifications

## Feature Overview

Enable browser notifications for upcoming todos. Users opt-in to notifications and set reminder timing (15m to 1 week before due date). The app polls every minute to check for todos needing notifications and sends browser notifications at the correct time. Singapore timezone enforced for all reminder calculations. Duplicate prevention via `last_notification_sent` field ensures each reminder fires only once.

**Core Capabilities:**

- Enable/disable browser notifications with permission request
- Seven reminder timing options: 15m, 30m, 1h, 2h, 1d, 2d, 1w before due date
- Polling system checks every minute (configurable)
- Duplicate prevention: one notification per reminder
- Singapore timezone for all calculations
- 🔔 badge shows reminder timing on todos
- Reminder field disabled when todo has no due date

---

## User Stories

### Story 1: Notification Permission

**As a busy user, I want to grant browser permission for notifications, so that I can receive alerts without manually checking my app.**

- Acceptance: Click "Enable Notifications" button triggers browser permission dialog
- User grants permission → button changes to "🔔 Notifications On" (green)
- User denies permission → button remains "🔔 Enable Notifications" (orange), shows helpful message
- Permission state persists across page reloads

### Story 2: Set Reminder Timing

**As a user with a calendar packed with meetings, I want to set reminders at various times before events, so that I can prepare accordingly.**

- Acceptance: After creating todo with due date, reminder dropdown shows 7 options + "None"
- Selecting option saves reminder setting
- 🔔 badge appears with abbreviation (15m, 30m, 1h, 2h, 1d, 2d, 1w)
- Different todos can have different reminder timings

### Story 3: Receive Notification

**As a user relying on notifications, I want browser notifications to pop up at reminder times, so that I don't miss deadlines.**

- Acceptance: Todo with reminder creates browser notification at correct time
- Notification shows todo title and scheduled time
- User can click notification to focus app
- Notification automatically disappears after 5 seconds or when clicked

### Story 4: Prevent Duplicate Reminders

**As a user who would be annoyed by multiple alerts, I want each reminder to fire only once, so that I'm not spammed with notifications.**

- Acceptance: Re-visiting app or reloading page doesn't trigger same notification twice
- `last_notification_sent` prevents re-notification
- Completing todo clears reminder for that instance
- If recurring, new instance can have same reminder without triggering old notification

### Story 5: Reminder Prerequisite

**As someone creating todos, I want reminder setting disabled when I haven't set a due date, so that I can't configure reminders for limitless todos.**

- Acceptance: Reminder dropdown shows as disabled/grayed when due_date is null
- Tooltip explains "Set due date first"
- Selecting due date immediately enables reminder dropdown

### Story 6: Disable Reminder

**As a user who wants to adjust reminders, I want to change reminder back to "None" anytime, so that I can stop notifications for specific todos.**

- Acceptance: Edit todo, move reminder to "None" option, save
- 🔔 badge disappears from todo immediately
- No notification will be sent for that todo

---

## User Flow

### Enable Notifications

1. User clicks orange "🔔 Enable Notifications" button (top-right area)
2. Browser shows permission request dialog
3. User clicks "Allow"
4. Button changes to green "🔔 Notifications On" with green background
5. Badge persists as user navigates
6. If user denies: stays orange, shows message "Browser notification permission denied. Allow in browser settings."

### Set Reminder on Todo

1. User creates or edits todo with future due date
2. Reminder dropdown becomes enabled
3. User clicks dropdown to reveal options:
   - None (default)
   - 15 minutes before
   - 30 minutes before
   - 1 hour before
   - 2 hours before
   - 1 day before
   - 2 days before
   - 1 week before
4. User selects option (e.g., "30 minutes before")
5. 🔔 badge appears with "30m" label
6. Reminder setting saved with todo

### Check and Send Reminders

1. Client-side utility polls `/api/notifications/check` every minute
2. API returns array of todos needing notification:
   - Reminder time reached in Singapore timezone
   - `last_notification_sent` is null or more than 24 hours old
   - Todo not completed
3. For each todo needing notification:
   - Create browser notification with title and time
   - Update `last_notification_sent` to current timestamp
   - Notification displays for 5 seconds then auto-dismisses
   - User can click to focus app

### Reminder Workflow for Recurring

1. Complete recurring todo with reminder at 1 hour
2. Next instance created with same reminder setting
3. `last_notification_sent` is null on next instance
4. Next instance eligible for new notification (1 hour before its due_date)
5. No duplicate notifications between cycles

---

## Technical Requirements

### Database Schema

Additions to todos table:

```sql
ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER CHECK (reminder_minutes IN (15, 30, 60, 120, 1440, 2880, 10080) OR reminder_minutes IS NULL);
ALTER TABLE todos ADD COLUMN last_notification_sent DATETIME;

CREATE INDEX idx_todos_reminder ON todos(reminder_minutes);
CREATE INDEX idx_todos_notification ON todos(last_notification_sent);
```

### API Endpoints

**GET /api/notifications/check** — Get todos needing notifications

```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const now = getSingaporeNow();
  const todos = db.getTodosByUserId(session.userId);

  const needsNotification = todos.filter((todo) => {
    if (!todo.reminder_minutes || todo.completed || !todo.due_date) {
      return false;
    }

    const reminderTime = new Date(
      new Date(todo.due_date).getTime() - todo.reminder_minutes * 60 * 1000,
    );

    // Check if reminder time passed but not yet notified (or notified 24+ hours ago)
    const lastNotified = todo.last_notification_sent
      ? new Date(todo.last_notification_sent)
      : new Date(0);
    const hoursSinceNotified =
      (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60);

    return reminderTime <= now && hoursSinceNotified > 24;
  });

  // Update last_notification_sent for each
  needsNotification.forEach((todo) => {
    db.updateTodo(todo.id, {
      ...todo,
      last_notification_sent: now.toISOString(),
    });
  });

  return NextResponse.json({
    success: true,
    data: needsNotification,
  });
}
```

### Types

```typescript
type ReminderTiming = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080; // minutes

interface ReminderOption {
  value: ReminderTiming;
  label: string;
  minutes: number;
}

const REMINDER_OPTIONS: ReminderOption[] = [
  { value: 15, label: "15 minutes", minutes: 15 },
  { value: 30, label: "30 minutes", minutes: 30 },
  { value: 60, label: "1 hour", minutes: 60 },
  { value: 120, label: "2 hours", minutes: 120 },
  { value: 1440, label: "1 day", minutes: 1440 },
  { value: 2880, label: "2 days", minutes: 2880 },
  { value: 10080, label: "1 week", minutes: 10080 },
];

function formatReminderLabel(minutes: ReminderTiming): string {
  const labels: Record<ReminderTiming, string> = {
    15: "15m",
    30: "30m",
    60: "1h",
    120: "2h",
    1440: "1d",
    2880: "2d",
    10080: "1w",
  };
  return labels[minutes];
}
```

### Client-Side Polling Hook

```typescript
// lib/hooks/useNotifications.ts
export function useNotifications() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check notification permission
    const permitted = Notification.permission === "granted";
    setIsEnabled(permitted);
  }, []);

  const requestPermission = async () => {
    const permission = await Notification.requestPermission();
    setIsEnabled(permission === "granted");
  };

  useEffect(() => {
    if (!isEnabled) return;

    // Poll every minute
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/notifications/check");
        if (!response.ok) return;

        const data = await response.json();
        data.data.forEach((todo: Todo) => {
          new Notification(`Reminder: ${todo.title}`, {
            body: `Due at ${formatSingaporeDate(new Date(todo.due_date!))}`,
            icon: "/logo.png",
            tag: `reminder-${todo.id}`, // Prevent duplicates
          });
        });
      } catch (error) {
        console.error("Failed to check notifications:", error);
      }
    }, 60 * 1000); // 60 seconds

    return () => clearInterval(interval);
  }, [isEnabled]);

  return { isEnabled, requestPermission };
}
```

### Singapore Timezone Requirement

```typescript
import { getSingaporeNow } from "@/lib/timezone";

// Reminder calculation always uses Singapore time
function calculateReminderTime(dueDate: string, reminderMinutes: number): Date {
  const now = getSingaporeNow();
  const due = new Date(dueDate);
  return new Date(due.getTime() - reminderMinutes * 60 * 1000);
}

// Check if reminder should fire NOW (Singapore time)
function shouldFireNow(
  dueDate: string,
  reminderMinutes: number,
  lastNotified: Date | null,
): boolean {
  const now = getSingaporeNow();
  const reminderTime = calculateReminderTime(dueDate, reminderMinutes);

  if (reminderTime > now) return false; // Not yet time

  if (!lastNotified) return true; // Never notified

  const hoursSince =
    (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60);
  return hoursSince > 24; // Notified more than 24 hours ago
}
```

---

## UI Components

### Notification Permission Button

```tsx
export function NotificationButton() {
  const { isEnabled, requestPermission } = useNotifications();

  const handleClick = async () => {
    if (Notification.permission === "denied") {
      alert("Notifications blocked. Allow in browser settings.");
      return;
    }
    await requestPermission();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        px-3 py-2 rounded font-medium flex items-center gap-2
        ${
          isEnabled
            ? "bg-green-100 text-green-800 dark:bg-green-900"
            : "bg-orange-100 text-orange-800 dark:bg-orange-900"
        }
      `}
    >
      🔔 {isEnabled ? "Notifications On" : "Enable Notifications"}
    </button>
  );
}
```

### Reminder Dropdown

```tsx
interface ReminderSelectorProps {
  value: ReminderTiming | null;
  onChange: (minutes: ReminderTiming | null) => void;
  disabled?: boolean;
}

export function ReminderSelector({
  value,
  onChange,
  disabled,
}: ReminderSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block font-medium">Reminder</label>
      <select
        value={value || ""}
        onChange={(e) =>
          onChange(
            e.target.value
              ? (parseInt(e.target.value) as ReminderTiming)
              : null,
          )
        }
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <option value="">None</option>
        <option value="15">15 minutes before</option>
        <option value="30">30 minutes before</option>
        <option value="60">1 hour before</option>
        <option value="120">2 hours before</option>
        <option value="1440">1 day before</option>
        <option value="2880">2 days before</option>
        <option value="10080">1 week before</option>
      </select>
      {disabled && <p className="text-xs text-gray-500">Set due date first</p>}
    </div>
  );
}
```

### Reminder Badge

```tsx
interface ReminderBadgeProps {
  minutes: ReminderTiming;
}

export function ReminderBadge({ minutes }: ReminderBadgeProps) {
  const label = formatReminderLabel(minutes);

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
      🔔 {label}
    </span>
  );
}
```

---

## Edge Cases

1. **Notification Permission Already Denied**: Show helpful message with browser settings instructions
2. **Tab Closed or App Minimized**: Polling continues if browser running; OS handles notification display
3. **Multiple Todos Due at Same Time**: All eligible reminders fire simultaneously
4. **Timezone Change**: Singapore timezone library handles all calculations; edge case unlikely
5. **System Clock Adjusted**: Polling catches up on next check cycle
6. **Server Restart**: `last_notification_sent` persists in database; no duplicates
7. **Browser Out of Focus**: OS notifications display regardless of focus; user can click to focus
8. **Notification Permission Changed in Settings**: App respects updated permission on next check
9. **Very Long Reminder Offset**: 1 week reminder respected, notification fires exactly 1 week before
10. **Daylight Saving Time**: Singapore timezone library handles (no DST in Singapore)

---

## Acceptance Criteria

- [ ] Notification permission button visible and clickable
- [ ] Permission request dialog appears when clicked
- [ ] Button state updates to "Notifications On" after granting permission
- [ ] All 7 reminder timing options available in dropdown
- [ ] Reminder dropdown disabled when due_date is null
- [ ] Reminder dropdown enabled after setting due_date
- [ ] 🔔 badge appears with correct timing abbreviation
- [ ] Notification fires at correct time (Singapore timezone)
- [ ] Each reminder fires only once (no duplicates)
- [ ] Completing recurring todo triggers new reminder for next instance
- [ ] Editing reminder updates badge immediately
- [ ] Changing reminder to "None" removes badge
- [ ] Polling checks every 60 seconds (+/- 5 seconds acceptable)

---

## Testing Requirements

### Unit Tests

1. **Reminder Time Calculation**
   - 15m before 12:00 → reminder at 11:45
   - 1d before 2024-12-25 10:00 → reminder at 2024-12-24 10:00
   - 1w before date → reminder exactly 7 days before

2. **Duplicate Prevention**
   - After notification sent, `last_notification_sent` set
   - Within 24 hours: no second notification
   - After 24 hours: notification can fire again (fallback)

3. **Reminder Prerequisite**
   - Reminder dropdown disabled when no due_date
   - Enabled when due_date set
   - Disabled again if due_date cleared

4. **Filtering Logic**
   - Only todos with reminder_minutes != null checked
   - Only incomplete todos considered
   - Only todos with due_date considered
   - Only past reminder times trigger notification

### Integration Tests

1. **Check Notifications Endpoint**
   - GET /api/notifications/check returns todos needing notification
   - Filters by user (no other users' todos)
   - Returns empty array if all caught up
   - Updates `last_notification_sent` on return

2. **Update Todo with Reminder**
   - PUT /api/todos/[id] with reminder_minutes persists
   - Changing reminder updates in database

3. **Recurring Reminder**
   - Create recurring todo with reminder
   - Complete it
   - Next instance created with same reminder_minutes
   - Next instance `last_notification_sent` is null

### E2E Tests (Playwright)

1. **Test: Enable Notifications**

   ```
   - Click notification button
   - Grant permission
   - Verify button state changes
   - Verify state persists on reload
   ```

2. **Test: Set Reminder**

   ```
   - Create todo with future due date
   - Reminder dropdown enabled
   - Select "30 minutes"
   - Verify 🔔 30m badge appears
   ```

3. **Test: Notification Fires**

   ```
   - Create todo due in 2 minutes with 1m reminder
   - Wait 1 minute
   - Verify browser notification appears
   - Click notification → app focuses
   ```

4. **Test: No Duplicate Notification**

   ```
   - Todo notification fires
   - Reload page
   - Wait 5 minutes
   - Verify no duplicate notification
   ```

5. **Test: Recurring Reminder**
   ```
   - Create recurring daily with 1h reminder
   - Complete it
   - Next instance appears with same 🔔 badge
   ```

---

## Out of Scope

- ❌ Email notifications (browser only)
- ❌ SMS notifications
- ❌ Custom notification sounds
- ❌ Notification history/log
- ❌ Notification grouping/threading
- ❌ Quiet hours / Do Not Disturb integration
- ❌ Notification persistence across browser restarts
- ❌ Service Worker optimization for better polling

---

## Success Metrics

1. **Correctness**: All timing calculations accurate, no duplicates
2. **Performance**: Polling < 50ms, notification display < 100ms
3. **Reliability**: Notifications fire consistently, survive page reloads
4. **User Experience**: Clear permission request, obvious button state, helpful disabled message
5. **Code Quality**: Timezone-aware calculations, clean hook implementation
