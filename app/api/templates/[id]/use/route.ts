import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB, todoDB, subtaskDB } from '@/lib/db'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const templateId = parseInt(id, 10)
  if (isNaN(templateId)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
  }

  const template = templateDB.findById(templateId, session.userId)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const todoId = todoDB.create({
    user_id: session.userId,
    title: template.title_template,
    priority: template.priority,
    is_recurring: template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  })

  // Create subtasks from template
  if (template.subtasks && Array.isArray(template.subtasks)) {
    for (const sub of template.subtasks) {
      if (sub && typeof sub === 'object' && sub.title) {
        subtaskDB.create(todoId, sub.title)
      }
    }
  }

  const todo = todoDB.findById(todoId, session.userId)
  return NextResponse.json(todo, { status: 201 })
}
