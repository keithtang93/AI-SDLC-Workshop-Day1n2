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
})

test.describe('Calendar View', () => {
  test('calendar loads current month', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.locator('header')).toContainText('Calendar View')

    // Should show current month/year in header
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const sgMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore', month: 'numeric' }))
    const sgYear = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore', year: 'numeric' }))
    await expect(page.locator('h2')).toContainText(monthNames[sgMonth - 1])
    await expect(page.locator('h2')).toContainText(String(sgYear))
  })

  test('navigate to previous and next months', async ({ page }) => {
    await page.goto('/calendar')

    const monthHeader = page.locator('h2').first()
    const initialText = await monthHeader.textContent()

    // Go to next month
    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(monthHeader).not.toHaveText(initialText!)

    // Go back
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(monthHeader).toHaveText(initialText!)
  })

  test('today button navigates to current month', async ({ page }) => {
    // Navigate to a different month first
    await page.goto('/calendar?month=2025-01')
    await expect(page.locator('h2').first()).toContainText('January')
    await expect(page.locator('h2').first()).toContainText('2025')

    // Click today
    await page.getByRole('button', { name: 'Go to today' }).click()

    // Now should be at current month
    const now = new Date()
    const sgYear = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore', year: 'numeric' }))
    await expect(page.locator('h2').first()).toContainText(String(sgYear))
  })

  test('todos appear on correct due dates', async ({ page }) => {
    // Create a todo with a specific due date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowStr = tomorrow.toISOString().slice(0, 16)

    await page.goto('/')
    await expect(page.locator('header')).toContainText(username)
    await createTodo(page, { title: 'Calendar Test Todo', dueDate: tomorrowStr })

    // Navigate to calendar
    await page.goto('/calendar')

    // The todo should appear somewhere in the calendar grid
    await expect(page.locator('.grid').filter({ hasText: 'Calendar Test Todo' })).toBeVisible({ timeout: 5000 })
  })

  test('holidays display on correct dates', async ({ page }) => {
    // Navigate to a month with known holidays
    await page.goto('/calendar?month=2026-12')
    await expect(page.locator('h2').first()).toContainText('December')

    // Christmas should be visible
    await expect(page.locator('text=Christmas Day')).toBeVisible({ timeout: 5000 })
  })

  test('clicking a day reveals day detail', async ({ page }) => {
    await page.goto('/calendar')

    // Click on a day cell (any day in the grid)
    const dayCell = page.locator('.grid .cursor-pointer').filter({ has: page.locator('div:text-is("15")') }).first()
    await dayCell.click()

    // Day detail panel should appear
    await expect(page.getByRole('heading', { name: /\d{4}/ }).first()).toBeVisible({ timeout: 3000 })
  })
})
