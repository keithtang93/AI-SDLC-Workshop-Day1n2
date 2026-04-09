import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 02: Priority System", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("create todo with high priority", async ({ page }) => {
    await createTodo(page, { title: "High priority task", priority: "high" });
    const article = page.locator("article").filter({ hasText: "High priority task" });
    await expect(article.getByText("high", { exact: true })).toBeVisible();
  });

  test("create todo with low priority", async ({ page }) => {
    await createTodo(page, { title: "Low priority task", priority: "low" });
    const article = page.locator("article").filter({ hasText: "Low priority task" });
    await expect(article.getByText("low", { exact: true })).toBeVisible();
  });

  test("default priority is medium", async ({ page }) => {
    await createTodo(page, { title: "Default priority task" });
    const article = page.locator("article").filter({ hasText: "Default priority task" });
    await expect(article.getByText("medium")).toBeVisible();
  });

  test("filter by priority", async ({ page }) => {
    await createTodo(page, { title: "High task", priority: "high" });
    await createTodo(page, { title: "Low task", priority: "low" });

    const filterSection = page.locator("section").filter({ hasText: "Search & Filters" });
    // Priority filter is the 2nd select (index 1): status=0, priority=1, tags=2
    await filterSection.locator("select").nth(1).selectOption("high");

    await expect(page.getByText("High task")).toBeVisible();
    await expect(page.getByText("Low task")).not.toBeVisible();
  });

  test("priority badge displays on todo", async ({ page }) => {
    await createTodo(page, { title: "Badge test", priority: "high" });
    const article = page.locator("article").filter({ hasText: "Badge test" });
    await expect(article.locator("span").filter({ hasText: "high" })).toBeVisible();
  });
});
