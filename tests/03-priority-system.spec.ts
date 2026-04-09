import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Priority System', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('priority_user_' + Date.now())
  })

  test('should create todos with different priorities and display badges', async ({ page }) => {
    await helper.createTodo('High task', { priority: 'high' })
    await helper.createTodo('Low task', { priority: 'low' })
    // Verify priority badges are displayed
    const highBadge = page.locator('span:has-text("high")').first()
    await expect(highBadge).toBeVisible()
    const lowBadge = page.locator('span:has-text("low")').first()
    await expect(lowBadge).toBeVisible()
  })

  test('should default to medium priority', async ({ page }) => {
    await helper.createTodo('Default priority task')
    const mediumBadge = page.locator('span:has-text("medium")').first()
    await expect(mediumBadge).toBeVisible()
  })

  test('should filter todos by priority', async ({ page }) => {
    await helper.createTodo('Important', { priority: 'high' })
    await helper.createTodo('Routine', { priority: 'low' })
    // Filter by high priority
    const priorityFilter = page.locator('select[aria-label="Filter by priority"]')
    await priorityFilter.selectOption('high')
    await expect(page.locator('text=Important')).toBeVisible()
    await expect(page.locator('text=Routine')).not.toBeVisible({ timeout: 3000 })
  })

  test('should edit priority of an existing todo', async ({ page }) => {
    await helper.createTodo('Edit priority', { priority: 'low' })
    const editBtn = page.locator('button[aria-label="Edit todo"]').first()
    await editBtn.click()
    await expect(page.locator('text=Edit Todo')).toBeVisible()
    const prioritySelect = page.locator('div[role="dialog"] select').first()
    await prioritySelect.selectOption('high')
    await page.click('button:has-text("Update")')
    // Verify the priority changed
    await expect(page.locator('span:has-text("high")').first()).toBeVisible()
  })

  test('should sort todos by priority (high before low)', async ({ page }) => {
    await helper.createTodo('Low item', { priority: 'low' })
    await helper.createTodo('High item', { priority: 'high' })
    // High-priority should appear before low-priority in the pending section
    const todoTitles = page.locator('span.text-sm.font-medium:not(.line-through)')
    const titles = await todoTitles.allTextContents()
    const highIndex = titles.indexOf('High item')
    const lowIndex = titles.indexOf('Low item')
    expect(highIndex).toBeLessThan(lowIndex)
  })
})
