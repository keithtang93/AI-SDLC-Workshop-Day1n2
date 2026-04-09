import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ tags: tagDB.listByUserId(session.userId) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const color = String(body?.color ?? '#3B82F6');
  if (!name) {
    return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
  }

  const existing = tagDB.getByName(session.userId, name);
  if (existing) {
    return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
  }

  const tag = tagDB.create(session.userId, name, color);
  return NextResponse.json({ tag }, { status: 201 });
}
