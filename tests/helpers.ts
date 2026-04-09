import { Page, Browser, BrowserContext, CDPSession, expect } from '@playwright/test'

/**
 * Enable virtual authenticator on the CDP session for WebAuthn testing.
 */
export async function enableVirtualAuthenticator(page: Page) {
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send('WebAuthn.enable')
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })
  return cdpSession
}

/**
 * Register a new user and log in via WebAuthn virtual authenticator.
 */
export async function registerAndLogin(page: Page, username: string) {
  await page.goto('/login', { timeout: 60000 })
  await page.getByPlaceholder('Enter your username').fill(username)

  // Switch to register mode
  await page.getByRole('button', { name: 'Register' }).click()

  // Click the register button
  await page.getByRole('button', { name: /Register with Passkey/i }).click()

  // Wait for redirect to home page (generous timeout for cold dev server)
  await page.waitForURL('/', { timeout: 60000 })
  await expect(page.locator('header')).toContainText(username)
}

/**
 * Login as an existing user via WebAuthn virtual authenticator.
 */
export async function loginUser(page: Page, username: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Enter your username').fill(username)
  await page.getByRole('button', { name: /Sign In with Passkey/i }).click()
  await page.waitForURL('/', { timeout: 15000 })
  await expect(page.locator('header')).toContainText(username)
}

/**
 * Create a todo with the given options.
 */
export async function createTodo(page: Page, options: {
  title: string
  priority?: 'high' | 'medium' | 'low'
  dueDate?: string
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  reminder?: number
}) {
  await page.locator('#create-title').fill(options.title)

  if (options.priority) {
    await page.locator('#create-priority').selectOption(options.priority)
  }

  if (options.dueDate) {
    await page.locator('#create-due-date').fill(options.dueDate)
  }

  if (options.recurring && options.dueDate) {
    await page.locator('#create-recurring').check()
    await page.locator('#create-recurrence-pattern').selectOption(options.recurring)
  }

  if (options.reminder && options.dueDate) {
    await page.locator('#create-reminder').selectOption(String(options.reminder))
  }

  await page.getByRole('button', { name: 'Add Todo' }).click()

  // Wait for the todo to appear in the list
  await expect(page.locator('main')).toContainText(options.title, { timeout: 5000 })
}

/**
 * Create a tag with the given name and color.
 */
export async function createTag(page: Page, options: { name: string; color: string }) {
  await page.getByRole('button', { name: /Tags/i }).click()

  // Wait for modal
  const modal = page.locator('.fixed').filter({ hasText: 'Tag Manager' }).locator('> div')
  await expect(modal).toBeVisible()

  await modal.getByPlaceholder('Tag name').fill(options.name)
  await modal.locator('input[type="color"]').fill(options.color)
  await modal.getByRole('button', { name: 'Add', exact: true }).click()

  // Wait for tag to appear in manager
  await expect(modal.locator('span').filter({ hasText: options.name })).toBeVisible()

  // Close modal
  await modal.getByRole('button', { name: 'Close' }).click()
  await expect(modal).not.toBeVisible()
}

/**
 * Add a subtask to a todo.
 */
export async function addSubtask(page: Page, todoTitle: string, subtaskTitle: string) {
  // Find the todo card
  const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: todoTitle }).first()

  // Expand subtasks if not already expanded
  const expandBtn = todoCard.getByRole('button', { name: /Expand subtasks/ })
  if (await expandBtn.count() > 0) {
    await expandBtn.click()
  }

  // Fill in subtask and submit
  await todoCard.getByPlaceholder('Add subtask...').fill(subtaskTitle)
  await todoCard.getByRole('button', { name: 'Add', exact: true }).click()

  // Wait for subtask to appear
  await expect(todoCard).toContainText(subtaskTitle, { timeout: 5000 })
}

/**
 * Get a future date string suitable for datetime-local input.
 */
export function futureDate(hoursFromNow: number = 24): string {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

/**
 * Register a user once and return session cookies + username.
 * Use in test.beforeAll to avoid repeated WebAuthn registrations.
 */
export async function setupAuth(browser: Browser): Promise<{ cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' }>; username: string }> {
  const username = `test_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const context = await browser.newContext({ baseURL: 'http://localhost:3000' })
  const page = await context.newPage()
  await enableVirtualAuthenticator(page)
  await registerAndLogin(page, username)
  const { cookies } = await context.storageState()
  await context.close()
  return { cookies, username }
}

/**
 * Delete all todos and tags for the current user via API.
 * Use in test.beforeEach when sharing a single user across tests.
 */
export async function resetTestData(context: BrowserContext) {
  const baseURL = 'http://localhost:3000'
  const todosRes = await context.request.get(`${baseURL}/api/todos`)
  if (todosRes.ok()) {
    for (const todo of await todosRes.json()) {
      await context.request.delete(`${baseURL}/api/todos/${todo.id}`)
    }
  }
  const tagsRes = await context.request.get(`${baseURL}/api/tags`)
  if (tagsRes.ok()) {
    for (const tag of await tagsRes.json()) {
      await context.request.delete(`${baseURL}/api/tags/${tag.id}`)
    }
  }
  const templatesRes = await context.request.get(`${baseURL}/api/templates`)
  if (templatesRes.ok()) {
    for (const template of await templatesRes.json()) {
      await context.request.delete(`${baseURL}/api/templates/${template.id}`)
    }
  }
}

/**
 * Get a future date string in a specific number of days.
 */
export function futureDateDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}
