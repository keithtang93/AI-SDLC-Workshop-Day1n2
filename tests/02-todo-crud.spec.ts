import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 01: Todo CRUD Operations", () => {
  let username: string;

  test.beforeEach(async ({ page }) => {
    username = uniqueUser();
    await registerUser(page, username);
  });

  test("redirect to login when unauthenticated", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });

  test("create todo with title only", async ({ page }) => {
    await createTodo(page, { title: "Test todo item" });
    await expect(page.getByText("Test todo item")).toBeVisible();
  });

  test("create todo with all metadata", async ({ page }) => {
    const futureDate = new Date(Date.now() + 86400000);
    const dateStr = futureDate.toISOString().slice(0, 16);

    await createTodo(page, {
      title: "Full metadata todo",
      description: "A detailed description",
      priority: "high",
      dueDate: dateStr,
      recurrence: "weekly",
      reminder: "60",
    });

    await expect(page.getByText("Full metadata todo")).toBeVisible();
    const article = page.locator("article").filter({ hasText: "Full metadata todo" });
    await expect(article.getByText("A detailed description")).toBeVisible();
    await expect(article.getByText("high", { exact: true })).toBeVisible();
  });

  test("toggle todo completion", async ({ page }) => {
    await createTodo(page, { title: "Toggle me item" });
    await expect(page.getByText("Toggle me item")).toBeVisible();

    const completeBtn = page
      .locator("article")
      .filter({ hasText: "Toggle me item" })
      .getByRole("button", { name: "Complete" });
    await completeBtn.click();
    await page.waitForTimeout(500);

    await expect(
      page
        .locator("article")
        .filter({ hasText: "Toggle me item" })
        .getByRole("button", { name: "Mark Active" }),
    ).toBeVisible();
  });

  test("delete todo", async ({ page }) => {
    await createTodo(page, { title: "Delete me todo" });
    await expect(page.getByText("Delete me todo")).toBeVisible();

    const deleteBtn = page
      .locator("article")
      .filter({ hasText: "Delete me todo" })
      .getByRole("button", { name: "Delete" });
    await deleteBtn.click();

    // Confirm deletion
    const confirmBtn = page
      .locator("article")
      .filter({ hasText: "Delete me todo" })
      .getByRole("button", { name: "Confirm" });
    await confirmBtn.click();

    await expect(page.getByText("Delete me todo")).not.toBeVisible();
  });

  test("todos displayed in sections (Active, Completed)", async ({ page }) => {
    await createTodo(page, { title: "Section active todo" });
    await expect(page.getByText(/Active \(1\)/)).toBeVisible();

    const completeBtn = page
      .locator("article")
      .filter({ hasText: "Section active todo" })
      .getByRole("button", { name: "Complete" });
    await completeBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/Completed \(1\)/)).toBeVisible();
  });

  test("empty state shows 'No todos in this section'", async ({ page }) => {
    await expect(page.getByText("No todos in this section.").first()).toBeVisible();
  });

  test("create form resets after submission", async ({ page }) => {
    await page.getByPlaceholder("Title").fill("My new todo");
    await page.getByRole("button", { name: "Add Todo" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder("Title")).toHaveValue("");
  });

  test("edit todo via edit modal", async ({ page }) => {
    await createTodo(page, { title: "Editable todo item" });
    await expect(page.getByText("Editable todo item")).toBeVisible();

    const editBtn = page
      .locator("article")
      .filter({ hasText: "Editable todo item" })
      .getByRole("button", { name: "Edit" });
    await editBtn.click();

    // Edit modal should appear
    await expect(page.getByRole("heading", { name: "Edit Todo" })).toBeVisible();

    // Change the title
    const titleInput = page.locator(".fixed input").first();
    await titleInput.fill("Updated todo item");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Updated todo item")).toBeVisible();
    await expect(page.getByText("Editable todo item")).not.toBeVisible();
  });

  test("past due date validation returns error", async ({ page }) => {
    const pastDate = new Date(Date.now() - 86400000);
    const dateStr = pastDate.toISOString().slice(0, 16);

    await createTodo(page, { title: "Past date todo", dueDate: dateStr });

    await expect(page.getByText(/Due date must be/)).toBeVisible();
  });
});
