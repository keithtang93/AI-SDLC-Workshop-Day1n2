import { test, expect } from '@playwright/test'
import { enableVirtualAuthenticator, registerAndLogin } from './helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await enableVirtualAuthenticator(page)
  })

  test('should register a new user with passkey', async ({ page }) => {
    test.setTimeout(60000)
    const username = `testuser_${Date.now()}`
    await registerAndLogin(page, username)
    await expect(page.locator('header')).toContainText(username)
    await expect(page.locator('header')).toContainText('Logout')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should logout successfully', async ({ page }) => {
    const username = `testuser_${Date.now()}`
    await registerAndLogin(page, username)

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('should persist session after page reload', async ({ page }) => {
    const username = `testuser_${Date.now()}`
    await registerAndLogin(page, username)

    await page.reload()
    await expect(page.locator('header')).toContainText(username)
  })

  test('should show error for duplicate registration', async ({ page }) => {
    const username = `testuser_${Date.now()}`
    await registerAndLogin(page, username)

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL(/\/login/)

    // Try to register again with same username
    await page.getByPlaceholder('Enter your username').fill(username)
    await page.getByRole('button', { name: 'Register' }).click()
    await page.getByRole('button', { name: /Register with Passkey/i }).click()

    // Should show error
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 5000 })
  })
})
