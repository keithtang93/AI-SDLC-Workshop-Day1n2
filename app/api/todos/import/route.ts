import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  Priority,
  RecurrencePattern,
  subtaskDB,
  tagDB,
  todoDB,
} from "@/lib/db";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const data = body?.data;
  if (!data || !Array.isArray(data.todos)) {
    return NextResponse.json(
      { error: "Invalid import payload" },
      { status: 400 },
    );
  }

  const localTags = tagDB.listByUserId(session.userId);
  const tagMap = new Map<string, number>();
  for (const tag of localTags) {
    tagMap.set(tag.name, tag.id);
  }

  for (const importTag of data.tags ?? []) {
    if (!tagMap.has(importTag.name)) {
      const created = tagDB.create(
        session.userId,
        importTag.name,
        importTag.color || "#3B82F6",
      );
      tagMap.set(created.name, created.id);
    }
  }

  let imported = 0;
  for (const sourceTodo of data.todos as any[]) {
    const todo = todoDB.create({
      userId: session.userId,
      title: sourceTodo.title,
      description: sourceTodo.description ?? null,
      priority: (sourceTodo.priority ?? "medium") as Priority,
      dueDate: sourceTodo.due_date ?? null,
      reminderMinutes: sourceTodo.reminder_minutes ?? null,
      recurrencePattern: (sourceTodo.recurrence_pattern ??
        null) as RecurrencePattern | null,
      tagIds: (sourceTodo.tags ?? [])
        .map((tag: any) => tagMap.get(tag.name))
        .filter(
          (id: number | undefined): id is number => typeof id === "number",
        ),
    });

    for (const subtask of sourceTodo.subtasks ?? []) {
      if (subtask.title) {
        subtaskDB.create(todo.id, subtask.title);
      }
    }

    imported += 1;
  }

  return NextResponse.json({ success: true, imported });
}
