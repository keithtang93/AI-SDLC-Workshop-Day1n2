import { type Page, expect } from '@playwright/test'

export class TodoHelper {
  constructor(private page: Page) {}

  async registerAndLogin(username: string) {
    await this.page.goto('/login')
    await this.page.fill('input[name="username"]', username)
    await this.page.click('button:has-text("Register")')
    await this.page.waitForURL('/')
  }

  async login(username: string) {
    await this.page.goto('/login')
    await this.page.fill('input[name="username"]', username)
    await this.page.click('button:has-text("Login")')
    await this.page.waitForURL('/')
  }

  async createTodo(title: string, options?: { priority?: string; dueDate?: string }) {
    await this.page.fill('input[placeholder="What needs to be done?"]', title)
    if (options?.priority) {
      await this.page.selectOption('select[name="priority"]', options.priority)
    }
    if (options?.dueDate) {
      await this.page.fill('input[type="datetime-local"]', options.dueDate)
    }
    await this.page.click('button:has-text("Add")')
    await expect(this.page.locator(`text=${title}`)).toBeVisible({ timeout: 5000 })
  }

  async addSubtask(todoTitle: string, subtaskTitle: string) {
    const todoItem = this.page.locator('div.p-3').filter({ hasText: todoTitle })
    await todoItem.locator('button:has-text("Subtasks")').click()
    await todoItem.locator('input[placeholder="Add subtask..."]').fill(subtaskTitle)
    await todoItem.locator('button:has-text("Add")').click()
    await expect(todoItem.locator(`text=${subtaskTitle}`)).toBeVisible()
  }

  async createTag(name: string, color?: string) {
    await this.page.click('button:has-text("+ Manage Tags")')
    await this.page.fill('input[placeholder="Tag name"]', name)
    if (color) {
      await this.page.fill('input[type="color"]', color)
    }
    await this.page.click('button:has-text("Create Tag")')
    await expect(this.page.locator(`text=${name}`)).toBeVisible()
  }

  async logout() {
    await this.page.click('button:has-text("Logout")')
    await this.page.waitForURL('/login')
  }
}
