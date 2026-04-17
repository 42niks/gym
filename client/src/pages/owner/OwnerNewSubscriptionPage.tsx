import { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type ManagedPackage, type Subscription, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';
import Alert from '../../components/Alert.js';
import { ownerLinks } from './ownerLinks.js';
import { getFirstFormErrorMessage } from '../../lib/formValidation.js';

export default function OwnerNewSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPackage, setSelectedPackage] = useState<ManagedPackage | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [errorPulse, setErrorPulse] = useState(0);
  const [loading, setLoading] = useState(false);
  const view = searchParams.get('view');
  const viewQuery = view ? `?view=${encodeURIComponent(view)}` : '';

  const { data: packages = [], isLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/api/packages'),
  });

  function handlePackageSelect(pkg: ManagedPackage) {
    setSelectedPackage(pkg);
    setAmount(String(pkg.price));
  }

  function showError(message: string) {
    setError(message);
    setErrorPulse(v => v + 1);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');
    setAmount(digits);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPackage) return;
    setError('');
    const validationError = getFirstFormErrorMessage(e.currentTarget);
    if (validationError) {
      showError(validationError);
      return;
    }
    setLoading(true);
    try {
      await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
        package_id: selectedPackage.id,
        start_date: startDate,
        amount: Number(amount),
      });
      navigate(`/members/${id}${viewQuery}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const byType = packages
    .filter(pkg => pkg.is_active)
    .reduce<Record<string, ManagedPackage[]>>((acc, pkg) => {
    if (!acc[pkg.service_type]) acc[pkg.service_type] = [];
    acc[pkg.service_type].push(pkg);
    return acc;
  }, {});

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-4xl">
        <Link to={`/members/${id}${viewQuery}`} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Member
        </Link>
        <p className="section-eyebrow">Owner actions</p>
        <h2 className="page-title mb-6 mt-2">New subscription</h2>
        <p className="-mt-3 max-w-2xl text-sm text-black/60 dark:text-white/70">
          Pick a package, confirm the start date, and lock in the final amount collected for this member.
        </p>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="space-y-5">
              {Object.entries(byType).map(([type, pkgs]) => (
                <div key={type}>
                  <p className="section-eyebrow mb-3">{type}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {pkgs.map(pkg => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handlePackageSelect(pkg)}
                        className={`rounded-[1.5rem] border p-4 text-left shadow-sm shadow-black/5 transition-all ${
                          selectedPackage?.id === pkg.id
                            ? 'border-black bg-white bg-brand-gradient shadow-panel dark:border-white dark:bg-surface-dark dark:bg-brand-gradient-dark'
                            : 'border-black bg-white/80 hover:border-brand-300 hover:bg-brand-50/60 dark:border-white dark:bg-surface-dark/80 dark:hover:bg-surface-raised/85'
                        }`}
                      >
                        <p className="font-headline text-xl font-black italic uppercase tracking-tight text-black dark:text-white">{pkg.sessions} sessions</p>
                        <p className="mt-1 text-xs text-black/60 dark:text-white/70">{pkg.duration_months}mo</p>
                        <p className={`mt-2 text-sm font-black ${selectedPackage?.id === pkg.id ? 'text-black dark:text-white' : 'text-black/75 dark:text-white/80'}`}>
                          ₹{pkg.price.toLocaleString('en-IN')}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedPackage && (
              <Card className="p-5 space-y-4">
                <Input label="Start date" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input label="Amount (₹)" type="text" inputMode="numeric" pattern="[0-9]*" required value={amount} onChange={handleAmountChange} />

                {error && (
                  <div key={errorPulse} className="form-error-flash">
                    <Alert variant="error">{error}</Alert>
                  </div>
                )}

                <Button type="submit" disabled={loading} size="lg" className="w-full" icon={loading ? 'progress_activity' : 'add_card'}>
                  {loading ? 'Creating…' : 'Create subscription'}
                </Button>
              </Card>
            )}
          </form>
        )}
      </div>
    </AppShell>
  );
}
