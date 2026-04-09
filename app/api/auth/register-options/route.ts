import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { userDB, authenticatorDB } from '@/lib/db'
import { registrationChallengeStore } from '@/lib/challenges'
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
    let user = userDB.findByUsername(trimmedUsername)

    if (user) {
      const existingAuths = authenticatorDB.findByUserId(user.id)
      if (existingAuths.length > 0) {
        return NextResponse.json({ error: 'User already registered' }, { status: 400 })
      }
    }

    if (!user) {
      user = userDB.create(trimmedUsername)
    }

    const rpID = process.env.RP_ID ?? 'localhost'
    const rpName = process.env.RP_NAME ?? 'Todo App'

    const existingAuths = authenticatorDB.findByUserId(user.id)

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: trimmedUsername,
      attestationType: 'none',
      excludeCredentials: existingAuths.map(auth => ({
        id: auth.credential_id,
        transports: JSON.parse(auth.transports || '[]'),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    registrationChallengeStore.set(trimmedUsername, options.challenge)

    return NextResponse.json(options)
  } catch (error) {
    logger.error('auth/register-options', error)
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 })
  }
}
