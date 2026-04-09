import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, createTag, futureDate } from './helpers'

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

test.describe('Search & Filtering', () => {
  test('search by todo title in real time', async ({ page }) => {
    await createTodo(page, { title: 'Buy groceries' })
    await createTodo(page, { title: 'Write report' })

    const searchInput = page.getByPlaceholder('Search todos, tags, subtasks...')
    await searchInput.fill('groceries')

    // Debounce wait
    await expect(page.locator('main')).toContainText('Buy groceries', { timeout: 3000 })
    await expect(page.locator('main')).not.toContainText('Write report')
  })

  test('search is case insensitive', async ({ page }) => {
    await createTodo(page, { title: 'Important MEETING' })

    const searchInput = page.getByPlaceholder('Search todos, tags, subtasks...')
    await searchInput.fill('important meeting')

    await expect(page.locator('main')).toContainText('Important MEETING', { timeout: 3000 })
  })

  test('search by tag name', async ({ page }) => {
    await createTag(page, { name: 'urgent', color: '#FF0000' })
    await createTodo(page, { title: 'Tagged task' })

    // Assign tag to todo
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Tagged task' }).first()
    await todoCard.getByRole('button', { name: /Edit/ }).click()
    await page.locator('.fixed').filter({ hasText: 'Edit Todo' }).locator('button').filter({ hasText: 'urgent' }).click()
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await createTodo(page, { title: 'Unrelated task' })

    const searchInput = page.getByPlaceholder('Search todos, tags, subtasks...')
    await searchInput.fill('urgent')

    await expect(page.locator('main')).toContainText('Tagged task', { timeout: 3000 })
    await expect(page.locator('main')).not.toContainText('Unrelated task')
  })

  test('filter by priority', async ({ page }) => {
    await createTodo(page, { title: 'High priority task', priority: 'high' })
    await createTodo(page, { title: 'Low priority task', priority: 'low' })

    await page.getByLabel('Filter by priority').selectOption('high')

    await expect(page.locator('main')).toContainText('High priority task')
    await expect(page.locator('main')).not.toContainText('Low priority task')
  })

  test('filter by tag', async ({ page }) => {
    await createTag(page, { name: 'work', color: '#0000FF' })
    await createTodo(page, { title: 'Work task' })
    await createTodo(page, { title: 'Other task' })

    // Assign work tag
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Work task' }).first()
    await todoCard.getByRole('button', { name: /Edit/ }).click()
    await page.locator('.fixed').filter({ hasText: 'Edit Todo' }).locator('button').filter({ hasText: 'work' }).click()
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await page.getByLabel('Filter by tag').selectOption({ label: 'work' })

    await expect(page.locator('main')).toContainText('Work task', { timeout: 3000 })
    await expect(page.locator('main')).not.toContainText('Other task')
  })

  test('combine search and filter criteria', async ({ page }) => {
    await createTodo(page, { title: 'Urgent meeting', priority: 'high' })
    await createTodo(page, { title: 'Urgent email', priority: 'low' })
    await createTodo(page, { title: 'Normal task', priority: 'high' })

    // Filter by high priority
    await page.getByLabel('Filter by priority').selectOption('high')
    // Then search for "urgent"
    await page.getByPlaceholder('Search todos, tags, subtasks...').fill('urgent')

    await expect(page.locator('main')).toContainText('Urgent meeting', { timeout: 3000 })
    await expect(page.locator('main')).not.toContainText('Urgent email')
    await expect(page.locator('main')).not.toContainText('Normal task')
  })

  test('clear all filters', async ({ page }) => {
    await createTodo(page, { title: 'Task A', priority: 'high' })
    await createTodo(page, { title: 'Task B', priority: 'low' })

    await page.getByLabel('Filter by priority').selectOption('high')
    await expect(page.locator('main')).not.toContainText('Task B')

    await page.getByText('Clear All').click()

    await expect(page.locator('main')).toContainText('Task A')
    await expect(page.locator('main')).toContainText('Task B')
  })
})
