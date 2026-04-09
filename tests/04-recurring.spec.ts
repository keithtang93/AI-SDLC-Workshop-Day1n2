import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, futureDate } from './helpers'

test.describe('Recurring Todos', () => {
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

  test('should create a daily recurring todo', async ({ page }) => {
    const dueDate = futureDate(24)
    await createTodo(page, { title: 'Daily standup', dueDate, recurring: 'daily' })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Daily standup' }).first()
    await expect(todoCard).toContainText('🔄')
    await expect(todoCard).toContainText('daily')
  })

  test('should create next instance when completing a recurring todo', async ({ page }) => {
    const dueDate = futureDate(24)
    await createTodo(page, { title: 'Recurring task', dueDate, recurring: 'daily', priority: 'high' })

    // Complete the recurring todo
    await page.getByRole('button', { name: /Mark complete: Recurring task/i }).click()

    // Wait for the new instance to appear — should have 2 now (1 completed + 1 new pending)
    await expect(page.locator('[class*="rounded-xl"]').filter({ hasText: 'Recurring task' })).toHaveCount(2, { timeout: 5000 })

    // New instance should be pending and have high priority
    const pendingCards = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Recurring task' }).filter({ hasText: 'high' })
    await expect(pendingCards).toHaveCount(2)
  })

  test('should create weekly recurring todo', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Weekly review', dueDate, recurring: 'weekly' })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Weekly review' }).first()
    await expect(todoCard).toContainText('weekly')
  })

  test('should create monthly recurring todo', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Monthly report', dueDate, recurring: 'monthly' })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Monthly report' }).first()
    await expect(todoCard).toContainText('monthly')
  })

  test('should create yearly recurring todo', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Annual review', dueDate, recurring: 'yearly' })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Annual review' }).first()
    await expect(todoCard).toContainText('yearly')
  })

  test('should disable recurring on existing todo', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Stop recurring', dueDate, recurring: 'daily' })

    // Edit and disable recurring
    await page.getByRole('button', { name: /Edit: Stop recurring/i }).click()
    await page.locator('#edit-recurring').uncheck()
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // Should no longer show recurring badge
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Stop recurring' }).first()
    await expect(todoCard).not.toContainText('🔄', { timeout: 5000 })
  })
})
