import { test, expect } from '@playwright/test'
import { setupAuth, resetTestData, createTodo, createTag } from './helpers'

test.describe('Tag System', () => {
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

  test('should create a tag', async ({ page }) => {
    await createTag(page, { name: 'Work', color: '#3B82F6' })

    // Verify tag exists in tag manager
    await page.getByRole('button', { name: /Tags/i }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Tag Manager' }).locator('> div')
    await expect(modal.locator('span').filter({ hasText: 'Work' })).toBeVisible()
    await modal.getByRole('button', { name: 'Close' }).click()
  })

  test('should assign a tag to a todo', async ({ page }) => {
    await createTag(page, { name: 'Personal', color: '#EF4444' })
    await createTodo(page, { title: 'Tagged task' })

    // Edit the existing todo to assign tag
    await page.getByRole('button', { name: /Edit: Tagged task/i }).click()
    const editModal = page.locator('.fixed').filter({ hasText: 'Edit Todo' }).locator('> div')
    await editModal.getByRole('button', { name: 'Personal' }).click()
    await editModal.getByRole('button', { name: 'Save Changes' }).click()

    const todoCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Tagged task' }).first()
    await expect(todoCard).toContainText('Personal', { timeout: 5000 })
  })

  test('should filter by tag', async ({ page }) => {
    await createTag(page, { name: 'FilterTag', color: '#10B981' })
    await createTodo(page, { title: 'Has tag' })
    await createTodo(page, { title: 'No tag' })

    // Assign tag to first todo via edit modal
    await page.getByRole('button', { name: /Edit: Has tag/i }).click()
    const editModal = page.locator('.fixed').filter({ hasText: 'Edit Todo' }).locator('> div')
    await editModal.getByRole('button', { name: 'FilterTag' }).click()
    await editModal.getByRole('button', { name: 'Save Changes' }).click()

    // Filter by tag using the select dropdown
    await page.locator('select[aria-label="Filter by tag"]').selectOption({ label: 'FilterTag' })

    await expect(page.locator('main')).toContainText('Has tag')
    await expect(page.locator('main')).not.toContainText('No tag', { timeout: 5000 })
  })

  test('should edit a tag name and color', async ({ page }) => {
    await createTag(page, { name: 'OldName', color: '#3B82F6' })

    // Open tag manager and edit
    await page.getByRole('button', { name: /Tags/i }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Tag Manager' }).locator('> div')
    await modal.getByRole('button', { name: 'Edit' }).click()

    await modal.getByPlaceholder('Tag name').fill('NewName')
    await modal.getByRole('button', { name: 'Update' }).click()

    await expect(modal.locator('span').filter({ hasText: 'NewName' })).toBeVisible({ timeout: 5000 })
    await modal.getByRole('button', { name: 'Close' }).click()
  })

  test('should delete a tag', async ({ page }) => {
    await createTag(page, { name: 'DeleteMe', color: '#F59E0B' })

    await page.getByRole('button', { name: /Tags/i }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Tag Manager' }).locator('> div')
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(modal.getByText('No tags yet')).toBeVisible({ timeout: 5000 })
    await modal.getByRole('button', { name: 'Close' }).click()
  })

  test('should reject duplicate tag name', async ({ page }) => {
    await createTag(page, { name: 'Unique', color: '#3B82F6' })

    // Try to create same name again
    await page.getByRole('button', { name: /Tags/i }).click()
    const modal = page.locator('.fixed').filter({ hasText: 'Tag Manager' }).locator('> div')
    await modal.getByPlaceholder('Tag name').fill('Unique')
    await modal.locator('input[type="color"]').fill('#EF4444')
    await modal.getByRole('button', { name: 'Add', exact: true }).click()

    // The tag list should still only have one 'Unique' tag
    const tagItems = modal.locator('span[class*="rounded-full"]').filter({ hasText: 'Unique' })
    await expect(tagItems).toHaveCount(1)

    await modal.getByRole('button', { name: 'Close' }).click()
  })
})
