import { expect, test } from "@playwright/test";
import { registerUser, createTodo, createTag, uniqueUser } from "./helpers";

test.describe("API Route Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("GET /api/todos returns 401 without auth", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.request.get("/api/todos");
    expect(response.status()).toBe(401);
    await context.close();
  });

  test("POST /api/todos creates todo", async ({ page }) => {
    const response = await page.request.post("/api/todos", {
      data: { title: "API created todo", priority: "high" },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.todo.title).toBe("API created todo");
    expect(data.todo.priority).toBe("high");
  });

  test("POST /api/todos rejects empty title", async ({ page }) => {
    const response = await page.request.post("/api/todos", {
      data: { title: "" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/tags creates tag", async ({ page }) => {
    const response = await page.request.post("/api/tags", {
      data: { name: "API tag", color: "#00FF00" },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.tag.name).toBe("API tag");
  });

  test("POST /api/tags rejects duplicate name", async ({ page }) => {
    await page.request.post("/api/tags", { data: { name: "Dupe tag" } });
    const response = await page.request.post("/api/tags", {
      data: { name: "Dupe tag" },
    });
    expect(response.status()).toBe(409);
  });

  test("GET /api/tags returns user tags", async ({ page }) => {
    await page.request.post("/api/tags", { data: { name: "List tag" } });
    const response = await page.request.get("/api/tags");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags.length).toBeGreaterThan(0);
  });

  test("POST /api/templates creates template", async ({ page }) => {
    const response = await page.request.post("/api/templates", {
      data: {
        name: "Test Template",
        title: "Template title",
        priority: "high",
      },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.template.name).toBe("Test Template");
  });

  test("GET /api/templates returns templates", async ({ page }) => {
    await page.request.post("/api/templates", {
      data: { name: "Listed Template", title: "Title" },
    });
    const response = await page.request.get("/api/templates");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.templates.length).toBeGreaterThan(0);
  });

  test("POST /api/auth/logout clears session", async ({ page }) => {
    const response = await page.request.post("/api/auth/logout");
    expect(response.status()).toBe(200);

    // After logout, accessing todos should fail
    const todoResponse = await page.request.get("/api/todos");
    expect(todoResponse.status()).toBe(401);
  });

  test("subtask CRUD via API", async ({ page }) => {
    // Create a todo first
    const todoRes = await page.request.post("/api/todos", {
      data: { title: "Subtask API parent" },
    });
    const todoData = await todoRes.json();
    const todoId = todoData.todo.id;

    // Create subtask
    const subtaskRes = await page.request.post(
      `/api/todos/${todoId}/subtasks`,
      { data: { title: "API subtask" } },
    );
    expect(subtaskRes.status()).toBe(201);
    const subtaskData = await subtaskRes.json();
    const subtaskId = subtaskData.subtask.id;

    // Toggle subtask
    const toggleRes = await page.request.put(`/api/subtasks/${subtaskId}`, {
      data: { completed: true },
    });
    expect(toggleRes.status()).toBe(200);
  });
});
