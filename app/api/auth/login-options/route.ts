import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { authenticatorDB, userDB } from "@/lib/db";
import { setChallenge } from "@/lib/webauthn-store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const username = String(body?.username ?? "").trim();

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 },
    );
  }

  const user = userDB.findByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const authenticators = authenticatorDB.findByUserId(user.id).map((auth) => ({
    id: auth.credential_id,
    transports: JSON.parse(auth.transports ?? "[]"),
  }));

  const options = await generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID || "localhost",
    allowCredentials: authenticators,
    timeout: 120000,
    userVerification: "preferred",
  });

  setChallenge(username, options.challenge);
  return NextResponse.json(options);
}
