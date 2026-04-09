import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB, todoDB, subtaskDB } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const template = templateDB.findById(id, session.userId)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  try {
    // Calculate due date from offset
    let dueDate: string | null = null
    if (template.due_date_offset_days != null) {
      const date = new Date()
      date.setDate(date.getDate() + template.due_date_offset_days)
      dueDate = date.toISOString()
    }

    const todo = todoDB.create({
      user_id: session.userId,
      title: template.title_template,
      priority: template.priority,
      due_date: dueDate,
      is_recurring: template.is_recurring,
      recurrence_pattern: template.recurrence_pattern,
      reminder_minutes: template.reminder_minutes,
    })

    // Create subtasks from JSON
    if (template.subtasks_json) {
      try {
        const subtasks = JSON.parse(template.subtasks_json) as Array<{ title: string; position: number }>
        for (const sub of subtasks) {
          subtaskDB.create({ todo_id: todo.id, title: sub.title })
        }
      } catch {
        // Skip invalid subtasks JSON silently
      }
    }

    const todoWithRelations = todoDB.findByIdWithRelations(todo.id, session.userId)
    return NextResponse.json(todoWithRelations, { status: 201 })
  } catch (error) {
    logger.error('templates/use', error)
    return NextResponse.json({ error: 'Failed to create todo from template' }, { status: 500 })
  }
}
