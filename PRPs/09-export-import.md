# PRP 09: Export & Import

## Feature Overview

Export and restore todo data as JSON. Export includes todos, subtasks, tags, and relationships. Import validates JSON, remaps IDs to prevent conflicts, and handles tag name conflicts. Preserves all metadata during round-trip. User sees count of items imported and any warnings.

**Core Capabilities:**

- Export all todos + subtasks + tags to JSON file
- Import JSON file with validation
- ID remapping during import (prevents collision with existing todos)
- Tag conflict resolution (use existing or create new)
- Progress feedback during import
- Warning messages for conflicts
- No data loss on import failure

---

## User Stories

### Story 1: Backup Data

**As a user, I want to export my todos, so that I have a backup.**

- Acceptance: Click "Export" button
- JSON file downloaded (todos_backup_YYYY-MM-DD.json)
- File contains all todos, subtasks, tags, and relationships

### Story 2: Switch Devices

**As a user switching to a new device, I want to import my old todos, so that I don't lose data.**

- Acceptance: Upload exported JSON file
- All todos imported with new IDs
- Tags matched by name (don't duplicate)
- One import completion notification

### Story 3: Migrate Data

**As someone starting a new project, I want to duplicate todos from a template, so that I can reuse patterns.**

- Acceptance: Export one workspace's todos
- Import into another account
- All tags and relationships preserved

### Story 4: Handle Conflicts

**As a user importing data with tag name conflicts, I want to choose how to handle it, so that I don't lose tags.**

- Acceptance: Tag conflict dialog shown for each new tag name
- Option: Use existing (merge) or import as new
- Clear feedback on result

### Story 5: Undo-safe Import

**As someone who imported data accidentally, I want to verify before committing, so that I don't corrupt data.**

- Acceptance: Validation step before import
- Summary shown (X todos, Y tags, Z subtasks)
- Confirm button required
- Cancel to discard

---

## User Flow

### Export

1. User clicks hamburger menu or "⋮" → "Export Data"
2. Modal appears:
   - Title: "Export Todos"
   - Shows count: "X todos, Y tags, Z subtasks"
   - Two buttons: "Cancel" and "Export"
3. User clicks "Export"
4. JSON file downloads: `todos_export_2025-03-15.json`
5. Modal closes
6. Toast: "Exported successfully"

### Import

1. User clicks hamburger menu → "Import Data"
2. File picker opens (accept .json)
3. User selects JSON file
4. Validation step:
   - File structure checked
   - Counts displayed (X todos, Y tags, Z subtasks)
   - "Conflicts" badge if tags exist
5. If conflicts, conflict resolution dialog:
   - List each conflicting tag name
   - For each: [Use Existing] or [Import as New]
6. User confirms import
7. Import progress shown:
   - "Importing todos..."
   - Progress bar 0-100%
8. Completion modal:
   - "Successfully imported X todos"
   - "Y tags matched or created"
   - "Z subtasks restored"
9. User clicks "Done"
10. Page refreshes to show new todos

---

## Technical Requirements

### Export JSON Format

```typescript
interface ExportData {
  version: 1;
  exportDate: string; // ISO format
  userId: string; // Hashed or obfuscated
  todos: Array<{
    id: number;
    user_id: number;
    title: string;
    description: string | null;
    priority: "high" | "medium" | "low";
    due_date: string | null; // ISO format
    completed: boolean;
    completed_at: string | null; // ISO format
    reminder_minutes: number | null;
    recurrence_pattern: "daily" | "weekly" | "monthly" | "yearly" | null;
    last_notification_sent: string | null;
    created_at: string;
    updated_at: string;
    tags: Array<{ id: number; name: string; color: string }>;
    subtasks: Array<{
      id: number;
      title: string;
      completed: boolean;
      position: number;
    }>;
  }>;
  tags: Array<{
    id: number;
    name: string;
    color: string;
  }>;
}
```

### Export Function

```typescript
export async function exportTodos(): Promise<void> {
  try {
    const response = await fetch("/api/todos/export");
    const data: ExportData = await response.json();

    // Create blob
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `todos_export_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    throw new Error("Failed to export todos");
  }
}
```

### Import Validation

```typescript
interface ImportValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    todos: number;
    tags: number;
    subtasks: number;
  };
  conflicts: {
    tagName: string;
  }[];
}

function validateImportFile(data: any): ImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: any[] = [];

  // Check structure
  if (!data.todos || !Array.isArray(data.todos)) {
    errors.push("Invalid file format: missing todos array");
  }
  if (!data.tags || !Array.isArray(data.tags)) {
    errors.push("Invalid file format: missing tags array");
  }

  // Check each todo
  data.todos.forEach((todo: any, idx: number) => {
    if (!todo.title || typeof todo.title !== "string") {
      errors.push(`Todo ${idx}: missing title`);
    }
    if (todo.priority && !["high", "medium", "low"].includes(todo.priority)) {
      errors.push(`Todo ${idx}: invalid priority`);
    }
  });

  // Check tag conflicts
  const existingTagNames = getExistingTagNames(); // DB query
  data.tags.forEach((tag: any) => {
    if (existingTagNames.includes(tag.name)) {
      conflicts.push({ tagName: tag.name });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      todos: data.todos.length,
      tags: data.tags.length,
      subtasks: data.todos.reduce(
        (sum: number, t: any) => sum + (t.subtasks?.length ?? 0),
        0,
      ),
    },
    conflicts,
  };
}
```

### Import with ID Remapping

```typescript
interface ImportRequest {
  exportData: ExportData;
  tagMappings: Record<string, "use_existing" | "create_new">; // tagName -> choice
}

async function importTodos(request: ImportRequest): Promise<{
  importedTodoCount: number;
  importedTagCount: number;
  importedSubtaskCount: number;
}> {
  try {
    // Step 1: Create new tags (with mapping)
    const tagIdMap = new Map<number, number>(); // oldId -> newId
    for (const tag of request.exportData.tags) {
      let newId: number;

      if (request.tagMappings[tag.name] === "use_existing") {
        // Find existing tag ID
        const existing = await getTagByName(tag.name);
        newId = existing.id;
      } else {
        // Create new tag
        const newTag = await createTag({
          name: tag.name,
          color: tag.color,
        });
        newId = newTag.id;
      }

      tagIdMap.set(tag.id, newId);
    }

    // Step 2: Create new todos with remapped IDs
    let importedTodoCount = 0;
    let importedSubtaskCount = 0;

    for (const todo of request.exportData.todos) {
      // Create todo
      const newTodo = await createTodo({
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        due_date: todo.due_date,
        reminder_minutes: todo.reminder_minutes,
        recurrence_pattern: todo.recurrence_pattern,
      });

      importedTodoCount++;

      // Add subtasks
      for (const subtask of todo.subtasks ?? []) {
        await addSubtask(newTodo.id, {
          title: subtask.title,
          position: subtask.position,
        });
        importedSubtaskCount++;
      }

      // Add tags (using remapped IDs)
      for (const tag of todo.tags ?? []) {
        const newTagId = tagIdMap.get(tag.id);
        if (newTagId) {
          await addTagToTodo(newTodo.id, newTagId);
        }
      }
    }

    return {
      importedTodoCount,
      importedTagCount: tagIdMap.size,
      importedSubtaskCount,
    };
  } catch (error) {
    console.error("Import failed:", error);
    throw new Error("Failed to import todos");
  }
}
```

### API Endpoint: Export

```typescript
// GET /api/todos/export
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const todos = getAllTodos(session.userId);
  const tags = getAllTags(session.userId);

  const enrichedTodos = todos.map((todo) => ({
    ...todo,
    tags: getTagsForTodo(todo.id),
    subtasks: getSubtasksForTodo(todo.id),
  }));

  const exportData: ExportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    userId: "anonymous", // Don't expose real user ID
    todos: enrichedTodos,
    tags,
  };

  return NextResponse.json(exportData);
}
```

### API Endpoint: Import

```typescript
// POST /api/todos/import
interface ImportBody {
  data: ExportData;
  tagMappings: Record<string, "use_existing" | "create_new">;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body: ImportBody = await request.json();

  // Validate
  const validation = validateImportFile(body.data);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid import file", details: validation.errors },
      { status: 400 },
    );
  }

  // Import
  const result = await importTodos(session.userId, body);

  return NextResponse.json({
    success: true,
    importedTodos: result.importedTodoCount,
    importedTags: result.importedTagCount,
    importedSubtasks: result.importedSubtaskCount,
  });
}
```

---

## UI Components

### Export Button / Modal

```tsx
export function ExportModal({
  isOpen,
  onClose,
  todosCount,
  tagsCount,
  subtasksCount,
}: ExportModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      await exportTodos();
      // Toast success
      onClose();
    } catch (error) {
      // Toast error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Export Todos</h2>
        <p className="text-gray-600">
          {todosCount} todos • {tagsCount} tags • {subtasksCount} subtasks
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### Import - File Selection & Validation

```tsx
export function ImportFlow() {
  const [step, setStep] = useState<
    "file" | "validate" | "conflicts" | "importing" | "complete"
  >("file");
  const [uploadedData, setUploadedData] = useState<ExportData | null>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [tagMappings, setTagMappings] = useState<
    Record<string, "use_existing" | "create_new">
  >({});
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setUploadedData(data);

      const val = validateImportFile(data);
      setValidation(val);

      if (val.conflicts.length > 0) {
        setStep("conflicts");
      } else {
        setStep("validate");
      }
    } catch (error) {
      // Toast error
    }
  };

  if (step === "file") {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Import Todos</h2>
        <div className="border-2 border-dashed rounded p-8 text-center">
          <input
            type="file"
            accept=".json"
            onChange={(e) =>
              e.target.files?.[0] && handleFileSelect(e.target.files[0])
            }
            className="hidden"
            id="import-file"
          />
          <label htmlFor="import-file" className="cursor-pointer">
            📁 Click to select JSON file
          </label>
        </div>
      </div>
    );
  }

  if (step === "conflicts" && validation?.conflicts.length) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Resolve Tag Conflicts</h2>
        <p className="text-sm text-gray-600">
          These tag names already exist. Choose how to handle:
        </p>
        <div className="space-y-2">
          {validation.conflicts.map((conflict) => (
            <div
              key={conflict.tagName}
              className="flex items-center justify-between p-3 border rounded"
            >
              <span className="font-medium">{conflict.tagName}</span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setTagMappings((prev) => ({
                      ...prev,
                      [conflict.tagName]: "use_existing",
                    }))
                  }
                  className={`px-3 py-1 rounded text-sm ${
                    tagMappings[conflict.tagName] === "use_existing"
                      ? "bg-blue-600 text-white"
                      : "border"
                  }`}
                >
                  Use Existing
                </button>
                <button
                  onClick={() =>
                    setTagMappings((prev) => ({
                      ...prev,
                      [conflict.tagName]: "create_new",
                    }))
                  }
                  className={`px-3 py-1 rounded text-sm ${
                    tagMappings[conflict.tagName] === "create_new"
                      ? "bg-blue-600 text-white"
                      : "border"
                  }`}
                >
                  Create New
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep("validate")}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === "validate") {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Review Import</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded space-y-2">
          <p>✓ {validation?.counts.todos ?? 0} todos</p>
          <p>✓ {validation?.counts.tags ?? 0} tags</p>
          <p>✓ {validation?.counts.subtasks ?? 0} subtasks</p>
        </div>
        <button
          onClick={() => setStep("importing")}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Import
        </button>
      </div>
    );
  }

  // ... importing and complete steps

  return null;
}
```

---

## Edge Cases

1. **Corrupted JSON**: Show error message, don't import
2. **Future-dated Todos**: Import with future dates intact
3. **Circular References**: Handle gracefully (shouldn't exist)
4. **Very Large Export**: Chunked processing if needed
5. **Duplicate Imports**: No deduplication; user might import same file twice (creates duplicates)
6. **Partial Import Failure**: Rollback entire import (transactional)
7. **Missing Subtasks Array**: Default to empty array

---

## Acceptance Criteria

- [ ] Export creates valid JSON file
- [ ] Export file contains all todos, subtasks, tags
- [ ] Import file picker opens
- [ ] Validation detects corrupted files
- [ ] Tag conflicts detected and shown
- [ ] User can choose "use existing" or "create new"
- [ ] IDs remapped on import
- [ ] All relationships preserved
- [ ] Progress shown during import
- [ ] Completion message shows counts
- [ ] No duplicate tags on merge
- [ ] Rollback on total failure

---

## Testing Requirements

### Unit Tests

1. **validateImportFile**
   - Valid file passes
   - Missing todos array fails
   - Detects tag conflicts
   - Counts correct

2. **Export Format**
   - ToJSON includes all fields
   - Date fields ISO format
   - Tags array present

### Integration Tests

1. **Export → Import Round-trip**
   - Export todos with tags, subtasks
   - Import back
   - Verify no data loss

2. **Tag Conflict Resolution**
   - Export with tag A
   - Create tag A in target
   - Import with "use existing" → merged
   - Todos have correct tag ID

### E2E Tests (Playwright)

1. **Test: Export**

   ```
   - Click "Export"
   - Verify file downloads
   - Verify filename format
   - Open file and check structure
   ```

2. **Test: Import Fresh**

   ```
   - Prepare export file
   - Click "Import"
   - Select file
   - Verify counts shown
   - Click "Import"
   - Verify todos appear
   ```

3. **Test: Import with Conflicts**
   ```
   - Create tag "Work" in app
   - Create export with "Work" tag
   - Import
   - Dialog shows "Use Existing" option
   - Select it
   - Verify todos use existing tag
   ```

---

## Out of Scope

- ❌ CSV export/import
- ❌ Cloud sync
- ❌ Incremental backups
- ❌ Version migrations
- ❌ Data merging (only overwrite or use existing)
- ❌ Multiple file upload

---

## Success Metrics

1. **Correctness**: 100% data preservation on round-trip
2. **Performance**: Export < 1s, import < 3s for 100 todos
3. **UX**: Clear conflict resolution dialog
4. **Reliability**: Rollback on failure (no partial imports)
