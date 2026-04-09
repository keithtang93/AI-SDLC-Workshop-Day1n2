import Database from "better-sqlite3";
import path from "node:path";
import { getSingaporeNow } from "@/lib/timezone";

const dbPath = path.join(process.cwd(), "todos.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

export type Priority = "high" | "medium" | "low";
export type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  sign_count: number;
  transports: string | null;
  created_at: string;
  last_used: string | null;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  completed: number;
  completed_at: string | null;
  reminder_minutes: number | null;
  recurrence_pattern: RecurrencePattern | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  subtasks?: Subtask[];
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  category: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  reminder_minutes: number | null;
  recurrence_pattern: RecurrencePattern | null;
  tags_json: string;
  subtasks_json: string;
  created_at: string;
  updated_at: string;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATETIME,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at DATETIME,
      reminder_minutes INTEGER,
      recurrence_pattern TEXT,
      last_notification_sent DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK(priority IN ('high','medium','low')),
      CHECK(recurrence_pattern IN ('daily','weekly','monthly','yearly') OR recurrence_pattern IS NULL)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      reminder_minutes INTEGER,
      recurrence_pattern TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      subtasks_json TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK(priority IN ('high','medium','low')),
      CHECK(recurrence_pattern IN ('daily','weekly','monthly','yearly') OR recurrence_pattern IS NULL)
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initSchema();

function withTodoRelations(todo: Todo): Todo {
  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       INNER JOIN todo_tags tt ON tt.tag_id = t.id
       WHERE tt.todo_id = ?
       ORDER BY t.name ASC`,
    )
    .all(todo.id) as Tag[];

  const subtasks = db
    .prepare(
      `SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC`,
    )
    .all(todo.id) as Subtask[];

  return { ...todo, tags, subtasks };
}

export const userDB = {
  create(username: string): User {
    const result = db
      .prepare("INSERT INTO users (username) VALUES (?)")
      .run(username.trim());
    return this.findById(Number(result.lastInsertRowid)) as User;
  },
  findByUsername(username: string): User | undefined {
    return db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username.trim()) as User | undefined;
  },
  findById(id: number): User | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | User
      | undefined;
  },
};

export const authenticatorDB = {
  create(input: {
    userId: number;
    credentialId: string;
    publicKey: string;
    signCount: number;
    transports?: string[];
  }): Authenticator {
    const result = db
      .prepare(
        `INSERT INTO authenticators
         (user_id, credential_id, public_key, sign_count, transports)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.credentialId,
        input.publicKey,
        input.signCount ?? 0,
        JSON.stringify(input.transports ?? []),
      );
    return db
      .prepare("SELECT * FROM authenticators WHERE id = ?")
      .get(result.lastInsertRowid) as Authenticator;
  },
  findByCredentialId(credentialId: string): Authenticator | undefined {
    return db
      .prepare("SELECT * FROM authenticators WHERE credential_id = ?")
      .get(credentialId) as Authenticator | undefined;
  },
  findByUserId(userId: number): Authenticator[] {
    return db
      .prepare("SELECT * FROM authenticators WHERE user_id = ?")
      .all(userId) as Authenticator[];
  },
  updateCounter(id: number, signCount: number): void {
    db.prepare(
      "UPDATE authenticators SET sign_count = ?, last_used = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(signCount ?? 0, id);
  },
};

export const todoDB = {
  create(input: {
    userId: number;
    title: string;
    description?: string | null;
    priority?: Priority;
    dueDate?: string | null;
    reminderMinutes?: number | null;
    recurrencePattern?: RecurrencePattern | null;
    tagIds?: number[];
  }): Todo {
    const result = db
      .prepare(
        `INSERT INTO todos
         (user_id, title, description, priority, due_date, reminder_minutes, recurrence_pattern)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.title.trim(),
        input.description ?? null,
        input.priority ?? "medium",
        input.dueDate ?? null,
        input.reminderMinutes ?? null,
        input.recurrencePattern ?? null,
      );

    const todoId = Number(result.lastInsertRowid);
    for (const tagId of input.tagIds ?? []) {
      db.prepare(
        "INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)",
      ).run(todoId, tagId);
    }

    const todo = db
      .prepare("SELECT * FROM todos WHERE id = ?")
      .get(todoId) as Todo;
    return withTodoRelations(todo);
  },

  listByUserId(userId: number): Todo[] {
    const rows = db
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
         ORDER BY completed ASC,
          CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          due_date IS NULL,
          due_date ASC,
          created_at DESC`,
      )
      .all(userId) as Todo[];

    return rows.map(withTodoRelations);
  },

  getById(userId: number, id: number): Todo | undefined {
    const row = db
      .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
      .get(id, userId) as Todo | undefined;
    return row ? withTodoRelations(row) : undefined;
  },

  update(
    userId: number,
    id: number,
    input: Partial<{
      title: string;
      description: string | null;
      priority: Priority;
      dueDate: string | null;
      completed: boolean;
      reminderMinutes: number | null;
      recurrencePattern: RecurrencePattern | null;
      lastNotificationSent: string | null;
      tagIds: number[];
    }>,
  ): Todo | undefined {
    const existing = db
      .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
      .get(id, userId) as Todo | undefined;
    if (!existing) {
      return undefined;
    }

    db.prepare(
      `UPDATE todos
       SET title = ?, description = ?, priority = ?, due_date = ?,
           completed = ?, completed_at = ?, reminder_minutes = ?, recurrence_pattern = ?,
           last_notification_sent = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
    ).run(
      input.title ?? existing.title,
      input.description ?? existing.description,
      input.priority ?? existing.priority,
      input.dueDate ?? existing.due_date,
      input.completed === undefined
        ? existing.completed
        : input.completed
          ? 1
          : 0,
      input.completed === undefined
        ? existing.completed_at
        : input.completed
          ? getSingaporeNow().toISOString()
          : null,
      input.reminderMinutes ?? existing.reminder_minutes,
      input.recurrencePattern ?? existing.recurrence_pattern,
      input.lastNotificationSent ?? existing.last_notification_sent,
      id,
      userId,
    );

    if (input.tagIds) {
      db.prepare("DELETE FROM todo_tags WHERE todo_id = ?").run(id);
      for (const tagId of input.tagIds) {
        db.prepare(
          "INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)",
        ).run(id, tagId);
      }
    }

    return this.getById(userId, id);
  },

  delete(userId: number, id: number): void {
    db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(
      id,
      userId,
    );
  },

  listDueForNotification(userId: number): Todo[] {
    const rows = db
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
           AND completed = 0
           AND due_date IS NOT NULL
           AND reminder_minutes IS NOT NULL`,
      )
      .all(userId) as Todo[];
    return rows.map(withTodoRelations);
  },
};

export const subtaskDB = {
  create(todoId: number, title: string): Subtask {
    const max = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) as value FROM subtasks WHERE todo_id = ?",
      )
      .get(todoId) as {
      value: number;
    };
    const result = db
      .prepare(
        "INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)",
      )
      .run(todoId, title.trim(), max.value + 1);
    return db
      .prepare("SELECT * FROM subtasks WHERE id = ?")
      .get(result.lastInsertRowid) as Subtask;
  },
  update(
    id: number,
    input: Partial<{ title: string; completed: boolean }>,
  ): Subtask | undefined {
    const current = db
      .prepare("SELECT * FROM subtasks WHERE id = ?")
      .get(id) as Subtask | undefined;
    if (!current) {
      return undefined;
    }
    db.prepare("UPDATE subtasks SET title = ?, completed = ? WHERE id = ?").run(
      input.title ?? current.title,
      input.completed === undefined
        ? current.completed
        : input.completed
          ? 1
          : 0,
      id,
    );
    return db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id) as Subtask;
  },
  delete(id: number): void {
    db.prepare("DELETE FROM subtasks WHERE id = ?").run(id);
  },
};

export const tagDB = {
  create(userId: number, name: string, color: string): Tag {
    const result = db
      .prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)")
      .run(userId, name.trim(), color);
    return db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(result.lastInsertRowid) as Tag;
  },
  listByUserId(userId: number): Tag[] {
    return db
      .prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC")
      .all(userId) as Tag[];
  },
  getByName(userId: number, name: string): Tag | undefined {
    return db
      .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
      .get(userId, name.trim()) as Tag | undefined;
  },
  update(
    userId: number,
    id: number,
    input: Partial<{ name: string; color: string }>,
  ): Tag | undefined {
    const current = db
      .prepare("SELECT * FROM tags WHERE id = ? AND user_id = ?")
      .get(id, userId) as Tag | undefined;
    if (!current) {
      return undefined;
    }
    db.prepare(
      "UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?",
    ).run(input.name ?? current.name, input.color ?? current.color, id, userId);
    return db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as Tag;
  },
  delete(userId: number, id: number): void {
    db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(id, userId);
  },
};

export const templateDB = {
  create(
    userId: number,
    input: {
      name: string;
      category?: string | null;
      title: string;
      description?: string | null;
      priority?: Priority;
      reminderMinutes?: number | null;
      recurrencePattern?: RecurrencePattern | null;
      tagsJson?: string;
      subtasksJson?: string;
    },
  ): Template {
    const result = db
      .prepare(
        `INSERT INTO templates
         (user_id, name, category, title, description, priority, reminder_minutes, recurrence_pattern, tags_json, subtasks_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.name.trim(),
        input.category ?? null,
        input.title.trim(),
        input.description ?? null,
        input.priority ?? "medium",
        input.reminderMinutes ?? null,
        input.recurrencePattern ?? null,
        input.tagsJson ?? "[]",
        input.subtasksJson ?? "[]",
      );
    return db
      .prepare("SELECT * FROM templates WHERE id = ?")
      .get(result.lastInsertRowid) as Template;
  },
  listByUserId(userId: number): Template[] {
    return db
      .prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC")
      .all(userId) as Template[];
  },
  getById(userId: number, id: number): Template | undefined {
    return db
      .prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
      .get(id, userId) as Template | undefined;
  },
  delete(userId: number, id: number): void {
    db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(
      id,
      userId,
    );
  },
};

export const holidayDB = {
  upsert(date: string, name: string): void {
    db.prepare(
      "INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name",
    ).run(date, name);
  },
  listByRange(
    startDate: string,
    endDate: string,
  ): { id: number; date: string; name: string }[] {
    return db
      .prepare(
        "SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC",
      )
      .all(startDate, endDate) as {
      id: number;
      date: string;
      name: string;
    }[];
  },
};
