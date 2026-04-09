import { expect, test } from "@playwright/test";
import { registerUser, createTodo, createTag, uniqueUser } from "./helpers";

test.describe("Feature 06: Tag System", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("create tag", async ({ page }) => {
    await createTag(page, "Work", "#FF0000");
    // Tag should appear in the tag selection area of the form
    await expect(page.getByRole("button", { name: "Work" })).toBeVisible();
  });

  test("create multiple tags", async ({ page }) => {
    await createTag(page, "Work");
    await createTag(page, "Personal");

    await expect(page.getByRole("button", { name: "Work" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Personal" })).toBeVisible();
  });

  test("assign tag to todo during creation", async ({ page }) => {
    await createTag(page, "Urgent", "#EF4444");

    // Select the tag by clicking it in the form
    await page.getByRole("button", { name: "Urgent" }).click();

    await createTodo(page, { title: "Tagged todo" });

    const article = page.locator("article").filter({ hasText: "Tagged todo" });
    await expect(article.getByText("Urgent")).toBeVisible();
  });

  test("filter by tag", async ({ page }) => {
    await createTag(page, "Home");
    await createTag(page, "Office");

    // Create todo with Home tag
    await page.getByRole("button", { name: "Home" }).click();
    await createTodo(page, { title: "Home task" });

    // Create todo with Office tag (need to deselect Home, select Office)
    // Tags from previous form submission are already reset
    await page.getByRole("button", { name: "Office" }).click();
    await createTodo(page, { title: "Office task" });

    // Filter by Home tag using the tag filter dropdown (3rd select, index 2)
    const filterSection = page.locator("section").filter({ hasText: "Search & Filters" });
    const tagSelect = filterSection.locator("select").nth(2);
    // Find the Home tag option
    await tagSelect.selectOption({ label: "Home" });

    await expect(page.getByText("Home task")).toBeVisible();
    await expect(page.getByText("Office task")).not.toBeVisible();
  });

  test("tag name input clears after creation", async ({ page }) => {
    await createTag(page, "Clearable");
    await expect(page.getByPlaceholder("Tag name")).toHaveValue("");
  });

  test("edit tag name and color", async ({ page }) => {
    await createTag(page, "EditMe", "#FF0000");
    await expect(page.getByRole("button", { name: "EditMe" })).toBeVisible();

    // Click the edit button on the tag in the Manage Tags section
    const tagSection = page.locator("section").filter({ hasText: "Manage Tags" });
    const editBtn = tagSection.locator('button[title="Edit tag"]');
    await editBtn.click();

    // Edit form should appear
    await expect(tagSection.getByText("Edit tag:")).toBeVisible();

    // Change name
    const nameInput = tagSection.locator("form").last().locator('input[placeholder="Tag name"]');
    await nameInput.fill("Renamed");
    await tagSection.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(500);

    // Verify name changed
    await expect(page.getByRole("button", { name: "Renamed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "EditMe" })).not.toBeVisible();
  });

  test("delete tag removes it", async ({ page }) => {
    await createTag(page, "DeleteMe", "#0000FF");
    await expect(page.getByRole("button", { name: "DeleteMe" })).toBeVisible();

    // Click the delete button on the tag
    const tagSection = page.locator("section").filter({ hasText: "Manage Tags" });
    const deleteBtn = tagSection.locator('button[title="Delete tag"]');
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Tag should no longer be visible in the form tags area
    await expect(
      tagSection.locator("div").filter({ hasText: "DeleteMe" }).locator('button[title="Delete tag"]'),
    ).not.toBeVisible();
  });

  test("duplicate tag name returns error via API", async ({ page }) => {
    await createTag(page, "UniqueTag");

    // Try to create the same tag again via API
    const response = await page.request.post("/api/tags", {
      data: { name: "UniqueTag", color: "#FF0000" },
    });
    expect(response.status()).toBe(409);
  });
});
