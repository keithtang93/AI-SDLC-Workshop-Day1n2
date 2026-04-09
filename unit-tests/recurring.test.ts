import { describe, it, expect } from "vitest";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";

/**
 * Recurring due-date logic extracted from app/api/todos/[id]/route.ts
 */

type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

interface Todo {
  completed: number;
  recurrence_pattern: string | null;
  due_date: string | null;
}

function nextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern,
): string {
  const current = new Date(currentDueDate);
  switch (pattern) {
    case "daily":
      return addDays(current, 1).toISOString();
    case "weekly":
      return addWeeks(current, 1).toISOString();
    case "monthly":
      return addMonths(current, 1).toISOString();
    case "yearly":
      return addYears(current, 1).toISOString();
  }
}

function shouldCreateNext(
  inputCompleted: boolean,
  previous: Todo,
  next: Todo,
): boolean {
  return Boolean(
    inputCompleted &&
      previous.completed === 0 &&
      next.completed === 1 &&
      previous.recurrence_pattern &&
      previous.due_date,
  );
}

describe("Recurring Due-Date Calculations", () => {
  describe("nextDueDate", () => {
    const baseDate = "2025-06-15T10:00:00.000Z";

    it("calculates next daily due date", () => {
      const result = nextDueDate(baseDate, "daily");
      const expected = addDays(new Date(baseDate), 1).toISOString();
      expect(result).toBe(expected);
      expect(new Date(result).getDate()).toBe(16);
    });

    it("calculates next weekly due date", () => {
      const result = nextDueDate(baseDate, "weekly");
      const expected = addWeeks(new Date(baseDate), 1).toISOString();
      expect(result).toBe(expected);
      expect(new Date(result).getDate()).toBe(22);
    });

    it("calculates next monthly due date", () => {
      const result = nextDueDate(baseDate, "monthly");
      const expected = addMonths(new Date(baseDate), 1).toISOString();
      expect(result).toBe(expected);
      expect(new Date(result).getMonth()).toBe(6); // July
    });

    it("calculates next yearly due date", () => {
      const result = nextDueDate(baseDate, "yearly");
      const expected = addYears(new Date(baseDate), 1).toISOString();
      expect(result).toBe(expected);
      expect(new Date(result).getFullYear()).toBe(2026);
    });

    it("handles month-end boundary for monthly (Jan 31 -> Feb 28)", () => {
      const jan31 = "2025-01-31T10:00:00.000Z";
      const result = nextDueDate(jan31, "monthly");
      const d = new Date(result);
      expect(d.getMonth()).toBe(1); // February
      expect(d.getDate()).toBe(28);
    });

    it("handles leap year monthly (Jan 31 -> Feb 29)", () => {
      const jan31 = "2024-01-31T10:00:00.000Z";
      const result = nextDueDate(jan31, "monthly");
      const d = new Date(result);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(29);
    });

    it("handles daily across month boundary", () => {
      const lastDay = "2025-06-30T10:00:00.000Z";
      const result = nextDueDate(lastDay, "daily");
      const d = new Date(result);
      expect(d.getMonth()).toBe(6); // July
      expect(d.getDate()).toBe(1);
    });

    it("handles weekly across year boundary", () => {
      const lastWeek = "2025-12-29T10:00:00.000Z";
      const result = nextDueDate(lastWeek, "weekly");
      const d = new Date(result);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(0); // January
      expect(d.getDate()).toBe(5);
    });

    it("handles yearly leap day (Feb 29 -> Feb 28 next year)", () => {
      const leapDay = "2024-02-29T10:00:00.000Z";
      const result = nextDueDate(leapDay, "yearly");
      const d = new Date(result);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(28);
    });

    it("preserves time component across daily recurrence", () => {
      const withTime = "2025-06-15T14:30:45.000Z";
      const result = nextDueDate(withTime, "daily");
      const d = new Date(result);
      expect(d.getUTCHours()).toBe(14);
      expect(d.getUTCMinutes()).toBe(30);
      expect(d.getUTCSeconds()).toBe(45);
    });
  });

  describe("shouldCreateNext", () => {
    it("returns true when completing a recurring todo with due date", () => {
      const previous: Todo = {
        completed: 0,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      const next: Todo = {
        completed: 1,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      expect(shouldCreateNext(true, previous, next)).toBe(true);
    });

    it("returns false when inputCompleted is false", () => {
      const previous: Todo = {
        completed: 0,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      const next: Todo = {
        completed: 1,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      expect(shouldCreateNext(false, previous, next)).toBe(false);
    });

    it("returns false when previous was already completed", () => {
      const previous: Todo = {
        completed: 1,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      const next: Todo = {
        completed: 1,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      expect(shouldCreateNext(true, previous, next)).toBe(false);
    });

    it("returns false when todo is not recurring", () => {
      const previous: Todo = {
        completed: 0,
        recurrence_pattern: null,
        due_date: "2025-06-15T10:00:00.000Z",
      };
      const next: Todo = {
        completed: 1,
        recurrence_pattern: null,
        due_date: "2025-06-15T10:00:00.000Z",
      };
      expect(shouldCreateNext(true, previous, next)).toBe(false);
    });

    it("returns false when todo has no due date", () => {
      const previous: Todo = {
        completed: 0,
        recurrence_pattern: "daily",
        due_date: null,
      };
      const next: Todo = {
        completed: 1,
        recurrence_pattern: "daily",
        due_date: null,
      };
      expect(shouldCreateNext(true, previous, next)).toBe(false);
    });

    it("returns false when next is not yet completed", () => {
      const previous: Todo = {
        completed: 0,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      const next: Todo = {
        completed: 0,
        recurrence_pattern: "daily",
        due_date: "2025-06-15T10:00:00.000Z",
      };
      expect(shouldCreateNext(true, previous, next)).toBe(false);
    });
  });
});
