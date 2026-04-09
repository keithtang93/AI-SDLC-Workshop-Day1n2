import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { registrationChallengeStore } from '@/lib/challenges'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request, { windowMs: 60_000, maxRequests: 100 })
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { username, credential } = body

    if (!username || !credential) {
      return NextResponse.json({ error: 'Missing username or credential' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const expectedChallenge = registrationChallengeStore.get(trimmedUsername)
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge not found. Please try again.' }, { status: 400 })
    }

    const rpID = process.env.RP_ID ?? 'localhost'
    const rpOrigin = process.env.RP_ORIGIN ?? 'http://localhost:3000'

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    registrationChallengeStore.delete(trimmedUsername)

    const user = userDB.findByUsername(trimmedUsername)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const { credential: cred } = verification.registrationInfo
    const credentialPublicKeyBase64 = isoBase64URL.fromBuffer(cred.publicKey)

    authenticatorDB.create({
      user_id: user.id,
      credential_id: cred.id,
      credential_public_key: credentialPublicKeyBase64,
      counter: cred.counter ?? 0,
      transports: credential.response?.transports ?? [],
    })

    await createSession(user.id, user.username)

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    logger.error('auth/register-verify', error)
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 500 })
  }
}
