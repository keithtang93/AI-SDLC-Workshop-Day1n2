import { Page } from "@playwright/test";

export async function gotoLogin(page: Page): Promise<void> {
  await page.goto("/login");
}
