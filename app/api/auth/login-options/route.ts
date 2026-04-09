import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { userDB, authenticatorDB } from '@/lib/db'
import { loginChallengeStore } from '@/lib/challenges'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request, { windowMs: 60_000, maxRequests: 100 })
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { username } = await request.json()
    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const user = userDB.findByUsername(trimmedUsername)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const userAuths = authenticatorDB.findByUserId(user.id)
    if (userAuths.length === 0) {
      return NextResponse.json({ error: 'No credentials registered' }, { status: 400 })
    }

    const rpID = process.env.RP_ID ?? 'localhost'

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userAuths.map(auth => ({
        id: auth.credential_id,
        transports: JSON.parse(auth.transports || '[]'),
      })),
      userVerification: 'preferred',
    })

    loginChallengeStore.set(trimmedUsername, options.challenge)

    return NextResponse.json(options)
  } catch (error) {
    logger.error('auth/login-options', error)
    return NextResponse.json({ error: 'Failed to generate login options' }, { status: 500 })
  }
}
