import { describe, it, expect } from "vitest";

/**
 * Calendar grid generation logic extracted from app/calendar/page.tsx.
 * Tests the days grid computation: leading nulls, date values, trailing nulls.
 *
 * EVALUATION.md F10: Unit test: Calendar generation
 */

function generateCalendarGrid(
  year: number,
  month: number,
): Array<Date | null> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const values: Date[] = [];
  for (let i = 1; i <= end.getDate(); i += 1) {
    values.push(new Date(year, month, i));
  }
  const lead = start.getDay(); // 0 = Sunday
  const withPad = [
    ...Array.from({ length: lead }).map(() => null),
    ...values,
  ] as Array<Date | null>;
  while (withPad.length % 7 !== 0) {
    withPad.push(null);
  }
  return withPad;
}

describe("Calendar Generation", () => {
  describe("Grid structure", () => {
    it("total length is always a multiple of 7", () => {
      for (let m = 0; m < 12; m++) {
        const grid = generateCalendarGrid(2025, m);
        expect(grid.length % 7).toBe(0);
      }
    });

    it("contains correct number of non-null date entries", () => {
      // June 2025 has 30 days
      const grid = generateCalendarGrid(2025, 5);
      const dates = grid.filter((d) => d !== null);
      expect(dates).toHaveLength(30);
    });

    it("contains correct number of non-null entries for February", () => {
      // Feb 2025 has 28 days
      const grid = generateCalendarGrid(2025, 1);
      const dates = grid.filter((d) => d !== null);
      expect(dates).toHaveLength(28);
    });

    it("contains 29 days for February in leap year", () => {
      const grid = generateCalendarGrid(2024, 1);
      const dates = grid.filter((d) => d !== null);
      expect(dates).toHaveLength(29);
    });

    it("contains 31 days for January", () => {
      const grid = generateCalendarGrid(2025, 0);
      const dates = grid.filter((d) => d !== null);
      expect(dates).toHaveLength(31);
    });
  });

  describe("Leading padding", () => {
    it("adds no leading nulls when month starts on Sunday", () => {
      // June 2025 starts on Sunday (day 0)
      const grid = generateCalendarGrid(2025, 5);
      expect(grid[0]).not.toBeNull();
      expect((grid[0] as Date).getDate()).toBe(1);
    });

    it("adds correct leading nulls when month starts on Wednesday", () => {
      // January 2025 starts on Wednesday (day 3)
      const grid = generateCalendarGrid(2025, 0);
      expect(grid[0]).toBeNull();
      expect(grid[1]).toBeNull();
      expect(grid[2]).toBeNull();
      expect(grid[3]).not.toBeNull();
      expect((grid[3] as Date).getDate()).toBe(1);
    });

    it("adds 1 leading null when month starts on Monday", () => {
      // September 2025 starts on Monday (day 1)
      const grid = generateCalendarGrid(2025, 8);
      expect(grid[0]).toBeNull();
      expect(grid[1]).not.toBeNull();
      expect((grid[1] as Date).getDate()).toBe(1);
    });
  });

  describe("Trailing padding", () => {
    it("pads to complete the last week row", () => {
      // June 2025: 30 days, starts on Sunday => 30 cells + 0 lead = 30
      // 30 % 7 = 2, so needs 5 trailing nulls to reach 35
      const grid = generateCalendarGrid(2025, 5);
      expect(grid.length).toBe(35);
      expect(grid[29]).not.toBeNull();
      expect(grid[30]).toBeNull();
      expect(grid[34]).toBeNull();
    });

    it("no trailing padding needed when grid is already complete", () => {
      // February 2015: 28 days, starts on Sunday (day 0): 28 cells, 28 % 7 = 0
      const grid = generateCalendarGrid(2015, 1);
      expect(grid.length).toBe(28);
      expect(grid[27]).not.toBeNull();
    });
  });

  describe("Date values", () => {
    it("dates are in sequential order", () => {
      const grid = generateCalendarGrid(2025, 5);
      const dates = grid.filter((d): d is Date => d !== null);
      for (let i = 0; i < dates.length; i++) {
        expect(dates[i].getDate()).toBe(i + 1);
      }
    });

    it("all dates belong to the correct month and year", () => {
      const grid = generateCalendarGrid(2025, 5);
      const dates = grid.filter((d): d is Date => d !== null);
      for (const d of dates) {
        expect(d.getFullYear()).toBe(2025);
        expect(d.getMonth()).toBe(5);
      }
    });

    it("first date is day 1 and last date is last day of month", () => {
      const grid = generateCalendarGrid(2025, 5);
      const dates = grid.filter((d): d is Date => d !== null);
      expect(dates[0].getDate()).toBe(1);
      expect(dates[dates.length - 1].getDate()).toBe(30);
    });
  });

  describe("Edge cases", () => {
    it("handles December correctly", () => {
      const grid = generateCalendarGrid(2025, 11);
      const dates = grid.filter((d): d is Date => d !== null);
      expect(dates).toHaveLength(31);
      expect(dates[0].getMonth()).toBe(11);
    });

    it("handles January correctly", () => {
      const grid = generateCalendarGrid(2025, 0);
      const dates = grid.filter((d): d is Date => d !== null);
      expect(dates).toHaveLength(31);
      expect(dates[0].getMonth()).toBe(0);
    });

    it("produces 6 rows for months that span 6 weeks", () => {
      // March 2025: 31 days, starts on Saturday (day 6) => 6 lead + 31 = 37 -> 42 (6 rows)
      const grid = generateCalendarGrid(2025, 2);
      expect(grid.length).toBe(42);
      expect(grid.length / 7).toBe(6);
    });

    it("produces 4 rows for February starting on Sunday (non-leap)", () => {
      // Feb 2015: 28 days, starts on Sunday => 0 + 28 = 28 = 4 rows
      const grid = generateCalendarGrid(2015, 1);
      expect(grid.length).toBe(28);
      expect(grid.length / 7).toBe(4);
    });
  });
});
