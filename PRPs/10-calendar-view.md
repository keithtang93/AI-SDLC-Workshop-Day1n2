# PRP 10: Calendar View

## Feature Overview
Add a monthly calendar interface that displays todos on their due dates and highlights Singapore public holidays. The calendar should support navigation, current-day emphasis, and a focused day-detail interaction.

## Dependencies
- Depends on [01-todo-crud-operations.md](01-todo-crud-operations.md) for due dates.
- Exported holiday and timezone behavior must follow Singapore-specific rules from repo guidance.

## User Stories
- As a user, I can switch from list view to a calendar view.
- As a user, I can navigate by month and jump back to today.
- As a user, I can see which days contain due todos.
- As a user, I can see Singapore public holidays when planning work.

## User Flow
1. User navigates to `/calendar`.
2. App loads the current month by default or reads `?month=YYYY-MM` from the URL.
3. Calendar renders day cells for the month grid.
4. Holidays and due todos appear on their respective dates.
5. User navigates to previous or next month or jumps to today.
6. User clicks a day to inspect that day's todos in a detail modal or panel.

## Technical Requirements

### Data Model
- Create `holidays` table if not already present.
- Seed Singapore public holidays through a script or migration path.

### API Endpoints
- `GET /api/holidays`
  - Returns holiday data relevant to the requested date range or month.
- Calendar page may reuse `GET /api/todos` if due dates are present in todo payloads, or introduce a month-scoped endpoint later without changing the UI contract.

### Calendar Logic
- Generate a month grid with week rows and day cells.
- Highlight current day.
- Style weekends distinctly.
- Show holiday names and todo counts on applicable dates.
- Support URL state with `?month=YYYY-MM`.

### Interface Surface
- Dedicated `/calendar` route.
- Month navigation controls: previous, next, today.
- Calendar grid with Sun-Sat headers unless the product explicitly changes week start.
- Day cell badges or list snippets for todos.
- Day-detail modal or side panel.

### Timezone Rules
- All date grouping must use Singapore timezone.
- Current-day highlighting must use Singapore current date, not browser locale date.

## UI Components
- Day cells should remain readable when multiple todos share a date.
- Holiday display should not visually overwhelm todo content.

## Edge Cases
- Month boundary generation beginning mid-week.
- Leap years and February length.
- Holidays and multiple todos on the same day.
- Todos without due dates should not appear on the calendar.
- URL month parameter malformed or missing.

## Acceptance Criteria
- Calendar loads the current month correctly.
- Previous, next, and today navigation all work.
- Todos appear on the correct due dates.
- Singapore holidays display on correct dates.
- Clicking a day reveals that day's todos.

## Testing Requirements

### E2E
- Load calendar for current month.
- Navigate to previous and next months.
- Use today action.
- Verify todo placement on date cells.
- Verify holiday placement.
- Open day detail view.

### Unit
- Month-grid generation.
- URL month parsing.
- Singapore-date day assignment.

## Out of Scope
- Drag-and-drop scheduling.
- Week and day views.
- External calendar sync.

## Success Metrics
- Calendar navigation is predictable and fast.
- Day placement is accurate across timezone-sensitive boundaries.
- Users can plan work visually without leaving the app.