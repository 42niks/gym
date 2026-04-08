import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ApiError } from '../lib/api.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import Alert from '../components/Alert.js';
import ThemeToggle from '../components/ThemeToggle.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err instanceof ApiError && err.status === 401 ? 'Authentication Failed' : err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 opacity-75 transition-opacity hover:opacity-100">
        <ThemeToggle />
      </div>

      <div className="flex min-h-full items-center justify-center bg-page px-6 py-10 sm:px-10">
        <div className="glass-panel w-full max-w-sm px-8 py-8">
          <div className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white px-6 py-5 shadow-panel dark:border-white/10 dark:bg-surface-dark">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,81,250,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,237,180,0.28),transparent_48%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,81,250,0.34),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,237,180,0.30),transparent_48%)]" />
            <div className="relative flex items-center gap-4">
              <img src="/logo.svg" alt="BASE" className="h-14 w-14" />
              <h1 className="font-headline text-[2.8rem] font-black uppercase tracking-[0.18em] text-gray-900 dark:text-white sm:text-[3.4rem]">
                BASE
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              labelClassName="ml-3 not-italic"
            />

            <div>
              <label className="mb-2 ml-3 block font-label text-[0.68rem] font-bold not-italic uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-2xl border border-line bg-white/90 px-4 py-3.5 pr-12 text-sm font-medium text-gray-900 shadow-sm shadow-black/5 transition-all placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-300/25 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <span className="material-symbols-outlined text-[1.2rem]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div role="alert">
                <Alert variant="error">{error}</Alert>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full" icon={loading ? 'progress_activity' : 'login'}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
