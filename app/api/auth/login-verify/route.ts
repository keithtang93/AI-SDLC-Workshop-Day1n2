import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { loginChallengeStore } from '@/lib/challenges'
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
    const expectedChallenge = loginChallengeStore.get(trimmedUsername)
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge not found. Please try again.' }, { status: 400 })
    }

    const user = userDB.findByUsername(trimmedUsername)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const userAuths = authenticatorDB.findByUserId(user.id)
    const authenticator = userAuths.find(auth => auth.credential_id === credential.id)
    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 })
    }

    const rpID = process.env.RP_ID ?? 'localhost'
    const rpOrigin = process.env.RP_ORIGIN ?? 'http://localhost:3000'

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    loginChallengeStore.delete(trimmedUsername)

    authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0)

    await createSession(user.id, user.username)

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    logger.error('auth/login-verify', error)
    return NextResponse.json({ error: 'Login verification failed' }, { status: 500 })
  }
}
