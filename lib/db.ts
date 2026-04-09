import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'todo.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initTables(_db)
  }
  return _db
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      credential_public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT,
      reminder_minutes INTEGER,
      last_notification_sent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
    CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
    CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      title_template TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT,
      reminder_minutes INTEGER,
      subtasks_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      UNIQUE(name, date)
    );

    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
    CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
  `)
}

// ========== Users ==========
export const userDB = {
  create(username: string) {
    const stmt = getDb().prepare('INSERT INTO users (username) VALUES (?)')
    const result = stmt.run(username)
    return { id: result.lastInsertRowid as number, username }
  },

  findByUsername(username: string) {
    const stmt = getDb().prepare('SELECT * FROM users WHERE username = ?')
    return stmt.get(username) as { id: number; username: string; created_at: string; updated_at: string } | undefined
  },

  findById(id: number) {
    const stmt = getDb().prepare('SELECT * FROM users WHERE id = ?')
    return stmt.get(id) as { id: number; username: string; created_at: string; updated_at: string } | undefined
  },
}

// ========== Authenticators ==========
export const authDB = {
  create(data: {
    user_id: number
    credential_id: string
    credential_public_key: string
    counter: number
    transports?: string
  }) {
    const stmt = getDb().prepare(
      'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports) VALUES (?, ?, ?, ?, ?)'
    )
    const result = stmt.run(data.user_id, data.credential_id, data.credential_public_key, data.counter ?? 0, data.transports ?? null)
    return result.lastInsertRowid as number
  },

  findByUserId(userId: number) {
    const stmt = getDb().prepare('SELECT * FROM authenticators WHERE user_id = ?')
    return stmt.all(userId) as Array<{
      id: number
      user_id: number
      credential_id: string
      credential_public_key: string
      counter: number
      transports: string | null
      created_at: string
    }>
  },

  findByCredentialId(credentialId: string) {
    const stmt = getDb().prepare('SELECT * FROM authenticators WHERE credential_id = ?')
    return stmt.get(credentialId) as {
      id: number
      user_id: number
      credential_id: string
      credential_public_key: string
      counter: number
      transports: string | null
      created_at: string
    } | undefined
  },

  updateCounter(id: number, counter: number) {
    const stmt = getDb().prepare('UPDATE authenticators SET counter = ? WHERE id = ?')
    stmt.run(counter ?? 0, id)
  },
}

// ========== Todos ==========
interface TodoRow {
  id: number
  user_id: number
  title: string
  completed: number
  priority: string
  due_date: string | null
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

interface SubtaskRow {
  id: number
  todo_id: number
  title: string
  completed: number
  position: number
  created_at: string
  updated_at: string
}

interface TagRow {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
  updated_at: string
}

export const todoDB = {
  create(data: {
    user_id: number
    title: string
    priority?: string
    due_date?: string | null
    is_recurring?: boolean
    recurrence_pattern?: string | null
    reminder_minutes?: number | null
  }) {
    const stmt = getDb().prepare(`
      INSERT INTO todos (user_id, title, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.user_id,
      data.title.trim(),
      data.priority || 'medium',
      data.due_date || null,
      data.is_recurring ? 1 : 0,
      data.recurrence_pattern || null,
      data.reminder_minutes ?? null
    )
    return result.lastInsertRowid as number
  },

  findAllByUser(userId: number) {
    const todos = getDb().prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY completed ASC, CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END ASC, due_date ASC NULLS LAST, created_at DESC').all(userId) as TodoRow[]

    const subtaskStmt = getDb().prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC')
    const tagStmt = getDb().prepare('SELECT t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?')

    return todos.map(todo => ({
      ...todo,
      completed: !!todo.completed,
      is_recurring: !!todo.is_recurring,
      subtasks: (subtaskStmt.all(todo.id) as SubtaskRow[]).map(s => ({ ...s, completed: !!s.completed })),
      tags: tagStmt.all(todo.id) as TagRow[],
    }))
  },

  findById(id: number, userId: number) {
    const todo = getDb().prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as TodoRow | undefined
    if (!todo) return undefined

    const subtasks = (getDb().prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC').all(todo.id) as SubtaskRow[]).map(s => ({ ...s, completed: !!s.completed }))
    const tags = getDb().prepare('SELECT t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?').all(todo.id) as TagRow[]

    return { ...todo, completed: !!todo.completed, is_recurring: !!todo.is_recurring, subtasks, tags }
  },

  update(id: number, userId: number, data: Partial<{
    title: string
    completed: boolean
    priority: string
    due_date: string | null
    is_recurring: boolean
    recurrence_pattern: string | null
    reminder_minutes: number | null
    last_notification_sent: string | null
  }>) {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title.trim()) }
    if (data.completed !== undefined) { fields.push('completed = ?'); values.push(data.completed ? 1 : 0) }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }
    if (data.is_recurring !== undefined) { fields.push('is_recurring = ?'); values.push(data.is_recurring ? 1 : 0) }
    if (data.recurrence_pattern !== undefined) { fields.push('recurrence_pattern = ?'); values.push(data.recurrence_pattern) }
    if (data.reminder_minutes !== undefined) { fields.push('reminder_minutes = ?'); values.push(data.reminder_minutes) }
    if (data.last_notification_sent !== undefined) { fields.push('last_notification_sent = ?'); values.push(data.last_notification_sent) }

    if (fields.length === 0) return

    fields.push("updated_at = datetime('now')")
    values.push(id, userId)

    getDb().prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
  },

  delete(id: number, userId: number) {
    getDb().prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId)
  },

  findDueReminders() {
    return getDb().prepare(`
      SELECT * FROM todos
      WHERE reminder_minutes IS NOT NULL
        AND due_date IS NOT NULL
        AND last_notification_sent IS NULL
        AND completed = 0
        AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime('now')
    `).all() as TodoRow[]
  },

  markNotificationSent(id: number) {
    getDb().prepare("UPDATE todos SET last_notification_sent = datetime('now') WHERE id = ?").run(id)
  },
}

// ========== Subtasks ==========
export const subtaskDB = {
  create(todoId: number, title: string) {
    const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) as max_pos FROM subtasks WHERE todo_id = ?').get(todoId) as { max_pos: number }
    const stmt = getDb().prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)')
    const result = stmt.run(todoId, title.trim(), maxPos.max_pos + 1)
    return result.lastInsertRowid as number
  },

  findByTodo(todoId: number) {
    return (getDb().prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC').all(todoId) as SubtaskRow[]).map(s => ({ ...s, completed: !!s.completed }))
  },

  update(id: number, data: Partial<{ title: string; completed: boolean }>) {
    const fields: string[] = []
    const values: (string | number)[] = []
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title.trim()) }
    if (data.completed !== undefined) { fields.push('completed = ?'); values.push(data.completed ? 1 : 0) }
    if (fields.length === 0) return
    fields.push("updated_at = datetime('now')")
    values.push(id)
    getDb().prepare(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },

  delete(id: number) {
    getDb().prepare('DELETE FROM subtasks WHERE id = ?').run(id)
  },

  findById(id: number) {
    return getDb().prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined
  },
}

// ========== Tags ==========
export const tagDB = {
  create(userId: number, name: string, color: string) {
    const stmt = getDb().prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)')
    const result = stmt.run(userId, name.trim(), color)
    return result.lastInsertRowid as number
  },

  findAllByUser(userId: number) {
    return getDb().prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId) as TagRow[]
  },

  findById(id: number, userId: number) {
    return getDb().prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as TagRow | undefined
  },

  update(id: number, userId: number, data: Partial<{ name: string; color: string }>) {
    const fields: string[] = []
    const values: (string | number)[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()) }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
    if (fields.length === 0) return
    fields.push("updated_at = datetime('now')")
    values.push(id, userId)
    getDb().prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
  },

  delete(id: number, userId: number) {
    getDb().prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId)
  },
}

// ========== Todo-Tag Associations ==========
export const todoTagDB = {
  assign(todoId: number, tagId: number) {
    getDb().prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId)
  },

  remove(todoId: number, tagId: number) {
    getDb().prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId)
  },

  findByTodo(todoId: number) {
    return getDb().prepare('SELECT t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?').all(todoId) as TagRow[]
  },

  findTodoIdsByTag(tagId: number) {
    return (getDb().prepare('SELECT todo_id FROM todo_tags WHERE tag_id = ?').all(tagId) as Array<{ todo_id: number }>).map(r => r.todo_id)
  },
}

// ========== Templates ==========
interface TemplateRow {
  id: number
  user_id: number
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: string
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  subtasks_json: string | null
  created_at: string
  updated_at: string
}

function mapTemplate(row: TemplateRow) {
  return {
    ...row,
    is_recurring: !!row.is_recurring,
    subtasks: row.subtasks_json ? JSON.parse(row.subtasks_json) : [],
  }
}

export const templateDB = {
  create(data: {
    user_id: number
    name: string
    description?: string | null
    category?: string | null
    title_template: string
    priority?: string
    is_recurring?: boolean
    recurrence_pattern?: string | null
    reminder_minutes?: number | null
    subtasks_json?: string | null
  }) {
    const stmt = getDb().prepare(`
      INSERT INTO templates (user_id, name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, subtasks_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.user_id,
      data.name.trim(),
      data.description || null,
      data.category || null,
      data.title_template.trim(),
      data.priority || 'medium',
      data.is_recurring ? 1 : 0,
      data.recurrence_pattern || null,
      data.reminder_minutes ?? null,
      data.subtasks_json || null
    )
    return result.lastInsertRowid as number
  },

  findAllByUser(userId: number) {
    const rows = getDb().prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY category ASC, name ASC').all(userId) as TemplateRow[]
    return rows.map(mapTemplate)
  },

  findById(id: number, userId: number) {
    const row = getDb().prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as TemplateRow | undefined
    return row ? mapTemplate(row) : undefined
  },

  update(id: number, userId: number, data: Partial<{
    name: string
    description: string | null
    category: string | null
    title_template: string
    priority: string
    is_recurring: boolean
    recurrence_pattern: string | null
    reminder_minutes: number | null
    subtasks_json: string | null
  }>) {
    const fields: string[] = []
    const values: (string | number | null)[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()) }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category) }
    if (data.title_template !== undefined) { fields.push('title_template = ?'); values.push(data.title_template.trim()) }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
    if (data.is_recurring !== undefined) { fields.push('is_recurring = ?'); values.push(data.is_recurring ? 1 : 0) }
    if (data.recurrence_pattern !== undefined) { fields.push('recurrence_pattern = ?'); values.push(data.recurrence_pattern) }
    if (data.reminder_minutes !== undefined) { fields.push('reminder_minutes = ?'); values.push(data.reminder_minutes) }
    if (data.subtasks_json !== undefined) { fields.push('subtasks_json = ?'); values.push(data.subtasks_json) }
    if (fields.length === 0) return
    fields.push("updated_at = datetime('now')")
    values.push(id, userId)
    getDb().prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
  },

  delete(id: number, userId: number) {
    getDb().prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId)
  },
}

// ========== Holidays ==========
export const holidayDB = {
  findByYear(year: number) {
    return getDb().prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date ASC').all(year) as Array<{ id: number; name: string; date: string; year: number }>
  },

  findByMonth(year: number, month: number) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    return getDb().prepare("SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC").all(`${monthStr}%`) as Array<{ id: number; name: string; date: string; year: number }>
  },

  seed() {
    const db = getDb()
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM holidays').get() as { cnt: number }).cnt
    if (count > 0) return

    const holidays = [
      // 2025
      { name: "New Year's Day", date: '2025-01-01', year: 2025 },
      { name: 'Chinese New Year', date: '2025-01-29', year: 2025 },
      { name: 'Chinese New Year (2nd day)', date: '2025-01-30', year: 2025 },
      { name: 'Hari Raya Puasa', date: '2025-03-31', year: 2025 },
      { name: 'Good Friday', date: '2025-04-18', year: 2025 },
      { name: 'Labour Day', date: '2025-05-01', year: 2025 },
      { name: 'Vesak Day', date: '2025-05-12', year: 2025 },
      { name: 'Hari Raya Haji', date: '2025-06-07', year: 2025 },
      { name: 'National Day', date: '2025-08-09', year: 2025 },
      { name: 'Deepavali', date: '2025-10-20', year: 2025 },
      { name: 'Christmas Day', date: '2025-12-25', year: 2025 },
      // 2026
      { name: "New Year's Day", date: '2026-01-01', year: 2026 },
      { name: 'Chinese New Year', date: '2026-02-17', year: 2026 },
      { name: 'Chinese New Year (2nd day)', date: '2026-02-18', year: 2026 },
      { name: 'Hari Raya Puasa', date: '2026-03-20', year: 2026 },
      { name: 'Good Friday', date: '2026-04-03', year: 2026 },
      { name: 'Labour Day', date: '2026-05-01', year: 2026 },
      { name: 'Vesak Day', date: '2026-05-31', year: 2026 },
      { name: 'Hari Raya Haji', date: '2026-05-27', year: 2026 },
      { name: 'National Day', date: '2026-08-09', year: 2026 },
      { name: 'Deepavali', date: '2026-11-08', year: 2026 },
      { name: 'Christmas Day', date: '2026-12-25', year: 2026 },
      // 2027
      { name: "New Year's Day", date: '2027-01-01', year: 2027 },
      { name: 'Chinese New Year', date: '2027-02-06', year: 2027 },
      { name: 'Chinese New Year (2nd day)', date: '2027-02-07', year: 2027 },
      { name: 'Hari Raya Puasa', date: '2027-03-10', year: 2027 },
      { name: 'Good Friday', date: '2027-03-26', year: 2027 },
      { name: 'Labour Day', date: '2027-05-01', year: 2027 },
      { name: 'Hari Raya Haji', date: '2027-05-17', year: 2027 },
      { name: 'Vesak Day', date: '2027-05-20', year: 2027 },
      { name: 'National Day', date: '2027-08-09', year: 2027 },
      { name: 'Deepavali', date: '2027-10-28', year: 2027 },
      { name: 'Christmas Day', date: '2027-12-25', year: 2027 },
    ]

    const stmt = db.prepare('INSERT OR IGNORE INTO holidays (name, date, year) VALUES (?, ?, ?)')
    const insertMany = db.transaction((items: typeof holidays) => {
      for (const h of items) {
        stmt.run(h.name, h.date, h.year)
      }
    })
    insertMany(holidays)
  },
}
