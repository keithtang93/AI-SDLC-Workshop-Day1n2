import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, tagDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAllByUser(session.userId)
  const tags = tagDB.findAllByUser(session.userId)

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    todos: todos.map(todo => ({
      title: todo.title,
      completed: todo.completed,
      priority: todo.priority,
      due_date: todo.due_date,
      is_recurring: todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      subtasks: todo.subtasks.map(s => ({
        title: s.title,
        completed: s.completed,
        position: s.position,
      })),
      tags: todo.tags.map(t => t.name),
    })),
    tags: tags.map(t => ({
      name: t.name,
      color: t.color,
    })),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="todo-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
