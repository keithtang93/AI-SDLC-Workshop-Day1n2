import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator, registerUser, uniqueUser } from "./helpers";

test.describe("Feature 11: Authentication (WebAuthn)", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByPlaceholder("your name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In with Passkey" }),
    ).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Create Account")).toBeVisible();
    await expect(page.getByPlaceholder("your name")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Passkey" }),
    ).toBeVisible();
  });

  test("protected route redirects unauthenticated user", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("calendar route redirects unauthenticated user", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("register new user with virtual authenticator", async ({ page }) => {
    const username = uniqueUser();
    await registerUser(page, username);
    await expect(page.getByRole("heading", { name: "Todo Workspace" })).toBeVisible();
  });

  test("logout clears session", async ({ page }) => {
    const username = uniqueUser();
    await registerUser(page, username);
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  });

  test("register page has link to login", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
});
