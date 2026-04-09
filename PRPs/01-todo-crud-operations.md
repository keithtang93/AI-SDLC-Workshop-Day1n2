# PRP 01: Todo CRUD Operations

## Feature Overview

The foundation of the Todo App: create, read, update, and delete todos with full-featured metadata support. Every todo has a title, optional due date (must be future-dated), and optional metadata like priority, recurrence, reminders, and tags. All date/time operations use Singapore timezone (Asia/Singapore).

**Core Capabilities:**

- Create todos with title and optional metadata
- Read todos in three sections: Overdue, Active (pending), and Completed
- Update todo properties without losing associated data
- Delete todos with CASCADE deletion of subtasks and tag relationships
- Singapore timezone validation for all due dates (minimum 1 minute in future)

---

## User Stories

### Story 1: Quick Todo Entry

**As a busy professional, I want to quickly add a todo with just a title, so that I can capture tasks without friction.**

- Acceptance: Can enter title and click Add to create instantly
- Pre-condition: On main page, form visible
- Post-condition: Todo appears in Active section, form clears

### Story 2: Detailed Todo Creation

**As a project manager, I want to create todos with priority, due date, and recurrence settings, so that I can organize complex projects.**

- Acceptance: Can fill all available fields in one form submission
- Field validation enforces: non-empty title, future due dates, valid pattern selection
- Pre-condition: Form visible with all fields accessible
- Post-condition: Todo stored with all metadata, appears correctly sorted

### Story 3: Todo Organization

**As a user, I want todos automatically sorted by priority and due date, so that I can focus on what matters most.**

- Acceptance: Active section shows todos sorted: High→Medium→Low, then by due date ascending
- Pre-condition: Multiple todos with different priorities and due dates exist
- Post-condition: Display order matches priority and date rules

### Story 4: Completion Workflow

**As a user, I want to toggle todos complete/incomplete with a checkbox, so that I can track progress.**

- Acceptance: Clicking checkbox moves todo between Active and Completed sections
- Pre-condition: Todo visible in Active section
- Post-condition: Completed section count updates, recurring todos trigger creation

### Story 5: Todo Modification

**As a user, I want to edit existing todo properties, so that I can adjust plans as circumstances change.**

- Acceptance: Edit modal allows changing title, priority, due date, recurring, reminder
- Pre-condition: Todo exists and is viewable
- Post-condition: Changes persist, UI reflects updates immediately

### Story 6: Overdue Awareness

**As a user, I want to see overdue todos in a separate section with visual warnings, so that I can immediately identify late items.**

- Acceptance: Overdue section appears above Active with red background, displays "Overdue (X)" count, shows ⚠️ icon
- Pre-condition: One or more todos have past due dates based on Singapore time
- Post-condition: Section visible with accurate todo list and count

### Story 7: Data Relationships

**As a developer, I want subtasks and tags to cascade-delete with parent todos, so that database stays clean.**

- Acceptance: Deleting a todo removes all associated subtasks and tag relationships
- Pre-condition: Todo has subtasks and tags assigned
- Post-condition: All related records deleted from database, no orphaned data

---

## User Flow

### Create Todo Flow

1. User enters title in main input field
2. User optionally selects priority from dropdown (defaults to Medium)
3. User optionally clicks date/time picker and sets future due date
4. User clicks **"Add"** button
5. System validates:
   - Title is non-empty and trimmed
   - If due date set: is in future (min 1 minute) in Singapore timezone
6. If valid: Todo created and appears in appropriate section (Active or Overdue)
7. Form clears, cursor returns to title field

### Edit Todo Flow

1. User clicks **"Edit"** button on any todo
2. Modal opens with pre-filled fields (title, priority, due date, recurring, reminder)
3. User modifies any desired fields
4. User clicks **"Update"** button
5. System validates as during creation
6. If valid: Todo updated, modal closes, section updates immediately
7. If recurring todo completed during edit: next instance NOT created (only on completion)

### Complete Todo Flow

1. User clicks checkbox on any todo in Active or Overdue section
2. System marks todo as completed
3. Todo moves to Completed section
4. If recurring: Next instance created with inherited metadata
5. If non-recurring: Todo remains in Completed section

### Delete Todo Flow

1. User clicks **"Delete"** button on any todo
2. Deletion confirmation dialog appears: "Are you sure? This will delete subtasks and tag associations."
3. User confirms deletion
4. System CASCADE deletes:
   - Todo record
   - All subtasks (in subtasks table)
   - All todo_tags associations (many-to-many)
5. UI updates immediately
6. No orphaned data remains

### View Todos Flow

1. Page loads with all user's todos divided into three sections:
   - **Overdue**: Past due date (Singapore time), red background, ⚠️ icon, count badge
   - **Active**: Future due date or no due date, sorted by priority then date
   - **Completed**: Checkbox checked, separate section for reference
2. Todos within each section sorted by priority first, due date second
3. Each todo displays:
   - Title (clickable for details)
   - Priority badge (colored)
   - Due date display (smart formatting)
   - Metadata badges (recurring 🔄, reminder 🔔)
   - Checkbox for completion toggle
   - Edit and Delete buttons

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  due_date DATETIME,
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  reminder_minutes INTEGER,
  last_notification_sent DATETIME,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  CHECK (title IS NOT NULL AND TRIM(title) != '')
);

CREATE TABLE subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  CHECK (title IS NOT NULL AND TRIM(title) != '')
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name),
  CHECK (name IS NOT NULL AND TRIM(name) != '')
);

CREATE TABLE todo_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(todo_id, tag_id)
);
```

### API Endpoints

**POST /api/todos** — Create todo

- Request body: `{ title, priority?, due_date?, is_recurring?, recurrence_pattern?, reminder_minutes? }`
- Response: `{ success, data: Todo, error? }`
- Validation: Title required, non-empty; due_date must be future if provided

**GET /api/todos** — Fetch all user's todos

- Query params: None (all returned)
- Response: `{ success, data: Todo[], error? }`
- Returns todos with sections computed by client (Overdue/Active/Completed)

**GET /api/todos/[id]** — Fetch single todo

- Response: `{ success, data: Todo, error? }`
- Includes all metadata, subtasks, tags

**PUT /api/todos/[id]** — Update todo

- Request body: `{ title?, priority?, due_date?, is_recurring?, recurrence_pattern?, reminder_minutes?, completed? }`
- Response: `{ success, data: Todo, error? }`
- If completed=true and is_recurring: next instance created (see Feature 03)
- Validation same as create

**DELETE /api/todos/[id]** — Delete todo

- Response: `{ success, message, error? }`
- CASCADE deletes subtasks and tag associations

### Types

```typescript
type Priority = "high" | "medium" | "low";
type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

interface Todo {
  id: number;
  user_id: number;
  title: string;
  priority: Priority;
  due_date: string | null; // ISO 8601, Singapore timezone
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
  tags?: Tag[];
}

interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  position: number;
  completed: boolean;
  created_at: string;
}

interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}
```

### Validation Rules

1. **Title**: Required, non-empty after trimming, max 255 characters
2. **Priority**: One of 'high', 'medium', 'low', defaults to 'medium'
3. **Due Date**: Must be at least 1 minute in future (Singapore time)
   - Use `getSingaporeNow()` from `lib/timezone.ts` for validation
   - Reject past dates and present/current time
4. **Recurring**: Requires due_date; recurrence_pattern required if is_recurring=true
5. **Reminder**: Requires due_date; must be one of valid timing options (15m, 30m, 1h, 2h, 1d, 2d, 1w)

### Singapore Timezone Requirement

**CRITICAL**: All date/time operations must use `lib/timezone.ts`:

```typescript
import { getSingaporeNow, formatSingaporeDate } from "@/lib/timezone";

// Good: Use Singapore time
const now = getSingaporeNow(); // Returns Date in Singapore timezone
const formattedDate = formatSingaporeDate(new Date()); // Australia/Sydney or any zone

// Bad: NEVER use new Date() directly for business logic
const now = new Date(); // Don't do this!
```

### Client-Side Organization

Todos organize into three sections based on Singapore time:

```typescript
const isOverdue = (todo: Todo) => {
  if (!todo.due_date || todo.completed) return false;
  return new Date(todo.due_date) < getSingaporeNow();
};

const sortTodos = (todos: Todo[]) => {
  return todos.sort((a, b) => {
    // Priority first (High > Medium > Low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // Due date second (earliest first)
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
};
```

---

## UI Components

### Create Todo Form

```tsx
export function CreateTodForm() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showError("Title required");
      return;
    }

    const response = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        due_date: dueDate,
      }),
    });

    if (!response.ok) {
      showError("Failed to create todo");
      return;
    }

    setTitle("");
    setPriority("medium");
    setDueDate(null);
    // Optimistic UI: add to list immediately
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Add a new todo..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        className="px-2 py-1 border rounded"
      >
        <option value="high">High Priority</option>
        <option value="medium">Medium Priority</option>
        <option value="low">Low Priority</option>
      </select>
      <input
        type="datetime-local"
        value={dueDate || ""}
        onChange={(e) => setDueDate(e.target.value)}
        className="px-2 py-1 border rounded"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Add
      </button>
    </form>
  );
}
```

### Todo Section

```tsx
interface TodoSectionProps {
  title: string;
  todos: Todo[];
  onComplete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
}

export function TodoSection({
  title,
  todos,
  onComplete,
  onEdit,
  onDelete,
}: TodoSectionProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">
        {title} ({todos.length})
      </h2>
      <div className="space-y-1">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={() => onComplete(todo.id)}
            onEdit={() => onEdit(todo)}
            onDelete={() => onDelete(todo.id)}
          />
        ))}
      </div>
    </section>
  );
}
```

### Todo Item

```tsx
interface TodoItemProps {
  todo: Todo;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TodoItem({
  todo,
  onComplete,
  onEdit,
  onDelete,
}: TodoItemProps) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={onComplete}
        className="w-5 h-5"
      />
      <div className="flex-1">
        <div className="font-medium">{todo.title}</div>
        <div className="text-sm text-gray-600">
          {todo.priority !== "medium" && (
            <span className={`badge priority-${todo.priority}`}>
              {todo.priority}
            </span>
          )}
          {todo.due_date && (
            <span className="ml-2">
              {formatSingaporeDate(new Date(todo.due_date))}
            </span>
          )}
        </div>
      </div>
      <button onClick={onEdit} className="px-2 py-1 text-sm">
        Edit
      </button>
      <button onClick={onDelete} className="px-2 py-1 text-sm text-red-600">
        Delete
      </button>
    </div>
  );
}
```

---

## Edge Cases

1. **Empty Title**: Form submission fails with error "Title required"
2. **Whitespace-Only Title**: Treated as empty, rejected
3. **Past Due Date**: Validation fails with error "Due date must be in future"
4. **Timezone Daylight Saving**: Handled by Singapore timezone library (always Asia/Singapore)
5. **Duplicate Submission**: Debounce Add button to prevent double-submit (300ms)
6. **Deleted Todo Edited Earlier**: If user tries to edit deleted todo, show error "Todo no longer exists"
7. **Concurrent Updates**: Last write wins; optimistic UI updated immediately, server takes precedence on conflict
8. **Large Title**: Truncated to 255 characters by input validation
9. **Very Long Due Date String**: Normalized to ISO 8601 format by date picker
10. **Network Failure During Delete**: Show error, don't remove from UI; user can retry

---

## Acceptance Criteria

- [ ] Can create todo with title only (no priority or due date)
- [ ] Can create todo with priority, due date, recurring, and reminder all set
- [ ] Past due dates rejected on form submission with clear error
- [ ] Todos sorted by priority (High→Medium→Low) then due date (earliest first)
- [ ] Completed todos move to Completed section immediately
- [ ] Overdue section appears with red background and ⚠️ icon when todos past due
- [ ] "Overdue (X)" count badge accurate and updates in real-time
- [ ] Edit modal pre-fills all fields with current values
- [ ] Edited todos stay in same section unless data changes require move (e.g., date changes)
- [ ] Delete confirmation dialog appears with warning about cascades
- [ ] Deleting todo removes all subtasks and tag associations (CASCADE)
- [ ] Singapore timezone enforced for all date comparisons
- [ ] Form clears after successful todo creation
- [ ] Optimistic UI updates on create/edit/delete (no flickering)
- [ ] Section counts accurate and update immediately

---

## Testing Requirements

### Unit Tests

1. **Title Validation**
   - Empty title rejected
   - Whitespace-only title rejected
   - Valid title accepted
   - Title trimmed before storage

2. **Due Date Validation**
   - Past date rejected
   - Present time rejected
   - Future date accepted (1+ minute)
   - Singapore timezone used for validation

3. **Priority Defaulting**
   - New todo gets Medium priority if not specified
   - Valid priorities: High, Medium, Low
   - Invalid priority rejected

4. **Sorting Logic**
   - Todos sorted priority first (High > Medium > Low)
   - Within same priority, sorted by due date ascending
   - Todos without due date sorted last

5. **Overdue Calculation**
   - Todo is overdue if due_date < getSingaporeNow() and not completed
   - Completed todos never overdue
   - Todos without due_date not overdue

### Integration Tests

1. **Create Todo API**
   - POST /api/todos creates todo in database
   - Returns created todo with all fields
   - Validates title and due_date
   - Associates with current user

2. **Read Todos API**
   - GET /api/todos returns all todos for current user only
   - Does not return other users' todos
   - Includes subtasks and tags

3. **Update Todo API**
   - PUT /api/todos/[id] updates specific todo
   - Only todo owner can update
   - Updates title, priority, due_date correctly
   - Does not affect unmodified fields

4. **Delete Todo API**
   - DELETE /api/todos/[id] removes todo
   - Only todo owner can delete
   - Cascades to subtasks
   - Cascades to tag associations

5. **Validation on All Endpoints**
   - Missing title returns 400 with error message
   - Past due date returns 400 with error message
   - Non-existent todo ID returns 404

### E2E Tests (Playwright)

1. **Test: Create Todo with Title Only**

   ```
   Steps:
   1. Navigate to /
   2. Enter title "Buy groceries"
   3. Click Add
   4. Verify todo appears in Active section
   ```

2. **Test: Create Todo with All Fields**

   ```
   Steps:
   1. Enter title, select High priority
   2. Pick future due date
   3. Check Repeat → select Weekly
   4. Select reminder 1 hour before
   5. Click Add
   6. Verify todo appears with all badges
   ```

3. **Test: Edit Todo**

   ```
   Steps:
   1. Create a todo
   2. Click Edit
   3. Change title and priority
   4. Click Update
   5. Verify changes in UI immediately
   ```

4. **Test: Complete Todo**

   ```
   Steps:
   1. Create non-recurring todo
   2. Click checkbox
   3. Verify todo moves to Completed section
   ```

5. **Test: Delete Todo**

   ```
   Steps:
   1. Create a todo
   2. Click Delete
   3. Confirm in dialog
   4. Verify todo removed from all views
   5. Verify no crud operations remain
   ```

6. **Test: Overdue Display**

   ```
   Steps:
   1. Create todo with past due date
   2. Verify it appears in Overdue section
   3. Verify section has red background and ⚠️
   ```

7. **Test: Sorting**
   ```
   Steps:
   1. Create 3 todos: High (12/25), Medium (12/24), Low (12/26)
   2. Verify order: Medium (12/24), High (12/25), Low (12/26)
   ```

---

## Out of Scope

- ❌ Todo categories/custom sections beyond Overdue/Active/Completed
- ❌ Bulk operations (multi-select, batch delete)
- ❌ Todo duplication/cloning (use templates instead for reuse)
- ❌ Todo history/audit trail
- ❌ Todo collaboration (share with other users)
- ❌ Time tracking or time estimates
- ❌ Custom field types beyond priority/due_date/recurring/reminder
- ❌ Attachments or file uploads
- ❌ Todo comments or annotations

---

## Success Metrics

1. **Correctness**: All acceptance criteria pass
2. **Performance**:
   - Todo creation API responds in < 200ms
   - Todo list fetches < 300ms (100 todos)
   - UI updates optimistically with no perceived lag
3. **Reliability**:
   - All data persisted correctly in Singapore timezone
   - No data loss on form submission
   - Cascade deletes work without orphaned records
4. **User Experience**:
   - Create form visible and accessible on page load
   - Validation errors clear and actionable
   - Sorting and sections obvious without explanation
5. **Code Quality**:
   - TypeScript strict mode: no type errors
   - All functions have parameter validation
   - Proper error handling in all API routes
   - No console.errors in production
