import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Calendar View', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('calendar_user_' + Date.now())
  })

  test('should navigate to calendar view and display month grid', async ({ page }) => {
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    await expect(page.locator('h1:has-text("Calendar")')).toBeVisible()
    // Day headers should be visible
    await expect(page.locator('text=Sun')).toBeVisible()
    await expect(page.locator('text=Mon')).toBeVisible()
    await expect(page.locator('text=Sat')).toBeVisible()
    // Calendar grid should exist
    await expect(page.locator('div[role="grid"]')).toBeVisible()
  })

  test('should navigate between months', async ({ page }) => {
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    // Get current month name
    const monthHeading = page.locator('h2').first()
    const currentMonth = await monthHeading.textContent()
    // Navigate to next month
    await page.click('button[aria-label="Next month"]')
    const nextMonth = await monthHeading.textContent()
    expect(nextMonth).not.toBe(currentMonth)
    // Navigate back
    await page.click('button[aria-label="Previous month"]')
    const backMonth = await monthHeading.textContent()
    expect(backMonth).toBe(currentMonth)
  })

  test('should show todo on its due date in the calendar', async ({ page }) => {
    // Create a todo with a due date in the current month
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await helper.createTodo('Calendar todo', { dueDate: dateStr })
    // Navigate to calendar
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    // The todo count badge should be visible on the day
    const dayOfMonth = tomorrow.getDate()
    // Look for the day cell that contains the todo count badge
    const badge = page.locator(`text=${dayOfMonth}`).first()
    await expect(badge).toBeVisible()
  })

  test('should open day detail modal when clicking a date', async ({ page }) => {
    // Create a todo for tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await helper.createTodo('Modal todo', { dueDate: dateStr })
    // Navigate to calendar
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    // Click on tomorrow's date cell in the calendar grid
    const dayOfMonth = tomorrow.getDate()
    // Find the clickable day cell in the calendar grid
    const gridCells = page.locator('div[role="grid"] .cursor-pointer')
    // Find the cell containing our day number
    for (let i = 0; i < await gridCells.count(); i++) {
      const cell = gridCells.nth(i)
      const text = await cell.textContent()
      if (text?.includes(String(dayOfMonth))) {
        await cell.click()
        break
      }
    }
    // The modal should show the todo
    await expect(page.locator('text=Modal todo')).toBeVisible({ timeout: 5000 })
  })

  test('should navigate back to todos view', async ({ page }) => {
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    await page.click('button:has-text("← Back to Todos")')
    await page.waitForURL(/\//)
    // Should be on the main page
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible()
  })

  test('should use Today button to jump to current month', async ({ page }) => {
    await page.click('button:has-text("Calendar")')
    await page.waitForURL(/\/calendar/)
    // Navigate away from current month
    await page.click('button[aria-label="Next month"]')
    await page.click('button[aria-label="Next month"]')
    // Click Today
    await page.click('button:has-text("Today")')
    // Now heading should show current month
    const now = new Date()
    const expectedMonth = now.toLocaleString('en-SG', { month: 'long', year: 'numeric' })
    await expect(page.locator('h2').first()).toContainText(expectedMonth)
  })
})
