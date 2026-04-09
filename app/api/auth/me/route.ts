import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { userDB } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = userDB.findById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    },
  });
}
