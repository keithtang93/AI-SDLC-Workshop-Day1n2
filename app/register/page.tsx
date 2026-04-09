'use client';

import { startRegistration } from '@simplewebauthn/browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error ?? 'Failed to start registration');
      }

      const options = await optionsRes.json();
      const response = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response })
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error ?? 'Registration failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-emerald-700 to-teal-500 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
        <p className="text-sm text-slate-600">Register with a passkey in one step.</p>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="your name"
          />
        </label>

        {error && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Passkey'}
        </button>

        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
