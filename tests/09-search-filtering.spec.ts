import { test, expect } from './fixtures'
import { TodoHelper } from './helpers'

test.describe('Search & Filtering', () => {
  let helper: TodoHelper

  test.beforeEach(async ({ page }) => {
    helper = new TodoHelper(page)
    await helper.registerAndLogin('search_user_' + Date.now())
    // Seed some todos for filtering
    await helper.createTodo('Buy groceries', { priority: 'high' })
    await helper.createTodo('Clean house', { priority: 'medium' })
    await helper.createTodo('Read book', { priority: 'low' })
  })

  test('should search todos by keyword', async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search todos"]')
    await searchInput.fill('groceries')
    // Wait for debounced search
    await page.waitForTimeout(500)
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Clean house')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Read book')).not.toBeVisible({ timeout: 3000 })
  })

  test('should filter by priority', async ({ page }) => {
    const priorityFilter = page.locator('select[aria-label="Filter by priority"]')
    await priorityFilter.selectOption('high')
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Clean house')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Read book')).not.toBeVisible({ timeout: 3000 })
  })

  test('should filter by completion status', async ({ page }) => {
    // Complete one todo
    const checkbox = page.locator('input[aria-label="Mark Buy groceries as complete"]')
    await checkbox.click()
    await page.waitForTimeout(500)
    // Open advanced filters
    await page.click('button:has-text("Advanced")')
    // Filter to show completed only
    const completionFilter = page.locator('select[aria-label="Filter by completion status"]')
    await completionFilter.selectOption('complete')
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Clean house')).not.toBeVisible({ timeout: 3000 })
  })

  test('should clear all filters', async ({ page }) => {
    // Apply a filter first
    const priorityFilter = page.locator('select[aria-label="Filter by priority"]')
    await priorityFilter.selectOption('high')
    await expect(page.locator('text=Clean house')).not.toBeVisible({ timeout: 3000 })
    // Clear all filters
    await page.click('button:has-text("Clear All")')
    // All todos should be visible again
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Clean house')).toBeVisible()
    await expect(page.locator('text=Read book')).toBeVisible()
  })

  test('should clear search with the clear button', async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search todos"]')
    await searchInput.fill('groceries')
    await page.waitForTimeout(500)
    await expect(page.locator('text=Clean house')).not.toBeVisible({ timeout: 3000 })
    // Click the clear search button
    await page.click('button:has-text("✕")')
    await page.waitForTimeout(500)
    await expect(page.locator('text=Clean house')).toBeVisible()
  })
})
