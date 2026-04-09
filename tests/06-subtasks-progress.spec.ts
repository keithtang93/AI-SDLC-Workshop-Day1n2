import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Subtasks & Progress', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('subtask_user_' + Date.now())
  })

  test('should expand subtasks section and add a subtask', async ({ page }) => {
    await helper.createTodo('Parent task')
    // Toggle subtasks expansion
    const expandBtn = page.locator('button[aria-label="Toggle subtasks"]').first()
    await expandBtn.click()
    // Add a subtask
    await page.fill('input[placeholder="Add subtask..."]', 'Child task 1')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Child task 1')).toBeVisible()
  })

  test('should add multiple subtasks and show progress', async ({ page }) => {
    await helper.createTodo('Multi-subtask todo')
    const expandBtn = page.locator('button[aria-label="Toggle subtasks"]').first()
    await expandBtn.click()
    // Add first subtask
    await page.fill('input[placeholder="Add subtask..."]', 'Subtask A')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Subtask A')).toBeVisible()
    // Add second subtask
    await page.fill('input[placeholder="Add subtask..."]', 'Subtask B')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Subtask B')).toBeVisible()
    // Progress should show 0/2
    await expect(page.locator('text=0/2 subtasks')).toBeVisible()
  })

  test('should toggle subtask completion and update progress', async ({ page }) => {
    await helper.createTodo('Progress task')
    const expandBtn = page.locator('button[aria-label="Toggle subtasks"]').first()
    await expandBtn.click()
    // Add two subtasks
    await page.fill('input[placeholder="Add subtask..."]', 'Sub 1')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Sub 1')).toBeVisible()
    await page.fill('input[placeholder="Add subtask..."]', 'Sub 2')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Sub 2')).toBeVisible()
    // Check the first subtask
    const subtaskCheckbox = page.locator('.ml-7 input[type="checkbox"]').first()
    await subtaskCheckbox.click()
    // Progress should now show 1/2
    await expect(page.locator('text=1/2 subtasks')).toBeVisible({ timeout: 5000 })
  })

  test('should delete a subtask', async ({ page }) => {
    await helper.createTodo('Delete subtask parent')
    const expandBtn = page.locator('button[aria-label="Toggle subtasks"]').first()
    await expandBtn.click()
    // Add a subtask
    await page.fill('input[placeholder="Add subtask..."]', 'To be deleted')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=To be deleted')).toBeVisible()
    // Click the delete button (✕)
    await page.locator('.ml-7 button:has-text("✕")').first().click()
    await expect(page.locator('text=To be deleted')).not.toBeVisible({ timeout: 5000 })
  })

  test('should show progress bar at 100% when all subtasks completed', async ({ page }) => {
    await helper.createTodo('Complete all')
    const expandBtn = page.locator('button[aria-label="Toggle subtasks"]').first()
    await expandBtn.click()
    // Add one subtask
    await page.fill('input[placeholder="Add subtask..."]', 'Only subtask')
    await page.locator('button:has-text("Add")').last().click()
    await expect(page.locator('text=Only subtask')).toBeVisible()
    // Complete it
    const subtaskCheckbox = page.locator('.ml-7 input[type="checkbox"]').first()
    await subtaskCheckbox.click()
    // Progress should show 1/1
    await expect(page.locator('text=1/1 subtasks')).toBeVisible({ timeout: 5000 })
    // Progress bar at 100% should have green color
    const progressBar = page.locator('div[role="progressbar"]')
    await expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })
})
