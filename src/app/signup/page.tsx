'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validateClient(): string | null {
    if (!name.trim()) return 'Name is required';
    if (!email.toLowerCase().endsWith('@hitchpartners.com')) {
      return 'Sign-ups are restricted to @hitchpartners.com email addresses';
    }
    if (pin !== confirmPin) return 'PINs do not match';
    if (!/^\d{4,8}$/.test(pin)) return 'PIN must be 4–8 digits';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = validateClient();
    if (clientError) { setError(clientError); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, pin, confirmPin }),
      });
      if (res.status === 201) {
        router.push('/login?signup=success');
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Signup failed. Please try again.');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-beige-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Create an account</h1>
          <p className="text-stone-400 text-sm mt-1">Hitch Partners team members only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-500 mb-1">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full px-4 py-3 rounded-lg bg-beige-50 border border-beige-300 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-transparent text-base"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-500 mb-1">Email</label>
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
            <label htmlFor="pin" className="block text-sm font-medium text-stone-500 mb-1">PIN</label>
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
            <label htmlFor="confirmPin" className="block text-sm font-medium text-stone-500 mb-1">Confirm PIN</label>
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
