import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, templateDB, todoDB } from '@/lib/db';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const template = templateDB.getById(session.userId, Number(id));
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const tags = JSON.parse(template.tags_json || '[]') as number[];
  const subtasks = JSON.parse(template.subtasks_json || '[]') as Array<{ title: string }>;

  const todo = todoDB.create({
    userId: session.userId,
    title: template.title,
    description: template.description,
    priority: template.priority,
    reminderMinutes: template.reminder_minutes,
    recurrencePattern: template.recurrence_pattern,
    tagIds: tags
  });

  for (const subtask of subtasks) {
    if (subtask.title) {
      subtaskDB.create(todo.id, subtask.title);
    }
  }

  return NextResponse.json({ todo }, { status: 201 });
}
