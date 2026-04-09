import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Export & Import', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('export_user_' + Date.now())
  })

  test('should export todos as JSON via API', async ({ page }) => {
    await helper.createTodo('Export me', { priority: 'high' })
    // Use page.evaluate to call the export API with auth cookies
    const exportData = await page.evaluate(async () => {
      const res = await fetch('/api/todos/export?format=json')
      return res.json()
    })
    expect(exportData.version).toBe(1)
    expect(exportData.todos.length).toBeGreaterThanOrEqual(1)
    expect(exportData.todos[0].title).toBe('Export me')
  })

  test('should export todos as CSV via API', async ({ page }) => {
    await helper.createTodo('CSV export', { priority: 'low' })
    const csvText = await page.evaluate(async () => {
      const res = await fetch('/api/todos/export?format=csv')
      return res.text()
    })
    expect(csvText).toContain('CSV export')
    expect(csvText).toContain('Title')
  })

  test('should import todos from JSON data', async ({ page }) => {
    // First export to get a valid data structure
    await helper.createTodo('Original todo', { priority: 'medium' })
    const exportData = await page.evaluate(async () => {
      const res = await fetch('/api/todos/export?format=json')
      return res.json()
    })
    // Delete original todo
    page.on('dialog', dialog => dialog.accept())
    await page.locator('button[aria-label="Delete todo"]').first().click()
    await expect(page.locator('text=Original todo')).not.toBeVisible({ timeout: 5000 })
    // Import the exported data
    const result = await page.evaluate(async (data) => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    }, exportData)
    expect(result.success).toBe(true)
    // Reload and verify imported todo exists
    await page.reload()
    await expect(page.locator('text=Original todo')).toBeVisible({ timeout: 5000 })
  })

  test('should preserve todo priority during export/import', async ({ page }) => {
    await helper.createTodo('High priority task', { priority: 'high' })
    const exportData = await page.evaluate(async () => {
      const res = await fetch('/api/todos/export?format=json')
      return res.json()
    })
    // Verify the exported data has the right priority
    const exported = exportData.todos.find((t: { title: string }) => t.title === 'High priority task')
    expect(exported.priority).toBe('high')
  })

  test('should handle import with empty data gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, todos: [], subtasks: [], tags: [], todoTags: [] }),
      })
      return { status: res.status, body: await res.json() }
    })
    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
  })
})
