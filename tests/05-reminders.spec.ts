import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 04: Reminders & Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("set reminder on todo", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Reminder todo",
      dueDate: dateStr,
      reminder: "60",
    });

    const article = page.locator("article").filter({ hasText: "Reminder todo" });
    await expect(article.getByText("reminder: 60m")).toBeVisible();
  });

  test("notifications permission button exists", async ({ page }) => {
    await expect(page.getByText(/Notifications:/)).toBeVisible();
  });

  test("reminder badge displays timing", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Badge reminder",
      dueDate: dateStr,
      reminder: "1440",
    });

    const article = page.locator("article").filter({ hasText: "Badge reminder" });
    await expect(article.getByText("reminder: 1440m")).toBeVisible();
  });

  test("notification check API returns data", async ({ page }) => {
    const response = await page.request.get("/api/notifications/check");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("notifications");
  });
});
