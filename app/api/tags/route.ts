import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tags = tagDB.findAllByUser(session.userId)
  return NextResponse.json(tags)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { name, color } = await request.json()
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const existing = tagDB.findByName(session.userId, name.trim())
    if (existing) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 400 })
    }

    const tag = tagDB.create({ user_id: session.userId, name: name.trim(), color })
    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    logger.error('tags/create', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
