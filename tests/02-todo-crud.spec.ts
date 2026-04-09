import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, futureDate } from './helpers'

test.describe('Todo CRUD Operations', () => {
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

  test('should create a todo with title only', async ({ page }) => {
    await createTodo(page, { title: 'Buy groceries' })
    await expect(page.locator('main')).toContainText('Buy groceries')
    await expect(page.locator('main')).toContainText('medium')
  })

  test('should create a todo with due date', async ({ page }) => {
    const dueDate = futureDate(48)
    await createTodo(page, { title: 'Doctor appointment', dueDate })
    await expect(page.locator('main')).toContainText('Doctor appointment')
    await expect(page.locator('main')).toContainText('📅')
  })

  test('should toggle todo completion', async ({ page }) => {
    await createTodo(page, { title: 'Complete task' })

    // Toggle complete
    await page.getByRole('button', { name: /Mark complete: Complete task/i }).click()

    // Should appear in completed section
    await expect(page.getByText('Completed (1)')).toBeVisible({ timeout: 5000 })
  })

  test('should toggle todo back to incomplete', async ({ page }) => {
    await createTodo(page, { title: 'Reversible task' })

    // Complete it
    await page.getByRole('button', { name: /Mark complete: Reversible task/i }).click()
    await expect(page.getByText('Completed (1)')).toBeVisible({ timeout: 5000 })

    // Uncomplete it
    await page.getByRole('button', { name: /Mark incomplete: Reversible task/i }).click()
    await expect(page.getByText('Pending (1)')).toBeVisible({ timeout: 5000 })
  })

  test('should delete a todo', async ({ page }) => {
    await createTodo(page, { title: 'Delete me' })
    await expect(page.locator('main')).toContainText('Delete me')

    await page.getByRole('button', { name: /Delete: Delete me/i }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page.locator('main')).not.toContainText('Delete me', { timeout: 5000 })
  })

  test('should edit a todo title', async ({ page }) => {
    await createTodo(page, { title: 'Original title' })

    // Open edit modal
    await page.getByRole('button', { name: /Edit: Original title/i }).click()
    await expect(page.getByText('Edit Todo')).toBeVisible()

    // Change title
    await page.locator('#edit-title').fill('Updated title')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.locator('main')).toContainText('Updated title', { timeout: 5000 })
    await expect(page.locator('main')).not.toContainText('Original title')
  })

  test('should reject empty title', async ({ page }) => {
    await page.locator('#create-title').fill('')
    await page.getByRole('button', { name: 'Add Todo' }).click()
    await expect(page.locator('main')).toContainText('Title is required')
  })

  test('should display pending count correctly', async ({ page }) => {
    await createTodo(page, { title: 'First todo' })
    await createTodo(page, { title: 'Second todo' })
    await expect(page.getByText('Pending (2)')).toBeVisible()
  })
})
