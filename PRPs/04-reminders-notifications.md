---
id: PRP-04
title: Reminders & Notifications
status: ready-for-build
depends_on: [PRP-01, PRP-03]
test_file: tests/05-reminders-notifications.spec.ts
---

# PRP 04: Reminders & Notifications

## Feature Overview

Implement reminder scheduling and browser notifications so users receive timely alerts before a todo is due. Reminder timing must respect Singapore timezone and must never spam duplicate notifications.

Core project conventions:

- Use `lib/timezone.ts` for all time calculations
- Use browser Notification APIs only after permission is granted
- Use API + polling to decide when alerts are due
- Track `last_notification_sent` to prevent duplicates

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Reminder timing selection, notification permission flow, polling hook, and duplicate-prevention tracking |
| **Depends on** | `PRP-01` due dates and `PRP-03` recurring-time behavior |
| **Pre-read** | `lib/timezone.ts`, `app/page.tsx`, `lib/db.ts`, `app/api/notifications/check/route.ts` (or planned path), `.github/copilot-instructions.md` |
| **Do not drift into** | Service workers, push-notification infrastructure, or mobile-native notification systems |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/05-reminders-notifications.spec.ts` |

---

## Why This Feature Matters

Deadlines matter only if users notice them in time. Reminders convert passive due dates into active nudges and make the todo app useful as a real planning tool.

---

## User Stories

### Core user stories
- As a user, I can choose how long before a due date I want to be reminded.
- As a user, I can enable browser notifications with one click.
- As a user, I receive a notification only once per reminder event.

### Supporting user stories
- As a user, reminder options are only available when a due date exists.
- As a user, I can see reminder status from a `🔔` badge on the todo.
- As a user, the app still respects time calculations in Singapore timezone.

---

## Canonical Acceptance Criteria

- [ ] Permission request works
- [ ] All 7 timing options available
- [ ] Notifications fire at correct time
- [ ] Only one notification per reminder
- [ ] Works in Singapore timezone

---

## User Flow

1. User creates or edits a todo with a due date.
2. User selects a reminder offset such as `15m`, `1h`, or `1d`.
3. User clicks `Enable Notifications` and grants permission.
4. The client begins polling the server for due reminders.
5. When a reminder becomes due, the app displays a browser notification.
6. The server records `last_notification_sent` so the same reminder is not sent again.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - reminder fields and update helpers
- `lib/hooks/useNotifications.ts` - browser notification hook and polling logic
- `app/api/notifications/check/route.ts` - due reminder query and duplicate protection
- `app/page.tsx` - reminder dropdown, enable button, badges
- `tests/05-reminders-notifications.spec.ts` - E2E and manual guidance

### 2. Data Model

Reminder-related todo fields:

```ts
interface Todo {
  due_date?: string | null
  reminder_minutes?: number | null
  last_notification_sent?: string | null
}
```

Supported values:

```ts
const REMINDER_OPTIONS = [15, 30, 60, 120, 1440, 2880, 10080]
```

### 3. Validation Rules

- A reminder requires a due date
- `reminder_minutes` must be one of the supported values
- Completed todos should not trigger reminders
- Use `todo.reminder_minutes ?? null` when shaping responses

---

## API Contract

### `GET /api/notifications/check`

**Purpose**
Return all incomplete todos for the current user whose reminder time has arrived and that have not already been notified.

**Expected behavior**
- Require a valid session
- Compare reminder thresholds using Singapore time
- Exclude completed items
- Exclude todos where `last_notification_sent` already covers the current reminder cycle

**Example response**

```json
{
  "todos": [
    {
      "id": "todo_123",
      "title": "Join weekly review",
      "due_date": "2026-04-08T17:00:00+08:00",
      "reminder_minutes": 60
    }
  ]
}
```

### Optional follow-up update
After the notification is shown, update the todo's `last_notification_sent` timestamp so the same alert is not emitted again.

---

## Frontend / UX Requirements

### Reminder Selection
- Add a dropdown to the create/edit form with:
  - None
  - 15 minutes before
  - 30 minutes before
  - 1 hour before
  - 2 hours before
  - 1 day before
  - 2 days before
  - 1 week before
- Disable the dropdown when no due date is set

### Notification Permission
- Show a top-right button such as `🔔 Enable Notifications`
- After permission is granted, switch to a success state like `🔔 Notifications On`
- Show a clear fallback message if the browser blocks notifications

### Badge Display
- Render short reminder badges like `🔔 15m`, `🔔 1h`, `🔔 1d`
- Keep badge styling readable in light and dark mode

---

## Step-by-Step Implementation Plan

1. **Confirm reminder fields in `lib/db.ts`**
   - `reminder_minutes`
   - `last_notification_sent`

2. **Add API validation to todo create/update routes**
   - reminder requires due date
   - value must be from the supported list

3. **Create `app/api/notifications/check/route.ts`**
   - use `getSession()` first
   - fetch due reminder candidates
   - return only current user's pending items

4. **Build `useNotifications` hook**
   - request permission
   - poll every 30 seconds
   - show notifications for new due items

5. **Prevent duplicates**
   - update `last_notification_sent`
   - ensure the same reminder is not shown again on the next poll

6. **Add UI controls to `app/page.tsx`**
   - reminder dropdown
   - notification permission button
   - reminder badges on todo cards

7. **Add manual and automated verification**
   - due reminder appears at the correct time
   - duplicate prevention works

---

## Edge Cases

1. Browser permission is denied or dismissed
2. Reminder is selected before due date is entered
3. Todo becomes completed before the reminder time arrives
4. Client refresh occurs between reminder due time and notification display
5. Overdue todos should not repeatedly notify every poll cycle
6. Very short future due dates should still respect the minimum validation window

---

## Testing Requirements

### Required scenarios
- Enable notifications and verify permission flow
- Set each reminder option and confirm it is saved/displayed
- Confirm the check endpoint returns due items only
- Verify `last_notification_sent` prevents duplicates
- Validate reminder behavior in Singapore timezone

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/05-reminders-notifications.spec.ts
```

### Manual verification
- Grant browser notification permission from the app UI
- Create a todo with a near-future due date and a short reminder offset
- Confirm exactly one browser notification appears when the reminder time arrives
- Refresh the page and verify the same reminder is not sent again

---

## Security and Quality Notes

- Do not expose other users' reminder data in the check endpoint
- Keep error messages generic; do not leak session or internal time details
- Polling should be lightweight and efficient

---

## Out of Scope

This PRP does **not** define:
- recurring date generation itself (see `03-recurring-todos.md`)
- calendar rendering for due dates (see `10-calendar-view.md`)

---

## Success Metrics

- Users can enable notifications without confusion
- Reminder badges and timing options are consistent and clear
- Duplicate notifications do not occur for the same todo/reminder cycle

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./03-recurring-todos.md`
