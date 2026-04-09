import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Template System', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('template_user_' + Date.now())
  })

  test('should save a todo as a template', async ({ page }) => {
    // Type a title to make the "Save as Template" button appear
    await page.fill('input[placeholder="What needs to be done?"]', 'Template source')
    await page.click('button:has-text("💾 Save as Template")')
    await expect(page.locator('h2:has-text("Save as Template")')).toBeVisible()
    await page.fill('input[placeholder="Template name"]', 'My Template')
    await page.fill('input[placeholder="Description (optional)"]', 'A test template')
    await page.fill('input[placeholder="Category (optional)"]', 'Testing')
    await page.click('button:has-text("Save Template")')
    // Verify template was saved by opening the Templates modal
    await page.click('button:has-text("📋 Templates")')
    await expect(page.locator('div[role="dialog"] >> text=My Template')).toBeVisible()
  })

  test('should create a todo from a template', async ({ page }) => {
    // First save a template
    await page.fill('input[placeholder="What needs to be done?"]', 'From template')
    await page.locator('select').first().selectOption('high')
    await page.click('button:has-text("💾 Save as Template")')
    await page.fill('input[placeholder="Template name"]', 'Reusable Task')
    await page.click('button:has-text("Save Template")')
    // Clear the title
    await page.fill('input[placeholder="What needs to be done?"]', '')
    // Open template modal and use the template
    await page.click('button:has-text("📋 Templates")')
    await expect(page.locator('div[role="dialog"] >> text=Reusable Task')).toBeVisible()
    await page.locator('div[role="dialog"] button:has-text("Use")').first().click()
    // A todo should be created from the template
    await expect(page.getByText('From template', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('should delete a template', async ({ page }) => {
    // Save a template first
    await page.fill('input[placeholder="What needs to be done?"]', 'Deletable')
    await page.click('button:has-text("💾 Save as Template")')
    await page.fill('input[placeholder="Template name"]', 'Delete Me Template')
    await page.click('button:has-text("Save Template")')
    // Open templates modal and delete
    await page.click('button:has-text("📋 Templates")')
    await expect(page.locator('div[role="dialog"] >> text=Delete Me Template')).toBeVisible()
    await page.locator('div[role="dialog"] button:has-text("Delete")').first().click()
    await expect(page.locator('div[role="dialog"] >> text=Delete Me Template')).not.toBeVisible({ timeout: 3000 })
  })

  test('should show template category badge', async ({ page }) => {
    await page.fill('input[placeholder="What needs to be done?"]', 'Categorized task')
    await page.click('button:has-text("💾 Save as Template")')
    await page.fill('input[placeholder="Template name"]', 'Cat Template')
    await page.fill('input[placeholder="Category (optional)"]', 'Productivity')
    await page.click('button:has-text("Save Template")')
    await page.click('button:has-text("📋 Templates")')
    await expect(page.locator('div[role="dialog"] >> text=Productivity')).toBeVisible()
  })

  test('should show empty template state', async ({ page }) => {
    await page.click('button:has-text("📋 Templates")')
    await expect(page.locator('text=No templates yet')).toBeVisible()
  })
})
