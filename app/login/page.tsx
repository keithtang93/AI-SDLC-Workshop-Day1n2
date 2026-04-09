'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)

  // Redirect if already authenticated
  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (res.ok) router.push('/')
    }).catch(() => {})
  }, [router])

  async function handleRegister() {
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    setError('')
    setLoading(true)

    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      const options = await optionsRes.json()
      const credential = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), credential }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || 'Verification failed')
        setLoading(false)
        return
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    setError('')
    setLoading(true)

    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      const options = await optionsRes.json()
      const credential = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), credential }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || 'Verification failed')
        setLoading(false)
        return
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div role="main" aria-label="Authentication" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div aria-label="Authentication form" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          Todo App
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Secure, passwordless authentication
        </p>

        <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => { setIsLogin(true); setError(''); handleLogin() }}
            aria-label="Switch to login mode"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isLogin
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); handleRegister() }}
            aria-label="Switch to register mode"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isLogin
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              aria-required="true"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { if (isLogin) { handleLogin() } else { handleRegister() } }
              }}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={isLogin ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? '🔑 Sign in with Passkey' : '🆕 Sign up with Passkey'}
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Uses WebAuthn / Passkeys for secure, passwordless authentication
        </p>
      </div>
    </div>
  )
}
