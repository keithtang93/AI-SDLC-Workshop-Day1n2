import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, tagDB, todoTagDB } from '@/lib/db'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { logger } from '@/lib/logger'
import { VALID_PRIORITIES, VALID_PATTERNS } from '@/lib/todo-utils'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const data = await request.json()

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 })
    }

    // Support both wrapped format and raw array
    const importData = Array.isArray(data) ? { todos: data } : data

    if (!Array.isArray(importData.todos)) {
      return NextResponse.json({ error: 'Invalid import format: todos array required' }, { status: 400 })
    }

    const todoIdMap = new Map<string, string>()
    const tagIdMap = new Map<string, string>()
    let importedCount = 0

    // Import tags and reuse existing by name
    if (Array.isArray(importData.tags)) {
      for (const tag of importData.tags) {
        if (!tag.name) continue
        const existing = tagDB.findByName(session.userId, tag.name)
        if (existing) {
          tagIdMap.set(tag.id, existing.id)
        } else {
          const newTag = tagDB.create({
            user_id: session.userId,
            name: tag.name,
            color: tag.color ?? '#3B82F6',
          })
          tagIdMap.set(tag.id, newTag.id)
        }
      }
    }

    // Import todos
    for (const todo of importData.todos) {
      if (!todo.title || typeof todo.title !== 'string') continue

      const priority = VALID_PRIORITIES.includes(todo.priority) ? todo.priority : 'medium'
      const recurrencePattern = VALID_PATTERNS.includes(todo.recurrence_pattern) ? todo.recurrence_pattern : null

      const newTodo = todoDB.create({
        user_id: session.userId,
        title: todo.title,
        priority,
        due_date: todo.due_date ?? null,
        is_recurring: !!todo.is_recurring,
        recurrence_pattern: recurrencePattern,
        reminder_minutes: todo.reminder_minutes ?? null,
      })

      if (todo.completed) {
        todoDB.update(newTodo.id, session.userId, { completed: true })
      }

      todoIdMap.set(todo.id, newTodo.id)
      importedCount++
    }

    // Import subtasks
    if (Array.isArray(importData.subtasks)) {
      for (const subtask of importData.subtasks) {
        const newTodoId = todoIdMap.get(subtask.todo_id)
        if (!newTodoId || !subtask.title) continue
        const newSub = subtaskDB.create({ todo_id: newTodoId, title: subtask.title })
        if (subtask.completed) {
          subtaskDB.update(newSub.id, { completed: true })
        }
      }
    }

    // Import todo-tag relationships
    if (Array.isArray(importData.todoTags)) {
      for (const tt of importData.todoTags) {
        const newTodoId = todoIdMap.get(tt.todo_id)
        const newTagId = tagIdMap.get(tt.tag_id)
        if (newTodoId && newTagId) {
          todoTagDB.add(newTodoId, newTagId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedCount} todos`,
      count: importedCount,
    })
  } catch (error) {
    logger.error('todos/import', error)
    return NextResponse.json({ error: 'Failed to import todos. Please check the file format.' }, { status: 400 })
  }
}
