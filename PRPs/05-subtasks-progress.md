# PRP 05: Subtasks & Progress Tracking

## Feature Overview

Break down complex todos into smaller subtasks with visual progress tracking. Each todo can have unlimited subtasks, each independently completable. Progress bar shows completion percentage (0-100%), visual indicator "X/Y completed". Subtasks maintain position order, and complete CASCADE deletion when parent todo deleted.

**Core Capabilities:**

- Create unlimited subtasks per todo
- Toggle subtask completion independently
- Real-time progress bar (0-100%)
- Progress text: "X/Y completed (Z%)"
- Subtasks maintain position order
- Delete individual subtasks
- Collapsible subtasks section with expand/collapse button
- CASCADE delete: removing parent todo removes all subtasks

---

## User Stories

### Story 1: Tackle Complex Projects

**As a project manager, I want to break large todos into subtasks, so that I can track multi-step projects.**

- Acceptance: Can add multiple subtasks to single todo
- Each subtask completes independently
- Removing parent todo removes all subtasks

### Story 2: Track Progress Visually

**As a visual learner, I want to see a progress bar for todos with subtasks, so that I can gauge completion at a glance.**

- Acceptance: Progress bar appears below todo title
- Bar fills from left to right as subtasks complete
- Color: blue at <100%, green at 100%
- Shows "X/Y subtasks" text (e.g., "3/7 subtasks")

### Story 3: Manage Subtask Order

**As a user managing complex workflows, I want subtasks to stay in order, so that I can list steps in sequence.**

- Acceptance: Subtasks display in creation order (position-based)
- New subtasks added at end of list
- Order maintained after completion/edit

### Story 4: Expand and Collapse

**As a user managing many todos, I want to hide subtasks, so that I can see more todos at once.**

- Acceptance: "▶ Subtasks" button (collapsed) expands to "▼ Subtasks"
- Clicking toggles subtask list visibility
- Progress bar always visible even when collapsed

### Story 5: Delete Individual Subtasks

**As a user refining a plan, I want to remove individual subtasks, so that I can adjust scope mid-project.**

- Acceptance: Each subtask has delete (✕) button
- Clicking removes subtask immediately
- Parent todo remains visible
- Progress updates after deletion

### Story 6: Cascade Delete

**As a user with database integrity concerns, I want deleting a parent todo to clean up subtasks, so that no orphaned data remains.**

- Acceptance: Deleting parent todo removes all associated subtasks
- No subtasks visible after parent deletion
- Database cleaned (no orphaned records)

---

## User Flow

### Expand Subtasks Section

1. User clicks "▶ Subtasks" button on any todo
2. Subtasks list expands below todo title
3. If no subtasks exist: shows message "No subtasks yet"
4. If subtasks exist: all displayed in creation order
5. Button changes to "▼ Subtasks"

### Add Subtask

1. Subtasks section expanded
2. User enters subtask title in input field
3. User presses Enter or clicks "Add" button
4. Subtask created and appears at end of list
5. Input field clears for next subtask
6. Progress bar updates immediately

### Complete Subtask

1. User clicks checkbox next to subtask
2. Subtask marked complete (checkmark visible)
3. Progress bar updates (color changes if 100%)
4. "X/Y" counter updates immediately
5. Can be unchecked to mark incomplete

### Delete Subtask

1. User clicks ✕ button on right side of subtask
2. Subtask removes immediately
3. Progress bar updates
4. Remaining subtasks reorder if needed

### Collapse Subtasks

1. User clicks "▼ Subtasks" when expanded
2. Subtasks list collapses
3. Progress bar remains visible
4. Button changes back to "▶ Subtasks"

### View Progress

1. Todo with subtasks displays progress bar
2. Bar filled proportionally: (completed / total) \* 100
3. Text displays: "X/Y subtasks (Z%)"
4. At 100%: bar turns green, text shows "All complete"
5. At 0%: bar appears empty, text shows "0/Y subtasks"

---

## Technical Requirements

### Database Schema

Subtasks table (from Feature 01):

```sql
CREATE TABLE subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  CHECK (title IS NOT NULL AND TRIM(title) != ''),
  UNIQUE(todo_id, position) -- Ensure unique position per todo
);

CREATE INDEX idx_subtasks_todo ON subtasks(todo_id);
CREATE INDEX idx_subtasks_position ON subtasks(todo_id, position);
```

### API Endpoints

**POST /api/todos/[id]/subtasks** — Create subtask

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const todo = db.getTodoById(id, session.userId);

  if (!todo) return notFound();

  // Get next position
  const lastSubtask = db.getLastSubtask(id);
  const position = (lastSubtask?.position || 0) + 1;

  const subtask = db.createSubtask({
    todo_id: id,
    title: body.title.trim(),
    position,
    completed: false,
  });

  return NextResponse.json({
    success: true,
    data: subtask,
  });
}
```

**PUT /api/subtasks/[id]** — Update subtask (toggle completion)

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const subtask = db.getSubtaskById(id);

  if (!subtask) return notFound();

  // Verify ownership
  const todo = db.getTodoById(subtask.todo_id, session.userId);
  if (!todo) return notFound();

  const updated = db.updateSubtask(id, {
    ...subtask,
    completed: body.completed,
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}
```

**DELETE /api/subtasks/[id]** — Delete subtask

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const subtask = db.getSubtaskById(id);
  if (!subtask) return notFound();

  // Verify ownership
  const todo = db.getTodoById(subtask.todo_id, session.userId);
  if (!todo) return notFound();

  db.deleteSubtask(id);

  return NextResponse.json({
    success: true,
    message: "Subtask deleted",
  });
}
```

### Types

```typescript
interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  position: number;
  completed: boolean;
  created_at: string;
}

interface SubtaskProgress {
  total: number;
  completed: number;
  percentage: number; // 0-100
}

function calculateProgress(subtasks: Subtask[]): SubtaskProgress {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.completed).length;

  return {
    total,
    completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
```

### Validation Rules

1. **Title**: Required, non-empty after trimming, max 255 characters
2. **Position**: Auto-assigned sequentially, never edited by user
3. **Completed**: Boolean, defaults to false
4. **CASCADE Delete**: Removing parent automatically removes all subtasks

---

## UI Components

### Progress Bar

```tsx
interface ProgressBarProps {
  progress: SubtaskProgress;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const percentWidth = `${progress.percentage}%`;
  const isComplete = progress.percentage === 100;

  return (
    <div className="w-full space-y-1 mt-1">
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: percentWidth }}
        />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {progress.completed}/{progress.total} completed ({progress.percentage}%)
      </p>
    </div>
  );
}
```

### Subtasks Section

```tsx
interface SubtasksSectionProps {
  todo: Todo;
  subtasks: Subtask[];
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (id: number, completed: boolean) => void;
  onDeleteSubtask: (id: number) => void;
}

export function SubtasksSection({
  todo,
  subtasks,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: SubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const progress = calculateProgress(subtasks);

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAddSubtask(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <ProgressBar progress={progress} />

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        {isExpanded ? "▼" : "▶"} Subtasks ({subtasks.length})
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {subtasks.length === 0 ? (
            <p className="text-xs text-gray-500">No subtasks yet</p>
          ) : (
            subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={(e) =>
                    onToggleSubtask(subtask.id, e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span
                  className={
                    subtask.completed ? "line-through text-gray-500" : ""
                  }
                >
                  {subtask.title}
                </span>
                <button
                  onClick={() => onDeleteSubtask(subtask.id)}
                  className="ml-auto text-xs text-red-600 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))
          )}

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Add subtask..."
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
            <button
              onClick={handleAdd}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Todo Item with Subtasks

```tsx
export function TodoItemWithSubtasks({ todo, ...props }: TodoItemProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  useEffect(() => {
    if (todo.subtasks) {
      setSubtasks(todo.subtasks);
    }
  }, [todo.subtasks]);

  const progress = calculateProgress(subtasks);

  return (
    <div className="p-3 border rounded">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={props.onComplete}
          className="w-5 h-5 mt-1"
        />
        <div className="flex-1">
          <div className="font-medium">{todo.title}</div>
          {subtasks.length > 0 && <ProgressBar progress={progress} />}
          <SubtasksSection
            todo={todo}
            subtasks={subtasks}
            onAddSubtask={async (title) => {
              // Call API to create
              const response = await fetch(`/api/todos/${todo.id}/subtasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
              });
              if (response.ok) {
                const data = await response.json();
                setSubtasks([...subtasks, data.data]);
              }
            }}
            onToggleSubtask={async (id, completed) => {
              const response = await fetch(`/api/subtasks/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed }),
              });
              if (response.ok) {
                setSubtasks(
                  subtasks.map((s) => (s.id === id ? { ...s, completed } : s)),
                );
              }
            }}
            onDeleteSubtask={async (id) => {
              const response = await fetch(`/api/subtasks/${id}`, {
                method: "DELETE",
              });
              if (response.ok) {
                setSubtasks(subtasks.filter((s) => s.id !== id));
              }
            }}
          />
        </div>
        <button onClick={props.onEdit}>Edit</button>
        <button onClick={props.onDelete}>Delete</button>
      </div>
    </div>
  );
}
```

---

## Edge Cases

1. **No Subtasks**: Section shows "No subtasks yet", progress bar doesn't display
2. **All Subtasks Complete**: Progress bar turns green, shows "X/X subtasks (100%)"
3. **Delete Parent with Subtasks**: All subtasks CASCADE deleted, no orphans
4. **Very Long Subtask Title**: Truncated to 255 characters
5. **Add Subtask to Completed Todo**: Allowed, doesn't affect completion status
6. **Position Gaps After Delete**: Position values can have gaps; not reordered (stable)
7. **Thousands of Subtasks**: Performance tested with 1000+ subtasks (lazy rendering if needed)
8. **Subtask Search**: Included in global search functionality (if search implemented)
9. **Subtask Visible When Collapsed**: Progress bar always visible, list hidden until expanded
10. **Empty Subtask Title**: Rejected with error "Subtask title required"

---

## Acceptance Criteria

- [ ] Can add unlimited subtasks to todo
- [ ] Subtasks display in creation order (position-based)
- [ ] Progress bar shows accurate completion percentage (0-100%)
- [ ] Progress text: "X/Y subtasks (Z%)" updates in real-time
- [ ] Checkbox toggle works for each subtask independently
- [ ] Delete button removes individual subtask immediately
- [ ] Collapse/expand button toggles subtask visibility
- [ ] Progress bar visible even when subtasks collapsed
- [ ] Deleting parent todo removes all subtasks (CASCADE)
- [ ] No subtasks message appears when section empty
- [ ] Progress at 100%: bar turns green
- [ ] Subtask title validation: non-empty, trimmed
- [ ] Optimistic UI updates (no flicker)

---

## Testing Requirements

### Unit Tests

1. **Progress Calculation**
   - 0/5 = 0%
   - 2/5 = 40%
   - 5/5 = 100%
   - Empty array = 0%

2. **Position Assignment**
   - First subtask gets position 1
   - Second gets position 2
   - Positions sequential

3. **Completion Toggle**
   - Checkbox changes state
   - Unchecking toggles back
   - Doesn't affect parent todo

### Integration Tests

1. **Create Subtask**
   - POST creates and returns subtask
   - Returns correct position
   - Associated with correct todo_id

2. **Update Subtask**
   - PUT updates completed field
   - Persists in database

3. **Delete Subtask**
   - DELETE removes subtask
   - Doesn't affect parent todo
   - No orphaned records

4. **CASCADE Delete**
   - DELETE parent todo removes all subtasks
   - Verified in database

### E2E Tests (Playwright)

1. **Test: Add Subtask**

   ```
   - Expand subtasks section
   - Enter subtask title
   - Verify appears in list
   - Verify progress updates
   ```

2. **Test: Progress Bar**

   ```
   - Create todo with 3 subtasks
   - Verify bar at 0%
   - Check 2 subtasks
   - Verify bar at 66%
   - Check last subtask
   - Verify bar green at 100%
   ```

3. **Test: Collapse/Expand**

   ```
   - Expand subtasks
   - Click collapse button
   - Verify progress bar still visible
   - Verify subtasks hidden
   - Click expand
   - Verify subtasks visible
   ```

4. **Test: Delete Subtask**

   ```
   - Create 3 subtasks
   - Delete middle one
   - Verify 2 remain
   - Verify progress accurate
   ```

5. **Test: CASCADE Delete**
   ```
   - Create todo with 5 subtasks
   - Delete parent todo
   - Verify todo gone
   - Verify no orphaned subtasks in DB
   ```

---

## Out of Scope

- ❌ Drag-to-reorder subtasks
- ❌ Nested subtasks (multi-level)
- ❌ Subtask due dates (different from parent)
- ❌ Subtask priorities separate from parent
- ❌ Subtask reminders separate from parent
- ❌ Subtask assignment (to other users)
- ❌ Subtask comments/notes
- ❌ Subtask time estimates or tracking

---

## Success Metrics

1. **Correctness**: Progress calculation 100% accurate, CASCADE deletes work
2. **Performance**: Operations < 100ms, renders 1000 subtasks smoothly
3. **UX**: Progress bar intuitive, expand/collapse obvious, buttons responsive
4. **Accessibility**: Keyboard can expand/collapse and toggle all subtasks
5. **Code Quality**: No type errors, proper error handling, clean component composition
