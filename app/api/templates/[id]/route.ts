import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { templateDB } from "@/lib/db";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  templateDB.delete(session.userId, Number(id));
  return NextResponse.json({ success: true });
}
