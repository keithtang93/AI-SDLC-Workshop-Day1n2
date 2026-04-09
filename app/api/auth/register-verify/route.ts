import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createSession } from "@/lib/auth";
import { authenticatorDB, userDB } from "@/lib/db";
import { consumeChallenge } from "@/lib/webauthn-store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const username = String(body?.username ?? "").trim();
  const attestationResponse = body?.response;

  if (!username || !attestationResponse) {
    return NextResponse.json(
      { error: "Missing registration payload" },
      { status: 400 },
    );
  }

  const expectedChallenge = consumeChallenge(username);
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "Registration challenge expired" },
      { status: 400 },
    );
  }

  const verification = await verifyRegistrationResponse({
    response: attestationResponse,
    expectedChallenge,
    expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
    expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 400 },
    );
  }

  let user = userDB.findByUsername(username);
  if (!user) {
    user = userDB.create(username);
  }

  const credentialId = verification.registrationInfo.credential.id;
  const existing = authenticatorDB.findByCredentialId(credentialId);
  if (!existing) {
    authenticatorDB.create({
      userId: user.id,
      credentialId,
      publicKey: isoBase64URL.fromBuffer(
        verification.registrationInfo.credential.publicKey,
      ),
      signCount: verification.registrationInfo.credential.counter ?? 0,
      transports: attestationResponse.response.transports ?? [],
    });
  }

  await createSession(user.id, user.username);
  return NextResponse.json({ success: true });
}
