import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todo = todoDB.findById(id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  try {
    const { title } = await request.json()
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
    }

    const subtask = subtaskDB.create({ todo_id: id, title: title.trim() })
    return NextResponse.json(subtask, { status: 201 })
  } catch (error) {
    logger.error('subtasks/create', error)
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}
