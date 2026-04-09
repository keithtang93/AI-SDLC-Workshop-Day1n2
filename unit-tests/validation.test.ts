import { describe, it, expect } from "vitest";

/**
 * Validation functions extracted from API routes.
 * These mirror the checks in app/api/todos/route.ts and other routes.
 */

// Title validation (used in POST /api/todos)
function validateTitle(title: unknown): { valid: boolean; error?: string } {
  const value = String(title ?? "").trim();
  if (!value) {
    return { valid: false, error: "Title is required" };
  }
  return { valid: true };
}

// Due date future validation (used in POST /api/todos)
function validateDueDateFuture(
  dueDate: string,
  now: Date,
): { valid: boolean; error?: string } {
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }
  if (due.getTime() <= now.getTime() + 60000) {
    return {
      valid: false,
      error: "Due date must be at least 1 minute in the future",
    };
  }
  return { valid: true };
}

// Recurring requires due date validation (used in POST /api/todos)
function validateRecurrenceRequiresDueDate(
  recurrencePattern: string | null | undefined,
  dueDate: string | null | undefined,
): { valid: boolean; error?: string } {
  if (recurrencePattern && !dueDate) {
    return { valid: false, error: "Recurring todos require a due date" };
  }
  return { valid: true };
}

// Priority validation
function validatePriority(
  priority: unknown,
): { valid: boolean; error?: string } {
  const allowed = ["high", "medium", "low"];
  if (priority && !allowed.includes(String(priority))) {
    return { valid: false, error: "Invalid priority" };
  }
  return { valid: true };
}

// Recurrence pattern validation
function validateRecurrencePattern(
  pattern: unknown,
): { valid: boolean; error?: string } {
  const allowed = ["daily", "weekly", "monthly", "yearly"];
  if (pattern && !allowed.includes(String(pattern))) {
    return { valid: false, error: "Invalid recurrence pattern" };
  }
  return { valid: true };
}

// Tag name validation
function validateTagName(
  name: unknown,
): { valid: boolean; error?: string } {
  const value = String(name ?? "").trim();
  if (!value) {
    return { valid: false, error: "Tag name is required" };
  }
  return { valid: true };
}

describe("Validation Functions", () => {
  describe("validateTitle", () => {
    it("accepts valid title", () => {
      expect(validateTitle("Buy milk")).toEqual({ valid: true });
    });

    it("rejects empty string", () => {
      expect(validateTitle("")).toEqual({
        valid: false,
        error: "Title is required",
      });
    });

    it("rejects whitespace-only string", () => {
      expect(validateTitle("   ")).toEqual({
        valid: false,
        error: "Title is required",
      });
    });

    it("rejects null", () => {
      expect(validateTitle(null)).toEqual({
        valid: false,
        error: "Title is required",
      });
    });

    it("rejects undefined", () => {
      expect(validateTitle(undefined)).toEqual({
        valid: false,
        error: "Title is required",
      });
    });

    it("accepts title with leading/trailing whitespace (trimmed)", () => {
      expect(validateTitle("  valid  ")).toEqual({ valid: true });
    });
  });

  describe("validateDueDateFuture", () => {
    it("accepts date more than 1 minute in the future", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = validateDueDateFuture("2025-06-15T12:05:00Z", now);
      expect(result.valid).toBe(true);
    });

    it("rejects date exactly now", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = validateDueDateFuture("2025-06-15T12:00:00Z", now);
      expect(result.valid).toBe(false);
    });

    it("rejects date in the past", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = validateDueDateFuture("2025-06-14T12:00:00Z", now);
      expect(result.valid).toBe(false);
    });

    it("rejects date less than 1 minute in the future", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = validateDueDateFuture("2025-06-15T12:00:30Z", now);
      expect(result.valid).toBe(false);
    });

    it("accepts date exactly 1 minute + 1ms in the future", () => {
      const now = new Date("2025-06-15T12:00:00.000Z");
      const result = validateDueDateFuture("2025-06-15T12:01:00.001Z", now);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid date string", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = validateDueDateFuture("not-a-date", now);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date format");
    });
  });

  describe("validateRecurrenceRequiresDueDate", () => {
    it("passes when recurrence has due date", () => {
      const result = validateRecurrenceRequiresDueDate(
        "daily",
        "2025-06-15T12:00:00Z",
      );
      expect(result.valid).toBe(true);
    });

    it("fails when recurrence has no due date", () => {
      const result = validateRecurrenceRequiresDueDate("daily", null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Recurring todos require a due date");
    });

    it("passes when no recurrence pattern", () => {
      expect(validateRecurrenceRequiresDueDate(null, null).valid).toBe(true);
      expect(validateRecurrenceRequiresDueDate(undefined, null).valid).toBe(
        true,
      );
    });

    it("fails with empty string due date and recurrence", () => {
      const result = validateRecurrenceRequiresDueDate("weekly", "");
      expect(result.valid).toBe(false);
    });
  });

  describe("validatePriority", () => {
    it("accepts 'high'", () => {
      expect(validatePriority("high").valid).toBe(true);
    });

    it("accepts 'medium'", () => {
      expect(validatePriority("medium").valid).toBe(true);
    });

    it("accepts 'low'", () => {
      expect(validatePriority("low").valid).toBe(true);
    });

    it("accepts null/undefined (default will be applied)", () => {
      expect(validatePriority(null).valid).toBe(true);
      expect(validatePriority(undefined).valid).toBe(true);
    });

    it("rejects invalid priority", () => {
      expect(validatePriority("urgent").valid).toBe(false);
      expect(validatePriority("critical").valid).toBe(false);
    });
  });

  describe("validateRecurrencePattern", () => {
    it("accepts all valid patterns", () => {
      expect(validateRecurrencePattern("daily").valid).toBe(true);
      expect(validateRecurrencePattern("weekly").valid).toBe(true);
      expect(validateRecurrencePattern("monthly").valid).toBe(true);
      expect(validateRecurrencePattern("yearly").valid).toBe(true);
    });

    it("accepts null/undefined", () => {
      expect(validateRecurrencePattern(null).valid).toBe(true);
      expect(validateRecurrencePattern(undefined).valid).toBe(true);
    });

    it("rejects invalid patterns", () => {
      expect(validateRecurrencePattern("biweekly").valid).toBe(false);
      expect(validateRecurrencePattern("hourly").valid).toBe(false);
    });
  });

  describe("validateTagName", () => {
    it("accepts valid tag name", () => {
      expect(validateTagName("work").valid).toBe(true);
    });

    it("rejects empty string", () => {
      expect(validateTagName("").valid).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(validateTagName("   ").valid).toBe(false);
    });

    it("rejects null", () => {
      expect(validateTagName(null).valid).toBe(false);
    });

    it("rejects undefined", () => {
      expect(validateTagName(undefined).valid).toBe(false);
    });
  });
});
