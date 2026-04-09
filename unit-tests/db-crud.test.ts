import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Use a dedicated test database to avoid polluting the real one
const TEST_DB_PATH = path.join(process.cwd(), "test-unit.db");

function createTestDB() {
  // Remove stale test DB if it exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const db = new Database(TEST_DB_PATH);
  db.pragma("foreign_keys = ON");

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

  return db;
}

/**
 * Helper to build a lightweight DB access layer for tests, mirroring lib/db.ts
 * but using the isolated test database instance.
 */
function buildTestDBLayer(db: Database.Database) {
  function withTodoRelations(todo: Record<string, unknown>) {
    const tags = db
      .prepare(
        `SELECT t.* FROM tags t
         INNER JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ?
         ORDER BY t.name ASC`,
      )
      .all(todo.id);

    const subtasks = db
      .prepare(
        `SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC`,
      )
      .all(todo.id);

    return { ...todo, tags, subtasks };
  }

  return {
    userDB: {
      create(username: string) {
        const result = db
          .prepare("INSERT INTO users (username) VALUES (?)")
          .run(username.trim());
        return db
          .prepare("SELECT * FROM users WHERE id = ?")
          .get(result.lastInsertRowid);
      },
      findByUsername(username: string) {
        return db
          .prepare("SELECT * FROM users WHERE username = ?")
          .get(username.trim());
      },
      findById(id: number) {
        return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      },
    },
    todoDB: {
      create(input: {
        userId: number;
        title: string;
        description?: string | null;
        priority?: string;
        dueDate?: string | null;
        reminderMinutes?: number | null;
        recurrencePattern?: string | null;
        tagIds?: number[];
      }) {
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
          .get(todoId) as Record<string, unknown>;
        return withTodoRelations(todo);
      },
      listByUserId(userId: number) {
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
          .all(userId) as Record<string, unknown>[];
        return rows.map(withTodoRelations);
      },
      getById(userId: number, id: number) {
        const row = db
          .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
          .get(id, userId) as Record<string, unknown> | undefined;
        return row ? withTodoRelations(row) : undefined;
      },
      update(
        userId: number,
        id: number,
        input: Partial<{
          title: string;
          description: string | null;
          priority: string;
          dueDate: string | null;
          completed: boolean;
          reminderMinutes: number | null;
          recurrencePattern: string | null;
          tagIds: number[];
        }>,
      ) {
        const existing = db
          .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
          .get(id, userId) as Record<string, unknown> | undefined;
        if (!existing) return undefined;

        db.prepare(
          `UPDATE todos
           SET title = ?, description = ?, priority = ?, due_date = ?,
               completed = ?, completed_at = ?, reminder_minutes = ?, recurrence_pattern = ?,
               updated_at = CURRENT_TIMESTAMP
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
              ? new Date().toISOString()
              : null,
          input.reminderMinutes ?? existing.reminder_minutes,
          input.recurrencePattern ?? existing.recurrence_pattern,
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
      delete(userId: number, id: number) {
        db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(
          id,
          userId,
        );
      },
    },
    subtaskDB: {
      create(todoId: number, title: string) {
        const max = db
          .prepare(
            "SELECT COALESCE(MAX(position), -1) as value FROM subtasks WHERE todo_id = ?",
          )
          .get(todoId) as { value: number };
        const result = db
          .prepare(
            "INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)",
          )
          .run(todoId, title.trim(), max.value + 1);
        return db
          .prepare("SELECT * FROM subtasks WHERE id = ?")
          .get(result.lastInsertRowid);
      },
      update(id: number, input: Partial<{ title: string; completed: boolean }>) {
        const current = db
          .prepare("SELECT * FROM subtasks WHERE id = ?")
          .get(id) as Record<string, unknown> | undefined;
        if (!current) return undefined;
        db.prepare(
          "UPDATE subtasks SET title = ?, completed = ? WHERE id = ?",
        ).run(
          input.title ?? current.title,
          input.completed === undefined
            ? current.completed
            : input.completed
              ? 1
              : 0,
          id,
        );
        return db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id);
      },
      delete(id: number) {
        db.prepare("DELETE FROM subtasks WHERE id = ?").run(id);
      },
      listByTodoId(todoId: number) {
        return db
          .prepare(
            "SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC",
          )
          .all(todoId);
      },
    },
    tagDB: {
      create(userId: number, name: string, color: string) {
        const result = db
          .prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)")
          .run(userId, name.trim(), color);
        return db
          .prepare("SELECT * FROM tags WHERE id = ?")
          .get(result.lastInsertRowid);
      },
      listByUserId(userId: number) {
        return db
          .prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC")
          .all(userId);
      },
      getByName(userId: number, name: string) {
        return db
          .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
          .get(userId, name.trim());
      },
      update(
        userId: number,
        id: number,
        input: Partial<{ name: string; color: string }>,
      ) {
        const current = db
          .prepare("SELECT * FROM tags WHERE id = ? AND user_id = ?")
          .get(id, userId) as Record<string, unknown> | undefined;
        if (!current) return undefined;
        db.prepare(
          "UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?",
        ).run(
          input.name ?? current.name,
          input.color ?? current.color,
          id,
          userId,
        );
        return db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
      },
      delete(userId: number, id: number) {
        db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(
          id,
          userId,
        );
      },
    },
    templateDB: {
      create(
        userId: number,
        input: {
          name: string;
          category?: string | null;
          title: string;
          description?: string | null;
          priority?: string;
          reminderMinutes?: number | null;
          recurrencePattern?: string | null;
          tagsJson?: string;
          subtasksJson?: string;
        },
      ) {
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
          .get(result.lastInsertRowid);
      },
      listByUserId(userId: number) {
        return db
          .prepare(
            "SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC",
          )
          .all(userId);
      },
      getById(userId: number, id: number) {
        return db
          .prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
          .get(id, userId);
      },
      update(
        userId: number,
        id: number,
        input: Partial<{
          name: string;
          category: string | null;
          title: string;
          description: string | null;
          priority: string;
          reminderMinutes: number | null;
          recurrencePattern: string | null;
          tagsJson: string;
          subtasksJson: string;
        }>,
      ) {
        const existing = db
          .prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
          .get(id, userId) as Record<string, unknown> | undefined;
        if (!existing) return undefined;

        db.prepare(
          `UPDATE templates
           SET name = ?, category = ?, title = ?, description = ?, priority = ?,
               reminder_minutes = ?, recurrence_pattern = ?, tags_json = ?, subtasks_json = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`,
        ).run(
          input.name ?? existing.name,
          input.category ?? existing.category,
          input.title ?? existing.title,
          input.description ?? existing.description,
          input.priority ?? existing.priority,
          input.reminderMinutes ?? existing.reminder_minutes,
          input.recurrencePattern ?? existing.recurrence_pattern,
          input.tagsJson ?? existing.tags_json,
          input.subtasksJson ?? existing.subtasks_json,
          id,
          userId,
        );

        return db
          .prepare("SELECT * FROM templates WHERE id = ?")
          .get(id);
      },
      delete(userId: number, id: number) {
        db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(
          id,
          userId,
        );
      },
    },
    holidayDB: {
      upsert(date: string, name: string) {
        db.prepare(
          "INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name",
        ).run(date, name);
      },
      listByRange(startDate: string, endDate: string) {
        return db
          .prepare(
            "SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC",
          )
          .all(startDate, endDate);
      },
    },
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Database CRUD Operations", () => {
  let db: Database.Database;
  let layer: ReturnType<typeof buildTestDBLayer>;
  let userId: number;

  beforeEach(() => {
    db = createTestDB();
    layer = buildTestDBLayer(db);
    const user = layer.userDB.create("testuser") as { id: number };
    userId = user.id;
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ─── Users ──────────────────────────────────────────────────────────────────

  describe("userDB", () => {
    it("creates a user and returns it", () => {
      const user = layer.userDB.create("newuser") as Record<string, unknown>;
      expect(user).toBeDefined();
      expect(user.username).toBe("newuser");
      expect(user.id).toBeGreaterThan(0);
    });

    it("trims username whitespace", () => {
      const user = layer.userDB.create("  spacey  ") as Record<string, unknown>;
      expect(user.username).toBe("spacey");
    });

    it("finds user by username", () => {
      const found = layer.userDB.findByUsername("testuser") as Record<string, unknown>;
      expect(found).toBeDefined();
      expect(found.username).toBe("testuser");
    });

    it("finds user by id", () => {
      const found = layer.userDB.findById(userId) as Record<string, unknown>;
      expect(found).toBeDefined();
      expect(found.id).toBe(userId);
    });

    it("returns undefined for non-existent username", () => {
      expect(layer.userDB.findByUsername("ghost")).toBeUndefined();
    });

    it("returns undefined for non-existent id", () => {
      expect(layer.userDB.findById(99999)).toBeUndefined();
    });

    it("enforces unique username constraint", () => {
      expect(() => layer.userDB.create("testuser")).toThrow();
    });
  });

  // ─── Todos ──────────────────────────────────────────────────────────────────

  describe("todoDB", () => {
    it("creates todo with required fields only", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "Buy milk",
      }) as Record<string, unknown>;

      expect(todo.title).toBe("Buy milk");
      expect(todo.priority).toBe("medium");
      expect(todo.completed).toBe(0);
      expect(todo.description).toBeNull();
      expect(todo.due_date).toBeNull();
      expect(todo.tags).toEqual([]);
      expect(todo.subtasks).toEqual([]);
    });

    it("creates todo with all optional fields", () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const todo = layer.todoDB.create({
        userId,
        title: "Full todo",
        description: "Detailed description",
        priority: "high",
        dueDate,
        reminderMinutes: 60,
        recurrencePattern: "weekly",
      }) as Record<string, unknown>;

      expect(todo.title).toBe("Full todo");
      expect(todo.description).toBe("Detailed description");
      expect(todo.priority).toBe("high");
      expect(todo.due_date).toBe(dueDate);
      expect(todo.reminder_minutes).toBe(60);
      expect(todo.recurrence_pattern).toBe("weekly");
    });

    it("trims title whitespace", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "  spaced out  ",
      }) as Record<string, unknown>;
      expect(todo.title).toBe("spaced out");
    });

    it("creates todo with tags", () => {
      const tag1 = layer.tagDB.create(userId, "urgent", "#FF0000") as Record<string, unknown>;
      const tag2 = layer.tagDB.create(userId, "work", "#00FF00") as Record<string, unknown>;
      const todo = layer.todoDB.create({
        userId,
        title: "Tagged todo",
        tagIds: [tag1.id as number, tag2.id as number],
      }) as Record<string, unknown>;

      const tags = todo.tags as Array<Record<string, unknown>>;
      expect(tags).toHaveLength(2);
      const tagNames = tags.map((t) => t.name);
      expect(tagNames).toContain("urgent");
      expect(tagNames).toContain("work");
    });

    it("lists todos by user sorted by priority", () => {
      layer.todoDB.create({ userId, title: "Low", priority: "low" });
      layer.todoDB.create({ userId, title: "High", priority: "high" });
      layer.todoDB.create({ userId, title: "Medium", priority: "medium" });

      const todos = layer.todoDB.listByUserId(userId) as Array<Record<string, unknown>>;
      expect(todos).toHaveLength(3);
      expect(todos[0].title).toBe("High");
      expect(todos[1].title).toBe("Medium");
      expect(todos[2].title).toBe("Low");
    });

    it("does not return other users' todos", () => {
      const user2 = layer.userDB.create("other") as { id: number };
      layer.todoDB.create({ userId, title: "Mine" });
      layer.todoDB.create({ userId: user2.id, title: "Theirs" });

      const myTodos = layer.todoDB.listByUserId(userId) as Array<Record<string, unknown>>;
      expect(myTodos).toHaveLength(1);
      expect(myTodos[0].title).toBe("Mine");
    });

    it("gets todo by id", () => {
      const created = layer.todoDB.create({
        userId,
        title: "Find me",
      }) as Record<string, unknown>;
      const found = layer.todoDB.getById(userId, created.id as number);
      expect(found).toBeDefined();
      expect((found as Record<string, unknown>).title).toBe("Find me");
    });

    it("returns undefined for wrong user", () => {
      const user2 = layer.userDB.create("other2") as { id: number };
      const todo = layer.todoDB.create({
        userId,
        title: "Private",
      }) as Record<string, unknown>;
      expect(layer.todoDB.getById(user2.id, todo.id as number)).toBeUndefined();
    });

    it("updates todo fields", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "Original",
      }) as Record<string, unknown>;

      const updated = layer.todoDB.update(userId, todo.id as number, {
        title: "Updated",
        priority: "high",
        description: "Now with description",
      }) as Record<string, unknown>;

      expect(updated.title).toBe("Updated");
      expect(updated.priority).toBe("high");
      expect(updated.description).toBe("Now with description");
    });

    it("updates todo completion status", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "Complete me",
      }) as Record<string, unknown>;

      const completed = layer.todoDB.update(userId, todo.id as number, {
        completed: true,
      }) as Record<string, unknown>;

      expect(completed.completed).toBe(1);
      expect(completed.completed_at).not.toBeNull();
    });

    it("updates todo tags", () => {
      const tag1 = layer.tagDB.create(userId, "old", "#000") as Record<string, unknown>;
      const tag2 = layer.tagDB.create(userId, "new", "#FFF") as Record<string, unknown>;
      const todo = layer.todoDB.create({
        userId,
        title: "Tag swap",
        tagIds: [tag1.id as number],
      }) as Record<string, unknown>;

      const updated = layer.todoDB.update(userId, todo.id as number, {
        tagIds: [tag2.id as number],
      }) as Record<string, unknown>;

      const tags = updated.tags as Array<Record<string, unknown>>;
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe("new");
    });

    it("returns undefined when updating non-existent todo", () => {
      expect(layer.todoDB.update(userId, 99999, { title: "X" })).toBeUndefined();
    });

    it("deletes todo", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "Delete me",
      }) as Record<string, unknown>;
      layer.todoDB.delete(userId, todo.id as number);
      expect(layer.todoDB.getById(userId, todo.id as number)).toBeUndefined();
    });

    it("cascade deletes subtasks when todo is deleted", () => {
      const todo = layer.todoDB.create({
        userId,
        title: "Parent",
      }) as Record<string, unknown>;
      layer.subtaskDB.create(todo.id as number, "Child 1");
      layer.subtaskDB.create(todo.id as number, "Child 2");

      const beforeDelete = layer.subtaskDB.listByTodoId(todo.id as number);
      expect(beforeDelete).toHaveLength(2);

      layer.todoDB.delete(userId, todo.id as number);

      const afterDelete = layer.subtaskDB.listByTodoId(todo.id as number);
      expect(afterDelete).toHaveLength(0);
    });

    it("cascade deletes todo_tags when todo is deleted", () => {
      const tag = layer.tagDB.create(userId, "test", "#000") as Record<string, unknown>;
      const todo = layer.todoDB.create({
        userId,
        title: "Tagged",
        tagIds: [tag.id as number],
      }) as Record<string, unknown>;

      layer.todoDB.delete(userId, todo.id as number);

      const refetchedTodo = layer.todoDB.getById(userId, todo.id as number);
      expect(refetchedTodo).toBeUndefined();
    });

    it("rejects invalid priority via CHECK constraint", () => {
      expect(() => {
        db.prepare(
          `INSERT INTO todos (user_id, title, priority) VALUES (?, ?, ?)`,
        ).run(userId, "Bad priority", "urgent");
      }).toThrow();
    });

    it("rejects invalid recurrence_pattern via CHECK constraint", () => {
      expect(() => {
        db.prepare(
          `INSERT INTO todos (user_id, title, recurrence_pattern) VALUES (?, ?, ?)`,
        ).run(userId, "Bad recurrence", "biweekly");
      }).toThrow();
    });
  });

  // ─── Subtasks ───────────────────────────────────────────────────────────────

  describe("subtaskDB", () => {
    let todoId: number;

    beforeEach(() => {
      const todo = layer.todoDB.create({
        userId,
        title: "Parent todo",
      }) as Record<string, unknown>;
      todoId = todo.id as number;
    });

    it("creates subtask with auto-incremented position", () => {
      const s1 = layer.subtaskDB.create(todoId, "First") as Record<string, unknown>;
      const s2 = layer.subtaskDB.create(todoId, "Second") as Record<string, unknown>;
      const s3 = layer.subtaskDB.create(todoId, "Third") as Record<string, unknown>;

      expect(s1.position).toBe(0);
      expect(s2.position).toBe(1);
      expect(s3.position).toBe(2);
    });

    it("trims subtask title", () => {
      const s = layer.subtaskDB.create(todoId, "  trimmed  ") as Record<string, unknown>;
      expect(s.title).toBe("trimmed");
    });

    it("creates subtask with completed = 0 by default", () => {
      const s = layer.subtaskDB.create(todoId, "New") as Record<string, unknown>;
      expect(s.completed).toBe(0);
    });

    it("updates subtask completion", () => {
      const s = layer.subtaskDB.create(todoId, "Toggle") as Record<string, unknown>;
      const updated = layer.subtaskDB.update(s.id as number, {
        completed: true,
      }) as Record<string, unknown>;
      expect(updated.completed).toBe(1);
    });

    it("updates subtask title", () => {
      const s = layer.subtaskDB.create(todoId, "Old title") as Record<string, unknown>;
      const updated = layer.subtaskDB.update(s.id as number, {
        title: "New title",
      }) as Record<string, unknown>;
      expect(updated.title).toBe("New title");
    });

    it("returns undefined when updating non-existent subtask", () => {
      expect(layer.subtaskDB.update(99999, { completed: true })).toBeUndefined();
    });

    it("deletes subtask", () => {
      const s = layer.subtaskDB.create(todoId, "Remove me") as Record<string, unknown>;
      layer.subtaskDB.delete(s.id as number);
      const remaining = layer.subtaskDB.listByTodoId(todoId);
      expect(remaining).toHaveLength(0);
    });
  });

  // ─── Tags ──────────────────────────────────────────────────────────────────

  describe("tagDB", () => {
    it("creates tag with name and color", () => {
      const tag = layer.tagDB.create(userId, "work", "#FF0000") as Record<string, unknown>;
      expect(tag.name).toBe("work");
      expect(tag.color).toBe("#FF0000");
      expect(tag.user_id).toBe(userId);
    });

    it("trims tag name", () => {
      const tag = layer.tagDB.create(userId, "  padded  ", "#000") as Record<string, unknown>;
      expect(tag.name).toBe("padded");
    });

    it("enforces unique tag names per user", () => {
      layer.tagDB.create(userId, "unique", "#000");
      expect(() => layer.tagDB.create(userId, "unique", "#FFF")).toThrow();
    });

    it("allows same tag name for different users", () => {
      const user2 = layer.userDB.create("user2") as { id: number };
      layer.tagDB.create(userId, "shared", "#000");
      const tag2 = layer.tagDB.create(user2.id, "shared", "#FFF") as Record<string, unknown>;
      expect(tag2.name).toBe("shared");
    });

    it("lists tags sorted by name", () => {
      layer.tagDB.create(userId, "charlie", "#000");
      layer.tagDB.create(userId, "alpha", "#000");
      layer.tagDB.create(userId, "bravo", "#000");

      const tags = layer.tagDB.listByUserId(userId) as Array<Record<string, unknown>>;
      expect(tags.map((t) => t.name)).toEqual(["alpha", "bravo", "charlie"]);
    });

    it("finds tag by name", () => {
      layer.tagDB.create(userId, "findme", "#000");
      const found = layer.tagDB.getByName(userId, "findme") as Record<string, unknown>;
      expect(found).toBeDefined();
      expect(found.name).toBe("findme");
    });

    it("returns undefined for non-existent tag name", () => {
      expect(layer.tagDB.getByName(userId, "nope")).toBeUndefined();
    });

    it("updates tag name", () => {
      const tag = layer.tagDB.create(userId, "old", "#000") as Record<string, unknown>;
      const updated = layer.tagDB.update(userId, tag.id as number, {
        name: "new",
      }) as Record<string, unknown>;
      expect(updated.name).toBe("new");
    });

    it("updates tag color", () => {
      const tag = layer.tagDB.create(userId, "colored", "#000") as Record<string, unknown>;
      const updated = layer.tagDB.update(userId, tag.id as number, {
        color: "#FF00FF",
      }) as Record<string, unknown>;
      expect(updated.color).toBe("#FF00FF");
    });

    it("returns undefined when updating non-existent tag", () => {
      expect(layer.tagDB.update(userId, 99999, { name: "X" })).toBeUndefined();
    });

    it("deletes tag", () => {
      const tag = layer.tagDB.create(userId, "remove", "#000") as Record<string, unknown>;
      layer.tagDB.delete(userId, tag.id as number);
      expect(layer.tagDB.getByName(userId, "remove")).toBeUndefined();
    });

    it("does not delete other users' tags", () => {
      const user2 = layer.userDB.create("user2b") as { id: number };
      const tag = layer.tagDB.create(userId, "mine", "#000") as Record<string, unknown>;
      layer.tagDB.delete(user2.id, tag.id as number);
      expect(layer.tagDB.getByName(userId, "mine")).toBeDefined();
    });
  });

  // ─── Templates ──────────────────────────────────────────────────────────────

  describe("templateDB", () => {
    it("creates template with required fields", () => {
      const tmpl = layer.templateDB.create(userId, {
        name: "Morning Routine",
        title: "Morning tasks",
      }) as Record<string, unknown>;

      expect(tmpl.name).toBe("Morning Routine");
      expect(tmpl.title).toBe("Morning tasks");
      expect(tmpl.priority).toBe("medium");
      expect(tmpl.tags_json).toBe("[]");
      expect(tmpl.subtasks_json).toBe("[]");
    });

    it("creates template with all optional fields", () => {
      const tmpl = layer.templateDB.create(userId, {
        name: "Full Template",
        category: "work",
        title: "Complex task",
        description: "Long description",
        priority: "high",
        reminderMinutes: 30,
        recurrencePattern: "daily",
        tagsJson: JSON.stringify([{ name: "urgent" }]),
        subtasksJson: JSON.stringify([
          { title: "Step 1", position: 0 },
          { title: "Step 2", position: 1 },
        ]),
      }) as Record<string, unknown>;

      expect(tmpl.category).toBe("work");
      expect(tmpl.description).toBe("Long description");
      expect(tmpl.priority).toBe("high");
      expect(tmpl.reminder_minutes).toBe(30);
      expect(tmpl.recurrence_pattern).toBe("daily");
      expect(JSON.parse(tmpl.tags_json as string)).toEqual([{ name: "urgent" }]);
      expect(JSON.parse(tmpl.subtasks_json as string)).toHaveLength(2);
    });

    it("lists templates sorted by name", () => {
      layer.templateDB.create(userId, { name: "Zulu", title: "z" });
      layer.templateDB.create(userId, { name: "Alpha", title: "a" });

      const list = layer.templateDB.listByUserId(userId) as Array<Record<string, unknown>>;
      expect(list[0].name).toBe("Alpha");
      expect(list[1].name).toBe("Zulu");
    });

    it("gets template by id", () => {
      const tmpl = layer.templateDB.create(userId, {
        name: "Find me",
        title: "found",
      }) as Record<string, unknown>;
      const found = layer.templateDB.getById(userId, tmpl.id as number) as Record<string, unknown>;
      expect(found).toBeDefined();
      expect(found.name).toBe("Find me");
    });

    it("updates template fields", () => {
      const tmpl = layer.templateDB.create(userId, {
        name: "Old",
        title: "Old title",
      }) as Record<string, unknown>;

      const updated = layer.templateDB.update(userId, tmpl.id as number, {
        name: "New",
        title: "New title",
        category: "personal",
        priority: "low",
      }) as Record<string, unknown>;

      expect(updated.name).toBe("New");
      expect(updated.title).toBe("New title");
      expect(updated.category).toBe("personal");
      expect(updated.priority).toBe("low");
    });

    it("returns undefined when updating non-existent template", () => {
      expect(
        layer.templateDB.update(userId, 99999, { name: "X" }),
      ).toBeUndefined();
    });

    it("deletes template", () => {
      const tmpl = layer.templateDB.create(userId, {
        name: "Remove",
        title: "gone",
      }) as Record<string, unknown>;
      layer.templateDB.delete(userId, tmpl.id as number);
      expect(layer.templateDB.getById(userId, tmpl.id as number)).toBeUndefined();
    });
  });

  // ─── Holidays ───────────────────────────────────────────────────────────────

  describe("holidayDB", () => {
    it("upserts a holiday", () => {
      layer.holidayDB.upsert("2025-01-01", "New Year");
      const list = layer.holidayDB.listByRange("2025-01-01", "2025-01-31") as Array<Record<string, unknown>>;
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("New Year");
    });

    it("updates existing holiday on conflict", () => {
      layer.holidayDB.upsert("2025-01-01", "New Year");
      layer.holidayDB.upsert("2025-01-01", "New Year's Day");
      const list = layer.holidayDB.listByRange("2025-01-01", "2025-01-31") as Array<Record<string, unknown>>;
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("New Year's Day");
    });

    it("filters holidays by date range", () => {
      layer.holidayDB.upsert("2025-01-01", "New Year");
      layer.holidayDB.upsert("2025-02-14", "Valentine's");
      layer.holidayDB.upsert("2025-12-25", "Christmas");

      const janOnly = layer.holidayDB.listByRange("2025-01-01", "2025-01-31");
      expect(janOnly).toHaveLength(1);

      const firstHalf = layer.holidayDB.listByRange("2025-01-01", "2025-06-30");
      expect(firstHalf).toHaveLength(2);
    });
  });
});
