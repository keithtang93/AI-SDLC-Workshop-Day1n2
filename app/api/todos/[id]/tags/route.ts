import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'
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
    const { tagIds } = await request.json()
    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 })
    }
    todoTagDB.setTagsForTodo(id, tagIds)
    const tags = todoTagDB.findByTodoId(id)
    return NextResponse.json(tags)
  } catch (error) {
    logger.error('todo-tags/set', error)
    return NextResponse.json({ error: 'Failed to set tags' }, { status: 500 })
  }
}

export async function DELETE(
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
    const url = new URL(request.url)
    const tagId = url.searchParams.get('tagId')
    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
    }
    todoTagDB.remove(id, tagId)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('todo-tags/remove', error)
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
