import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createSession } from "@/lib/auth";
import { authenticatorDB, userDB } from "@/lib/db";
import { consumeChallenge } from "@/lib/webauthn-store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const username = String(body?.username ?? "").trim();
  const authenticationResponse = body?.response;

  if (!username || !authenticationResponse) {
    return NextResponse.json(
      { error: "Missing authentication payload" },
      { status: 400 },
    );
  }

  const expectedChallenge = consumeChallenge(username);
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "Authentication challenge expired" },
      { status: 400 },
    );
  }

  const credentialId = String(authenticationResponse.id ?? "");
  const authenticator = authenticatorDB.findByCredentialId(credentialId);
  if (!authenticator) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 400 },
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
    expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
    credential: {
      id: authenticator.credential_id,
      publicKey: isoBase64URL.toBuffer(authenticator.public_key),
      counter: authenticator.sign_count ?? 0,
      transports: JSON.parse(authenticator.transports ?? "[]"),
    },
  });

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 400 },
    );
  }

  authenticatorDB.updateCounter(
    authenticator.id,
    verification.authenticationInfo.newCounter ?? 0,
  );

  const user = userDB.findById(authenticator.user_id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await createSession(user.id, user.username);
  return NextResponse.json({ success: true });
}
