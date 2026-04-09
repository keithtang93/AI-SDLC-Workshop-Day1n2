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
});
