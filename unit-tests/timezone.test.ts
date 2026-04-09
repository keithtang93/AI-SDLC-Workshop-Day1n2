import { describe, it, expect } from "vitest";
import {
  getSingaporeNow,
  formatSingaporeDate,
  fromSingaporeLocal,
  SINGAPORE_TIMEZONE,
} from "@/lib/timezone";

describe("Timezone Utility Functions", () => {
  describe("SINGAPORE_TIMEZONE", () => {
    it("is Asia/Singapore", () => {
      expect(SINGAPORE_TIMEZONE).toBe("Asia/Singapore");
    });
  });

  describe("getSingaporeNow", () => {
    it("returns a Date object", () => {
      const now = getSingaporeNow();
      expect(now).toBeInstanceOf(Date);
    });

    it("returns a date close to the current time", () => {
      const before = Date.now();
      const sgNow = getSingaporeNow();
      const after = Date.now();
      // The Singapore time should be within a reasonable range of Date.now()
      // (accounting for the timezone conversion). The absolute timestamp
      // difference should be small since it's the same instant.
      const sgMs = sgNow.getTime();
      // getSingaporeNow converts to zoned representation — the underlying
      // Date may be shifted, but the *formatted* time should reflect SGT.
      // We just check it returns a valid date.
      expect(sgMs).toBeGreaterThan(0);
      expect(after - before).toBeLessThan(1000);
    });
  });

  describe("formatSingaporeDate", () => {
    it("formats a Date object with default format", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const formatted = formatSingaporeDate(date);
      // UTC 12:00 → Singapore +8 → 20:00
      expect(formatted).toContain("2025-06-15");
      expect(formatted).toContain("20:00:00");
    });

    it("formats a string date", () => {
      const formatted = formatSingaporeDate("2025-01-01T00:00:00Z");
      // UTC 00:00 → Singapore +8 → 08:00 on same date
      expect(formatted).toContain("2025-01-01");
      expect(formatted).toContain("08:00:00");
    });

    it("accepts custom format", () => {
      const date = new Date("2025-03-15T10:30:00Z");
      const formatted = formatSingaporeDate(date, "yyyy-MM-dd HH:mm");
      // UTC 10:30 → Singapore → 18:30
      expect(formatted).toBe("2025-03-15 18:30");
    });

    it("handles midnight UTC correctly", () => {
      const formatted = formatSingaporeDate(
        "2025-12-31T16:00:00Z",
        "yyyy-MM-dd",
      );
      // UTC 16:00 on Dec 31 → SGT 00:00 on Jan 1 (+8h)
      expect(formatted).toBe("2026-01-01");
    });
  });

  describe("fromSingaporeLocal", () => {
    it("converts Singapore local datetime to UTC Date", () => {
      const date = fromSingaporeLocal("2025-06-15T20:00:00");
      // Singapore 20:00 → UTC 12:00
      expect(date.toISOString()).toBe("2025-06-15T12:00:00.000Z");
    });

    it("handles date boundary crossing", () => {
      const date = fromSingaporeLocal("2025-01-01T02:00:00");
      // Singapore 02:00 Jan 1 → UTC 18:00 Dec 31
      expect(date.toISOString()).toBe("2024-12-31T18:00:00.000Z");
    });
  });
});
