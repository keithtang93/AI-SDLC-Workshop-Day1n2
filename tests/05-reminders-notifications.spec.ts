import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Reminders & Notifications', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('reminder_user_' + Date.now())
  })

  test('should set a reminder on a todo and display the badge', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await page.fill('input[placeholder="What needs to be done?"]', 'Reminder task')
    await page.fill('input[type="datetime-local"]', dateStr)
    // Select "15 minutes before" reminder
    const reminderSelect = page.locator('select').last()
    await reminderSelect.selectOption('15')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Reminder task')).toBeVisible()
    // Verify reminder badge
    await expect(page.locator('text=🔔')).toBeVisible()
  })

  test('should display notification permission button', async ({ page }) => {
    // The button should say "Enable Notifications" initially
    await expect(page.locator('button:has-text("Enable Notifications"), button:has-text("Notifications On")')).toBeVisible()
  })

  test('should set different reminder intervals', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await page.fill('input[placeholder="What needs to be done?"]', 'One-hour reminder')
    await page.fill('input[type="datetime-local"]', dateStr)
    const reminderSelect = page.locator('select').last()
    await reminderSelect.selectOption('60')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=One-hour reminder')).toBeVisible()
    await expect(page.locator('text=🔔 1 hour')).toBeVisible()
  })

  test('should check notifications API returns proper response when authenticated', async ({ request, page }) => {
    // First authenticate via the page to get cookies
    const helper2 = new TodoHelper(page)
    await helper2.registerAndLogin('notif_api_' + Date.now())
    // Now the browser context has auth cookies; use page.evaluate to call the API
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/notifications/check')
      return { status: res.status, ok: res.ok }
    })
    expect(result.status).toBe(200)
  })

  test('reminder select should be disabled without a due date', async ({ page }) => {
    // The last select (reminder) should be disabled when no due date is set
    // Don't set a due date - just check the reminder select state
    const reminderSelect = page.locator('select').last()
    await expect(reminderSelect).toBeDisabled()
  })
})
