# PRP 08: Search & Filtering

## Feature Overview

Powerful search and filtering system with real-time results. Search matches todo titles and subtask titles (case-insensitive, partial match). Priority, tag, date range, and completion status filters combine with AND logic. Debounced search (500ms). Optional saved filter presets stored in localStorage.

**Core Capabilities:**

- Real-time search (debounced 500ms) matching titles and subtasks
- Filter by priority (High/Medium/Low/All)
- Filter by tag (single tag selection)
- Filter by completion status (All/Incomplete/Complete)
- Date range filtering (from/to)
- Combine all filters with AND logic
- Save filter presets to localStorage
- Clear individual filters or all at once
- Empty state messaging

---

## User Stories

### Story 1: Quick Todo Search

**As a user with 50+ todos, I want to search by title, so that I can find specific items quickly.**

- Acceptance: Type in search box, results update in real-time
- Partial matching: searching "proj" finds "project" and "projection"
- Case-insensitive: "Project" and "project" both match

### Story 2: Filter by Status

**As a user with mixed completed and incomplete todos, I want to focus on incomplete items, so that I can track progress.**

- Acceptance: Filter "Incomplete Only" hides completed todos
- Filter "Completed Only" shows completed todos
- Filter "All" shows all regardless of status

### Story 3: Date Range Filtering

**As a project planner, I want to filter todos by due date range, so that I can focus on upcoming deadlines.**

- Acceptance: Set "From" and "To" dates
- Shows only todos within range (inclusive)
- "From" alone shows todos on or after date
- "To" alone shows todos on or before date
- Empty fields = no date filtering

### Story 4: Combined Filtering

**As an organized user, I want multiple filters to work together, so that I can find specific subsets of todos.**

- Acceptance: Search "meeting" + Priority "High" + Tag "Work" = todos matching all
- Each filter reduces results further (AND logic)
- All filters clear with one "Clear All" button

### Story 5: Save Presets

**As a user with recurring filter patterns, I want to save filters, so that I can reapply them quickly.**

- Acceptance: Click "Save Filter" when filters active → modal for preset name
- Click preset to reapply instantly
- Delete button removes preset
- Persists across page reloads

---

## User Flow

### Search

1. User types in search box (top of todo list)
2. Search input debounced 500ms (updates after user stops typing)
3. Results update in real-time
4. Searches: todo title (case-insensitive, partial) + subtask titles
5. Clear button (✕) appears when text entered
6. Clicking ✕ clears search and shows all todos

### Filter by Priority

1. Priority dropdown visible below search
2. Default: "All Priorities"
3. User clicks dropdown and selects priority (High/Medium/Low/All)
4. List updates to show only selected priority
5. Filters combine with other active filters (AND)

### Filter by Tag

1. Tag dropdown visible below search (only if tags exist)
2. Default: "All Tags"
3. User clicks dropdown and selects tag name
4. List shows only todos with that tag
5. Filter combines with other filters

### Advanced Filters

1. "▶ Advanced" button (collapsed) toggles panel
2. User clicks to expand → "▼ Advanced"
3. Advanced panel reveals:
   - Completion status dropdown (All/Incomplete/Complete)
   - Date "From" input (mm/dd/yyyy)
   - Date "To" input (mm/dd/yyyy)
   - Saved presets list (if any)
4. User sets desired filters
5. List updates immediately
6. Filters combine with search and basic filters

### Save Filter Preset

1. User applies any mix of filters (search, priority, tag, date, status)
2. "Save Filter" button appears when any filter active
3. User clicks button → modal opens
4. Modal shows:
   - List of currently active filters
   - Name input field
5. User enters preset name (e.g., "High Priority Work This Week")
6. User clicks Save
7. Preset appears in Advanced panel
8. Preset persists in localStorage

### Apply Saved Preset

1. Presets appear in Advanced panel under "Saved Presets"
2. User clicks preset name → all filters applied instantly
3. Or clicks ✕ button on preset to delete

### Clear Filters

1. "Clear All" button appears when any filter active
2. Clicking resets:
   - Search text to empty
   - Priority to All
   - Tag to All Tags
   - Status to All
   - Dates to empty
3. All todos visible

---

## Technical Requirements

### Database Queries

Filtering happens client-side after fetching all user todos:

```typescript
interface FilterCriteria {
  search?: string;
  priority?: Priority;
  tag?: number; // tag_id
  status?: "all" | "incomplete" | "complete";
  dateFrom?: Date;
  dateTo?: Date;
}

function filterTodos(todos: Todo[], criteria: FilterCriteria): Todo[] {
  return todos.filter((todo) => {
    // Search filter
    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      const titleMatch = todo.title.toLowerCase().includes(searchLower);
      const subtaskMatch = todo.subtasks?.some((st) =>
        st.title.toLowerCase().includes(searchLower),
      );
      if (!titleMatch && !subtaskMatch) return false;
    }

    // Priority filter
    if (criteria.priority && todo.priority !== criteria.priority) {
      return false;
    }

    // Tag filter
    if (criteria.tag) {
      if (!todo.tags?.some((t) => t.id === criteria.tag)) {
        return false;
      }
    }

    // Status filter
    if (criteria.status === "incomplete" && todo.completed) return false;
    if (criteria.status === "complete" && !todo.completed) return false;

    // Date range filter
    if (criteria.dateFrom && todo.due_date) {
      if (new Date(todo.due_date) < criteria.dateFrom) return false;
    }
    if (criteria.dateTo && todo.due_date) {
      if (new Date(todo.due_date) > criteria.dateTo) return false;
    }
    if (criteria.dateFrom && !todo.due_date) return false; // Todos without dates excluded if filtering by date

    return true;
  });
}
```

### Debouncing

```typescript
function useSearchDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
const debouncedSearch = useSearchDebounce(searchQuery, 500);

useEffect(() => {
  const filtered = filterTodos(todos, {
    search: debouncedSearch,
    status: selectedStatus,
    priority: selectedPriority,
    tag: selectedTag,
    dateFrom: dateFrom,
    dateTo: dateTo,
  });
  setDisplayedTodos(filtered);
}, [
  debouncedSearch,
  selectedStatus,
  selectedPriority,
  selectedTag,
  dateFrom,
  dateTo,
]);
```

### Preset Storage

```typescript
interface FilterPreset {
  name: string;
  search?: string;
  priority?: Priority;
  tag?: number;
  status?: "all" | "incomplete" | "complete";
  dateFrom?: string; // ISO format
  dateTo?: string;
}

function saveFilterPreset(preset: FilterPreset): void {
  const presets = JSON.parse(localStorage.getItem("filterPresets") || "[]");
  presets.push({ ...preset, id: Date.now() });
  localStorage.setItem("filterPresets", JSON.stringify(presets));
}

function getFilterPresets(): FilterPreset[] {
  return JSON.parse(localStorage.getItem("filterPresets") || "[]");
}

function deleteFilterPreset(id: number): void {
  const presets = JSON.parse(localStorage.getItem("filterPresets") || "[]");
  const filtered = presets.filter((p: any) => p.id !== id);
  localStorage.setItem("filterPresets", JSON.stringify(filtered));
}
```

---

## UI Components

### Search Box

```tsx
interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search todos and subtasks..."
        className="w-full pl-10 pr-8 py-2 border rounded"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

### Filter Controls

```tsx
interface FilterControlsProps {
  priority: Priority | "all";
  onPriorityChange: (p: Priority | "all") => void;
  tags: Tag[];
  selectedTag: number | null;
  onTagChange: (t: number | null) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

export function FilterControls({
  priority,
  onPriorityChange,
  tags,
  selectedTag,
  onTagChange,
  hasActiveFilters,
  onClearAll,
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center p-2 border-b">
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value as any)}
        className="px-3 py-2 border rounded text-sm"
      >
        <option value="all">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {tags.length > 0 && (
        <select
          value={selectedTag || ""}
          onChange={(e) =>
            onTagChange(e.target.value ? parseInt(e.target.value) : null)
          }
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      )}

      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="ml-auto px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
```

### Advanced Filters Panel

```tsx
export function AdvancedFiltersPanel({
  isExpanded,
  onToggle,
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  presets,
  onApplyPreset,
  onDeletePreset,
  onSavePreset,
}: AdvancedFiltersPanelProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);

  return (
    <div className="border-b">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left font-medium hover:bg-gray-100 dark:hover:bg-gray-900"
      >
        {isExpanded ? "▼" : "▶"} Advanced Filters
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-blue-50 dark:bg-blue-900/20">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as any)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="all">All</option>
              <option value="incomplete">Incomplete</option>
              <option value="complete">Completed</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* Saved Presets */}
          {presets.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Saved Presets
              </label>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded text-sm"
                  >
                    <button
                      onClick={() => onApplyPreset(preset)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => onDeletePreset(preset.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Current Filters */}
          <button
            onClick={() => setShowSaveModal(true)}
            className="w-full px-3 py-2 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
          >
            💾 Save Filter
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Edge Cases

1. **No Results**: Show "No todos found" message
2. **All Filters Cleared**: Show all todos
3. **Search Empty String**: No filtering by search
4. **Invalid Date Range**: "From" > "To" allowed (returns no results)
5. **Preset with Deleted Tag**: Handle gracefully (ignore tag if deleted)
6. **Hundreds of Results**: Performance tested (client-side filter)
7. **Rapid Filter Changes**: Debounce prevents excessive re-renders

---

## Acceptance Criteria

- [ ] Search updates results in real-time (debounced)
- [ ] Search matches partial titles and subtasks
- [ ] Search case-insensitive
- [ ] Priority filter works and combines with other filters
- [ ] Tag filter works (if tags exist)
- [ ] Status filter (All/Incomplete/Complete) works
- [ ] Date range filters work correctly
- [ ] Filters combine with AND logic
- [ ] "Clear All" resets all filters
- [ ] "Save Filter" creates preset
- [ ] Presets persist in localStorage
- [ ] Empty state message clear

---

## Testing Requirements

### Unit Tests

1. **Search Matching**
   - Partial match works
   - Case-insensitive
   - Subtask matching works

2. **Filter Logic**
   - Priority filter correct
   - Tag filter correct
   - Status filter correct
   - Date range inclusive

3. **Debouncing**
   - Delays 500ms
   - Cancels pending on new input

### E2E Tests (Playwright)

1. **Test: Search**

   ```
   - Type "meeting"
   - Verify only todos with "meeting" shown
   - Type "proj"
   - Verify matching subtasks shown
   ```

2. **Test: Priority Filter**

   ```
   - Select "High"
   - Verify only high priority shown
   - Select "All"
   - Verify all shown
   ```

3. **Test: Combined Filters**

   ```
   - Search "report"
   - Filter "High"
   - Filter "Work" tag
   - Verify only todos matching all shown
   ```

4. **Test: Save Preset**
   ```
   - Apply filters
   - Click save
   - Name preset
   - Clear filters
   - Click preset
   - Verify filters reapply
   ```

---

## Out of Scope

- ❌ Advanced search operators (AND, OR, NOT)
- ❌ Search history
- ❌ Fuzzy matching
- ❌ Full-text search indexing
- ❌ Search performance optimization (500+ todos)

---

## Success Metrics

1. **Correctness**: All filter combinations work correctly
2. **Performance**: Search/filter < 100ms
3. **UX**: Filters obvious, presets work intuitively
