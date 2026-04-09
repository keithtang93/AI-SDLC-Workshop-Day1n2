import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { setChallenge } from '@/lib/webauthn-store';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const username = String(body?.username ?? '').trim();

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const options = await generateRegistrationOptions({
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME || 'Todo App',
    userName: username,
    userDisplayName: username,
    timeout: 120000,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred'
    }
  });

  setChallenge(username, options.challenge);
  return NextResponse.json(options);
}
