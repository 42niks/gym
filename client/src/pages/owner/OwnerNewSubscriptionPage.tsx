import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, type ManagedPackage, type MemberDetail, type Subscription } from '../../lib/api.js';
import Alert from '../../components/Alert.js';
import AppShell from '../../components/AppShell.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Input from '../../components/Input.js';
import Spinner from '../../components/Spinner.js';
import { formatFullDate } from '../../components/attendance/AttendanceCalendar.js';
import { ownerLinks } from './ownerLinks.js';

function computeEndDate(fromStartDate: string, durationMonths: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStartDate)) {
    return '';
  }
  const [year, month, day] = fromStartDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) {
    return '';
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + durationMonths, start.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function isValidYmdDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function OwnerNewSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPackage, setSelectedPackage] = useState<ManagedPackage | null>(null);
  const [mode, setMode] = useState<'existing' | 'custom'>('existing');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [existingEndDate, setExistingEndDate] = useState('');
  const [existingEndDateTouched, setExistingEndDateTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSessions, setCustomSessions] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customWindowDays, setCustomWindowDays] = useState('7');
  const [customMinDays, setCustomMinDays] = useState('3');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const view = searchParams.get('view');
  const viewQuery = view ? `?view=${encodeURIComponent(view)}` : '';

  const { data: memberDetail, isLoading: memberLoading } = useQuery<MemberDetail>({
    queryKey: ['member-detail', id],
    enabled: !!id,
    queryFn: () => api.get(`/api/members/${id}`),
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/api/packages'),
  });

  useEffect(() => {
    if (!memberDetail) return;
    setStartDate((current) => (current < memberDetail.join_date ? memberDetail.join_date : current));
  }, [memberDetail]);

  useEffect(() => {
    if (mode !== 'existing' || !selectedPackage) return;
    setAmount((current) => current || String(selectedPackage.price));
  }, [mode, selectedPackage]);

  const visiblePackages = useMemo(
    () => packages.filter((pkg) => pkg.is_active),
    [packages],
  );

  const groupedPackages = useMemo(() => visiblePackages.reduce<Record<string, ManagedPackage[]>>((acc, pkg) => {
    if (!acc[pkg.service_type]) acc[pkg.service_type] = [];
    acc[pkg.service_type].push(pkg);
    return acc;
  }, {}), [visiblePackages]);

  const customPackageNameSuggestions = useMemo(
    () => Array.from(new Set(visiblePackages.map((pkg) => pkg.service_type))),
    [visiblePackages],
  );

  const derivedEndDate = mode === 'existing' && selectedPackage
    ? computeEndDate(startDate, selectedPackage.duration_months)
    : null;

  useEffect(() => {
    if (mode !== 'existing') return;
    if (!derivedEndDate) {
      setExistingEndDate('');
      setExistingEndDateTouched(false);
      return;
    }
    if (!existingEndDateTouched || !existingEndDate) {
      setExistingEndDate(derivedEndDate);
    }
  }, [derivedEndDate, existingEndDate, existingEndDateTouched, mode]);

  function normalizeDigits(value: string) {
    return value.replace(/\D+/g, '');
  }

  function validateForm() {
    if (!memberDetail) return 'Could not load member details.';
    if (!memberDetail.can_add_subscription) return 'Unarchive this member before adding a subscription.';
    if (!startDate) return 'Start date is required.';
    if (startDate < memberDetail.join_date) {
      return `Start date cannot be before ${formatFullDate(memberDetail.join_date)}.`;
    }

    if (!amount || Number.parseInt(amount, 10) <= 0) {
      return 'Amount must be greater than 0.';
    }

    if (mode === 'existing') {
      if (!selectedPackage) return 'Select an existing package.';
      if (!existingEndDate) return 'End date is required.';
      if (!isValidYmdDate(existingEndDate)) return 'End date must be a valid date.';
      if (existingEndDate < startDate) return 'End date cannot be before start date.';
      return null;
    }

    if (!customName.trim()) return 'Package name is required.';
    if (!customSessions || Number.parseInt(customSessions, 10) <= 0) return 'Number of sessions must be greater than 0.';
    if (!customEndDate) return 'End date is required.';
    if (customEndDate < startDate) return 'End date cannot be before start date.';
    if (!customWindowDays || Number.parseInt(customWindowDays, 10) < 5) return 'Consistency window must be at least 5 days.';
    if (!customMinDays || Number.parseInt(customMinDays, 10) <= 0) return 'Minimum attendance days must be greater than 0.';
    if (Number.parseInt(customMinDays, 10) >= Number.parseInt(customWindowDays, 10)) {
      return 'Minimum attendance days must be less than the consistency window.';
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'existing' && selectedPackage) {
        await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
          package_id: selectedPackage.id,
          start_date: startDate,
          end_date: existingEndDate,
          amount: Number(amount),
        });
      } else {
        await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
          custom_package: {
            service_type: customName.trim(),
            sessions: Number(customSessions),
            start_date: startDate,
            end_date: customEndDate,
            amount: Number(amount),
            consistency_window_days: Number(customWindowDays),
            consistency_min_days: Number(customMinDays),
          },
        });
      }
      navigate(`/members/${id}${viewQuery}`);
    } catch (submissionError) {
      setError(submissionError instanceof ApiError ? submissionError.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (memberLoading || packagesLoading) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack max-w-5xl">
          <Link to={`/members/${id}${viewQuery}`} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member
          </Link>
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!memberDetail) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack max-w-5xl">
          <Link to={`/members/${id}${viewQuery}`} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member
          </Link>
          <div className="empty-state">Could not load member details.</div>
        </div>
      </AppShell>
    );
  }

  const isBlocked = !memberDetail.can_add_subscription;

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-5xl">
        <Link to={`/members/${id}${viewQuery}`} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Member
        </Link>

        <div className="space-y-3">
          <p className="section-eyebrow">Owner actions</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="page-title">New subscription</h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/70">
                Create a plan for {memberDetail.full_name} using an existing public package or a one-off custom package for this subscription only.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-black/10 bg-white/70 px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.04]">
              <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black/55 dark:text-white/60">
                Member since
              </p>
              <p className="mt-2 text-sm font-semibold text-black dark:text-white">{formatFullDate(memberDetail.join_date)}</p>
            </div>
          </div>
        </div>

        {isBlocked ? (
          <Card className="space-y-4 p-5">
            <Alert variant="warning">
              Unarchive this member before creating a new subscription.
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Link to={`/members/${id}${viewQuery}`}>
                <Button variant="secondary" icon="arrow_back">
                  Back to member
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant={mode === 'existing' ? 'primary' : 'secondary'}
                type="button"
                onClick={() => setMode('existing')}
              >
                Existing package
              </Button>
              <Button
                variant={mode === 'custom' ? 'primary' : 'secondary'}
                type="button"
                onClick={() => setMode('custom')}
              >
                Custom package
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === 'existing' ? (
                <div className="space-y-5">
                  {Object.entries(groupedPackages).map(([serviceType, packageGroup]) => (
                    <div key={serviceType} className="space-y-3">
                      <p className="section-eyebrow">{serviceType}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {packageGroup.map((pkg) => {
                          const selected = selectedPackage?.id === pkg.id;
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => {
                                setSelectedPackage(pkg);
                                setAmount(String(pkg.price));
                                setExistingEndDateTouched(false);
                              }}
                              className={`rounded-[1.5rem] border p-4 text-left shadow-sm shadow-black/5 transition-all ${
                                selected
                                  ? 'border-black bg-white bg-brand-gradient dark:border-white dark:bg-surface-dark dark:bg-brand-gradient-dark'
                                  : 'border-black/10 bg-white/85 hover:border-brand-300 hover:bg-brand-50/60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                              }`}
                            >
                              <p className="font-headline text-xl font-black italic uppercase tracking-tight text-black dark:text-white">
                                {pkg.sessions} sessions
                              </p>
                              <p className="mt-1 text-xs text-black/60 dark:text-white/70">
                                {pkg.duration_months} month{pkg.duration_months === 1 ? '' : 's'} • {pkg.consistency_min_days} in {pkg.consistency_window_days}
                              </p>
                              <p className="mt-3 text-sm font-black text-black dark:text-white">{formatCurrency(pkg.price)}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <Card className="space-y-5 p-5">
                {mode === 'custom' ? (
                  <>
                    <Input
                      label="Package name"
                      required
                      list="package-name-suggestions"
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                    />
                    <datalist id="package-name-suggestions">
                      {customPackageNameSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    <Input
                      label="Number of sessions"
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customSessions}
                      onChange={(event) => setCustomSessions(normalizeDigits(event.target.value))}
                    />
                  </>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Start date"
                    type="date"
                    required
                    min={memberDetail.join_date}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                  <Input
                    label="End date"
                    type="date"
                    required
                    min={startDate}
                    value={mode === 'existing' ? existingEndDate : customEndDate}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (mode === 'existing') {
                        setExistingEndDate(nextValue);
                        setExistingEndDateTouched(true);
                        return;
                      }
                      setCustomEndDate(nextValue);
                    }}
                  />
                </div>

                {mode === 'custom' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Consistency window (days)"
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customWindowDays}
                      onChange={(event) => setCustomWindowDays(normalizeDigits(event.target.value))}
                    />
                    <Input
                      label="Minimum attendance days"
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customMinDays}
                      onChange={(event) => setCustomMinDays(normalizeDigits(event.target.value))}
                    />
                  </div>
                ) : null}

                <Input
                  label="Amount (₹)"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(event) => setAmount(normalizeDigits(event.target.value))}
                />

                {mode === 'existing' && selectedPackage ? (
                  <Alert variant="info">
                    Suggested end date is {formatFullDate(derivedEndDate!)} based on package duration. You can override it for this subscription. Consistency rule stays at {selectedPackage.consistency_min_days} days in {selectedPackage.consistency_window_days}.
                  </Alert>
                ) : null}

                {mode === 'custom' ? (
                  <Alert variant="info">
                    This custom package is private to this subscription and will not appear in the shared package catalog for other members.
                  </Alert>
                ) : null}

                {error ? <Alert variant="error">{error}</Alert> : null}

                <Button type="submit" disabled={loading} size="lg" className="w-full" icon={loading ? 'progress_activity' : 'add_card'}>
                  {loading ? 'Creating…' : 'Create subscription'}
                </Button>
              </Card>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
