import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect unauthenticated users from / to /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('should redirect unauthenticated users from /calendar to /login', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('should display login page with form elements', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Todo App')
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('button:has-text("Login")')).toBeVisible()
    await expect(page.locator('button:has-text("Register")')).toBeVisible()
  })

  test('should show error when submitting empty username', async ({ page }) => {
    await page.goto('/login')
    // Switch to register mode and try submitting empty
    await page.locator('button:has-text("Register")').first().click()
    await page.locator('button:has-text("Register")').last().click()
    await expect(page.locator('text=Username is required')).toBeVisible({ timeout: 3000 })
  })

  test('should toggle between login and register modes', async ({ page }) => {
    await page.goto('/login')
    const registerTab = page.locator('button:has-text("Register")').first()
    await registerTab.click()
    const loginTab = page.locator('button:has-text("Login")').first()
    await loginTab.click()
  })

  test('should have accessible form elements', async ({ page }) => {
    await page.goto('/login')
    const input = page.locator('#username')
    await expect(input).toHaveAttribute('aria-required', 'true')
    await expect(page.locator('label[for="username"]')).toBeVisible()
  })

  test('auth API should return 401 for unauthenticated /api/auth/me', async ({ request }) => {
    const response = await request.get('/api/auth/me')
    expect(response.status()).toBe(401)
  })

  test('auth API should require username for login-options', async ({ request }) => {
    const response = await request.post('/api/auth/login-options', {
      data: { username: '' },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  test('auth API should require username for register-options', async ({ request }) => {
    const response = await request.post('/api/auth/register-options', {
      data: { username: '' },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  test('auth API should return error for non-existent user login', async ({ request }) => {
    const response = await request.post('/api/auth/login-options', {
      data: { username: 'nonexistent_user_' + Date.now() },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('not found')
  })
})
