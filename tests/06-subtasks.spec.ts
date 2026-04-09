import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, addSubtask } from './helpers'

test.describe('Subtasks & Progress', () => {
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

  test('should add a subtask to a todo', async ({ page }) => {
    await createTodo(page, { title: 'Parent task' })
    await addSubtask(page, 'Parent task', 'Child task 1')

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Parent task' }).first()
    await expect(todoCard).toContainText('Child task 1')
    await expect(todoCard).toContainText('0/1 subtasks')
  })

  test('should toggle subtask completion', async ({ page }) => {
    await createTodo(page, { title: 'Toggle parent' })
    await addSubtask(page, 'Toggle parent', 'Toggle child')

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Toggle parent' }).first()

    // Toggle subtask complete
    await todoCard.locator('[aria-label^="Toggle subtask:"]').first().click()

    await expect(todoCard).toContainText('1/1 subtasks', { timeout: 5000 })
  })

  test('should show progress bar with multiple subtasks', async ({ page }) => {
    await createTodo(page, { title: 'Progress parent' })
    await addSubtask(page, 'Progress parent', 'Sub A')
    await addSubtask(page, 'Progress parent', 'Sub B')
    await addSubtask(page, 'Progress parent', 'Sub C')

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Progress parent' }).first()
    await expect(todoCard).toContainText('0/3 subtasks')

    // Complete one subtask
    await todoCard.locator('[aria-label^="Toggle subtask:"]').first().click()
    await expect(todoCard).toContainText('1/3 subtasks', { timeout: 5000 })
  })

  test('should delete a subtask', async ({ page }) => {
    await createTodo(page, { title: 'Delete sub parent' })
    await addSubtask(page, 'Delete sub parent', 'Subtask to delete')

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Delete sub parent' }).first()

    // Hover and click delete
    await todoCard.getByRole('button', { name: /Delete subtask: Subtask to delete/i }).click()

    await expect(todoCard).not.toContainText('Subtask to delete', { timeout: 5000 })
  })

  test('should cascade delete subtasks when parent is deleted', async ({ page }) => {
    await createTodo(page, { title: 'Cascade parent' })
    await addSubtask(page, 'Cascade parent', 'Cascade child')

    // Delete the parent
    await page.getByRole('button', { name: /Delete: Cascade parent/i }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()

    await expect(page.locator('main')).not.toContainText('Cascade parent', { timeout: 5000 })
    await expect(page.locator('main')).not.toContainText('Cascade child')
  })
})
