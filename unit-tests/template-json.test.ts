import { describe, it, expect } from "vitest";

/**
 * Template subtasks and tags JSON serialization/deserialization tests.
 * Mirrors the logic in:
 * - POST /api/templates (store subtasksJson / tagsJson strings)
 * - POST /api/templates/[id]/use (parse and create subtasks from JSON)
 *
 * EVALUATION.md F07: Unit test: Subtasks JSON serialization
 */

interface SubtaskEntry {
  title: string;
  position?: number;
}

// Serialization (when creating/updating templates)
function serializeSubtasks(subtasks: SubtaskEntry[]): string {
  return JSON.stringify(subtasks);
}

// Deserialization (when using a template to create a todo)
function deserializeSubtasks(json: string | null | undefined): SubtaskEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

// Tags JSON helpers
function serializeTags(tagIds: number[]): string {
  return JSON.stringify(tagIds);
}

function deserializeTags(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

describe("Template JSON Serialization", () => {
  describe("Subtasks serialization", () => {
    it("serializes empty subtasks array", () => {
      const result = serializeSubtasks([]);
      expect(result).toBe("[]");
    });

    it("serializes single subtask", () => {
      const subtasks: SubtaskEntry[] = [{ title: "Step 1" }];
      const result = serializeSubtasks(subtasks);
      expect(JSON.parse(result)).toEqual([{ title: "Step 1" }]);
    });

    it("serializes multiple subtasks with positions", () => {
      const subtasks: SubtaskEntry[] = [
        { title: "Step 1", position: 0 },
        { title: "Step 2", position: 1 },
        { title: "Step 3", position: 2 },
      ];
      const result = serializeSubtasks(subtasks);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].title).toBe("Step 1");
      expect(parsed[2].position).toBe(2);
    });

    it("preserves special characters in subtask titles", () => {
      const subtasks: SubtaskEntry[] = [
        { title: 'Title with "quotes" & <special> chars' },
      ];
      const json = serializeSubtasks(subtasks);
      const parsed = JSON.parse(json);
      expect(parsed[0].title).toBe(
        'Title with "quotes" & <special> chars',
      );
    });

    it("preserves unicode characters", () => {
      const subtasks: SubtaskEntry[] = [{ title: "任务 📝 タスク" }];
      const json = serializeSubtasks(subtasks);
      const parsed = JSON.parse(json);
      expect(parsed[0].title).toBe("任务 📝 タスク");
    });
  });

  describe("Subtasks deserialization", () => {
    it("deserializes valid JSON array", () => {
      const json = '[{"title":"Step 1"},{"title":"Step 2"}]';
      const result = deserializeSubtasks(json);
      expect(result).toEqual([{ title: "Step 1" }, { title: "Step 2" }]);
    });

    it("returns empty array for null", () => {
      expect(deserializeSubtasks(null)).toEqual([]);
    });

    it("returns empty array for undefined", () => {
      expect(deserializeSubtasks(undefined)).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(deserializeSubtasks("")).toEqual([]);
    });

    it("returns empty array for invalid JSON", () => {
      expect(deserializeSubtasks("not-json")).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      expect(deserializeSubtasks('{"title":"not array"}')).toEqual([]);
    });

    it("returns empty array for '[]'", () => {
      expect(deserializeSubtasks("[]")).toEqual([]);
    });
  });

  describe("Subtasks round-trip", () => {
    it("preserves data through serialize/deserialize cycle", () => {
      const original: SubtaskEntry[] = [
        { title: "First step", position: 0 },
        { title: "Second step", position: 1 },
      ];
      const json = serializeSubtasks(original);
      const restored = deserializeSubtasks(json);
      expect(restored).toEqual(original);
    });

    it("handles empty array round-trip", () => {
      const json = serializeSubtasks([]);
      const restored = deserializeSubtasks(json);
      expect(restored).toEqual([]);
    });
  });

  describe("Tags JSON serialization", () => {
    it("serializes empty tag array", () => {
      expect(serializeTags([])).toBe("[]");
    });

    it("serializes tag IDs", () => {
      const result = serializeTags([1, 5, 10]);
      expect(JSON.parse(result)).toEqual([1, 5, 10]);
    });

    it("deserializes tag IDs", () => {
      expect(deserializeTags("[1,5,10]")).toEqual([1, 5, 10]);
    });

    it("returns empty array for null tags", () => {
      expect(deserializeTags(null)).toEqual([]);
    });

    it("returns empty array for invalid JSON tags", () => {
      expect(deserializeTags("bad-json")).toEqual([]);
    });

    it("round-trips tag IDs", () => {
      const ids = [3, 7, 12];
      const json = serializeTags(ids);
      const restored = deserializeTags(json);
      expect(restored).toEqual(ids);
    });
  });

  describe("Template use flow simulation", () => {
    it("creates subtasks from deserialized template JSON", () => {
      const templateSubtasksJson = JSON.stringify([
        { title: "Review requirements" },
        { title: "Write code" },
        { title: "Run tests" },
      ]);

      const subtasks = deserializeSubtasks(templateSubtasksJson);
      const created = subtasks
        .filter((s) => s.title)
        .map((s, i) => ({ title: s.title, position: i }));

      expect(created).toHaveLength(3);
      expect(created[0]).toEqual({ title: "Review requirements", position: 0 });
      expect(created[2]).toEqual({ title: "Run tests", position: 2 });
    });

    it("filters out subtasks with empty titles", () => {
      const json = JSON.stringify([
        { title: "Valid" },
        { title: "" },
        { title: "Also valid" },
      ]);

      const subtasks = deserializeSubtasks(json);
      const created = subtasks.filter((s) => s.title);

      expect(created).toHaveLength(2);
    });
  });
});
