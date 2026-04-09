import { request } from '@playwright/test'

/**
 * Warm up the dev server by hitting key routes to trigger on-demand compilation.
 * This prevents cold-start timeouts in the first test.
 */
export default async function globalSetup() {
  const ctx = await request.newContext({
    baseURL: 'http://localhost:3000',
    timeout: 60000,
  })
  try {
    // Warm up page routes + middleware (these trigger full page compilation)
    await ctx.get('/login')
    await ctx.get('/')

    // Warm up all API routes (errors expected — we just need compilation)
    await ctx.get('/api/auth/me').catch(() => {})
    await ctx.post('/api/auth/register-options', { data: { username: '__warmup__' } }).catch(() => {})
    await ctx.post('/api/auth/register-verify', { data: { username: '__warmup__', credential: {} } }).catch(() => {})
    await ctx.post('/api/auth/login-options', { data: { username: '__warmup__' } }).catch(() => {})
    await ctx.post('/api/auth/login-verify', { data: { username: '__warmup__', credential: {} } }).catch(() => {})
    await ctx.post('/api/auth/logout').catch(() => {})
    await ctx.get('/api/todos').catch(() => {})
    await ctx.get('/api/tags').catch(() => {})
    await ctx.get('/api/notifications/check').catch(() => {})
    await ctx.get('/api/templates').catch(() => {})
    await ctx.get('/api/todos/export').catch(() => {})
    await ctx.post('/api/todos/import', { data: {} }).catch(() => {})
    await ctx.get('/api/holidays').catch(() => {})
    await ctx.get('/calendar').catch(() => {})
  } catch {
    // Errors expected (401s, etc.) — we just need the compilation
  }
  await ctx.dispose()
}
