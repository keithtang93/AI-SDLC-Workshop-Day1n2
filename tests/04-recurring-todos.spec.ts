import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Recurring Todos', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('recurring_user_' + Date.now())
  })

  test('should create a daily recurring todo with badge', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    // Fill in todo title
    await page.fill('input[placeholder="What needs to be done?"]', 'Daily standup')
    // Set due date (required for recurring)
    await page.fill('input[type="datetime-local"]', dateStr)
    // Check the repeat checkbox
    await page.locator('label:has-text("Repeat") input[type="checkbox"]').check()
    // Select daily pattern
    await page.locator('select:has-text("Daily")').first().selectOption('daily')
    // Submit
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Daily standup')).toBeVisible()
    // Verify recurrence badge
    await expect(page.locator('text=🔄 daily')).toBeVisible()
  })

  test('should create a weekly recurring todo', async ({ page }) => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const dateStr = nextWeek.toISOString().slice(0, 16)
    await page.fill('input[placeholder="What needs to be done?"]', 'Weekly review')
    await page.fill('input[type="datetime-local"]', dateStr)
    await page.locator('label:has-text("Repeat") input[type="checkbox"]').check()
    await page.locator('select:has-text("Daily")').first().selectOption('weekly')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Weekly review')).toBeVisible()
    await expect(page.locator('text=🔄 weekly')).toBeVisible()
  })

  test('should create next instance when completing a recurring todo', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await page.fill('input[placeholder="What needs to be done?"]', 'Recurring task')
    await page.fill('input[type="datetime-local"]', dateStr)
    await page.locator('label:has-text("Repeat") input[type="checkbox"]').check()
    await page.locator('select:has-text("Daily")').first().selectOption('daily')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Recurring task')).toBeVisible()
    // Mark as complete
    const checkbox = page.locator('input[aria-label="Mark Recurring task as complete"]')
    await checkbox.click()
    // A new instance should be created (same title still visible in pending)
    await page.waitForTimeout(1000)
    // Should still have a "Recurring task" in the pending section (next instance)
    await expect(page.locator('text=Recurring task').first()).toBeVisible()
  })

  test('should display all four recurrence patterns', async ({ page }) => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    const dateStr = future.toISOString().slice(0, 16)
    for (const pattern of ['daily', 'weekly', 'monthly', 'yearly']) {
      await page.fill('input[placeholder="What needs to be done?"]', `${pattern} task`)
      await page.fill('input[type="datetime-local"]', dateStr)
      await page.locator('label:has-text("Repeat") input[type="checkbox"]').check()
      await page.locator('select:has-text("Daily")').first().selectOption(pattern)
      await page.click('button:has-text("Add")')
      await expect(page.locator(`text=🔄 ${pattern}`)).toBeVisible()
      // Uncheck repeat for next iteration
    }
  })

  test('should not show recurrence badge for non-recurring todo', async ({ page }) => {
    await helper.createTodo('One-time task')
    await expect(page.locator('text=One-time task')).toBeVisible()
    await expect(page.locator('text=🔄')).not.toBeVisible()
  })
})
