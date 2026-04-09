# PRP 07: Template System

## Feature Overview

Save frequent todo patterns as reusable templates for instant creation. Templates preserve title, priority, recurrence settings, reminder timing, and optional description/category. Subtasks stored as JSON array. When using template, due date is calculated from optional offset. Templates user-specific, stored in `templates` table.

**Core Capabilities:**

- Save current todo as template
- Use template to create new todo
- Store template name, description, priority, recurrence, reminder, subtasks JSON
- Optional category for grouping templates
- Edit and delete templates
- Create todos from template with new due date (calculated from offset)
- Due date NOT stored in template; calculated when used

---

## User Stories

### Story 1: Save Work Template

**As a manager with recurring responsibilities, I want to save my weekly meeting todo as a template, so that I can recreate it consistently.**

- Acceptance: Click "Save as Template", name it "Weekly Meeting", choose category "Work"
- Template saved with priority, recurrence pattern, reminder, subtasks
- Can create todos from template instantly

### Story 2: Reuse Templates

**As a person managing similar projects, I want to create todos from templates, so that I don't recreate settings every time.**

- Acceptance: Dropdown shows saved templates
- Clicking template creates new todo with all settings
- Due date calculated based on usage time
- Subtasks recreated from JSON

### Story 3: Organize Templates

**As a user with 20+ templates, I want to group them by category, so that I can find them quickly.**

- Acceptance: Template dropdown shows categories for grouping
- Filter templates by category
- Optional category field (can leave blank)

### Story 4: Manage Templates

**As an evolving user, I want to edit or delete templates, so that my templates stay current.**

- Acceptance: Templates modal shows all with Edit/Delete buttons
- Edit changes template settings
- Delete removes template (doesn't affect existing todos)

### Story 5: Preview Templates

**As a user deciding which template to use, I want to see template details, so that I select the right one.**

- Acceptance: Template shows: name, description, priority badge, recurrence badge, reminder badge
- Modal displays all template metadata before using

---

## User Flow

### Save as Template

1. User creates todo with full settings (priority, recurrence, reminder, subtasks)
2. User clicks "Save as Template" button (appears when title filled)
3. Modal opens with fields:
   - Template Name (required)
   - Description (optional)
   - Category (optional dropdown)
4. User fills fields and clicks Save
5. Template created with:
   - title_template (not template-specific due_date)
   - priority, recurrence_pattern, reminder_minutes, category
   - subtasks serialized to JSON string
6. Modal closes
7. Todo form clears (or continues editing)

### Use Template

1. User starts creating new todo
2. User clicks "Use Template" dropdown below form
3. Dropdown shows templates grouped by category
4. User selects template
5. Todo form pre-filled with template settings:
   - Title from template
   - Priority selected
   - Recurrence pattern selected (if applicable)
   - Reminder timing selected
6. Due date field EMPTY (user must set manually)
7. Subtasks NOT yet added (added after creation if desired)
8. User can modify any field before submitting
9. User clicks Add to create todo

### Edit Template

1. User clicks "Templates" button or opens Templates modal
2. Modal shows list of all templates
3. User clicks "Edit" on desired template
4. Edit modal opens with:
   - Current name
   - Current description
   - Current category
   - All settings visible
5. User modifies fields
6. User clicks Save
7. Template updated (affects only future uses, not existing todos)

### Delete Template

1. Templates modal open
2. User clicks "Delete" on template
3. Template removed immediately (no confirmation)
4. Existing todos from this template unaffected

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title_template TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL),
  reminder_minutes INTEGER CHECK (reminder_minutes IN (15, 30, 60, 120, 1440, 2880, 10080) OR reminder_minutes IS NULL),
  category TEXT,
  subtasks_json TEXT, -- JSON array: [{ title, position }]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  CHECK (title_template IS NOT NULL AND TRIM(title_template) != '')
);

CREATE INDEX idx_templates_user ON templates(user_id);
CREATE INDEX idx_templates_category ON templates(category);
```

### API Endpoints

**GET /api/templates** — Fetch all templates for user

```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const templates = db.getTemplatesByUserId(session.userId);

  return NextResponse.json({
    success: true,
    data: templates,
  });
}
```

**POST /api/templates** — Create template

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const {
    title_template,
    description,
    priority,
    is_recurring,
    recurrence_pattern,
    reminder_minutes,
    category,
    subtasks,
  } = await request.json();

  const template = db.createTemplate({
    user_id: session.userId,
    title_template: title_template.trim(),
    description: description?.trim(),
    priority,
    is_recurring,
    recurrence_pattern,
    reminder_minutes,
    category,
    subtasks_json: JSON.stringify(subtasks || []),
  });

  return NextResponse.json({
    success: true,
    data: template,
  });
}
```

**PUT /api/templates/[id]** — Update template

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const template = db.getTemplateById(id);
  if (!template || template.user_id !== session.userId) return notFound();

  const body = await request.json();

  const updated = db.updateTemplate(id, {
    ...template,
    ...body,
    subtasks_json: body.subtasks
      ? JSON.stringify(body.subtasks)
      : template.subtasks_json,
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}
```

**DELETE /api/templates/[id]** — Delete template

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const template = db.getTemplateById(id);
  if (!template || template.user_id !== session.userId) return notFound();

  db.deleteTemplate(id);

  return NextResponse.json({
    success: true,
    message: "Template deleted",
  });
}
```

**POST /api/templates/[id]/use** — Create todo from template

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const template = db.getTemplateById(id);
  if (!template || template.user_id !== session.userId) return notFound();

  const { due_date } = await request.json(); // User-provided due date

  // Create todo from template
  const todo = db.createTodo({
    user_id: session.userId,
    title: template.title_template,
    priority: template.priority,
    due_date,
    is_recurring: template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
    completed: false,
  });

  // Add subtasks from template JSON
  if (template.subtasks_json) {
    const subtasks = JSON.parse(template.subtasks_json);
    subtasks.forEach((st: any) => {
      db.createSubtask({
        todo_id: todo.id,
        title: st.title,
        position: st.position,
        completed: false,
      });
    });
  }

  return NextResponse.json({
    success: true,
    data: todo,
  });
}
```

### Types

```typescript
interface Template {
  id: number;
  user_id: number;
  title_template: string;
  description: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: ReminderTiming | null;
  category: string | null;
  subtasks_json: string; // JSON array
  created_at: string;
  updated_at: string;
}

interface TemplateWithSubtasks extends Omit<Template, "subtasks_json"> {
  subtasks: Array<{ title: string; position: number }>;
}

function parseTemplateSubtasks(
  json: string,
): Array<{ title: string; position: number }> {
  try {
    return JSON.parse(json) || [];
  } catch {
    return [];
  }
}
```

---

## UI Components

### Save as Template Modal

```tsx
interface SaveTemplateModalProps {
  todo: Todo;
  onSave: (template: Partial<Template>) => Promise<void>;
  onCancel: () => void;
}

export function SaveTemplateModal({
  todo,
  onSave,
  onCancel,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  return (
    <div className="space-y-4 p-4 border rounded">
      <h2 className="text-lg font-bold">Save as Template</h2>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name (required)"
        className="w-full px-3 py-2 border rounded"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-3 py-2 border rounded h-20"
      />

      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category (optional)"
        className="w-full px-3 py-2 border rounded"
      />

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-2 border rounded">
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!name.trim()) {
              alert("Template name required");
              return;
            }
            await onSave({
              title_template: todo.title,
              description,
              priority: todo.priority,
              is_recurring: todo.is_recurring,
              recurrence_pattern: todo.recurrence_pattern,
              reminder_minutes: todo.reminder_minutes,
              category: category || null,
              subtasks_json: todo.subtasks
                ? JSON.stringify(todo.subtasks)
                : "[]",
            });
          }}
          className="px-3 py-2 bg-blue-500 text-white rounded"
        >
          Save Template
        </button>
      </div>
    </div>
  );
}
```

### Use Template Dropdown

```tsx
interface UseTemplateProps {
  templates: Template[];
  onSelect: (template: Template) => void;
}

export function UseTemplate({ templates, onSelect }: UseTemplateProps) {
  const grouped = templates.reduce(
    (acc, t) => {
      const category = t.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(t);
      return acc;
    },
    {} as Record<string, Template[]>,
  );

  return (
    <select
      onChange={(e) => {
        const templateId = parseInt(e.target.value);
        const template = templates.find((t) => t.id === templateId);
        if (template) onSelect(template);
      }}
      defaultValue=""
      className="w-full px-3 py-2 border rounded"
    >
      <option value="">Use Template...</option>
      {Object.entries(grouped).map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title_template}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

---

## Edge Cases

1. **Empty Subtasks**: JSON array can be empty
2. **Very Long Template Name**: Truncated to 255 characters
3. **Delete Template with Similar Todos**: Template deleted, todos unaffected
4. **Use Template Without Due Date**: Form validation requires due date for recurring templates
5. **Uncategorized Templates**: Shown under "Uncategorized" group or as null

---

## Acceptance Criteria

- [ ] Can save current todo as template with name
- [ ] Template preserves priority, recurrence, reminder, category
- [ ] Subtasks serialized to JSON and stored
- [ ] Can create todo from template
- [ ] Template dropdown filtered by category
- [ ] Edit template updates for future use
- [ ] Delete template doesn't affect existing todos
- [ ] Templates modal accessible and functional
- [ ] Due date NOT stored in template; user provides when using

---

## Testing Requirements

### Unit Tests

1. **Subtasks JSON Serialization**
   - Serialize array correctly
   - Deserialize and recreate
   - Handle empty array

### Integration Tests

1. **Create Template**
   - POST creates with all fields
   - Subtasks properly JSON-serialized
   - Returns template with id

2. **Use Template**
   - POST creates todo from template
   - Subtasks recreated from JSON
   - All metadata preserved

3. **Edit/Delete**
   - PUT updates template
   - DELETE removes template

### E2E Tests (Playwright)

1. **Test: Save Template**

   ```
   - Create todo with settings
   - Click Save as Template
   - Name it "Weekly Standup"
   - Verify template appears
   ```

2. **Test: Use Template**
   ```
   - Select template from dropdown
   - Form pre-fills
   - Set due date
   - Create todo
   - Verify todo has template settings
   ```

---

## Out of Scope

- ❌ Template sharing between users
- ❌ Template versioning
- ❌ Template cloning
- ❌ Template search/filtering beyond category

---

## Success Metrics

1. **Correctness**: Templates created, stored, and used correctly
2. **Performance**: Template operations < 100ms
3. **UX**: Template selection intuitive, settings clear
