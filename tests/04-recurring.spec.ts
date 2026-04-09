import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 03: Recurring Todos", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("create daily recurring todo", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Daily recurring",
      dueDate: dateStr,
      recurrence: "daily",
    });

    const article = page.locator("article").filter({ hasText: "Daily recurring" });
    await expect(article.getByText("repeat: daily")).toBeVisible();
  });

  test("create weekly recurring todo", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Weekly recurring",
      dueDate: dateStr,
      recurrence: "weekly",
    });

    const article = page.locator("article").filter({ hasText: "Weekly recurring" });
    await expect(article.getByText("repeat: weekly")).toBeVisible();
  });

  test("completing recurring todo creates next instance", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Recur complete test",
      dueDate: dateStr,
      recurrence: "daily",
    });

    const completeBtn = page
      .locator("article")
      .filter({ hasText: "Recur complete test" })
      .getByRole("button", { name: "Complete" });
    await completeBtn.click();
    await page.waitForTimeout(1000);

    // After completing, a new active instance should exist + the completed one
    const articles = page.locator("article").filter({ hasText: "Recur complete test" });
    await expect(articles).toHaveCount(2);
  });

  test("recurrence badge shows pattern", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Monthly todo",
      dueDate: dateStr,
      recurrence: "monthly",
    });

    await expect(page.getByText("repeat: monthly")).toBeVisible();
  });

  test("next recurring instance inherits metadata", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Inherit meta test",
      dueDate: dateStr,
      recurrence: "daily",
      priority: "high",
      reminder: "60",
    });

    // Complete the recurring todo
    const completeBtn = page
      .locator("article")
      .filter({ hasText: "Inherit meta test" })
      .getByRole("button", { name: "Complete" });
    await completeBtn.click();
    await page.waitForTimeout(1000);

    // The new active instance should have the same metadata
    const activeArticle = page
      .locator("section")
      .filter({ hasText: /Active/ })
      .locator("article")
      .filter({ hasText: "Inherit meta test" });

    await expect(activeArticle.getByText("high", { exact: true })).toBeVisible();
    await expect(activeArticle.getByText("repeat: daily")).toBeVisible();
    await expect(activeArticle.getByText("reminder: 60m")).toBeVisible();
  });
});
