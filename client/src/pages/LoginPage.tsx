import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ApiError } from '../lib/api.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import ThemeToggle from '../components/ThemeToggle.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password.trim());
      navigate(user.role === 'owner' ? '/owner' : '/home', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="bg-brand-gradient flex flex-col items-center justify-end pb-10 pt-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="relative flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="BASE" className="h-16 w-16 brightness-0 invert" />
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter text-white leading-none">THE BASE</h1>
            <p className="text-white/70 text-sm font-medium tracking-widest uppercase mt-1">Fitness</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 bg-page dark:bg-page-dark px-6 py-8">
        <h2 className="text-xl font-black mb-6 text-gray-900 dark:text-white">Sign in</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••"
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
