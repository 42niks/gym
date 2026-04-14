import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { ApiError } from '../lib/api.js';
import Input from '../components/Input.js';
import Button from '../components/Button.js';
import Alert from '../components/Alert.js';
import ThemeToggle from '../components/ThemeToggle.js';
import Icon from '../components/Icon.js';

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
      await login(email.trim(), password.trim());
      navigate('/home', { replace: true });
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

      <div className="brand-duotone-page relative min-h-screen overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-5 h-24 rounded-full bg-white/30 blur-3xl dark:bg-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 top-24 h-40 w-40 rounded-full bg-accent-500/15 blur-3xl dark:bg-accent-500/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 bottom-20 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-400/15"
        />

        <div className="relative flex min-h-screen items-start justify-center px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pb-10 sm:pt-6">
          <div className="w-full max-w-sm">
            <div className="relative mb-4 overflow-hidden rounded-[2rem] border border-black bg-white/78 px-5 py-5 shadow-panel backdrop-blur-md dark:border-white dark:bg-surface-dark/82 sm:mb-5 sm:px-6 sm:py-6">
              <div className="brand-duotone-panel absolute inset-0" />
              <div className="relative flex min-h-[10.5rem] flex-col justify-between pt-1">
                <div className="ml-1">
                  <img
                    src={theme === 'dark' ? '/base-wordmark-dark.png' : '/base-wordmark-light.png'}
                    alt="BASE"
                    className="h-[4.44rem] w-auto sm:h-[4.86rem]"
                  />
                </div>
                <div className="ml-auto max-w-[13.5rem] text-right">
                  <p
                    aria-label="Your Strength Habitat"
                    className="font-brand text-[1.53rem] font-black uppercase tracking-[0.16em] text-[#226350] dark:text-[#e00b0b] sm:text-[1.69rem]"
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

            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-[2rem] border border-black bg-white/82 p-4 shadow-panel backdrop-blur-md dark:border-white dark:bg-surface-dark/84 sm:p-5"
            >
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
                <label htmlFor={passwordInputId} className="field-label ml-3 not-italic">
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
                    placeholder={isPasswordOptionalInDev ? 'Optional in local dev' : 'Enter password'}
                    className="field-control pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black/70 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white/80"
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="block text-[1.2rem]" />
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
      </div>
    </>
  );
}
