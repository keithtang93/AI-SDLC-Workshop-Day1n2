import { describe, it, expect } from "vitest";

/**
 * ID remapping logic extracted from app/api/todos/import/route.ts.
 * When importing todos, tags must be remapped to local IDs.
 * If a tag name already exists locally, use the local ID.
 * Otherwise, create a new tag and use its ID.
 */

interface ImportTag {
  id?: number;
  name: string;
  color: string;
}

interface ImportTodo {
  title: string;
  description?: string | null;
  priority?: string;
  due_date?: string | null;
  reminder_minutes?: number | null;
  recurrence_pattern?: string | null;
  tags?: ImportTag[];
  subtasks?: Array<{ title: string }>;
}

interface ExportPayload {
  version: number;
  exportDate: string;
  todos: ImportTodo[];
  tags: ImportTag[];
}

/**
 * Simulates the tag remapping logic from the import route.
 * Returns a map of tag name → local ID.
 */
function buildTagMap(
  localTags: Array<{ id: number; name: string }>,
  importTags: ImportTag[],
  createTag: (name: string, color: string) => { id: number; name: string },
): Map<string, number> {
  const tagMap = new Map<string, number>();
  for (const tag of localTags) {
    tagMap.set(tag.name, tag.id);
  }
  for (const importTag of importTags) {
    if (!tagMap.has(importTag.name)) {
      const created = createTag(importTag.name, importTag.color || "#3B82F6");
      tagMap.set(created.name, created.id);
    }
  }
  return tagMap;
}

/**
 * Resolves tag IDs for a todo being imported using the tag map.
 */
function resolveTagIds(
  todoTags: ImportTag[] | undefined,
  tagMap: Map<string, number>,
): number[] {
  if (!todoTags) return [];
  return todoTags
    .map((tag) => tagMap.get(tag.name))
    .filter((id): id is number => typeof id === "number");
}

describe("Import ID Remapping", () => {
  describe("buildTagMap", () => {
    it("maps existing local tags by name", () => {
      const localTags = [
        { id: 1, name: "work" },
        { id: 2, name: "personal" },
      ];
      const tagMap = buildTagMap(localTags, [], () => ({ id: 0, name: "" }));
      expect(tagMap.get("work")).toBe(1);
      expect(tagMap.get("personal")).toBe(2);
    });

    it("creates new tags for import-only tags", () => {
      let nextId = 10;
      const createTag = (name: string, _color: string) => ({
        id: nextId++,
        name,
      });

      const localTags: Array<{ id: number; name: string }> = [];
      const importTags: ImportTag[] = [
        { name: "urgent", color: "#FF0000" },
        { name: "review", color: "#00FF00" },
      ];

      const tagMap = buildTagMap(localTags, importTags, createTag);
      expect(tagMap.get("urgent")).toBe(10);
      expect(tagMap.get("review")).toBe(11);
    });

    it("reuses existing tag when import conflicts", () => {
      const createTag = vi.fn();
      const localTags = [{ id: 5, name: "work" }];
      const importTags: ImportTag[] = [{ name: "work", color: "#FF0000" }];

      const tagMap = buildTagMap(localTags, importTags, createTag);
      expect(tagMap.get("work")).toBe(5);
      expect(createTag).not.toHaveBeenCalled();
    });

    it("handles mixed local and new tags", () => {
      let nextId = 100;
      const createTag = (name: string, _color: string) => ({
        id: nextId++,
        name,
      });

      const localTags = [{ id: 1, name: "existing" }];
      const importTags: ImportTag[] = [
        { name: "existing", color: "#000" },
        { name: "brand-new", color: "#FFF" },
      ];

      const tagMap = buildTagMap(localTags, importTags, createTag);
      expect(tagMap.get("existing")).toBe(1); // kept local
      expect(tagMap.get("brand-new")).toBe(100); // newly created
    });
  });

  describe("resolveTagIds", () => {
    it("resolves tag names to IDs", () => {
      const tagMap = new Map([
        ["work", 1],
        ["personal", 2],
      ]);
      const ids = resolveTagIds(
        [
          { name: "work", color: "#000" },
          { name: "personal", color: "#FFF" },
        ],
        tagMap,
      );
      expect(ids).toEqual([1, 2]);
    });

    it("filters out unknown tag names", () => {
      const tagMap = new Map([["work", 1]]);
      const ids = resolveTagIds(
        [
          { name: "work", color: "#000" },
          { name: "unknown", color: "#FFF" },
        ],
        tagMap,
      );
      expect(ids).toEqual([1]);
    });

    it("returns empty array for undefined tags", () => {
      const tagMap = new Map([["work", 1]]);
      expect(resolveTagIds(undefined, tagMap)).toEqual([]);
    });

    it("returns empty array for empty tags", () => {
      const tagMap = new Map([["work", 1]]);
      expect(resolveTagIds([], tagMap)).toEqual([]);
    });
  });

  describe("JSON validation", () => {
    it("validates correct export payload structure", () => {
      const payload: ExportPayload = {
        version: 1,
        exportDate: "2025-01-01T00:00:00Z",
        todos: [
          {
            title: "Test todo",
            priority: "high",
            tags: [{ name: "work", color: "#000" }],
            subtasks: [{ title: "Step 1" }],
          },
        ],
        tags: [{ name: "work", color: "#000" }],
      };

      expect(payload.version).toBe(1);
      expect(Array.isArray(payload.todos)).toBe(true);
      expect(Array.isArray(payload.tags)).toBe(true);
      expect(payload.todos[0].title).toBe("Test todo");
    });

    it("rejects payload without todos array", () => {
      const isValid = (data: unknown): boolean => {
        if (!data || typeof data !== "object") return false;
        const d = data as Record<string, unknown>;
        return Array.isArray(d.todos);
      };

      expect(isValid(null)).toBe(false);
      expect(isValid({})).toBe(false);
      expect(isValid({ todos: "not-an-array" })).toBe(false);
      expect(isValid({ todos: [] })).toBe(true);
    });

    it("validates todo required fields", () => {
      const isValidTodo = (todo: unknown): boolean => {
        if (!todo || typeof todo !== "object") return false;
        const t = todo as Record<string, unknown>;
        return typeof t.title === "string" && t.title.trim().length > 0;
      };

      expect(isValidTodo({ title: "Valid" })).toBe(true);
      expect(isValidTodo({ title: "" })).toBe(false);
      expect(isValidTodo({ title: "  " })).toBe(false);
      expect(isValidTodo({})).toBe(false);
      expect(isValidTodo(null)).toBe(false);
    });
  });
});
