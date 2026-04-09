import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, tagDB, todoTagDB } from '@/lib/db'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate schema version
    if (!body || body.version !== 1) {
      return NextResponse.json({ error: 'Unsupported export version. Expected version 1.' }, { status: 400 })
    }

    if (!Array.isArray(body.todos)) {
      return NextResponse.json({ error: 'Invalid format: todos must be an array' }, { status: 400 })
    }

    const MAX_TODOS = 500
    const MAX_SUBTASKS_PER_TODO = 50
    const MAX_TAGS = 100
    const MAX_TITLE_LENGTH = 500

    if (body.todos.length > MAX_TODOS) {
      return NextResponse.json({ error: `Import limited to ${MAX_TODOS} todos` }, { status: 400 })
    }

    if (Array.isArray(body.tags) && body.tags.length > MAX_TAGS) {
      return NextResponse.json({ error: `Import limited to ${MAX_TAGS} tags` }, { status: 400 })
    }

    // Get existing tags for the user to reuse by name
    const existingTags = tagDB.findAllByUser(session.userId)
    const tagNameMap = new Map(existingTags.map(t => [t.name.toLowerCase(), t]))

    // Import tags first - reuse existing or create new
    let tagsCreated = 0
    if (Array.isArray(body.tags)) {
      for (const tag of body.tags) {
        if (!tag || !tag.name) continue
        const key = tag.name.trim().toLowerCase()
        if (!tagNameMap.has(key)) {
          const id = tagDB.create(session.userId, tag.name.trim(), tag.color || '#3B82F6')
          tagNameMap.set(key, { id, user_id: session.userId, name: tag.name.trim(), color: tag.color || '#3B82F6', created_at: '', updated_at: '' })
          tagsCreated++
        }
      }
    }

    // Import todos
    let todosCreated = 0
    let subtasksCreated = 0

    for (const todo of body.todos) {
      if (!todo || !todo.title) continue

      const title = String(todo.title).slice(0, MAX_TITLE_LENGTH)

      const todoId = todoDB.create({
        user_id: session.userId,
        title,
        priority: ['high', 'medium', 'low'].includes(todo.priority) ? todo.priority : 'medium',
        due_date: todo.due_date || null,
        is_recurring: !!todo.is_recurring,
        recurrence_pattern: todo.recurrence_pattern || null,
        reminder_minutes: todo.reminder_minutes ?? null,
      })

      // If the imported todo was completed, update it
      if (todo.completed) {
        todoDB.update(todoId, session.userId, { completed: true })
      }

      // Import subtasks
      if (Array.isArray(todo.subtasks)) {
        for (const sub of todo.subtasks.slice(0, MAX_SUBTASKS_PER_TODO)) {
          if (!sub || !sub.title) continue
          const subId = subtaskDB.create(todoId, String(sub.title).slice(0, MAX_TITLE_LENGTH))
          if (sub.completed) {
            subtaskDB.update(subId, { completed: true })
          }
          subtasksCreated++
        }
      }

      // Assign tags by name
      if (Array.isArray(todo.tags)) {
        for (const tagName of todo.tags) {
          if (!tagName) continue
          const existing = tagNameMap.get(String(tagName).trim().toLowerCase())
          if (existing) {
            todoTagDB.assign(todoId, existing.id)
          }
        }
      }

      todosCreated++
    }

    return NextResponse.json({
      success: true,
      imported: {
        todos: todosCreated,
        subtasks: subtasksCreated,
        tags: tagsCreated,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON data' }, { status: 400 })
  }
}
