---
id: PRP-10
title: Calendar View
status: ready-for-build
depends_on: [PRP-01]
test_file: tests/11-calendar-view.spec.ts
---

# PRP 10: Calendar View

## Feature Overview

Implement a monthly calendar view at `/calendar` so users can visualize due dates, spot workload clusters, and plan around Singapore public holidays.

Project rules for this feature:

- all date logic must use Singapore timezone helpers
- holidays come from the SQLite `holidays` table
- calendar data should stay in sync with the main todo list
- UI should remain readable in both light and dark mode

## Agent Build Brief

| Field | Value |
|-------|-------|
| **Build scope** | Monthly calendar page, holiday display, month navigation, and per-day todo drill-down |
| **Depends on** | `PRP-01` due dates and core todo data |
| **Pre-read** | `app/calendar/page.tsx` (or planned page), `lib/timezone.ts`, `lib/db.ts`, `scripts/seed-holidays.ts` |
| **Do not drift into** | Drag-and-drop rescheduling, multi-view calendars, or scheduling engines |
| **Verification gate** | `npm run lint`, `npm run build`, `npx playwright test tests/11-calendar-view.spec.ts` |

---

## Why This Feature Matters

List views are good for execution, but calendars are better for planning. This feature helps users see busy days, overdue patterns, and holiday conflicts at a glance.

---

## User Stories

### Core user stories
- As a user, I can open a monthly calendar showing my todos by due date.
- As a user, I can move between months and jump back to today.
- As a user, I can see Singapore public holidays in the same view.

### Supporting user stories
- As a user, I can click a day to inspect its todos in more detail.
- As a user, current day and weekends are visually distinct.
- As a user, priority colors still help me scan important work quickly.

---

## Canonical Acceptance Criteria

- [ ] Calendar displays correctly
- [ ] Holidays shown
- [ ] Todos on correct dates
- [ ] Navigation works
- [ ] Modal shows day's todos

---

## User Flow

1. User clicks `Calendar` from the main app.
2. The app navigates to `/calendar` and loads the current month.
3. The calendar renders a full month grid with day headers and padding days as needed.
4. Todos appear on the dates matching their due dates.
5. Holidays display with distinct styling.
6. User navigates to previous or next month or clicks `Today` to jump back.
7. Clicking a date opens a day-detail modal or panel.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - holiday query helpers if needed
- `app/calendar/page.tsx` - main calendar page UI
- `app/api/holidays/route.ts` - return holidays by year/month scope
- `scripts/seed-holidays.ts` - seed Singapore holidays into the DB
- `tests/11-calendar-view.spec.ts` - E2E coverage

### 2. Data Model

Recommended holiday structure:

```ts
export interface Holiday {
  id: string
  date: string
  name: string
  country_code: string
}
```

The calendar should consume todos with `due_date`, `priority`, `title`, and `completed` fields.

### 3. Calendar Rules

- Generate a full month grid from Sunday to Saturday
- Highlight the current Singapore date
- Render weekends differently from weekdays
- Show multiple todos on the same date cleanly
- Use URL state like `?month=2026-04` for shareable navigation

---

## API Contract

### `GET /api/holidays`

**Example**

```http
GET /api/holidays?year=2026
```

**Behavior**
- return relevant Singapore public holidays
- allow filtering by year to keep payloads small

### Calendar page data
The calendar can fetch todos using the existing todo API and combine that response with holidays on the client.

---

## Frontend / UX Requirements

### Calendar Layout
- top bar with `Prev`, month/year label, `Next`, and `Today`
- day-of-week headers (`Sun` through `Sat`)
- responsive month grid with one cell per day

### Day Cell Content
- day number
- holiday label when applicable
- todo titles or count badge
- priority-aware styling for quick scanning

### Day Detail View
- click a day to open a modal or side panel
- show all todos due that day
- allow quick navigation back to the list if needed

---

## Step-by-Step Implementation Plan

1. **Confirm holidays persistence**
   - create or verify the `holidays` table
   - seed Singapore holidays using `scripts/seed-holidays.ts`

2. **Build `GET /api/holidays`**
   - fetch by year and return holiday names/dates

3. **Create `app/calendar/page.tsx`**
   - fetch todos and holidays
   - derive the active month from the URL or current date

4. **Generate the month grid**
   - include leading/trailing days for complete weeks
   - mark today, weekends, and holiday cells

5. **Render todos on due dates**
   - group by date key in Singapore timezone
   - show titles or a compact count if there are many

6. **Add navigation controls**
   - previous month
   - next month
   - today reset
   - sync state into the URL

7. **Add click-day details**
   - modal or panel with the selected day's todos and holiday info

8. **Add E2E coverage**
   - current month load
   - navigation
   - correct date placement
   - day modal behavior

---

## Edge Cases

1. Month starts mid-week and needs leading padding days
2. Month spans six grid rows
3. Leap-year February
4. Many todos on one day require truncation or a count badge
5. Holiday and weekend fall on the same date
6. Todo due dates with timezone offsets must still map to the correct Singapore day

---

## Testing Requirements

### Required E2E scenarios
- Calendar opens on the current month
- Previous/next navigation works
- `Today` jumps back correctly
- A todo appears on the correct date cell
- A holiday appears on the correct date cell
- Clicking a day opens the detail modal/panel

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/11-calendar-view.spec.ts
```

---

## Security and Quality Notes

- Keep holiday and todo queries user-safe and lightweight
- Avoid rendering too much text inside day cells; prefer progressive disclosure
- Use Singapore date helpers consistently when grouping by day

---

## Out of Scope

This PRP does **not** define:
- drag-and-drop rescheduling on the calendar
- week/day agenda views beyond the monthly layout

---

## Success Metrics

- Users can quickly see their monthly workload distribution
- Holidays and due dates align accurately in Singapore time
- Navigation remains smooth and intuitive

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
