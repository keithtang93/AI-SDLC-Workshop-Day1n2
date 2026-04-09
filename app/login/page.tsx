'use client'

import { useState } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  async function handleRegister() {
    if (!username.trim()) {
      setError('Please enter a username')
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
        throw new Error(data.error || 'Failed to get registration options')
      }

      const options: PublicKeyCredentialCreationOptionsJSON = await optionsRes.json()
      const credential = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), credential }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || 'Registration verification failed')
      }

      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!username.trim()) {
      setError('Please enter a username')
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
        throw new Error(data.error || 'Failed to get login options')
      }

      const options: PublicKeyCredentialRequestOptionsJSON = await optionsRes.json()
      const credential = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), credential }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || 'Login verification failed')
      }

      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">✅ Todo App</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {mode === 'login' ? 'Sign in with your passkey' : 'Create a new account with a passkey'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (mode === 'login') handleLogin()
                  else handleRegister()
                }
              }}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={loading}
              autoFocus
            />
          </div>

          {mode === 'login' ? (
            <>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? 'Authenticating...' : '🔐 Sign In with Passkey'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('register'); setError('') }} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Register
                </button>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {loading ? 'Creating account...' : '🆕 Register with Passkey'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError('') }} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Sign In
                </button>
              </p>
            </>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            This app uses WebAuthn passkeys for passwordless authentication.
            Your biometric data never leaves your device.
          </p>
        </div>
      </div>
    </div>
  )
}
