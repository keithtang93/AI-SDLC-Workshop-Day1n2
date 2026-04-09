import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { userDB, authDB } from '@/lib/db'
import { loginChallengeStore } from '@/lib/challenge-store'

export async function POST(request: Request) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const user = userDB.findByUsername(trimmedUsername)

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please register first.' }, { status: 404 })
    }

    const authenticators = authDB.findByUserId(user.id)

    if (authenticators.length === 0) {
      return NextResponse.json({ error: 'No authenticators found for this user.' }, { status: 404 })
    }

    const rpID = process.env.RP_ID || 'localhost'

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map(auth => ({
        id: auth.credential_id,
        transports: (auth.transports?.split(',') || []) as AuthenticatorTransport[],
      })),
      userVerification: 'preferred',
    })

    loginChallengeStore.set(trimmedUsername, options.challenge)

    return NextResponse.json(options)
  } catch {
    return NextResponse.json({ error: 'Failed to generate login options' }, { status: 500 })
  }
}
