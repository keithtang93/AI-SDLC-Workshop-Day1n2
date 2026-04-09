# PRP 02: Priority System

## Feature Overview

Organize todos by importance with three distinct priority levels (High, Medium, Low). Each priority has color-coded visual indicators and automatic sorting rules. Todos default to Medium priority and are sorted with High tasks appearing first, followed by Medium, then Low within the same section.

**Core Capabilities:**

- Three-level priority system (High/Medium/Low)
- Color-coded badges (red/yellow/blue)
- Automatic sorting by priority
- Priority filtering with dropdown
- Priority changes persist across edits
- Dark mode color compatibility

---

## User Stories

### Story 1: Quick Priority Assessment

**As a user, I want to see priority visually coded, so that I can quickly assess task importance at a glance.**

- Acceptance: Each priority level has distinct color badge (red/yellow/blue)
- Visual distinction clear in both light and dark modes
- Badge appears next to every todo for quick scanning

### Story 2: Priority-Based Sorting

**As a user, I want todos automatically sorted by priority, so that I can focus on high-priority items first.**

- Acceptance: High priority todos always appear above Medium, which appear above Low
- Sorting applies within each section (Overdue, Active, Completed)
- Changing todo priority immediately updates position

### Story 3: Priority Filtering

**As a user, I want to filter todos by priority, so that I can focus only on important tasks.**

- Acceptance: Dropdown filter "All Priorities" shows options: All, High Only, Medium Only, Low Only
- Clicking option immediately filters visible todos
- Filter combines with search and other filters (AND logic)
- Clear filter button resets to All Priorities

### Story 4: Priority Editing

**As a user, I want to change a todo's priority at any time, so that plans can adjust as importance changes.**

- Acceptance: Edit modal shows priority dropdown pre-filled with current value
- Changing priority and saving immediately updates sort position
- Original todo no longer visible if filtered out by new priority

### Story 5: Priority Default

**As a user, I want new todos to default to Medium priority, so that I don't have to explicitly set every todo.**

- Acceptance: Creating todo without selecting priority creates Medium priority todo
- Explicit High or Low selection required to override default
- Medium shows no badge styling (only High and Low have distinct styling)

---

## User Flow

### Assign Priority During Creation

1. User creates new todo by entering title
2. User sees priority dropdown with default "Medium" selected
3. User optionally changes priority (High, Medium, or Low)
4. User clicks Add
5. Todo created with selected priority
6. Todo positioned in sort order based on priority

### Assign Priority During Edit

1. User clicks Edit on existing todo
2. Modal opens with current priority pre-selected
3. User changes priority dropdown if desired
4. User clicks Update
5. Todo immediately repositioned in list based on new priority
6. If priority filter active and new priority filtered out: todo disappears from view

### Filter by Priority

1. User sees "All Priorities" dropdown below search bar
2. User clicks dropdown to open options
3. Options: All Priorities (default), High Priority, Medium Priority, Low Priority
4. User selects option
5. Todo list updates to show only todos matching selected priority
6. Other active filters (search, tag, date) remain applied (AND combination)
7. To clear: user clicks dropdown and selects "All Priorities"

### Priority-Based Sorting

1. User creates multiple todos with different priorities
2. System automatically applies sort order:
   - High priority todos grouped first
   - Medium priority todos grouped second
   - Low priority todos grouped last
   - Within same priority: sorted by due date (earliest first)
3. Order maintained across page updates
4. Creating new todo inserts in correct position

---

## Technical Requirements

### Database Schema

Priority field in todos table (from Feature 01):

```sql
ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
CREATE INDEX idx_todos_priority ON todos(priority);
```

### API Endpoints

**Priority Filtering** (GET /api/todos supports filter param):

```typescript
// Query params:
// ?priority=high|medium|low (optional, combined with other filters)

// Response same format as Feature 01, just filtered
GET /api/todos?priority=high
// Returns only high priority todos
```

All Create/Update endpoints (POST, PUT) support priority field as documented in Feature 01.

### Types

```typescript
type Priority = "high" | "medium" | "low";

interface PriorityBadge {
  priority: Priority;
  color: string; // RGB hex
  label: string;
}

const PRIORITY_CONFIG: Record<Priority, PriorityBadge> = {
  high: { color: "#EF4444", label: "High" }, // Red (light mode)
  medium: { color: "#F59E0B", label: "Medium" }, // Yellow (light mode)
  low: { color: "#3B82F6", label: "Low" }, // Blue (light mode)
};
```

### Sorting Implementation

```typescript
function sortTodosByPriority(todos: Todo[]): Todo[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return todos.sort((a, b) => {
    // Priority first
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Due date second (earliest first)
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}
```

### Filtering Implementation

```typescript
function filterTodosByPriority(todos: Todo[], priority?: Priority): Todo[] {
  if (!priority || priority === "all") return todos;
  return todos.filter((todo) => todo.priority === priority);
}

// Usage in API:
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const priority = searchParams.get("priority") as Priority | null;

  let todos = await db.getAllTodos(userId);

  if (priority) {
    todos = filterTodosByPriority(todos, priority);
  }

  return NextResponse.json({ success: true, data: sortTodosByPriority(todos) });
}
```

---

## UI Components

### Priority Badge

```tsx
interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const colors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    medium:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded ${colors[priority]}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
```

### Priority Filter Dropdown

```tsx
interface PriorityFilterProps {
  selectedPriority: Priority | "all";
  onChange: (priority: Priority | "all") => void;
}

export function PriorityFilter({
  selectedPriority,
  onChange,
}: PriorityFilterProps) {
  return (
    <select
      value={selectedPriority}
      onChange={(e) => onChange(e.target.value as Priority | "all")}
      className="px-3 py-2 border rounded bg-white dark:bg-gray-800"
    >
      <option value="all">All Priorities</option>
      <option value="high">🔴 High Priority</option>
      <option value="medium">🟡 Medium Priority</option>
      <option value="low">🔵 Low Priority</option>
    </select>
  );
}
```

### Priority Selector in Form

```tsx
interface PrioritySelectorProps {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block font-medium">Priority</label>
      <div className="flex gap-2">
        {(["high", "medium", "low"] as Priority[]).map((priority) => (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            className={`
              px-3 py-2 rounded font-medium
              ${
                value === priority
                  ? "ring-2 ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              }
              ${priority === "high" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}
              ${priority === "medium" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}
              ${priority === "low" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}
            `}
          >
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Todo Item with Priority

```tsx
export function TodoItemWithPriority({ todo, ...props }: TodoItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-900">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={props.onComplete}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{todo.title}</span>
          <PriorityBadge priority={todo.priority} />
        </div>
        {todo.due_date && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Due: {formatSingaporeDate(new Date(todo.due_date))}
          </div>
        )}
      </div>
      <button onClick={props.onEdit}>Edit</button>
      <button onClick={props.onDelete}>Delete</button>
    </div>
  );
}
```

---

## Edge Cases

1. **Default Priority**: Todos created without explicit priority get Medium
2. **Filter with Empty Result**: If filtering leaves no todos, show "No todos found" message
3. **Priority Change During Filter**: If todo's priority changed and current filter excludes it: todo disappears
4. **Priority Sort Stability**: Todos with same priority and due date maintain insertion order (stable sort)
5. **All Priority Counts**: Badge shows total in section, not filtered count
6. **Dark Mode Colors**: All badge colors have dark mode variants defined
7. **Priority Badge Display**: Medium priority shows badge (not hidden) unless styling says otherwise
8. **Filter History**: Changing page doesn't reset filter; persist filter in URL or session
9. **Accessibility**: Priority badges have aria-label for screen readers
10. **No Todos Section**: If all todos in active section filtered out, section still displays with "No todos found"

---

## Acceptance Criteria

- [ ] Three priority levels (High, Medium, Low) selectable in forms
- [ ] Todos default to Medium priority when not specified
- [ ] Priority badges visible on all todos with distinct colors
- [ ] High priority todos sort before Medium, Medium before Low
- [ ] Priority filter dropdown works and combines with other filters
- [ ] Changing todo priority immediately updates position in list
- [ ] Priority badges have consistent colors in light and dark modes
- [ ] WCAG AA contrast ratios met for all badge colors
- [ ] Keyboard can navigate and select all priority options
- [ ] Empty state message appears when priority filter produces no results

---

## Testing Requirements

### Unit Tests

1. **Priority Sorting**
   - Three todos (High, Medium, Low) sort in correct order
   - Same priority todos sorted by due date
   - No due date todos sorted last

2. **Priority Filtering**
   - Filter by High returns only high priority
   - Filter by Medium returns only medium priority
   - Filter by Low returns only low priority
   - Filter "All" returns all todos

3. **Priority Defaults**
   - Missing priority defaults to Medium
   - Invalid priority rejected

4. **Priority Validation**
   - Only 'high', 'medium', 'low' accepted
   - Case-insensitive validation
   - Invalid priority values rejected

### Integration Tests

1. **Create with Priority**
   - POST /api/todos with priority creates correctly
   - Default priority applied if omitted
   - Priority persisted in database

2. **Update Priority**
   - PUT /api/todos/[id] changes priority
   - Updated priority persisted
   - Sort order reflects new priority

3. **Filter by Priority**
   - GET /api/todos?priority=high returns only high
   - Other filters combined correctly (AND logic)
   - Filtering works with pagination if implemented

### E2E Tests (Playwright)

1. **Test: Create Todo with Each Priority**

   ```
   For each of [high, medium, low]:
   - Enter title, select priority
   - Verify badge displays with correct color
   - Verify positioned correctly in sort order
   ```

2. **Test: Priority Sorting**

   ```
   - Create todos: Medium (no date), High (12/25), Low (12/26)
   - Verify order: High, Medium, Low (regardless of date)
   - Within same priority, verify date sort
   ```

3. **Test: Priority Filter**

   ```
   - Create High, Medium, Low todos
   - Select "High Priority" filter
   - Verify only High priority visible
   - Select "Medium Priority"
   - Verify only Medium priority visible
   - Select "All Priorities"
   - Verify all visible
   ```

4. **Test: Change Priority**

   ```
   - Create Medium priority todo
   - Click Edit
   - Change to High
   - Save
   - Verify bounces to top of list
   ```

5. **Test: Dark Mode Colors**
   ```
   - Verify badge colors distinguishable in dark mode
   - Toggle between light/dark
   - Confirm colors change but remain readable
   ```

---

## Out of Scope

- ❌ Custom priority levels beyond High/Medium/Low
- ❌ Priority inheritance from parent todos
- ❌ Priority escalation (auto-increase priority over time)
- ❌ Priority-based notifications (separate reminders for high priority)
- ❌ User-defined color schemes per priority
- ❌ Priority icons beyond text labels
- ❌ Drag-to-reorder by priority
- ❌ Priority history or audit trail

---

## Success Metrics

1. **Correctness**: All acceptance criteria pass
2. **Performance**: Priority operations complete in < 50ms
3. **Usability**: Users intuitively understand priority levels without instructions
4. **Accessibility**: WCAG AA contrast compliance, keyboard navigation works
5. **Visual Design**: Priority badges immediately recognizable across light/dark modes
6. **Code Quality**: No type errors, proper error handling, consistent styling
