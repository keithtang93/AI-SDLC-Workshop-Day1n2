import { Page, expect, BrowserContext } from "@playwright/test";

export async function gotoLogin(page: Page): Promise<void> {
  await page.goto("/login");
}

export async function addVirtualAuthenticator(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    },
  );
  return authenticatorId;
}

export async function registerUser(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto("/register");
  await addVirtualAuthenticator(page);
  await page.getByPlaceholder("your name").fill(username);
  await page.getByRole("button", { name: "Create Passkey" }).click();
  await page.waitForURL("/", { timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: "Todo Workspace" }),
  ).toBeVisible();
}

export async function loginUser(page: Page, username: string): Promise<void> {
  await page.goto("/login");
  await addVirtualAuthenticator(page);
  await page.getByPlaceholder("your name").fill(username);
  await page.getByRole("button", { name: "Sign In with Passkey" }).click();
  await page.waitForURL("/", { timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: "Todo Workspace" }),
  ).toBeVisible();
}

export async function createTodo(
  page: Page,
  options: {
    title: string;
    description?: string;
    priority?: "high" | "medium" | "low";
    dueDate?: string;
    recurrence?: "daily" | "weekly" | "monthly" | "yearly";
    reminder?: string;
  },
): Promise<void> {
  await page.getByPlaceholder("Title").fill(options.title);

  if (options.description) {
    await page.getByPlaceholder("Description").fill(options.description);
  }

  if (options.priority) {
    await page.locator("form select").first().selectOption(options.priority);
  }

  if (options.dueDate) {
    await page.locator('input[type="datetime-local"]').fill(options.dueDate);
  }

  if (options.recurrence) {
    await page.locator("form select").nth(1).selectOption(options.recurrence);
  }

  if (options.reminder) {
    await page.locator("form select").nth(2).selectOption(options.reminder);
  }

  await page.getByRole("button", { name: "Add Todo" }).click();
  await page.waitForTimeout(500);
}

export async function createTag(
  page: Page,
  name: string,
  color?: string,
): Promise<void> {
  await page.getByPlaceholder("Tag name").fill(name);
  if (color) {
    await page.locator('input[type="color"]').fill(color);
  }
  await page.getByRole("button", { name: "Create tag" }).click();
  await page.waitForTimeout(500);
}

export async function addSubtask(
  page: Page,
  todoTitle: string,
  subtaskTitle: string,
): Promise<void> {
  page.once("dialog", async (dialog) => {
    await dialog.accept(subtaskTitle);
  });
  const addBtn = page
    .locator("article")
    .filter({ hasText: todoTitle })
    .getByRole("button", { name: "Add Subtask" });
  await addBtn.click();
  await page.waitForTimeout(500);
}

export function uniqueUser(): string {
  return `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
