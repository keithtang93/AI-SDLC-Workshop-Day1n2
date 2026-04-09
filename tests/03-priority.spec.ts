import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, futureDate } from './helpers'

test.describe('Priority System', () => {
  let cookies: any[]
  let username: string

  test.beforeAll(async ({ browser }) => {
    const auth = await setupAuth(browser)
    cookies = auth.cookies
    username = auth.username
  })

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies(cookies)
    await resetTestData(context)
    await page.goto('/')
    await expect(page.locator('header')).toContainText(username)
  })

  test('should create todos with each priority level', async ({ page }) => {
    await createTodo(page, { title: 'High priority task', priority: 'high' })
    await createTodo(page, { title: 'Medium priority task', priority: 'medium' })
    await createTodo(page, { title: 'Low priority task', priority: 'low' })

    await expect(page.locator('main')).toContainText('high')
    await expect(page.locator('main')).toContainText('medium')
    await expect(page.locator('main')).toContainText('low')
  })

  test('should default to medium priority', async ({ page }) => {
    await createTodo(page, { title: 'Default priority task' })

    // Find the todo card and verify medium badge
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Default priority task' }).first()
    await expect(todoCard).toContainText('medium')
  })

  test('should sort todos by priority (high first)', async ({ page }) => {
    // Create in reverse order
    await createTodo(page, { title: 'Low task', priority: 'low' })
    await createTodo(page, { title: 'High task', priority: 'high' })
    await createTodo(page, { title: 'Med task', priority: 'medium' })

    // Get all todo titles in order
    const cards = page.locator('[class*="rounded-xl"]').filter({ hasText: /task/ })
    const titles: string[] = []
    const count = await cards.count()
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).innerText()
      if (text.includes('High task')) titles.push('High')
      else if (text.includes('Med task')) titles.push('Med')
      else if (text.includes('Low task')) titles.push('Low')
    }

    expect(titles).toEqual(['High', 'Med', 'Low'])
  })

  test('should change priority via edit', async ({ page }) => {
    await createTodo(page, { title: 'Change my priority', priority: 'low' })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Change my priority' }).first()
    await expect(todoCard).toContainText('low')

    // Edit
    await page.getByRole('button', { name: /Edit: Change my priority/i }).click()
    await page.locator('#edit-priority').selectOption('high')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.locator('[class*="rounded-xl"]').filter({ hasText: 'Change my priority' }).first()).toContainText('high', { timeout: 5000 })
  })

  test('should filter by priority', async ({ page }) => {
    await createTodo(page, { title: 'High item', priority: 'high' })
    await createTodo(page, { title: 'Low item', priority: 'low' })

    // Filter to high only
    await page.locator('select[aria-label="Filter by priority"]').selectOption('high')

    await expect(page.locator('main')).toContainText('High item')
    await expect(page.locator('main')).not.toContainText('Low item')

    // Reset filter
    await page.getByText('Clear All').click()
    await expect(page.locator('main')).toContainText('Low item')
  })
})
