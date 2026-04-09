import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { subtaskDB, todoDB } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const subtask = subtaskDB.findById(id)
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  // Verify ownership through parent todo
  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updateData: Partial<{ title: string; completed: boolean }> = {}
    if (body.title !== undefined) {
      if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      }
      updateData.title = body.title.trim()
    }
    if (body.completed !== undefined) updateData.completed = body.completed

    const updated = subtaskDB.update(id, updateData)
    return NextResponse.json(updated)
  } catch (error) {
    logger.error('subtasks/update', error)
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const subtask = subtaskDB.findById(id)
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  subtaskDB.remove(id)
  return NextResponse.json({ success: true })
}
