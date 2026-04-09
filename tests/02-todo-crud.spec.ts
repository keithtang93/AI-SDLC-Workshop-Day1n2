import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Todo CRUD', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('crud_user_' + Date.now())
  })

  test('should create a todo and see it in the pending section', async ({ page }) => {
    await page.fill('input[placeholder="What needs to be done?"]', 'Buy groceries')
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    const pendingSection = page.locator('text=Pending').first()
    await expect(pendingSection).toBeVisible()
  })

  test('should toggle a todo as completed', async ({ page }) => {
    await helper.createTodo('Walk the dog')
    const checkbox = page.locator('input[aria-label="Mark Walk the dog as complete"]')
    await checkbox.click()
    await expect(page.locator('text=Completed').first()).toBeVisible({ timeout: 5000 })
  })

  test('should edit a todo title and priority', async ({ page }) => {
    await helper.createTodo('Old title')
    const editBtn = page.locator('button[aria-label="Edit todo"]').first()
    await editBtn.click()
    await expect(page.locator('text=Edit Todo')).toBeVisible()
    const titleInput = page.locator('div[role="dialog"] input[type="text"]').first()
    await titleInput.fill('New title')
    const prioritySelect = page.locator('div[role="dialog"] select').first()
    await prioritySelect.selectOption('high')
    await page.click('button:has-text("Update")')
    await expect(page.locator('text=New title')).toBeVisible()
  })

  test('should delete a todo', async ({ page }) => {
    await helper.createTodo('Delete me')
    await page.locator('text=Delete me').waitFor({ state: 'visible' })
    page.once('dialog', dialog => dialog.accept())
    await page.locator('button[aria-label="Delete todo"]').first().click()
    await expect(page.locator('text=Delete me')).not.toBeVisible({ timeout: 5000 })
  })

  test('should create a todo with due date', async ({ page }) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 16)
    await helper.createTodo('Timed task', { dueDate: dateStr })
    await expect(page.locator('text=Timed task')).toBeVisible()
  })

  test('should show empty state when no todos exist', async ({ page }) => {
    await expect(page.locator('text=No pending todos')).toBeVisible()
  })
})
