import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, futureDate } from './helpers'

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

test.describe('Template System', () => {
  test('save a todo as template and use it', async ({ page }) => {
    // Fill form
    await page.locator('#create-title').fill('Weekly Report')
    await page.locator('#create-priority').selectOption('high')

    // Click Save as Template
    await page.getByRole('button', { name: /Save as Template/ }).click()
    const saveModal = page.locator('.fixed').filter({ hasText: 'Save as Template' })
    await expect(saveModal).toBeVisible()

    // Fill template details
    await saveModal.getByPlaceholder('e.g. Weekly Report').fill('Weekly Report Template')
    await saveModal.getByPlaceholder('Optional description').fill('Report template for work')
    await saveModal.getByPlaceholder('e.g. Work, Personal').fill('Work')

    // Save
    await saveModal.getByRole('button', { name: 'Save Template' }).click()
    await expect(saveModal).not.toBeVisible({ timeout: 3000 })

    // Open template manager
    await page.getByRole('button', { name: /Templates/ }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Template Manager' }).locator('> div')
    await expect(modal).toBeVisible()

    // Verify template shows
    await expect(modal).toContainText('Weekly Report Template')
    await expect(modal).toContainText('Report template for work')
    await expect(modal).toContainText('Work')

    // Use the template
    await modal.getByRole('button', { name: 'Use' }).click()

    // Verify todo created
    await expect(page.locator('main')).toContainText('Weekly Report', { timeout: 5000 })
  })

  test('edit and delete template', async ({ context, page }) => {
    // Create a template via API
    await context.request.post('http://localhost:3000/api/templates', {
      data: {
        name: 'Test Template',
        title_template: 'Test Todo',
        priority: 'medium',
        category: 'Personal',
      },
    })

    // Reload to get fresh template list
    await page.reload()
    await expect(page.locator('header')).toContainText(username)

    // Open template manager
    await page.getByRole('button', { name: /Templates/ }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Template Manager' }).locator('> div')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Test Template')

    // Edit template
    await modal.getByRole('button', { name: 'Edit' }).click()
    await modal.getByPlaceholder('Template name').fill('Updated Template')
    await modal.getByRole('button', { name: 'Update' }).click()

    await expect(modal).toContainText('Updated Template')

    // Delete template
    await modal.getByRole('button', { name: 'Delete' }).click()
    await expect(modal).not.toContainText('Updated Template')
  })

  test('template preserves priority and recurring settings', async ({ context, page }) => {
    // Create template with specific settings
    await context.request.post('http://localhost:3000/api/templates', {
      data: {
        name: 'Recurring Template',
        title_template: 'Daily Standup',
        priority: 'high',
        is_recurring: true,
        recurrence_pattern: 'daily',
        reminder_minutes: 15,
      },
    })

    await page.reload()
    await expect(page.locator('header')).toContainText(username)

    // Open template manager and verify settings
    await page.getByRole('button', { name: /Templates/ }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Template Manager' }).locator('> div')
    await expect(modal).toBeVisible()

    await expect(modal).toContainText('high')
    await expect(modal).toContainText('daily')

    // Use the template
    await modal.getByRole('button', { name: 'Use' }).click()

    // Verify todo was created with correct priority
    await expect(page.locator('main')).toContainText('Daily Standup', { timeout: 5000 })
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Daily Standup' }).first()
    await expect(todoCard.locator('span').filter({ hasText: 'high' })).toBeVisible()
  })

  test('template with subtasks creates todo with subtasks', async ({ context, page }) => {
    await context.request.post('http://localhost:3000/api/templates', {
      data: {
        name: 'Subtask Template',
        title_template: 'Sprint Planning',
        priority: 'medium',
        subtasks_json: JSON.stringify([{ title: 'Review backlog' }, { title: 'Estimate stories' }]),
      },
    })

    await page.reload()
    await expect(page.locator('header')).toContainText(username)

    await page.getByRole('button', { name: /Templates/ }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Template Manager' }).locator('> div')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('2 subtasks')

    await modal.getByRole('button', { name: 'Use' }).click()
    await expect(page.locator('main')).toContainText('Sprint Planning', { timeout: 5000 })

    // Expand subtasks
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Sprint Planning' }).first()
    await todoCard.getByRole('button', { name: /Expand subtasks/ }).click()
    await expect(todoCard).toContainText('Review backlog')
    await expect(todoCard).toContainText('Estimate stories')
  })

  test('category filtering works in template browser', async ({ context, page }) => {
    await context.request.post('http://localhost:3000/api/templates', {
      data: { name: 'Work T1', title_template: 'Work Task', priority: 'high', category: 'Work' },
    })
    await context.request.post('http://localhost:3000/api/templates', {
      data: { name: 'Personal T1', title_template: 'Personal Task', priority: 'low', category: 'Personal' },
    })

    await page.reload()
    await expect(page.getByRole('button', { name: /Templates/ })).toBeVisible()

    await page.getByRole('button', { name: /Templates/ }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Template Manager' }).locator('> div')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Work T1')
    await expect(modal).toContainText('Personal T1')

    // Filter by Work
    await modal.getByLabel('Filter templates by category').selectOption('Work')
    await expect(modal).toContainText('Work T1')
    await expect(modal).not.toContainText('Personal T1')

    // Filter by Personal
    await modal.getByLabel('Filter templates by category').selectOption('Personal')
    await expect(modal).not.toContainText('Work T1')
    await expect(modal).toContainText('Personal T1')
  })
})
