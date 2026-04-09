import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { userDB } from '@/lib/db'
import { registrationChallengeStore } from '@/lib/challenge-store'

export async function POST(request: Request) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    const existingUser = userDB.findByUsername(trimmedUsername)

    if (existingUser) {
      return NextResponse.json({ error: 'Username already registered. Please log in instead.' }, { status: 409 })
    }

    const rpID = process.env.RP_ID || 'localhost'
    const rpName = process.env.RP_NAME || 'Todo App'

    // Hash username to fit 1-64 byte requirement for user handle
    const encoder = new TextEncoder()
    const data = encoder.encode(trimmedUsername)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const userID = new Uint8Array(hashBuffer)

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: trimmedUsername,
      userID,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    registrationChallengeStore.set(trimmedUsername, options.challenge)

    return NextResponse.json(options)
  } catch {
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 })
  }
}
