import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'session-token';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export interface Session {
  userId: number;
  username: string;
}

export async function createSession(userId: number, username: string): Promise<void> {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as { userId?: number; username?: string };
    if (!payload.userId || !payload.username) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
