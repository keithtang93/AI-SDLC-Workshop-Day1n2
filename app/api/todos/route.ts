import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Priority, RecurrencePattern, todoDB } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const todos = todoDB.listByUserId(session.userId);
  return NextResponse.json({ todos });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const todo = todoDB.create({
    userId: session.userId,
    title,
    description: body?.description ?? null,
    priority: (body?.priority ?? "medium") as Priority,
    dueDate: body?.due_date ?? null,
    reminderMinutes: body?.reminder_minutes ?? null,
    recurrencePattern: (body?.recurrence_pattern ??
      null) as RecurrencePattern | null,
    tagIds: Array.isArray(body?.tag_ids) ? body.tag_ids : [],
  });

  return NextResponse.json({ todo }, { status: 201 });
}
