import { expect, test } from "@playwright/test";
import { registerUser, createTodo, addSubtask, uniqueUser } from "./helpers";

test.describe("Feature 05: Subtasks & Progress Tracking", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("add subtask to todo", async ({ page }) => {
    await createTodo(page, { title: "Subtask parent" });

    page.on("dialog", async (dialog) => {
      await dialog.accept("My subtask");
    });

    const addBtn = page
      .locator("article")
      .filter({ hasText: "Subtask parent" })
      .getByRole("button", { name: "Add Subtask" });
    await addBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByText("My subtask")).toBeVisible();
  });

  test("toggle subtask completion", async ({ page }) => {
    await createTodo(page, { title: "Toggle subtask parent" });

    page.on("dialog", async (dialog) => {
      await dialog.accept("Toggleable subtask");
    });

    const addBtn = page
      .locator("article")
      .filter({ hasText: "Toggle subtask parent" })
      .getByRole("button", { name: "Add Subtask" });
    await addBtn.click();
    await page.waitForTimeout(500);

    const checkbox = page
      .locator("article")
      .filter({ hasText: "Toggle subtask parent" })
      .locator('input[type="checkbox"]');
    await checkbox.click();
    await page.waitForTimeout(500);

    // Progress should update to 1/1 (100%)
    await expect(
      page
        .locator("article")
        .filter({ hasText: "Toggle subtask parent" })
        .getByText("1/1 (100%)"),
    ).toBeVisible();
  });

  test("progress bar shows correct percentage", async ({ page }) => {
    await createTodo(page, { title: "Progress parent" });

    let dialogCount = 0;
    page.on("dialog", async (dialog) => {
      dialogCount++;
      await dialog.accept(`Subtask ${dialogCount}`);
    });

    const article = page.locator("article").filter({ hasText: "Progress parent" });
    const addBtn = article.getByRole("button", { name: "Add Subtask" });

    await addBtn.click();
    await page.waitForTimeout(500);
    await addBtn.click();
    await page.waitForTimeout(500);

    // 0/2 = 0%
    await expect(article.getByText("0/2 (0%)")).toBeVisible();

    // Toggle one
    const checkbox = article.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await page.waitForTimeout(500);

    // 1/2 = 50%
    await expect(article.getByText("1/2 (50%)")).toBeVisible();
  });

  test("subtask display shows title", async ({ page }) => {
    await createTodo(page, { title: "Display subtask parent" });

    page.on("dialog", async (dialog) => {
      await dialog.accept("Visible subtask");
    });

    const addBtn = page
      .locator("article")
      .filter({ hasText: "Display subtask parent" })
      .getByRole("button", { name: "Add Subtask" });
    await addBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Visible subtask")).toBeVisible();
  });

  test("delete subtask removes it from the list", async ({ page }) => {
    await createTodo(page, { title: "Delete subtask parent" });
    await addSubtask(page, "Delete subtask parent", "Subtask to delete");

    await expect(page.getByText("Subtask to delete")).toBeVisible();

    // Click the delete button (✕) on the subtask
    const article = page.locator("article").filter({ hasText: "Delete subtask parent" });
    const deleteBtn = article.locator('button[title="Delete subtask"]');
    await deleteBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Subtask to delete")).not.toBeVisible();
  });

  test("deleting todo cascades to subtasks", async ({ page }) => {
    await createTodo(page, { title: "Cascade parent todo" });
    await addSubtask(page, "Cascade parent todo", "Cascade child subtask");

    await expect(page.getByText("Cascade child subtask")).toBeVisible();

    // Delete the parent todo
    const deleteBtn = page
      .locator("article")
      .filter({ hasText: "Cascade parent todo" })
      .getByRole("button", { name: "Delete" });
    await deleteBtn.click();

    const confirmBtn = page
      .locator("article")
      .filter({ hasText: "Cascade parent todo" })
      .getByRole("button", { name: "Confirm" });
    await confirmBtn.click();
    await page.waitForTimeout(500);

    // Both parent and subtask should be gone
    await expect(page.getByText("Cascade parent todo")).not.toBeVisible();
    await expect(page.getByText("Cascade child subtask")).not.toBeVisible();
  });
});
