import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
}

const globalStore = globalThis as unknown as {
  _rateLimitLog?: Map<string, number[]>
  _rateLimitLastCleanup?: number
}

if (!globalStore._rateLimitLog) {
  globalStore._rateLimitLog = new Map<string, number[]>()
}
if (!globalStore._rateLimitLastCleanup) {
  globalStore._rateLimitLastCleanup = Date.now()
}

const requestLog = globalStore._rateLimitLog

const CLEANUP_INTERVAL_MS = 60_000

function cleanupExpiredEntries(maxWindowMs: number): void {
  const now = Date.now()
  if (now - (globalStore._rateLimitLastCleanup ?? 0) < CLEANUP_INTERVAL_MS) return
  globalStore._rateLimitLastCleanup = now

  const cutoff = now - maxWindowMs
  for (const [key, timestamps] of requestLog) {
    const valid = timestamps.filter(t => t > cutoff)
    if (valid.length === 0) {
      requestLog.delete(key)
    } else {
      requestLog.set(key, valid)
    }
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return '127.0.0.1'
}

export function rateLimit(request: NextRequest, config: RateLimitConfig): RateLimitResult {
  const { windowMs, maxRequests } = config
  const ip = getClientIp(request)
  const now = Date.now()
  const windowStart = now - windowMs

  cleanupExpiredEntries(windowMs)

  const existing = requestLog.get(ip) ?? []
  const windowHits = existing.filter(t => t > windowStart)

  if (windowHits.length >= maxRequests) {
    return { success: false, remaining: 0 }
  }

  requestLog.set(ip, [...windowHits, now])

  return { success: true, remaining: maxRequests - windowHits.length - 1 }
}
