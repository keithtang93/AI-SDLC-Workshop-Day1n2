import { describe, it, expect } from "vitest";
import { differenceInMinutes, subMinutes, addMinutes } from "date-fns";

/**
 * Reminder time calculation tests.
 * Mirrors the notification check logic from app/api/notifications/check/route.ts.
 *
 * EVALUATION.md F04: Unit test: Reminder time calculation (Singapore timezone)
 *
 * The app supports these reminder offsets (in minutes):
 * 15, 30, 60 (1h), 120 (2h), 1440 (1d), 2880 (2d), 10080 (1w)
 */

interface TodoForNotification {
  id: number;
  title: string;
  due_date: string | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
}

/**
 * Determines if a todo should trigger a notification.
 * Extracted from GET /api/notifications/check
 */
function shouldNotify(todo: TodoForNotification, now: Date): boolean {
  if (
    !todo.due_date ||
    todo.reminder_minutes === null ||
    todo.last_notification_sent
  ) {
    return false;
  }

  const minutesLeft = differenceInMinutes(new Date(todo.due_date), now);
  return minutesLeft <= (todo.reminder_minutes ?? 0);
}

/**
 * For a given due date and reminder offset, returns the earliest moment
 * at which a reminder should trigger.
 */
function getReminderTriggerTime(
  dueDate: string,
  reminderMinutes: number,
): Date {
  return subMinutes(new Date(dueDate), reminderMinutes);
}

describe("Reminder Time Calculation", () => {
  describe("shouldNotify", () => {
    const baseTodo: TodoForNotification = {
      id: 1,
      title: "Test todo",
      due_date: "2025-06-15T10:00:00.000Z",
      reminder_minutes: 30,
      last_notification_sent: null,
    };

    it("triggers when current time is within reminder window", () => {
      // 15 minutes before due = within 30-minute reminder window
      const now = new Date("2025-06-15T09:45:00.000Z");
      expect(shouldNotify(baseTodo, now)).toBe(true);
    });

    it("triggers when current time is exactly at reminder threshold", () => {
      // Exactly 30 minutes before due
      const now = new Date("2025-06-15T09:30:00.000Z");
      expect(shouldNotify(baseTodo, now)).toBe(true);
    });

    it("does not trigger when outside reminder window", () => {
      // 45 minutes before due = outside 30-minute window
      const now = new Date("2025-06-15T09:15:00.000Z");
      expect(shouldNotify(baseTodo, now)).toBe(false);
    });

    it("triggers when past due date", () => {
      // Already past due
      const now = new Date("2025-06-15T11:00:00.000Z");
      expect(shouldNotify(baseTodo, now)).toBe(true);
    });

    it("does not trigger when notification already sent", () => {
      const todo = {
        ...baseTodo,
        last_notification_sent: "2025-06-15T09:35:00.000Z",
      };
      const now = new Date("2025-06-15T09:45:00.000Z");
      expect(shouldNotify(todo, now)).toBe(false);
    });

    it("does not trigger when no due date", () => {
      const todo = { ...baseTodo, due_date: null };
      const now = new Date("2025-06-15T09:45:00.000Z");
      expect(shouldNotify(todo, now)).toBe(false);
    });

    it("does not trigger when reminder_minutes is null", () => {
      const todo = { ...baseTodo, reminder_minutes: null };
      const now = new Date("2025-06-15T09:45:00.000Z");
      expect(shouldNotify(todo, now)).toBe(false);
    });
  });

  describe("Reminder offsets", () => {
    const dueDate = "2025-06-15T10:00:00.000Z";

    it("15-minute reminder triggers 15 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 15);
      expect(trigger.toISOString()).toBe("2025-06-15T09:45:00.000Z");
    });

    it("30-minute reminder triggers 30 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 30);
      expect(trigger.toISOString()).toBe("2025-06-15T09:30:00.000Z");
    });

    it("1-hour reminder triggers 60 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 60);
      expect(trigger.toISOString()).toBe("2025-06-15T09:00:00.000Z");
    });

    it("2-hour reminder triggers 120 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 120);
      expect(trigger.toISOString()).toBe("2025-06-15T08:00:00.000Z");
    });

    it("1-day reminder triggers 1440 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 1440);
      expect(trigger.toISOString()).toBe("2025-06-14T10:00:00.000Z");
    });

    it("2-day reminder triggers 2880 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 2880);
      expect(trigger.toISOString()).toBe("2025-06-13T10:00:00.000Z");
    });

    it("1-week reminder triggers 10080 min before", () => {
      const trigger = getReminderTriggerTime(dueDate, 10080);
      expect(trigger.toISOString()).toBe("2025-06-08T10:00:00.000Z");
    });
  });

  describe("Singapore timezone awareness", () => {
    it("correctly calculates reminder for SGT evening due date", () => {
      // Due at 6pm SGT (10:00 UTC) with 2-hour reminder
      // Should trigger at 4pm SGT (08:00 UTC)
      const sgtEvening = "2025-06-15T10:00:00.000Z"; // 6pm SGT
      const trigger = getReminderTriggerTime(sgtEvening, 120);
      expect(trigger.toISOString()).toBe("2025-06-15T08:00:00.000Z"); // 4pm SGT
    });

    it("handles midnight SGT boundary", () => {
      // Due at midnight SGT (16:00 UTC previous day) with 30-min reminder
      const midnightSGT = "2025-06-14T16:00:00.000Z"; // midnight SGT Jun 15
      const trigger = getReminderTriggerTime(midnightSGT, 30);
      expect(trigger.toISOString()).toBe("2025-06-14T15:30:00.000Z"); // 11:30pm SGT Jun 14
    });

    it("shouldNotify works correctly for SGT due date crossing day boundary", () => {
      // Due at 12:30am SGT Jun 16 (16:30 UTC Jun 15), reminder 60 min
      const todo: TodoForNotification = {
        id: 1,
        title: "Late night task",
        due_date: "2025-06-15T16:30:00.000Z",
        reminder_minutes: 60,
        last_notification_sent: null,
      };

      // At 11:45pm SGT Jun 15 (15:45 UTC) = 45 min before due => within 60 min window
      const withinWindow = new Date("2025-06-15T15:45:00.000Z");
      expect(shouldNotify(todo, withinWindow)).toBe(true);

      // At 11:00pm SGT Jun 15 (15:00 UTC) = 90 min before due => outside 60 min window
      const outsideWindow = new Date("2025-06-15T15:00:00.000Z");
      expect(shouldNotify(todo, outsideWindow)).toBe(false);
    });
  });
});
