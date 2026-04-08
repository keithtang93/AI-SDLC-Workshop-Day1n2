# PRP 04: Reminders & Notifications

## Feature Overview
Add browser-based reminder notifications for todos with due dates. Users can choose predefined reminder offsets, enable browser notification permissions, and receive a single notification when reminder time is reached.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md) for due date support.
- Depends on [03-recurring-todos.md](03-recurring-todos.md) because reminder settings must carry forward on recurring instance creation.
- Must follow notification architecture described in [.github/copilot-instructions.md](../.github/copilot-instructions.md).

## User Stories
- As a user, I can enable browser notifications for the app.
- As a user, I can set a reminder offset for a todo that has a due date.
- As a user, I get one notification when the reminder time arrives.
- As a user, I can see reminder status directly on the todo item.

## User Flow
1. User clicks `Enable Notifications`.
2. Browser prompts for permission and the UI reflects the permission state.
3. User creates or edits a todo with a due date.
4. User selects a reminder offset from the predefined list.
5. Frontend polling checks for due reminders on a fixed interval.
6. When a reminder is due, the backend returns eligible todos and the client shows browser notifications.
7. Reminder is marked as sent so it is not shown again.

## Technical Requirements

### Data Model
- Add fields to `todos`:
  - `reminder_minutes`
  - `last_notification_sent`
- Supported reminder offsets:
  - 15 minutes
  - 30 minutes
  - 60 minutes
  - 120 minutes
  - 1440 minutes
  - 2880 minutes
  - 10080 minutes

### Validation Rules
- Reminder requires a due date.
- `reminder_minutes` must be one of the allowed values or null.
- `last_notification_sent` is server-managed and must not be trusted from the client.

### API Endpoints
- `GET /api/notifications/check`
  - Auth required.
  - Returns todos whose reminder threshold has been reached and which have not been notified yet.
  - Uses Singapore timezone for calculations.
- Todo create/update endpoints accept valid `reminder_minutes`.

### Notification Logic
- Reminder time = due date minus reminder offset.
- Polling interval should default to 30 seconds or 60 seconds depending on implementation constraints; document the chosen interval and keep it stable.
- Prevent duplicates using `last_notification_sent`.
- Notifications should still work when the tab is open in the background, subject to browser support.

### Frontend Architecture
- Implement notification behavior in `lib/hooks/useNotifications.ts`.
- Hook responsibilities:
  - check browser support
  - request permission
  - poll the API when permission is granted
  - show notifications
  - avoid duplicate client-side rendering within one polling cycle

### Interface Surface
- `Enable Notifications` button with visible status change after permission grant.
- Reminder dropdown in create/edit forms.
- Reminder control disabled when no due date exists.
- Reminder badge on todo rows using short labels such as `15m`, `1h`, `1d`, `1w`.

## UI Components
- Permission state should be obvious: unsupported, blocked, default, granted.
- Reminder badge should coexist cleanly with priority and recurring badges.

## Edge Cases
- Browser does not support notifications.
- User denies permission.
- Todo due date changes after reminder has already been sent.
- Reminder offset longer than time remaining until due date.
- Multiple tabs open causing duplicate polling.
- Recurring todo completion needs reminder to carry to the new instance but not duplicate sent-state.

## Acceptance Criteria
- User can request notification permission from the UI.
- User can set one of seven reminder offsets on todos with due dates.
- Reminder dropdown is disabled without a due date.
- Notifications fire at the correct time using Singapore timezone calculations.
- A reminder is sent only once per todo occurrence.
- Reminder badge reflects the configured offset.

## Testing Requirements

### E2E
- Enable notifications with browser permission handling.
- Create a todo with each supported reminder option.
- Verify reminder badge rendering.
- Verify API returns only due reminders.
- Verify recurring todo completion creates next instance with inherited reminder configuration.

### Manual
- Browser permission flow in Chrome, Edge, Firefox, and Safari where supported.
- Background-tab behavior validation.

### Unit
- Reminder time calculation using Singapore timezone.
- Allowed reminder option validation.
- Duplicate-prevention logic based on `last_notification_sent`.

## Out of Scope
- Push notifications to mobile devices.
- Email or SMS reminders.
- User-defined arbitrary reminder offsets.

## Success Metrics
- Reminder notifications trigger once and only once for due todos.
- Permission state and reminder status are understandable without extra documentation.
- Notification polling does not materially degrade page performance.