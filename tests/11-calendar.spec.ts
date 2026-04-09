import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 10: Calendar View", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("calendar page loads", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  test("calendar shows day headers", async ({ page }) => {
    await page.goto("/calendar");
    const grid = page.locator(".grid-cols-7").first();
    await expect(grid.getByText("Sun")).toBeVisible();
    await expect(grid.getByText("Mon")).toBeVisible();
    await expect(grid.getByText("Tue")).toBeVisible();
    await expect(grid.getByText("Wed")).toBeVisible();
    await expect(grid.getByText("Thu")).toBeVisible();
    await expect(grid.getByText("Fri")).toBeVisible();
    await expect(grid.getByText("Sat")).toBeVisible();
  });

  test("navigate to previous month", async ({ page }) => {
    await page.goto("/calendar");
    const currentMonth = await page.locator("h2").first().textContent();
    await page.getByRole("button", { name: "Prev" }).click();
    const newMonth = await page.locator("h2").first().textContent();
    expect(newMonth).not.toBe(currentMonth);
  });

  test("navigate to next month", async ({ page }) => {
    await page.goto("/calendar");
    const currentMonth = await page.locator("h2").first().textContent();
    await page.getByRole("button", { name: "Next" }).click();
    const newMonth = await page.locator("h2").first().textContent();
    expect(newMonth).not.toBe(currentMonth);
  });

  test("today button returns to current month", async ({ page }) => {
    await page.goto("/calendar");
    const currentMonth = await page.locator("h2").first().textContent();

    await page.getByRole("button", { name: "Prev" }).click();
    await page.getByRole("button", { name: "Prev" }).click();

    await page.getByRole("button", { name: "Today" }).click();
    const restoredMonth = await page.locator("h2").first().textContent();
    expect(restoredMonth).toBe(currentMonth);
  });

  test("back to todos link works", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("link", { name: "Back to Todos" }).click();
    await expect(page).toHaveURL("/");
  });

  test("holidays API returns data", async ({ page }) => {
    const now = new Date();
    const start = `${now.getFullYear()}-01-01`;
    const end = `${now.getFullYear()}-12-31`;
    const response = await page.request.get(
      `/api/holidays?start=${start}&end=${end}`,
    );
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("holidays");
    expect(Array.isArray(data.holidays)).toBe(true);
  });

  test("calendar link in main page works", async ({ page }) => {
    await page.getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  test("todo appears on correct date in calendar", async ({ page }) => {
    // Create a todo with a specific future due date (15th of next month)
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 15, 12, 0);
    const dateStr = targetDate.toISOString().slice(0, 16);
    const dayNum = targetDate.getDate();

    await createTodo(page, {
      title: "Calendar visible todo",
      dueDate: dateStr,
    });

    // Navigate to calendar
    await page.goto("/calendar");

    // Navigate to the correct month
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(500);

    // The todo title should appear on the calendar on the 15th
    const dayCell = page.locator(".grid-cols-7").last().locator("div").filter({ hasText: String(dayNum) });
    await expect(dayCell.getByText("Calendar visible todo")).toBeVisible();
  });
});
