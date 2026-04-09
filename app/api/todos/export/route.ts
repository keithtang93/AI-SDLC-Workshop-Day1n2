import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, tagDB, todoTagDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'json'

  const todos = todoDB.findAllByUser(session.userId)
  const tags = tagDB.findAllByUser(session.userId)

  const allSubtasks: Array<{ id: string; todo_id: string; title: string; completed: boolean; position: number; created_at: string }> = []
  const allTodoTags: Array<{ todo_id: string; tag_id: string }> = []

  for (const todo of todos) {
    const subs = subtaskDB.findByTodoId(todo.id)
    allSubtasks.push(...subs)
    const todoTags = todoTagDB.findByTodoId(todo.id)
    for (const tag of todoTags) {
      allTodoTags.push({ todo_id: todo.id, tag_id: tag.id })
    }
  }

  if (format === 'csv') {
    const headers = ['ID', 'Title', 'Completed', 'Due Date', 'Priority', 'Recurring', 'Pattern', 'Reminder', 'Created']
    const rows = todos.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.completed,
      t.due_date ?? '',
      t.priority,
      t.is_recurring,
      t.recurrence_pattern ?? '',
      t.reminder_minutes ?? '',
      t.created_at,
    ].join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const now = new Date().toISOString().split('T')[0]
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="todos-${now}.csv"`,
      },
    })
  }

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos,
    subtasks: allSubtasks,
    tags,
    todoTags: allTodoTags,
  }

  const now = new Date().toISOString().split('T')[0]
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="todos-${now}.json"`,
    },
  })
}
