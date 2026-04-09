import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'
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
  try {
    const { name, color } = await request.json()
    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // Check for duplicate name
    if (name) {
      const existing = tagDB.findByName(session.userId, name.trim())
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'Tag name already exists' }, { status: 400 })
      }
    }

    const updated = tagDB.update(id, session.userId, {
      name: name?.trim(),
      color,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('tags/update', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
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
  const deleted = tagDB.remove(id, session.userId)
  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
