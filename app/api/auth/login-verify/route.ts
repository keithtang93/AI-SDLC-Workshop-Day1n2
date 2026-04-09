import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { userDB, authDB } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { loginChallengeStore } from '@/lib/challenge-store'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export async function POST(request: Request) {
  try {
    const { username, credential } = await request.json()

    if (!username || !credential) {
      return NextResponse.json({ error: 'Username and credential are required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const expectedChallenge = loginChallengeStore.get(trimmedUsername)

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No login challenge found. Please try again.' }, { status: 400 })
    }

    const user = userDB.findByUsername(trimmedUsername)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const credentialIdFromResponse = credential.id
    const authenticator = authDB.findByCredentialId(credentialIdFromResponse)

    if (!authenticator || authenticator.user_id !== user.id) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 })
    }

    const rpID = process.env.RP_ID || 'localhost'
    const rpOrigin = process.env.RP_ORIGIN || 'http://localhost:3000'

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: (authenticator.transports?.split(',') || []) as AuthenticatorTransport[],
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 })
    }

    loginChallengeStore.delete(trimmedUsername)

    authDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0)

    await createSession(user.id)

    return NextResponse.json({ verified: true, username: user.username })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
