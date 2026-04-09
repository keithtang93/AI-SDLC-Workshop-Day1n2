import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const protectedPaths = ['/', '/calendar']

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    return new TextEncoder().encode('insecure-dev-only-fallback-secret-32ch')
  }
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = protectedPaths.some(
    p => pathname === p || (p !== '/' && pathname.startsWith(p))
  )

  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/', '/calendar'],
}
