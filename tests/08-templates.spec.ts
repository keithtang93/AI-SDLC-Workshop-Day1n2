import { expect, test } from "@playwright/test";
import { registerUser, createTodo, uniqueUser } from "./helpers";

test.describe("Feature 07: Template System", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUser());
  });

  test("save todo as template", async ({ page }) => {
    await page.getByPlaceholder("Title").fill("Template source");
    await page.getByPlaceholder("Template name").fill("My Template");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Template should appear in the template dropdown
    // Verify the template exists in the dropdown by checking it has the option
    const templateSelect = page.locator("select").filter({ hasText: "Use template..." });
    await expect(templateSelect).toContainText("My Template");
  });

  test("create todo from template", async ({ page }) => {
    // First create a template
    await page.getByPlaceholder("Title").fill("Templated todo");
    await page.getByPlaceholder("Description").fill("From template");

    await page.getByPlaceholder("Template name").fill("Reuse Me");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Use the template
    const templateSelect = page.locator("select").filter({ hasText: "Use template..." });
    await templateSelect.selectOption({ label: "Reuse Me" });
    await page.waitForTimeout(1000);

    // New todo should be created with the template's title
    await expect(page.getByText("Templated todo")).toBeVisible();
  });

  test("template name input clears after save", async ({ page }) => {
    await page.getByPlaceholder("Title").fill("Some title");
    await page.getByPlaceholder("Template name").fill("Clear test");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByPlaceholder("Template name")).toHaveValue("");
  });

  test("template preserves settings", async ({ page }) => {
    // Create a template with priority high
    await page.getByPlaceholder("Title").fill("High priority task");
    const prioritySelect = page.locator("form select").first();
    await prioritySelect.selectOption("high");

    await page.getByPlaceholder("Template name").fill("High Priority Template");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Use the template
    const templateSelect = page.locator("select").filter({ hasText: "Use template..." });
    await templateSelect.selectOption({ label: "High Priority Template" });
    await page.waitForTimeout(1000);

    // The created todo should have high priority
    const article = page.locator("article").filter({ hasText: "High priority task" });
    await expect(article.getByText("high", { exact: true })).toBeVisible();
  });

  test("template preview shows settings", async ({ page }) => {
    await page.getByPlaceholder("Title").fill("Preview task");
    const prioritySelect = page.locator("form select").first();
    await prioritySelect.selectOption("high");

    await page.getByPlaceholder("Template name").fill("Preview Template");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Select the template in preview dropdown
    const previewSelect = page.locator("select").filter({ hasText: "Preview template..." });
    await previewSelect.selectOption({ label: "Preview Template" });

    // Template preview should be visible
    const preview = page.locator('[data-testid="template-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Preview Template")).toBeVisible();
    await expect(preview.getByText("Preview task")).toBeVisible();
    await expect(preview.getByText("high")).toBeVisible();
  });

  test("edit template via API", async ({ page }) => {
    // Create a template first
    await page.getByPlaceholder("Title").fill("Edit me template title");
    await page.getByPlaceholder("Template name").fill("Editable Template");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Get templates from API
    const listResponse = await page.request.get("/api/templates");
    const { templates } = await listResponse.json();
    const template = templates.find((t: any) => t.name === "Editable Template");
    expect(template).toBeTruthy();

    // Edit via API
    const response = await page.request.put(`/api/templates/${template.id}`, {
      data: { name: "Updated Template Name", title: "Updated title" },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.template.name).toBe("Updated Template Name");
  });

  test("delete template via API", async ({ page }) => {
    // Create a template
    await page.getByPlaceholder("Title").fill("Delete template title");
    await page.getByPlaceholder("Template name").fill("Deletable Template");
    await page.getByRole("button", { name: "Save as Template" }).click();
    await page.waitForTimeout(500);

    // Get templates
    const listResponse = await page.request.get("/api/templates");
    const { templates } = await listResponse.json();
    const template = templates.find((t: any) => t.name === "Deletable Template");
    expect(template).toBeTruthy();

    // Delete via API
    const response = await page.request.delete(`/api/templates/${template.id}`);
    expect(response.status()).toBe(200);

    // Verify it's gone
    const afterResponse = await page.request.get("/api/templates");
    const afterData = await afterResponse.json();
    const found = afterData.templates.find((t: any) => t.name === "Deletable Template");
    expect(found).toBeUndefined();
  });
});
