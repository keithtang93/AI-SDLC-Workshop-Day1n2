import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { userDB, authDB } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { registrationChallengeStore } from '@/lib/challenge-store'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export async function POST(request: Request) {
  try {
    const { username, credential } = await request.json()

    if (!username || !credential) {
      return NextResponse.json({ error: 'Username and credential are required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const expectedChallenge = registrationChallengeStore.get(trimmedUsername)

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No registration challenge found. Please try again.' }, { status: 400 })
    }

    const rpID = process.env.RP_ID || 'localhost'
    const rpOrigin = process.env.RP_ORIGIN || 'http://localhost:3000'

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 })
    }

    registrationChallengeStore.delete(trimmedUsername)

    const { credential: cred } = verification.registrationInfo

    const user = userDB.create(trimmedUsername)

    authDB.create({
      user_id: user.id,
      credential_id: cred.id,
      credential_public_key: isoBase64URL.fromBuffer(cred.publicKey),
      counter: cred.counter ?? 0,
      transports: credential.response?.transports?.join(',') || null,
    })

    await createSession(user.id)

    return NextResponse.json({ verified: true, username: user.username })
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
