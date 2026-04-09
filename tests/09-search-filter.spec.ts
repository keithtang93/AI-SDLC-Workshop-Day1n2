import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 08: Search & Filtering", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("search by title", async ({ page }) => {
    await createTodo(page, { title: "Unique apple todo" });
    await createTodo(page, { title: "Unique banana todo" });

    await page.getByPlaceholder("Search todos, subtasks, or tags").fill("apple");

    await expect(page.getByText("Unique apple todo")).toBeVisible();
    await expect(page.getByText("Unique banana todo")).not.toBeVisible();
  });

  test("search is case-insensitive", async ({ page }) => {
    await createTodo(page, { title: "Case Test Item" });

    await page.getByPlaceholder("Search todos, subtasks, or tags").fill("case test");

    await expect(page.getByText("Case Test Item")).toBeVisible();
  });

  test("filter by status (completed)", async ({ page }) => {
    await createTodo(page, { title: "Status active todo xk7" });
    await createTodo(page, { title: "Status done todo xk7" });

    // Complete the second todo
    const completeBtn = page
      .locator("article")
      .filter({ hasText: "Status done todo xk7" })
      .getByRole("button", { name: "Complete" });
    await completeBtn.click();
    await page.waitForTimeout(500);

    // Status filter is the 1st select (index 0)
    const filterSection = page.locator("section").filter({ hasText: "Search & Filters" });
    await filterSection.locator("select").nth(0).selectOption("complete");

    await expect(page.getByText("Status done todo xk7")).toBeVisible();
    await expect(page.getByText("Status active todo xk7")).not.toBeVisible();
  });

  test("filter by priority", async ({ page }) => {
    await createTodo(page, { title: "Filter high", priority: "high" });
    await createTodo(page, { title: "Filter low", priority: "low" });

    // Priority filter is the 2nd select (index 1)
    const filterSection = page.locator("section").filter({ hasText: "Search & Filters" });
    await filterSection.locator("select").nth(1).selectOption("low");

    await expect(page.getByText("Filter low")).toBeVisible();
    await expect(page.getByText("Filter high")).not.toBeVisible();
  });

  test("clear search shows all todos", async ({ page }) => {
    await createTodo(page, { title: "Show me alpha" });
    await createTodo(page, { title: "Show me beta" });

    await page.getByPlaceholder("Search todos, subtasks, or tags").fill("alpha");
    await expect(page.getByText("Show me beta")).not.toBeVisible();

    await page.getByPlaceholder("Search todos, subtasks, or tags").fill("");
    await expect(page.getByText("Show me alpha")).toBeVisible();
    await expect(page.getByText("Show me beta")).toBeVisible();
  });

  test("empty results show no todos message", async ({ page }) => {
    await page.getByPlaceholder("Search todos, subtasks, or tags").fill("nonexistent_xyz_123");
    await expect(page.getByText("No todos in this section.").first()).toBeVisible();
  });
});
