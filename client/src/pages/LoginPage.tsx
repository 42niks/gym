import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { ApiError } from '../lib/api.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import Alert from '../components/Alert.js';
import ThemeToggle from '../components/ThemeToggle.js';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPasswordOptionalInDev = import.meta.env.DEV;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordInputId = 'login-password';

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
          <div className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white px-6 py-6 shadow-panel dark:border-white/10 dark:bg-surface-dark">
            <div className="brand-duotone-panel absolute inset-0" />
            <div className="relative flex min-h-[10.25rem] flex-col justify-between pt-1">
              <div className="ml-1">
                <img
                  src={theme === 'dark' ? '/base-wordmark-dark.png' : '/base-wordmark-light.png'}
                  alt="BASE"
                  className="h-[4.05rem] w-auto"
                />
              </div>
              <div className="ml-auto max-w-[13.5rem] text-right">
                <p
                  aria-label="Your Strength Habitat"
                  className="font-brand text-[1.22rem] font-black uppercase tracking-[0.16em] text-[#1f6c58] dark:text-[#d90a0a]"
                >
                  YOUR
                  <br />
                  STRENGTH
                  <br />
                  HABITAT
                </p>
              </div>
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
              <label htmlFor={passwordInputId} className="mb-2 ml-3 block font-label text-[0.68rem] font-bold not-italic uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  id={passwordInputId}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required={!isPasswordOptionalInDev}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isPasswordOptionalInDev ? 'Optional in local dev' : '••••••••••'}
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
