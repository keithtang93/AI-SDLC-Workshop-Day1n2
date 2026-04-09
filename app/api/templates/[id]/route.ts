import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_PATTERNS = ['daily', 'weekly', 'monthly', 'yearly']

export async function GET(
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

  return NextResponse.json(template)
}

export async function PUT(
  request: Request,
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

  const existing = templateDB.findById(templateId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, subtasks_json } = body

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 })
    }

    if (title_template !== undefined && (!title_template || !title_template.trim())) {
      return NextResponse.json({ error: 'Title template cannot be empty' }, { status: 400 })
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    if (recurrence_pattern !== undefined && recurrence_pattern !== null && !VALID_PATTERNS.includes(recurrence_pattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 })
    }

    templateDB.update(templateId, session.userId, {
      name, description, category, title_template, priority,
      is_recurring, recurrence_pattern, reminder_minutes,
      subtasks_json,
    })

    const updated = templateDB.findById(templateId, session.userId)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(
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

  const existing = templateDB.findById(templateId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  templateDB.delete(templateId, session.userId)
  return NextResponse.json({ success: true })
}
