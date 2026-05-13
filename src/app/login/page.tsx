'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });

      if (res.ok) {
        const from = searchParams.get('from') ?? '/chat';
        router.push(from);
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Login failed');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-500 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full px-4 py-3 rounded-lg bg-beige-50 border border-beige-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-transparent text-base"
          placeholder="you@hitchpartners.com"
        />
      </div>

      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-stone-500 mb-1">
          PIN
        </label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
          autoComplete="current-password"
          inputMode="numeric"
          className="w-full px-4 py-3 rounded-lg bg-beige-50 border border-beige-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-transparent text-base"
          placeholder="••••"
        />
      </div>

      {error && <p className="text-[#991B1B] text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-medium text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-beige-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Sloane</h1>
          <p className="text-stone-400 text-sm mt-1">Hitch Partners Intelligence</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
