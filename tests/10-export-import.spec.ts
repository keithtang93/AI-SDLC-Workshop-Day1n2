import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 09: Export & Import", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("export button exists", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  });

  test("import button exists", async ({ page }) => {
    await expect(page.getByText("Import")).toBeVisible();
  });

  test("export API returns valid JSON", async ({ page }) => {
    await createTodo(page, { title: "Export test todo" });

    const response = await page.request.get("/api/todos/export");
    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("version", 1);
    expect(data).toHaveProperty("exportDate");
    expect(data).toHaveProperty("todos");
    expect(data).toHaveProperty("tags");
    expect(Array.isArray(data.todos)).toBe(true);
    expect(data.todos.length).toBeGreaterThan(0);
  });

  test("import API accepts valid data", async ({ page }) => {
    const importPayload = {
      data: {
        version: 1,
        todos: [
          {
            title: "Imported todo",
            description: "From import",
            priority: "high",
            tags: [],
            subtasks: [],
          },
        ],
        tags: [],
      },
    };

    const response = await page.request.post("/api/todos/import", {
      data: importPayload,
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });

  test("imported todo appears in the list", async ({ page }) => {
    const importPayload = {
      data: {
        version: 1,
        todos: [
          {
            title: "Visible imported item",
            priority: "medium",
            tags: [],
            subtasks: [],
          },
        ],
        tags: [],
      },
    };

    await page.request.post("/api/todos/import", { data: importPayload });
    await page.reload();
    await expect(page.getByText("Visible imported item")).toBeVisible();
  });

  test("import invalid data returns error", async ({ page }) => {
    const response = await page.request.post("/api/todos/import", {
      data: { data: { notTodos: true } },
    });
    expect(response.status()).toBe(400);
  });
});
