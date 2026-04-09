import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, createTag, addSubtask } from './helpers'

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

test.describe('Export & Import', () => {
  test('export current todos', async ({ page }) => {
    await createTodo(page, { title: 'Export Test Todo', priority: 'high' })

    // Click export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '📤 Export' }).click(),
    ])

    const fileName = download.suggestedFilename()
    expect(fileName).toMatch(/todo-export-.*\.json/)

    // Read and verify content
    const content = await (await download.createReadStream()).toArray()
    const text = Buffer.concat(content).toString()
    const data = JSON.parse(text)

    expect(data.version).toBe(1)
    expect(data.todos).toHaveLength(1)
    expect(data.todos[0].title).toBe('Export Test Todo')
    expect(data.todos[0].priority).toBe('high')
  })

  test('import a valid export file', async ({ page }) => {
    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [
        { title: 'Imported Todo 1', priority: 'high', completed: false, subtasks: [], tags: [] },
        { title: 'Imported Todo 2', priority: 'low', completed: false, subtasks: [], tags: [] },
      ],
      tags: [],
    }

    // Create a temporary file for import
    const buffer = Buffer.from(JSON.stringify(exportData))
    const fileInput = page.locator('input[type="file"][accept=".json"]')
    await fileInput.setInputFiles({
      name: 'test-import.json',
      mimeType: 'application/json',
      buffer,
    })

    // Wait for import status
    await expect(page.locator('text=Imported 2 todos')).toBeVisible({ timeout: 5000 })

    // Verify todos appear
    await expect(page.locator('main')).toContainText('Imported Todo 1')
    await expect(page.locator('main')).toContainText('Imported Todo 2')
  })

  test('import preserves subtasks and tag relationships', async ({ page }) => {
    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [
        {
          title: 'Complex Todo',
          priority: 'medium',
          completed: false,
          subtasks: [{ title: 'Sub A', completed: false, position: 0 }, { title: 'Sub B', completed: true, position: 1 }],
          tags: ['imported-tag'],
        },
      ],
      tags: [{ name: 'imported-tag', color: '#FF5500' }],
    }

    const buffer = Buffer.from(JSON.stringify(exportData))
    const fileInput = page.locator('input[type="file"][accept=".json"]')
    await fileInput.setInputFiles({
      name: 'complex-import.json',
      mimeType: 'application/json',
      buffer,
    })

    await expect(page.locator('text=Imported 1 todos')).toBeVisible({ timeout: 5000 })

    // Check todo appears
    await expect(page.locator('main')).toContainText('Complex Todo')

    // Expand subtasks
    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Complex Todo' }).first()
    await todoCard.getByRole('button', { name: /Expand subtasks/ }).click()
    await expect(todoCard).toContainText('Sub A')
    await expect(todoCard).toContainText('Sub B')

    // Check tag badge
    await expect(todoCard).toContainText('imported-tag')
  })

  test('import invalid JSON shows error', async ({ page }) => {
    const buffer = Buffer.from('not valid json {{{')
    const fileInput = page.locator('input[type="file"][accept=".json"]')
    await fileInput.setInputFiles({
      name: 'bad-import.json',
      mimeType: 'application/json',
      buffer,
    })

    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 })
  })

  test('import wrong version shows error', async ({ page }) => {
    const buffer = Buffer.from(JSON.stringify({ version: 99, todos: [] }))
    const fileInput = page.locator('input[type="file"][accept=".json"]')
    await fileInput.setInputFiles({
      name: 'wrong-version.json',
      mimeType: 'application/json',
      buffer,
    })

    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 })
  })
})
