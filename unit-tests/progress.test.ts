import { describe, it, expect } from "vitest";

/**
 * Progress calculation logic extracted from app/page.tsx.
 * The formula: (completedSubtasks / totalSubtasks) * 100
 * Used in the progress bar display as "X/Y completed (Z%)".
 */
function calculateProgress(
  subtasks: Array<{ completed: number }>,
): { completed: number; total: number; percent: number } {
  const total = subtasks.length;
  if (total === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }
  const completed = subtasks.filter((s) => s.completed === 1).length;
  const percent = Math.round((completed / total) * 100);
  return { completed, total, percent };
}

describe("Progress Calculation", () => {
  it("returns 0% for empty subtask list", () => {
    const result = calculateProgress([]);
    expect(result).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("returns 0% when no subtasks are completed", () => {
    const subtasks = [
      { completed: 0 },
      { completed: 0 },
      { completed: 0 },
    ];
    const result = calculateProgress(subtasks);
    expect(result).toEqual({ completed: 0, total: 3, percent: 0 });
  });

  it("returns 100% when all subtasks are completed", () => {
    const subtasks = [
      { completed: 1 },
      { completed: 1 },
    ];
    const result = calculateProgress(subtasks);
    expect(result).toEqual({ completed: 2, total: 2, percent: 100 });
  });

  it("calculates partial completion correctly", () => {
    const subtasks = [
      { completed: 1 },
      { completed: 0 },
      { completed: 1 },
      { completed: 0 },
    ];
    const result = calculateProgress(subtasks);
    expect(result).toEqual({ completed: 2, total: 4, percent: 50 });
  });

  it("rounds percentage to nearest integer", () => {
    // 1/3 = 33.333...% → rounds to 33
    const subtasks = [
      { completed: 1 },
      { completed: 0 },
      { completed: 0 },
    ];
    const result = calculateProgress(subtasks);
    expect(result.percent).toBe(33);
  });

  it("handles single subtask (100%)", () => {
    const result = calculateProgress([{ completed: 1 }]);
    expect(result).toEqual({ completed: 1, total: 1, percent: 100 });
  });

  it("handles single subtask (0%)", () => {
    const result = calculateProgress([{ completed: 0 }]);
    expect(result).toEqual({ completed: 0, total: 1, percent: 0 });
  });

  it("rounds 2/3 correctly (67%)", () => {
    const subtasks = [
      { completed: 1 },
      { completed: 1 },
      { completed: 0 },
    ];
    const result = calculateProgress(subtasks);
    expect(result.percent).toBe(67);
  });
});
