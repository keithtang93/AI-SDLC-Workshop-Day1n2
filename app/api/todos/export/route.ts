import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.listByUserId(session.userId);
  const tags = tagDB.listByUserId(session.userId);

  return NextResponse.json({
    version: 1,
    exportDate: new Date().toISOString(),
    todos,
    tags
  });
}
