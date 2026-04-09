import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, futureDate } from './helpers'

test.describe('Reminders & Notifications', () => {
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

  test('should show notification enable button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Enable Notifications/i })).toBeVisible()
  })

  test('should set 15-minute reminder', async ({ page }) => {
    const dueDate = futureDate(24)
    await createTodo(page, { title: 'Quick reminder', dueDate, reminder: 15 })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Quick reminder' }).first()
    await expect(todoCard).toContainText('🔔')
    await expect(todoCard).toContainText('15m')
  })

  test('should set 1-hour reminder', async ({ page }) => {
    const dueDate = futureDate(24)
    await createTodo(page, { title: 'Hour reminder', dueDate, reminder: 60 })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Hour reminder' }).first()
    await expect(todoCard).toContainText('🔔')
    await expect(todoCard).toContainText('1h')
  })

  test('should set 1-day reminder', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Day reminder', dueDate, reminder: 1440 })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day reminder' }).first()
    await expect(todoCard).toContainText('🔔')
    await expect(todoCard).toContainText('1d')
  })

  test('should set 1-week reminder', async ({ page }) => {
    const dueDate = futureDate(240)
    await createTodo(page, { title: 'Week reminder', dueDate, reminder: 10080 })

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Week reminder' }).first()
    await expect(todoCard).toContainText('🔔')
    await expect(todoCard).toContainText('1w')
  })

  test('should disable reminder when no due date', async ({ page }) => {
    // The reminder select should be disabled without a due date
    await expect(page.locator('#create-reminder')).toBeDisabled()
  })

  test('should update reminder via edit', async ({ page }) => {
    const dueDate = futureDate(24)
    await createTodo(page, { title: 'Edit reminder', dueDate, reminder: 15 })

    // Edit to change reminder
    await page.getByRole('button', { name: /Edit: Edit reminder/i }).click()
    await page.locator('#edit-reminder').selectOption('60')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Edit reminder' }).first()
    await expect(todoCard).toContainText('1h', { timeout: 5000 })
  })
})
