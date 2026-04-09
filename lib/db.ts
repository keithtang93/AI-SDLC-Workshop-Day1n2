import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { rowToTodo, rowToSubtask, rowToTemplate } from './todo-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface User {
  id: string
  username: string
  created_at: string
}

export interface Authenticator {
  id: string
  user_id: string
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string
  created_at: string
}

export interface Todo {
  id: string
  user_id: string
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  completed: boolean
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

export interface TodoRow {
  id: string
  user_id: string
  title: string
  description: string | null
  priority: string
  due_date: string | null
  completed: number
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

export interface TodoWithRelations extends Todo {
  tags: Tag[]
  subtasks: Subtask[]
}

export interface Subtask {
  id: string
  todo_id: string
  title: string
  completed: boolean
  position: number
  created_at: string
}

export interface SubtaskRow {
  id: string
  todo_id: string
  title: string
  completed: number
  position: number
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface TodoTag {
  todo_id: string
  tag_id: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  due_date_offset_days: number | null
  subtasks_json: string | null
  created_at: string
  updated_at: string
}

export interface TemplateRow {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: string
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  due_date_offset_days: number | null
  subtasks_json: string | null
  created_at: string
  updated_at: string
}

export interface Holiday {
  id: number
  date: string
  name: string
  country_code: string
}

// ─── Database Initialization ──────────────────────────────────────────────────

const dbPath = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(), 'todos.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    credential_public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    todo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    due_date_offset_days INTEGER,
    subtasks_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT 'SG'
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
`)

// ─── Helpers (imported from todo-utils.ts) ────────────────────────────────────

// ─── User DB ──────────────────────────────────────────────────────────────────

export const userDB = {
  create(username: string): User {
    const id = randomUUID()
    const created_at = new Date().toISOString()
    db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)').run(id, username, created_at)
    return { id, username, created_at }
  },

  findByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined
  },

  findById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
  },
}

// ─── Authenticator DB ─────────────────────────────────────────────────────────

export const authenticatorDB = {
  create(data: {
    user_id: string
    credential_id: string
    credential_public_key: string
    counter: number
    transports: string[]
  }): Authenticator {
    const id = randomUUID()
    const created_at = new Date().toISOString()
    const transportsJson = JSON.stringify(data.transports)
    db.prepare(
      `INSERT INTO authenticators (id, user_id, credential_id, credential_public_key, counter, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.user_id, data.credential_id, data.credential_public_key, data.counter ?? 0, transportsJson, created_at)
    return { id, user_id: data.user_id, credential_id: data.credential_id, credential_public_key: data.credential_public_key, counter: data.counter ?? 0, transports: transportsJson, created_at }
  },

  findByUserId(userId: string): Authenticator[] {
    return db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(userId) as Authenticator[]
  },

  findByCredentialId(credentialId: string): Authenticator | undefined {
    return db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Authenticator | undefined
  },

  updateCounter(id: string, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter, id)
  },
}

// ─── Todo DB ──────────────────────────────────────────────────────────────────

export const todoDB = {
  create(data: {
    user_id: string
    title: string
    description?: string | null
    priority?: Priority
    due_date?: string | null
    is_recurring?: boolean
    recurrence_pattern?: RecurrencePattern | null
    reminder_minutes?: number | null
  }): Todo {
    const id = randomUUID()
    const now = new Date().toISOString()
    const todo: TodoRow = {
      id,
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'medium',
      due_date: data.due_date ?? null,
      completed: 0,
      is_recurring: data.is_recurring ? 1 : 0,
      recurrence_pattern: data.recurrence_pattern ?? null,
      reminder_minutes: data.reminder_minutes ?? null,
      last_notification_sent: null,
      created_at: now,
      updated_at: now,
    }
    db.prepare(
      `INSERT INTO todos (id, user_id, title, description, priority, due_date, completed, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      todo.id, todo.user_id, todo.title, todo.description, todo.priority,
      todo.due_date, todo.completed, todo.is_recurring, todo.recurrence_pattern,
      todo.reminder_minutes, todo.last_notification_sent, todo.created_at, todo.updated_at
    )
    return rowToTodo(todo)
  },

  findAllByUser(userId: string): Todo[] {
    const rows = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC').all(userId) as TodoRow[]
    return rows.map(rowToTodo)
  },

  findAllByUserWithRelations(userId: string, options?: { limit?: number; offset?: number }): TodoWithRelations[] {
    const limit = options?.limit
    const offset = options?.offset ?? 0

    const query = limit != null
      ? 'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC'

    const rows = limit != null
      ? db.prepare(query).all(userId, limit, offset) as TodoRow[]
      : db.prepare(query).all(userId) as TodoRow[]

    const todos = rows.map(rowToTodo)

    if (todos.length === 0) return []

    const todoIds = todos.map(t => t.id)
    const placeholders = todoIds.map(() => '?').join(',')

    const tagRows = db.prepare(
      `SELECT t.*, tt.todo_id FROM tags t
       JOIN todo_tags tt ON t.id = tt.tag_id
       WHERE tt.todo_id IN (${placeholders})`
    ).all(...todoIds) as (Tag & { todo_id: string })[]

    const subtaskRows = db.prepare(
      `SELECT * FROM subtasks WHERE todo_id IN (${placeholders}) ORDER BY position`
    ).all(...todoIds) as SubtaskRow[]

    const tagsByTodo: Record<string, Tag[]> = {}
    for (const tag of tagRows) {
      const todoId = tag.todo_id
      if (!tagsByTodo[todoId]) tagsByTodo[todoId] = []
      tagsByTodo[todoId].push({ id: tag.id, user_id: tag.user_id, name: tag.name, color: tag.color, created_at: tag.created_at })
    }

    const subtasksByTodo: Record<string, Subtask[]> = {}
    for (const row of subtaskRows) {
      if (!subtasksByTodo[row.todo_id]) subtasksByTodo[row.todo_id] = []
      subtasksByTodo[row.todo_id].push(rowToSubtask(row))
    }

    return todos.map(todo => ({
      ...todo,
      tags: tagsByTodo[todo.id] ?? [],
      subtasks: subtasksByTodo[todo.id] ?? [],
    }))
  },

  countByUser(userId: string): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM todos WHERE user_id = ?').get(userId) as { count: number }
    return row.count
  },

  findById(id: string, userId: string): Todo | undefined {
    const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as TodoRow | undefined
    return row ? rowToTodo(row) : undefined
  },

  findByIdWithRelations(id: string, userId: string): TodoWithRelations | undefined {
    const todo = this.findById(id, userId)
    if (!todo) return undefined

    const tagRows = db.prepare(
      `SELECT t.* FROM tags t
       JOIN todo_tags tt ON t.id = tt.tag_id
       WHERE tt.todo_id = ?`
    ).all(id) as Tag[]

    const subtaskRows = db.prepare(
      'SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position'
    ).all(id) as SubtaskRow[]

    return {
      ...todo,
      tags: tagRows,
      subtasks: subtaskRows.map(rowToSubtask),
    }
  },

  update(id: string, userId: string, data: Partial<{
    title: string
    description: string | null
    priority: Priority
    due_date: string | null
    completed: boolean
    is_recurring: boolean
    recurrence_pattern: RecurrencePattern | null
    reminder_minutes: number | null
    last_notification_sent: string | null
  }>): Todo | undefined {
    const existing = this.findById(id, userId)
    if (!existing) return undefined

    const updated = {
      title: data.title ?? existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      priority: data.priority ?? existing.priority,
      due_date: data.due_date !== undefined ? data.due_date : existing.due_date,
      completed: data.completed !== undefined ? data.completed : existing.completed,
      is_recurring: data.is_recurring !== undefined ? data.is_recurring : existing.is_recurring,
      recurrence_pattern: data.recurrence_pattern !== undefined ? data.recurrence_pattern : existing.recurrence_pattern,
      reminder_minutes: data.reminder_minutes !== undefined ? data.reminder_minutes : existing.reminder_minutes,
      last_notification_sent: data.last_notification_sent !== undefined ? data.last_notification_sent : existing.last_notification_sent,
      updated_at: new Date().toISOString(),
    }

    db.prepare(
      `UPDATE todos SET title = ?, description = ?, priority = ?, due_date = ?,
       completed = ?, is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?,
       last_notification_sent = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      updated.title, updated.description, updated.priority, updated.due_date,
      updated.completed ? 1 : 0, updated.is_recurring ? 1 : 0, updated.recurrence_pattern,
      updated.reminder_minutes, updated.last_notification_sent, updated.updated_at,
      id, userId
    )

    return this.findById(id, userId)
  },

  remove(id: string, userId: string): boolean {
    const result = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId)
    return result.changes > 0
  },

  findDueReminders(userId: string, nowISO: string): Todo[] {
    const rows = db.prepare(
      `SELECT * FROM todos
       WHERE user_id = ? AND completed = 0 AND reminder_minutes IS NOT NULL
       AND due_date IS NOT NULL AND last_notification_sent IS NULL`
    ).all(userId) as TodoRow[]
    return rows.map(rowToTodo).filter(todo => {
      if (!todo.due_date || !todo.reminder_minutes) return false
      const dueTime = new Date(todo.due_date).getTime()
      const reminderTime = dueTime - todo.reminder_minutes * 60 * 1000
      const now = new Date(nowISO).getTime()
      return now >= reminderTime && now < dueTime
    })
  },
}

// ─── Subtask DB ───────────────────────────────────────────────────────────────

export const subtaskDB = {
  create(data: { todo_id: string; title: string }): Subtask {
    const id = randomUUID()
    const created_at = new Date().toISOString()
    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM subtasks WHERE todo_id = ?').get(data.todo_id) as { maxPos: number | null }
    const position = (maxPos.maxPos ?? -1) + 1
    db.prepare(
      'INSERT INTO subtasks (id, todo_id, title, completed, position, created_at) VALUES (?, ?, ?, 0, ?, ?)'
    ).run(id, data.todo_id, data.title, position, created_at)
    return { id, todo_id: data.todo_id, title: data.title, completed: false, position, created_at }
  },

  findByTodoId(todoId: string): Subtask[] {
    const rows = db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position').all(todoId) as SubtaskRow[]
    return rows.map(rowToSubtask)
  },

  findById(id: string): Subtask | undefined {
    const row = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined
    return row ? rowToSubtask(row) : undefined
  },

  update(id: string, data: Partial<{ title: string; completed: boolean }>): Subtask | undefined {
    const existing = this.findById(id)
    if (!existing) return undefined
    const title = data.title ?? existing.title
    const completed = data.completed !== undefined ? data.completed : existing.completed
    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(title, completed ? 1 : 0, id)
    return { ...existing, title, completed }
  },

  remove(id: string): boolean {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
    return result.changes > 0
  },
}

// ─── Tag DB ───────────────────────────────────────────────────────────────────

export const tagDB = {
  create(data: { user_id: string; name: string; color?: string }): Tag {
    const id = randomUUID()
    const created_at = new Date().toISOString()
    const color = data.color ?? '#3B82F6'
    db.prepare('INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)').run(id, data.user_id, data.name, color, created_at)
    return { id, user_id: data.user_id, name: data.name, color, created_at }
  },

  findAllByUser(userId: string): Tag[] {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name').all(userId) as Tag[]
  },

  findById(id: string, userId: string): Tag | undefined {
    return db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Tag | undefined
  },

  findByName(userId: string, name: string): Tag | undefined {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').get(userId, name) as Tag | undefined
  },

  update(id: string, userId: string, data: Partial<{ name: string; color: string }>): Tag | undefined {
    const existing = this.findById(id, userId)
    if (!existing) return undefined
    const name = data.name ?? existing.name
    const color = data.color ?? existing.color
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, id, userId)
    return { ...existing, name, color }
  },

  remove(id: string, userId: string): boolean {
    const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId)
    return result.changes > 0
  },
}

// ─── TodoTag DB ───────────────────────────────────────────────────────────────

export const todoTagDB = {
  add(todoId: string, tagId: string): void {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId)
  },

  remove(todoId: string, tagId: string): boolean {
    const result = db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId)
    return result.changes > 0
  },

  findByTodoId(todoId: string): Tag[] {
    return db.prepare(
      'SELECT t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?'
    ).all(todoId) as Tag[]
  },

  setTagsForTodo(todoId: string, tagIds: string[]): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId)
    const insert = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)')
    for (const tagId of tagIds) {
      insert.run(todoId, tagId)
    }
  },
}

// ─── Template DB ──────────────────────────────────────────────────────────────

export const templateDB = {
  create(data: {
    user_id: string
    name: string
    description?: string | null
    category?: string | null
    title_template: string
    priority?: Priority
    is_recurring?: boolean
    recurrence_pattern?: RecurrencePattern | null
    reminder_minutes?: number | null
    due_date_offset_days?: number | null
    subtasks_json?: string | null
  }): Template {
    const id = randomUUID()
    const now = new Date().toISOString()
    const row: TemplateRow = {
      id,
      user_id: data.user_id,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      title_template: data.title_template,
      priority: data.priority ?? 'medium',
      is_recurring: data.is_recurring ? 1 : 0,
      recurrence_pattern: data.recurrence_pattern ?? null,
      reminder_minutes: data.reminder_minutes ?? null,
      due_date_offset_days: data.due_date_offset_days ?? null,
      subtasks_json: data.subtasks_json ?? null,
      created_at: now,
      updated_at: now,
    }
    db.prepare(
      `INSERT INTO templates (id, user_id, name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_days, subtasks_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id, row.user_id, row.name, row.description, row.category, row.title_template,
      row.priority, row.is_recurring, row.recurrence_pattern, row.reminder_minutes,
      row.due_date_offset_days, row.subtasks_json, row.created_at, row.updated_at
    )
    return rowToTemplate(row)
  },

  findAllByUser(userId: string, category?: string): Template[] {
    if (category) {
      const rows = db.prepare('SELECT * FROM templates WHERE user_id = ? AND category = ? ORDER BY name').all(userId, category) as TemplateRow[]
      return rows.map(rowToTemplate)
    }
    const rows = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name').all(userId) as TemplateRow[]
    return rows.map(rowToTemplate)
  },

  findById(id: string, userId: string): Template | undefined {
    const row = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as TemplateRow | undefined
    return row ? rowToTemplate(row) : undefined
  },

  update(id: string, userId: string, data: Partial<{
    name: string
    description: string | null
    category: string | null
    title_template: string
    priority: Priority
    is_recurring: boolean
    recurrence_pattern: RecurrencePattern | null
    reminder_minutes: number | null
    due_date_offset_days: number | null
    subtasks_json: string | null
  }>): Template | undefined {
    const existing = this.findById(id, userId)
    if (!existing) return undefined
    const updated = {
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      category: data.category !== undefined ? data.category : existing.category,
      title_template: data.title_template ?? existing.title_template,
      priority: data.priority ?? existing.priority,
      is_recurring: data.is_recurring !== undefined ? data.is_recurring : existing.is_recurring,
      recurrence_pattern: data.recurrence_pattern !== undefined ? data.recurrence_pattern : existing.recurrence_pattern,
      reminder_minutes: data.reminder_minutes !== undefined ? data.reminder_minutes : existing.reminder_minutes,
      due_date_offset_days: data.due_date_offset_days !== undefined ? data.due_date_offset_days : existing.due_date_offset_days,
      subtasks_json: data.subtasks_json !== undefined ? data.subtasks_json : existing.subtasks_json,
      updated_at: new Date().toISOString(),
    }
    db.prepare(
      `UPDATE templates SET name = ?, description = ?, category = ?, title_template = ?,
       priority = ?, is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?,
       due_date_offset_days = ?, subtasks_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      updated.name, updated.description, updated.category, updated.title_template,
      updated.priority, updated.is_recurring ? 1 : 0, updated.recurrence_pattern,
      updated.reminder_minutes, updated.due_date_offset_days, updated.subtasks_json,
      updated.updated_at, id, userId
    )
    return this.findById(id, userId)
  },

  remove(id: string, userId: string): boolean {
    const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId)
    return result.changes > 0
  },
}

// ─── Holiday DB ───────────────────────────────────────────────────────────────

export const holidayDB = {
  findByYear(year: number, countryCode: string = 'SG'): Holiday[] {
    return db.prepare(
      `SELECT * FROM holidays WHERE country_code = ? AND date LIKE ? ORDER BY date`
    ).all(countryCode, `${year}-%`) as Holiday[]
  },

  upsert(data: { date: string; name: string; country_code?: string }): void {
    const countryCode = data.country_code ?? 'SG'
    const existing = db.prepare('SELECT id FROM holidays WHERE date = ? AND country_code = ?').get(data.date, countryCode)
    if (existing) {
      db.prepare('UPDATE holidays SET name = ? WHERE date = ? AND country_code = ?').run(data.name, data.date, countryCode)
    } else {
      db.prepare('INSERT INTO holidays (date, name, country_code) VALUES (?, ?, ?)').run(data.date, data.name, countryCode)
    }
  },
}

export default db
