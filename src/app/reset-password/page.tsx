'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [tokenState, setTokenState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setTokenState('invalid'); return; }
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`)
      .then((r) => setTokenState(r.ok ? 'valid' : 'invalid'))
      .catch(() => setTokenState('invalid'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    if (!/^\d{4,8}$/.test(pin)) { setError('PIN must be 4–8 digits'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin, confirmPin }),
      });
      if (res.ok) {
        router.push('/login?reset=success');
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Reset failed. Please try again.');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (tokenState === 'loading') {
    return <p className="text-center text-stone-400 text-sm">Verifying link…</p>;
  }

  if (tokenState === 'invalid') {
    return (
      <div className="text-center space-y-3">
        <p className="text-stone-500 text-sm">This link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-teal-700 hover:underline text-sm">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-stone-500 mb-1">New PIN</label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
          inputMode="numeric"
          className="w-full px-4 py-3 rounded-lg bg-beige-50 border border-beige-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-transparent text-base"
          placeholder="4–8 digits"
        />
      </div>
      <div>
        <label htmlFor="confirmPin" className="block text-sm font-medium text-stone-500 mb-1">Confirm new PIN</label>
        <input
          id="confirmPin"
          type="password"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          required
          inputMode="numeric"
          className="w-full px-4 py-3 rounded-lg bg-beige-50 border border-beige-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-transparent text-base"
          placeholder="Repeat PIN"
        />
      </div>

      {error && <p className="text-[#991B1B] text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-medium text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {loading ? 'Saving…' : 'Set new PIN'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-beige-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Set new PIN</h1>
          <p className="text-stone-400 text-sm mt-1">Choose a new 4–8 digit PIN</p>
        </div>
        <Suspense fallback={<p className="text-center text-stone-400 text-sm">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
