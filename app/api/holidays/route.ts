import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { holidayDB } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") || "1900-01-01";
  const end = searchParams.get("end") || "2100-12-31";

  const holidays = holidayDB.listByRange(start, end);
  return NextResponse.json({ holidays });
}
