import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Tag System', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('tag_user_' + Date.now())
  })

  test('should create a tag via the Manage Tags modal', async ({ page }) => {
    await page.click('button:has-text("+ Manage Tags")')
    await expect(page.locator('h2:has-text("Manage Tags")')).toBeVisible()
    await page.fill('input[placeholder="Tag name"]', 'Work')
    await page.click('button:has-text("Create Tag")')
    await expect(page.locator('div[role="dialog"] >> text=Work')).toBeVisible()
  })

  test('should assign a tag to a todo', async ({ page }) => {
    // First create a tag
    await page.click('button:has-text("+ Manage Tags")')
    await page.fill('input[placeholder="Tag name"]', 'Urgent')
    await page.click('button:has-text("Create Tag")')
    await expect(page.locator('div[role="dialog"] >> text=Urgent')).toBeVisible()
    // Close modal by clicking overlay
    await page.locator('div[role="dialog"]').locator('..').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 3000 })
    // Now create a todo - tag buttons should appear below the form
    await page.fill('input[placeholder="What needs to be done?"]', 'Tagged task')
    // Click the tag button to assign it
    const tagBtn = page.locator('button:has-text("Urgent")').first()
    await tagBtn.click()
    await page.click('button:has-text("Add")')
    // Verify the tag badge appears on the todo
    await expect(page.locator('text=Tagged task')).toBeVisible()
    // The tag should be visible as a badge on the todo item
    const todoBadge = page.locator('span:has-text("Urgent")').first()
    await expect(todoBadge).toBeVisible()
  })

  test('should filter todos by tag', async ({ page }) => {
    // Create two tags
    await page.click('button:has-text("+ Manage Tags")')
    await page.fill('input[placeholder="Tag name"]', 'Home')
    await page.click('button:has-text("Create Tag")')
    await expect(page.locator('div[role="dialog"] >> text=Home')).toBeVisible()
    await page.locator('div[role="dialog"]').locator('..').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 3000 })
    // Create a tagged todo
    await page.fill('input[placeholder="What needs to be done?"]', 'Home chore')
    await page.locator('button:has-text("Home")').first().click()
    await page.click('button:has-text("Add")')
    await expect(page.locator('text=Home chore')).toBeVisible()
    // Create an untagged todo
    await helper.createTodo('Untagged item')
    // Filter by the "Home" tag
    const tagFilter = page.locator('select[aria-label="Filter by tag"]')
    await tagFilter.selectOption({ label: 'Home' })
    await expect(page.locator('text=Home chore')).toBeVisible()
    await expect(page.locator('text=Untagged item')).not.toBeVisible({ timeout: 3000 })
  })

  test('should delete a tag', async ({ page }) => {
    await page.click('button:has-text("+ Manage Tags")')
    await page.fill('input[placeholder="Tag name"]', 'Temporary')
    await page.click('button:has-text("Create Tag")')
    await expect(page.locator('div[role="dialog"] >> text=Temporary')).toBeVisible()
    // Delete the tag
    await page.locator('div[role="dialog"] button:has-text("Delete")').first().click()
    await expect(page.locator('div[role="dialog"] >> text=Temporary')).not.toBeVisible({ timeout: 3000 })
  })

  test('should edit a tag name', async ({ page }) => {
    await page.click('button:has-text("+ Manage Tags")')
    await page.fill('input[placeholder="Tag name"]', 'OldName')
    await page.click('button:has-text("Create Tag")')
    await expect(page.locator('div[role="dialog"] >> text=OldName')).toBeVisible()
    // Click edit
    await page.locator('div[role="dialog"] button:has-text("Edit")').first().click()
    // Clear and type new name
    const editInput = page.locator('div[role="dialog"] input[type="text"]').nth(1)
    await editInput.fill('NewName')
    await page.locator('div[role="dialog"] button:has-text("Update")').click()
    await expect(page.locator('div[role="dialog"] >> text=NewName')).toBeVisible()
    await expect(page.locator('div[role="dialog"] >> text=OldName')).not.toBeVisible()
  })
})
