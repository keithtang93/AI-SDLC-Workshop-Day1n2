# PRP 06: Tag System

## Feature Overview

Organize todos with custom color-coded tags. Users create and manage tags with custom names and colors. Each todo can have multiple tags. Tags are filtered with AND logic (combine with other filters). Many-to-many relationship: todos ↔ tags via `todo_tags` table. Editing tag updates all associated todos. Deleting tag removes associations (CASCADE).

**Core Capabilities:**

- Create tags with custom name and hex color
- Edit tag name and color
- Delete tag (removes from all todos)
- Assign multiple tags to single todo
- Filter todos by single tag
- Tag badges displayed on todos with custom colors
- Tag management modal for CRUD operations
- Unique tag names per user
- Tags persist with todos when exported/imported

---

## User Stories

### Story 1: Organize by Category

**As a productivity enthusiast with diverse tasks, I want to tag todos by category (Work, Personal, Health), so that I can group related items.**

- Acceptance: Can create tags like "Work", "Personal", "Health"
- Each tag can have distinct color
- Multiple todos can share same tag

### Story 2: Quick Tag Assignment

**As a user creating todos, I want to assign tags while creating, so that organization doesn't slow me down.**

- Acceptance: Tag checkboxes appear below todo form
- Can select multiple tags before submitting
- Selected tags show checkmark and highlighted
- Unselected tags appear faded

### Story 3: Tag Filtering

**As a user managing 100+ todos, I want to filter by tag, so that I can focus on specific categories.**

- Acceptance: Click tag badge to filter todos by that tag
- Filter shows only todos with that tag
- Other filters combine (search + tag + priority = AND logic)
- Clear filter button removes tag filter

### Story 4: Manage Tags

**As a user refining my system, I want to edit or delete tags, so that my organization evolves with my needs.**

- Acceptance: "Manage Tags" modal shows all tags
- Edit button allows changing name and color
- Delete button removes tag (removes from todos, no delete confirmation)
- Changes immediately reflected on all associated todos

### Story 5: Visual Differentiation

**As a visual person, I want each tag to have a distinct color, so that I can scan and identify categories at a glance.**

- Acceptance: Color picker in tag modal allows custom hex colors
- Default color: blue (#3B82F6)
- Badge displays with selected color
- Colors readable in light and dark modes

### Story 6: Bulk Edits

**As an admin-like user, I want editing a tag to update all todos with that tag, so that I can fix naming/colors across the system.**

- Acceptance: Rename tag → all todos with tag reflect new name
- Change tag color → all todo badges update immediately
- No manual per-todo updates needed

---

## User Flow

### Create Tag

1. User clicks "Manage Tags" button (near todo form)
2. Modal opens showing existing tags (if any)
3. User enters new tag name in input field
4. User selects color using color picker (or enters hex directly)
5. User clicks "Create Tag" button
6. Tag appears in tag list immediately
7. Tag now available in todo form checkboxes

### Assign Tags to Todo (During Creation)

1. User sees tag section below todo form (if tags exist)
2. User clicks on tag pill to select/deselect
3. Pill appearance changes when selected:
   - Checkmark appears
   - Background becomes solid colored
   - Text becomes white
4. Multiple tags can be selected
5. When submitting todo: all selected tags associated
6. Selected tags appear as badges on created todo

### Assign Tags to Todo (During Edit)

1. User clicks Edit on todo
2. Modal/form opens with tag checkboxes
3. Currently assigned tags show checked and highlighted
4. User can check/uncheck tags
5. User clicks Update
6. Todo tags updated in database
7. Badges reflect new tag set

### Filter by Tag

1. User clicks on tag badge displayed on any todo
2. Todo list filters to show only todos with that tag
3. Filter indicator appears showing active filter: "Tag: Work"
4. Other filters combine with tag filter (AND logic)
5. Clear button removes tag filter
6. Or: use tag dropdown filter: "All Tags" → select tag → filter applies

### Edit Tag

1. User opens "Manage Tags" modal
2. User clicks "Edit" button next to tag
3. Edit form shows:
   - Current tag name
   - Current color picker showing current color
4. User changes name and/or color
5. User clicks "Update"
6. Tag updated globally across all todos
7. Modal updates to show new values
8. All affected todo badges update immediately

### Delete Tag

1. User opens "Manage Tags" modal
2. User clicks "Delete" button next to tag
3. Tag removed from all todos
4. Todo badges update immediately (tag removed)
5. Tag no longer available for selection
6. Modal updates to remove deleted tag

---

## Technical Requirements

### Database Schema

Tags table and many-to-many relationship (from Feature 01):

```sql
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

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_todo_tags_todo ON todo_tags(todo_id);
CREATE INDEX idx_todo_tags_tag ON todo_tags(tag_id);
```

### API Endpoints

**GET /api/tags** — Fetch all tags for user

```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const tags = db.getTagsByUserId(session.userId);

  return NextResponse.json({
    success: true,
    data: tags,
  });
}
```

**POST /api/tags** — Create tag

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();

  // Validate
  if (!body.name?.trim()) {
    return NextResponse.json(
      { success: false, error: "Tag name required" },
      { status: 400 },
    );
  }

  // Check unique
  const existing = db.getTag(session.userId, body.name.trim());
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Tag name already exists" },
      { status: 400 },
    );
  }

  const tag = db.createTag({
    user_id: session.userId,
    name: body.name.trim(),
    color: body.color || "#3B82F6",
  });

  return NextResponse.json({
    success: true,
    data: tag,
  });
}
```

**PUT /api/tags/[id]** — Update tag

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const tag = db.getTagById(id);

  if (!tag || tag.user_id !== session.userId) {
    return notFound();
  }

  // Validate new name unique if changed
  if (body.name && body.name !== tag.name) {
    const existing = db.getTag(session.userId, body.name.trim());
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Tag name already exists" },
        { status: 400 },
      );
    }
  }

  const updated = db.updateTag(id, {
    name: body.name?.trim() || tag.name,
    color: body.color || tag.color,
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}
```

**DELETE /api/tags/[id]** — Delete tag

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const tag = db.getTagById(id);

  if (!tag || tag.user_id !== session.userId) {
    return notFound();
  }

  db.deleteTag(id); // CASCADE deletes todo_tags

  return NextResponse.json({
    success: true,
    message: "Tag deleted",
  });
}
```

**POST /api/todos/[id]/tags** — Add tag to todo

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

  const tag = db.getTagById(body.tag_id);
  if (!tag || tag.user_id !== session.userId) return notFound();

  db.addTagToTodo(id, body.tag_id);

  return NextResponse.json({
    success: true,
    message: "Tag added",
  });
}
```

**DELETE /api/todos/[id]/tags/[tag_id]** — Remove tag from todo

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tag_id: string }> },
) {
  const { id, tag_id } = await params;
  const session = await getSession();
  if (!session) return unauthorized();

  const todo = db.getTodoById(id, session.userId);
  if (!todo) return notFound();

  db.removeTagFromTodo(id, tag_id);

  return NextResponse.json({
    success: true,
    message: "Tag removed",
  });
}
```

### Types

```typescript
interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string; // hex color #RRGGBB
  created_at: string;
}

interface TodoTag {
  tag_id: number;
  name: string;
  color: string;
}

function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(hex);
}

function getContrastingTextColor(hex: string): string {
  const rgb = parseInt(hex.slice(1), 16);
  const luminance =
    (0.299 * (rgb >> 16) + 0.587 * ((rgb >> 8) & 255) + 0.114 * (rgb & 255)) /
    255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
```

### Tag Filtering

```typescript
function filterTodosByTag(todos: Todo[], tagId: number): Todo[] {
  return todos.filter((todo) => {
    return todo.tags?.some((tag) => tag.id === tagId) || false;
  });
}

// GET /api/todos?tag_id=5
// Returns todos associated with tag_id=5
```

---

## UI Components

### Tag Badge

```tsx
interface TagBadgeProps {
  tag: Tag;
  onClick?: () => void;
}

export function TagBadge({ tag, onClick }: TagBadgeProps) {
  const textColor = getContrastingTextColor(tag.color);

  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs font-medium rounded text-white"
      style={{
        backgroundColor: tag.color,
        color: textColor,
      }}
    >
      {tag.name}
    </button>
  );
}
```

### Tag Selector (For Todo Form)

```tsx
interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
}

export function TagSelector({
  tags,
  selectedTagIds,
  onToggleTag,
}: TagSelectorProps) {
  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="block font-medium">Tags</label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          const textColor = getContrastingTextColor(tag.color);

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className={`px-3 py-1 text-sm rounded font-medium transition ${
                isSelected
                  ? "ring-2 ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                backgroundColor: isSelected ? tag.color : "transparent",
                color: isSelected ? textColor : tag.color,
                borderColor: tag.color,
                borderWidth: "1px",
              }}
            >
              {isSelected && "✓ "}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Tag Management Modal

```tsx
interface TagManagementModalProps {
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<void>;
  onUpdateTag: (id: number, name: string, color: string) => Promise<void>;
  onDeleteTag: (id: number) => Promise<void>;
}

export function TagManagementModal({
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: TagManagementModalProps) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Manage Tags</h2>

      {/* Create Section */}
      <div className="space-y-2 p-3 border rounded">
        <h3 className="font-medium">Create New Tag</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
            className="flex-1 px-2 py-1 border rounded"
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="w-10 h-9 rounded"
          />
          <button
            onClick={async () => {
              await onCreateTag(newTagName, newTagColor);
              setNewTagName("");
              setNewTagColor("#3B82F6");
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Create
          </button>
        </div>
      </div>

      {/* List Section */}
      <div className="space-y-2">
        {tags.length === 0 ? (
          <p className="text-gray-500 text-sm">No tags yet</p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 p-2 border rounded"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                  <button
                    onClick={async () => {
                      await onUpdateTag(tag.id, editName, editColor);
                      setEditingId(null);
                    }}
                    className="text-xs px-2 py-1 bg-green-500 text-white rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <TagBadge tag={tag} />
                  <button
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                      setEditColor(tag.color);
                    }}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await onDeleteTag(tag.id);
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Edge Cases

1. **No Tags**: Tag section not displayed in todo form
2. **Duplicate Tag Names**: Rejected with error "Tag name already exists"
3. **Case Sensitivity**: Tag names case-sensitive (Work vs work are different)
4. **Delete Tag with Todos**: Tag removed from all todos, todos still exist
5. **Edit Tag Color to Same**: Allowed, no-op update
6. **Very Long Tag Name**: Truncated to 255 characters
7. **Invalid Hex Color**: Rejected or normalized
8. **Dark Mode Badge Colors**: Contrast maintained in dark backgrounds
9. **Many Tags**: Scroll in modal/selector if > 20 tags
10. **No Permissions**: User can't edit/delete other users' tags

---

## Acceptance Criteria

- [ ] Can create tag with name and custom color
- [ ] Tag names unique per user
- [ ] Can assign multiple tags to single todo
- [ ] Can filter todos by clicking tag badge
- [ ] Filter combines with other filters (AND logic)
- [ ] Edit tag updates all associated todos' badges
- [ ] Delete tag removes from all todos
- [ ] Tag badges show custom color with readable text
- [ ] "Manage Tags" modal accessible and functional
- [ ] Create, edit, delete tag operations reflected immediately in UI
- [ ] Dark mode: tag colors remain readable
- [ ] WCAG AA contrast compliance for badge text

---

## Testing Requirements

### Unit Tests

1. **Tag Validation**
   - Non-empty name required
   - Unique name per user
   - Valid hex color required
   - Invalid hex rejected

2. **Filtering**
   - Filter by tag_id returns only todos with that tag
   - Multiple tags per todo supported
   - Empty result handled

3. **Text Color Contrast**
   - Light colors get dark text
   - Dark colors get light text

### Integration Tests

1. **Create Tag**
   - POST creates and persists
   - Returns with correct user_id
   - Duplicate names rejected

2. **Assign/Remove Tags**
   - POST adds tag to todo
   - DELETE removes tag from todo
   - Many-to-many relationships work

3. **Tag Cleanup**
   - DELETE tag removes from all todos
   - Deleting todo removes tag associations

### E2E Tests (Playwright)

1. **Test: Create and Use Tag**

   ```
   - Open manage tags modal
   - Create "Work" tag (blue)
   - Create todo and select "Work"
   - Verify badge on todo
   ```

2. **Test: Filter by Tag**

   ```
   - Create 2 todos with "Work" tag
   - Create 1 todo with "Personal" tag
   - Click "Work" badge
   - Verify only 2 Work todos shown
   - Clear filter
   - Verify all 3 shown
   ```

3. **Test: Edit Tag**

   ```
   - Create "Work" tag
   - Edit to "Career"
   - Verify todos with tag show "Career" badge
   - Verify color updates
   ```

4. **Test: Delete Tag**
   ```
   - Create 3 todos with tag
   - Open manage modal
   - Delete tag
   - Verify todos still exist
   - Verify badge gone from todos
   ```

---

## Out of Scope

- ❌ Tag hierarchies (parent/child tags)
- ❌ Tag templates (predefined tag sets)
- ❌ Tag usage statistics
- ❌ Tag sharing across users
- ❌ Tag aliases or synonyms
- ❌ Bulk tag operations (multi-select todos to tag)
- ❌ Tag autocomplete from previous usage
- ❌ Tag icons or emoji

---

## Success Metrics

1. **Correctness**: All tag operations work, no orphaned records
2. **Performance**: Tag operations < 100ms, filtering < 50ms
3. **Usability**: Tag creation intuitive, filter obvious from badge click
4. **Accessibility**: WCAG AA contrast compliance, keyboard navigation
5. **Visual Design**: Colors distinctive and readable in all modes
6. **Code Quality**: No type errors, proper validation, clean API
