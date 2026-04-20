import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, type ManagedPackage, type MemberDetail, type Subscription } from '../../lib/api.js';
import Alert from '../../components/Alert.js';
import AppShell from '../../components/AppShell.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import Input from '../../components/Input.js';
import Spinner from '../../components/Spinner.js';
import { formatFullDate } from '../../components/attendance/AttendanceCalendar.js';
import { ownerLinks } from './ownerLinks.js';
import { formatYmdForInput, parseInputDateToYmd } from '../../lib/dateInput.js';

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime())
    || candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toUtcDate(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function getIstTodayDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function computeEndDate(fromStartDate: string, durationMonths: number) {
  const start = toUtcDate(fromStartDate);
  if (!start || !Number.isInteger(durationMonths) || durationMonths <= 0) {
    return '';
  }

  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + durationMonths, start.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
  if (!Number.isFinite(amount)) {
    return '--';
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDuration(months: number) {
  if (!Number.isFinite(months) || months <= 0) {
    return '--';
  }
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

function formatConsistency(pkg: Pick<ManagedPackage, 'consistency_min_days' | 'consistency_window_days'>) {
  if (
    !Number.isFinite(pkg.consistency_min_days)
    || !Number.isFinite(pkg.consistency_window_days)
    || pkg.consistency_min_days <= 0
    || pkg.consistency_window_days <= 0
  ) {
    return 'Consistency unavailable';
  }
  return `${pkg.consistency_min_days} in ${pkg.consistency_window_days} days`;
}

function isValidYmdDate(value: string) {
  return parseDateParts(value) !== null;
}

interface PackageFormData {
  service_type: string;
  sessions: string;
  end_date: string;
  price: string;
  consistency_window_days: string;
  consistency_min_days: string;
}

const emptyCustomPackageForm: PackageFormData = {
  service_type: '',
  sessions: '1',
  end_date: '',
  price: '',
  consistency_window_days: '7',
  consistency_min_days: '1',
};

const CUSTOM_SERVICE_TYPE = '__custom__';
const CUSTOM_PACKAGE_LABEL_CLASS = 'not-italic';
const serviceTypeOptions = [
  '1:1 Personal Training',
  'Group Personal Training',
  'MMA/Kickboxing Personal Training',
];

interface ExistingPackageTab {
  key: string;
  label: string;
  title: string;
  icon: string;
  packages: ManagedPackage[];
  count: number;
}

const existingPackageTabMeta = [
  { match: '1:1 personal training', icon: 'person', label: '1:1' },
  { match: 'group personal training', icon: 'groups', label: 'Group' },
  { match: 'mma/kickboxing personal training', icon: 'sports_mma', label: 'MMA' },
  { match: 'boxing', icon: 'sports_mma', label: 'Boxing' },
] as const;

function getExistingPackageTabRank(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  const index = existingPackageTabMeta.findIndex((item) => normalized.includes(item.match));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getExistingPackageTabIcon(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return existingPackageTabMeta.find((item) => normalized.includes(item.match))?.icon ?? 'inventory_2';
}

function getExistingPackageTabLabel(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return existingPackageTabMeta.find((item) => normalized.includes(item.match))?.label ?? serviceType;
}

function buildExistingPackageTabs(packages: ManagedPackage[]): ExistingPackageTab[] {
  const grouped = new Map<string, ManagedPackage[]>();

  for (const pkg of packages) {
    const current = grouped.get(pkg.service_type) ?? [];
    current.push(pkg);
    grouped.set(pkg.service_type, current);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => {
      const rankDiff = getExistingPackageTabRank(left) - getExistingPackageTabRank(right);
      return rankDiff !== 0 ? rankDiff : left.localeCompare(right);
    })
    .map(([serviceType, items]) => ({
      key: serviceType,
      label: getExistingPackageTabLabel(serviceType),
      title: serviceType,
      icon: getExistingPackageTabIcon(serviceType),
      packages: items,
      count: items.length,
    }));
}

const SUBSCRIPTION_MODES = [
  { key: 'existing', label: 'Existing package', icon: 'inventory_2' },
  { key: 'custom', label: 'Custom package', icon: 'draw' },
] as const;

function StepperInput({
  id,
  label,
  labelClassName = '',
  value,
  onChange,
  onBlur,
  onStep,
  decrementDisabled,
  incrementDisabled = false,
  decrementLabel,
  incrementLabel,
}: {
  id: string;
  label: string;
  labelClassName?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onStep: (delta: number) => void;
  decrementDisabled: boolean;
  incrementDisabled?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}) {
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatTriggeredRef = useRef(false);

  function clearHold() {
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  useEffect(() => clearHold, []);

  function startHold(delta: number, disabled: boolean) {
    if (disabled) return;

    repeatTriggeredRef.current = false;
    clearHold();

    holdTimeoutRef.current = setTimeout(() => {
      repeatTriggeredRef.current = true;
      onStep(delta);
      holdIntervalRef.current = setInterval(() => onStep(delta), 90);
    }, 300);
  }

  function stopHold() {
    clearHold();
  }

  function handleClick(delta: number, disabled: boolean) {
    if (disabled) {
      repeatTriggeredRef.current = false;
      return;
    }

    if (repeatTriggeredRef.current) {
      repeatTriggeredRef.current = false;
      return;
    }

    onStep(delta);
  }

  const buttonClass =
    'inline-flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center rounded-2xl border border-black bg-white/80 text-black/80 shadow-sm shadow-black/5 transition-all hover:border-brand-300 hover:bg-brand-50/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-black disabled:hover:bg-white/80 dark:border-white dark:bg-surface-dark/75 dark:text-white/80 dark:hover:bg-surface-raised/85 dark:disabled:hover:border-white dark:disabled:hover:bg-surface-dark/75';

  return (
    <div>
      <label htmlFor={id} className={`field-label ${labelClassName}`}>
        {label}
      </label>
      <div className="mx-auto flex w-3/4 items-center gap-2">
        <button
          type="button"
          onClick={() => handleClick(-1, decrementDisabled)}
          onPointerDown={() => startHold(-1, decrementDisabled)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          disabled={decrementDisabled}
          className={buttonClass}
          aria-label={decrementLabel}
        >
          <span className="material-symbols-outlined text-[1.2rem]">remove</span>
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className="field-control min-w-0 flex-1 text-center"
        />
        <button
          type="button"
          onClick={() => handleClick(1, incrementDisabled)}
          onPointerDown={() => startHold(1, incrementDisabled)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          disabled={incrementDisabled}
          className={buttonClass}
          aria-label={incrementLabel}
        >
          <span className="material-symbols-outlined text-[1.2rem]">add</span>
        </button>
      </div>
    </div>
  );
}

export default function OwnerNewSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPackage, setSelectedPackage] = useState<ManagedPackage | null>(null);
  const [selectedPackageType, setSelectedPackageType] = useState<string | null>(null);
  const [mode, setMode] = useState<'existing' | 'custom'>('existing');
  const [startDate, setStartDate] = useState(getIstTodayDateString());
  const [startDateInput, setStartDateInput] = useState(formatYmdForInput(getIstTodayDateString()));
  const [existingEndDate, setExistingEndDate] = useState('');
  const [existingEndDateInput, setExistingEndDateInput] = useState('');
  const [existingEndDateTouched, setExistingEndDateTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [customForm, setCustomForm] = useState<PackageFormData>(emptyCustomPackageForm);
  const [customEndDateInput, setCustomEndDateInput] = useState('');
  const [serviceTypeChoice, setServiceTypeChoice] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const view = searchParams.get('view');
  const viewQuery = view ? `?view=${encodeURIComponent(view)}` : '';

  const { data: memberDetail, isLoading: memberLoading } = useQuery<MemberDetail>({
    queryKey: ['member-detail', id],
    enabled: !!id,
    queryFn: () => api.get(`/api/members/${id}`),
  });

  const { data: packageData = [], isLoading: packagesLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/api/packages'),
  });

  useEffect(() => {
    if (!memberDetail || !isValidYmdDate(memberDetail.join_date)) return;
    setStartDate((current) => {
      const nextValue = current < memberDetail.join_date ? memberDetail.join_date : current;
      setStartDateInput(formatYmdForInput(nextValue));
      return nextValue;
    });
  }, [memberDetail]);

  useEffect(() => {
    if (mode !== 'existing' || !selectedPackage) return;
    setAmount((current) => current || String(selectedPackage.price));
  }, [mode, selectedPackage]);

  const packages = useMemo(
    () => (Array.isArray(packageData)
      ? packageData.filter((pkg): pkg is ManagedPackage =>
        pkg !== null
        && typeof pkg === 'object'
        && typeof pkg.service_type === 'string'
        && pkg.service_type.trim().length > 0,
      ).map((pkg) => ({ ...pkg, service_type: pkg.service_type.trim() }))
      : []),
    [packageData],
  );

  const visiblePackages = useMemo(
    () => packages.filter((pkg) => pkg.is_active === true),
    [packages],
  );

  const existingPackageTabs = useMemo(
    () => buildExistingPackageTabs(visiblePackages),
    [visiblePackages],
  );
  const firstExistingPackageTabKey = existingPackageTabs[0]?.key ?? null;
  const activeExistingPackageTabKey = existingPackageTabs.some((tab) => tab.key === selectedPackageType)
    ? selectedPackageType
    : firstExistingPackageTabKey;
  const activeExistingPackageTab = existingPackageTabs.find((tab) => tab.key === activeExistingPackageTabKey) ?? null;

  const parsedStartDate = parseInputDateToYmd(startDateInput);
  const resolvedStartDate = parsedStartDate ?? startDate;
  const derivedEndDate = mode === 'existing' && selectedPackage
    ? computeEndDate(resolvedStartDate, selectedPackage.duration_months)
    : null;
  const hasVisiblePackages = visiblePackages.length > 0;
  const canSubmitExisting = !!selectedPackage && hasVisiblePackages && !loading;

  useEffect(() => {
    if (!existingPackageTabs.length) {
      setSelectedPackageType(null);
      return;
    }

    setSelectedPackageType((current) => {
      if (current && existingPackageTabs.some((tab) => tab.key === current)) {
        return current;
      }
      if (selectedPackage && existingPackageTabs.some((tab) => tab.key === selectedPackage.service_type)) {
        return selectedPackage.service_type;
      }
      return existingPackageTabs[0].key;
    });
  }, [existingPackageTabs, selectedPackage]);

  useEffect(() => {
    if (!selectedPackage) return;

    const nextSelectedPackage = visiblePackages.find((pkg) => pkg.id === selectedPackage.id) ?? null;
    if (!nextSelectedPackage) {
      setSelectedPackage(null);
      setAmount('');
      setExistingEndDateTouched(false);
      return;
    }

    if (nextSelectedPackage !== selectedPackage) {
      setSelectedPackage(nextSelectedPackage);
    }
  }, [selectedPackage, visiblePackages]);

  useEffect(() => {
    if (mode !== 'existing') return;
    if (!derivedEndDate) {
      setExistingEndDate('');
      setExistingEndDateInput('');
      setExistingEndDateTouched(false);
      return;
    }
    if (!existingEndDateTouched || !existingEndDate) {
      setExistingEndDate(derivedEndDate);
      setExistingEndDateInput(formatYmdForInput(derivedEndDate));
    }
  }, [derivedEndDate, existingEndDate, existingEndDateTouched, mode]);

  function normalizeDigits(value: string) {
    return value.replace(/\D+/g, '');
  }

  function normalizeAtLeastOne(value: string) {
    const digits = value.replace(/\D+/g, '');
    if (!digits) return '';
    return String(Math.max(1, parseInt(digits, 10)));
  }

  function handleServiceTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setServiceTypeChoice(value);
    setCustomForm((current) => ({
      ...current,
      service_type: value === CUSTOM_SERVICE_TYPE ? customServiceType : value,
    }));
  }

  function handleCustomServiceTypeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCustomServiceType(value);
    setCustomForm((current) => ({ ...current, service_type: value }));
  }

  function handleCustomPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');
    setCustomForm((current) => ({ ...current, price: digits }));
  }

  function stepCustomField(field: 'sessions', delta: number) {
    setCustomForm((current) => {
      const next = Math.max(1, (parseInt(current[field], 10) || 1) + delta);
      return { ...current, [field]: String(next) };
    });
  }

  function handleCustomCountChange(field: 'sessions', value: string) {
    setCustomForm((current) => ({ ...current, [field]: normalizeAtLeastOne(value) }));
  }

  function handleCustomCountBlur(field: 'sessions') {
    setCustomForm((current) => ({ ...current, [field]: current[field] || '1' }));
  }

  function handleConsistencyWindowDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');

    setCustomForm((current) => {
      if (!digits) {
        return { ...current, consistency_window_days: '' };
      }

      const nextWindow = Math.max(5, parseInt(digits, 10));
      const currentMinDays = parseInt(current.consistency_min_days, 10) || 1;
      const nextMinDays = Math.min(Math.max(1, currentMinDays), nextWindow - 1);

      return {
        ...current,
        consistency_window_days: String(nextWindow),
        consistency_min_days: String(nextMinDays),
      };
    });
  }

  function handleConsistencyWindowDaysBlur() {
    setCustomForm((current) => {
      const nextWindow = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), nextWindow - 1);

      return {
        ...current,
        consistency_window_days: String(nextWindow),
        consistency_min_days: String(nextMinDays),
      };
    });
  }

  function handleConsistencyMinDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');

    setCustomForm((current) => {
      if (!digits) {
        return { ...current, consistency_min_days: '' };
      }

      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextMinDays = Math.min(Math.max(1, parseInt(digits, 10)), windowDays - 1);

      return { ...current, consistency_min_days: String(nextMinDays) };
    });
  }

  function handleConsistencyMinDaysBlur() {
    setCustomForm((current) => {
      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), windowDays - 1);

      return { ...current, consistency_min_days: String(nextMinDays) };
    });
  }

  function stepConsistencyWindowDays(delta: number) {
    setCustomForm((current) => {
      const currentWindow = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextWindow = Math.max(5, currentWindow + delta);
      const currentMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), currentWindow - 1);
      const nextMinDays = Math.min(currentMinDays, nextWindow - 1);

      return {
        ...current,
        consistency_window_days: String(nextWindow),
        consistency_min_days: String(nextMinDays),
      };
    });
  }

  function stepConsistencyMinDays(delta: number) {
    setCustomForm((current) => {
      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const currentMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), windowDays - 1);
      const nextMinDays = Math.min(windowDays - 1, Math.max(1, currentMinDays + delta));

      return {
        ...current,
        consistency_min_days: String(nextMinDays),
      };
    });
  }

  function validateForm() {
    if (!id) return 'Could not determine which member to update.';
    if (!memberDetail) return 'Could not load member details.';
    if (!memberDetail.can_add_subscription) return 'Unarchive this member before adding a subscription.';
    if (!startDateInput.trim()) return 'Start date is required.';
    if (!parsedStartDate) return 'Start date must be in dd-mm-yyyy format.';
    if (parsedStartDate < memberDetail.join_date) {
      return `Start date cannot be before ${formatFullDate(memberDetail.join_date)}.`;
    }

    if (mode === 'existing') {
      if (!hasVisiblePackages) return 'No active packages are available. Switch to a custom package or create a new shared package first.';
      if (!selectedPackage) return 'Select an existing package.';
      const parsedExistingEndDate = parseInputDateToYmd(existingEndDateInput);
      if (!existingEndDateInput.trim()) return 'End date is required.';
      if (!parsedExistingEndDate) return 'End date must be in dd-mm-yyyy format.';
      if (parsedExistingEndDate <= parsedStartDate) return 'End date must be after start date.';
      if (!amount || Number.parseInt(amount, 10) <= 0) return 'Amount must be greater than 0.';
      return null;
    }

    if (!customForm.service_type.trim()) return 'Service type is required.';
    if (!customForm.sessions || Number.parseInt(customForm.sessions, 10) <= 0) return 'Number of sessions must be greater than 0.';
    const parsedCustomEndDate = parseInputDateToYmd(customEndDateInput);
    if (!customEndDateInput.trim()) return 'End date is required.';
    if (!parsedCustomEndDate) return 'End date must be in dd-mm-yyyy format.';
    if (parsedCustomEndDate <= parsedStartDate) return 'End date must be after start date.';
    if (!customForm.price || Number.parseInt(customForm.price, 10) <= 0) return 'Amount must be greater than 0.';
    if (!customForm.consistency_window_days || Number.parseInt(customForm.consistency_window_days, 10) < 5) return 'Consistency window must be at least 5 days.';
    if (!customForm.consistency_min_days || Number.parseInt(customForm.consistency_min_days, 10) <= 0) return 'Minimum attendance days must be greater than 0.';
    if (Number.parseInt(customForm.consistency_min_days, 10) >= Number.parseInt(customForm.consistency_window_days, 10)) {
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

    const startDateYmd = parseInputDateToYmd(startDateInput);
    const existingEndDateYmd = parseInputDateToYmd(existingEndDateInput);
    const customEndDateYmd = parseInputDateToYmd(customEndDateInput);
    if (!startDateYmd) {
      setError('Start date must be in dd-mm-yyyy format.');
      return;
    }
    if (mode === 'existing' && !existingEndDateYmd) {
      setError('End date must be in dd-mm-yyyy format.');
      return;
    }
    if (mode === 'custom' && !customEndDateYmd) {
      setError('End date must be in dd-mm-yyyy format.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'existing' && selectedPackage) {
        await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
          package_id: selectedPackage.id,
          start_date: startDateYmd,
          end_date: existingEndDateYmd,
          amount: Number(amount),
        });
      } else {
        await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
          custom_package: {
            service_type: customForm.service_type.trim(),
            sessions: Number(customForm.sessions),
            start_date: startDateYmd,
            end_date: customEndDateYmd,
            amount: Number(customForm.price),
            consistency_window_days: Number(customForm.consistency_window_days),
            consistency_min_days: Number(customForm.consistency_min_days),
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

  const currentSessionsValue = Math.max(1, parseInt(customForm.sessions, 10) || 1);
  const currentConsistencyWindowDaysValue = Math.max(5, parseInt(customForm.consistency_window_days, 10) || 7);
  const currentConsistencyMinDaysValue = Math.min(
    Math.max(1, parseInt(customForm.consistency_min_days, 10) || 1),
    currentConsistencyWindowDaysValue - 1,
  );
  const backLink = id ? `/members/${id}${viewQuery}` : '/members';

  if (memberLoading || packagesLoading) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack max-w-5xl">
          <Link to={backLink} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member Profile
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
          <Link to={backLink} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member Profile
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
        <Link to={backLink} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Member Profile
        </Link>

        <div>
          <h2 className="page-title">New subscription</h2>
        </div>

        {isBlocked ? (
          <Card className="space-y-4 p-5">
            <Alert variant="warning">
              Unarchive this member before creating a new subscription.
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Link to={backLink}>
                <Button variant="secondary" icon="arrow_back">
                  Back to member profile
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <div className="-mx-1 px-1 py-1">
              <div className="members-view-tabs-scroll overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {SUBSCRIPTION_MODES.map((tab) => {
                    const active = mode === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setMode(tab.key)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 font-label text-[0.7rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
                          active
                            ? 'members-view-tab-active border-black bg-white text-black shadow-panel dark:border-white dark:text-white'
                            : 'members-view-tab-inactive border-black/15 text-black/70 hover:border-black/25 hover:text-black dark:border-white/15 dark:text-white/75 dark:hover:border-white/25 dark:hover:text-white'
                        }`}
                      >
                        <Icon name={tab.icon} className="text-[0.95rem]" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {mode === 'existing' ? (
                <div className="space-y-4">
                  <div className="-mx-1 px-1">
                    <div className="members-view-tabs-scroll overflow-x-auto">
                      <div className="flex min-w-max gap-2">
                        {existingPackageTabs.map((tab) => {
                          const active = tab.key === activeExistingPackageTabKey;

                          return (
                            <button
                              key={tab.key}
                              type="button"
                              title={tab.title}
                              onClick={() => setSelectedPackageType(tab.key)}
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 font-label text-[0.7rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
                                active
                                  ? 'members-view-tab-active border-black bg-white text-black shadow-panel dark:border-white dark:text-white'
                                  : 'members-view-tab-inactive border-black/15 text-black/70 hover:border-black/25 hover:text-black dark:border-white/15 dark:text-white/75 dark:hover:border-white/25 dark:hover:text-white'
                              }`}
                            >
                              <Icon name={tab.icon} className="text-[0.95rem]" />
                              {tab.label}
                              <span className="text-[0.68rem] tracking-[0.12em] opacity-70">{tab.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <Card className="overflow-hidden p-0">
                    {!activeExistingPackageTab || activeExistingPackageTab.packages.length === 0 ? (
                      <div className="px-6 py-10 text-center text-sm text-black dark:text-white">
                        No packages in this category
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-[42rem] w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-black/[0.03] dark:bg-white/[0.03]">
                              <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                                Sessions
                              </th>
                              <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                                Duration
                              </th>
                              <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                                Price
                              </th>
                              <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                                Consistency
                              </th>
                              <th className="w-[8.75rem] px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeExistingPackageTab.packages.map((pkg) => {
                              const selected = selectedPackage?.id === pkg.id;

                              return (
                                <tr
                                  key={pkg.id}
                                  className={`border-t border-black align-top dark:border-white ${
                                    selected
                                      ? 'existing-package-row-selected'
                                      : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                                  }`}
                                >
                                  <td className="px-4 py-3.5 sm:px-5">
                                    <p className="text-base font-black text-black dark:text-white">{pkg.sessions}</p>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <p className="text-sm font-semibold text-black dark:text-white">
                                      {formatDuration(pkg.duration_months)}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <p className="text-sm font-black text-black dark:text-white">{formatCurrency(pkg.price)}</p>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <p className="text-sm text-black/75 dark:text-white/80">{formatConsistency(pkg)}</p>
                                  </td>
                                  <td className="w-[8.75rem] px-4 py-3.5 sm:px-5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPackage(pkg);
                                        setSelectedPackageType(pkg.service_type);
                                        setAmount(String(pkg.price));
                                        setExistingEndDateTouched(false);
                                      }}
                                      aria-pressed={selected}
                                      className={`inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
                                        selected
                                          ? 'border-brand-600 bg-brand-600 text-white shadow-panel dark:border-brand-400 dark:bg-brand-400 dark:text-black'
                                          : 'border-black bg-white/80 text-black/80 shadow-sm shadow-black/5 hover:border-brand-300 hover:bg-brand-50/60 dark:border-white dark:bg-surface-dark/75 dark:text-white/80 dark:hover:bg-surface-raised/85'
                                      }`}
                                    >
                                      {selected ? (
                                        <>
                                          <Icon name="check" className="text-[0.9rem]" />
                                          Selected
                                        </>
                                      ) : (
                                        'Select'
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              ) : null}

              {mode === 'existing' ? (
                <Card className="space-y-5 p-5">
                  {!hasVisiblePackages ? (
                    <Alert variant="warning">
                      No active shared packages are available right now. Switch to Custom package or create a new package first.
                    </Alert>
                  ) : !selectedPackage ? (
                    <Alert variant="info">
                      Select a package above to prefill the price and suggested dates for this subscription.
                    </Alert>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Start date"
                      labelClassName="ml-4 not-italic"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                      placeholder="dd-mm-yyyy"
                      required
                      value={startDateInput}
                      onChange={(event) => setStartDateInput(event.target.value)}
                      onBlur={() => {
                        const parsed = parseInputDateToYmd(startDateInput);
                        if (!parsed) return;
                        setStartDate(parsed);
                        setStartDateInput(formatYmdForInput(parsed));
                      }}
                    />
                    <Input
                      label="End date"
                      labelClassName="ml-4 not-italic"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                      placeholder="dd-mm-yyyy"
                      required
                      value={existingEndDateInput}
                      onChange={(event) => {
                        setExistingEndDateInput(event.target.value);
                        setExistingEndDateTouched(true);
                      }}
                      onBlur={() => {
                        const parsed = parseInputDateToYmd(existingEndDateInput);
                        if (!parsed) return;
                        setExistingEndDate(parsed);
                        setExistingEndDateInput(formatYmdForInput(parsed));
                      }}
                    />
                  </div>

                  <Input
                    label="Amount (₹)"
                    labelClassName="ml-4 not-italic"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amount}
                    onChange={(event) => setAmount(normalizeDigits(event.target.value))}
                  />

                  {selectedPackage ? (
                    <Alert variant="info">
                      Suggested end date is {formatFullDate(derivedEndDate!)} based on package duration. You can override it for this subscription. Consistency rule stays at {selectedPackage.consistency_min_days} days in {selectedPackage.consistency_window_days}.
                    </Alert>
                  ) : null}

                  {error ? <Alert variant="error">{error}</Alert> : null}

                  <Button type="submit" disabled={!canSubmitExisting} size="lg" className="w-full" icon={loading ? 'progress_activity' : 'add_card'}>
                    {loading ? 'Creating…' : 'Create subscription'}
                  </Button>
                </Card>
              ) : (
                <div className="glass-panel space-y-4 p-5 sm:p-6">
                  <Alert variant="info">
                    This custom package is private to this subscription and will not appear in the shared package catalog for other members.
                  </Alert>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Start date"
                      labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                      placeholder="dd-mm-yyyy"
                      required
                      value={startDateInput}
                      onChange={(event) => setStartDateInput(event.target.value)}
                      onBlur={() => {
                        const parsed = parseInputDateToYmd(startDateInput);
                        if (!parsed) return;
                        setStartDate(parsed);
                        setStartDateInput(formatYmdForInput(parsed));
                      }}
                    />
                    <Input
                      label="End date"
                      labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                      placeholder="dd-mm-yyyy"
                      required
                      value={customEndDateInput}
                      onChange={(event) => setCustomEndDateInput(event.target.value)}
                      onBlur={(event) => {
                        const parsed = parseInputDateToYmd(event.target.value);
                        if (!parsed) return;
                        setCustomForm((current) => ({ ...current, end_date: parsed }));
                        setCustomEndDateInput(formatYmdForInput(parsed));
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="service-type" className={`field-label ${CUSTOM_PACKAGE_LABEL_CLASS}`}>
                      Service type
                    </label>
                    <div className="relative">
                      <select
                        id="service-type"
                        required
                        value={serviceTypeChoice}
                        onChange={handleServiceTypeChange}
                        className="field-control appearance-none pr-12"
                      >
                        <option value="">Select service type</option>
                        {serviceTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value={CUSTOM_SERVICE_TYPE}>Create new service type</option>
                      </select>
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[1.1rem] text-black/60 dark:text-white/70"
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  {serviceTypeChoice === CUSTOM_SERVICE_TYPE ? (
                    <div>
                      <label htmlFor="custom-service-type" className={`field-label ${CUSTOM_PACKAGE_LABEL_CLASS} flex items-center gap-2`}>
                        <span className="material-symbols-outlined text-base">bolt</span>
                        New service type
                      </label>
                      <input
                        id="custom-service-type"
                        type="text"
                        required
                        value={customServiceType}
                        onChange={handleCustomServiceTypeChange}
                        placeholder="Specify service type"
                        className="field-control"
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <StepperInput
                      id="custom-sessions"
                      label="Sessions"
                      labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                      value={customForm.sessions}
                      onChange={(event) => handleCustomCountChange('sessions', event.target.value)}
                      onBlur={() => handleCustomCountBlur('sessions')}
                      onStep={(delta) => stepCustomField('sessions', delta)}
                      decrementDisabled={currentSessionsValue <= 1}
                      decrementLabel="Decrease sessions"
                      incrementLabel="Increase sessions"
                    />
                    <Input
                      label="Price (₹)"
                      labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={customForm.price}
                      onChange={handleCustomPriceChange}
                      className="mx-auto block w-3/4"
                    />
                    <StepperInput
                      id="custom-consistency-window-days"
                      label="Consistency window (days)"
                      labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                      value={customForm.consistency_window_days}
                      onChange={handleConsistencyWindowDaysChange}
                      onBlur={handleConsistencyWindowDaysBlur}
                      onStep={stepConsistencyWindowDays}
                      decrementDisabled={currentConsistencyWindowDaysValue <= 5}
                      decrementLabel="Decrease consistency window days"
                      incrementLabel="Increase consistency window days"
                    />
                  </div>

                  <StepperInput
                    id="custom-consistency-min-days"
                    label="Min days in window"
                    labelClassName={CUSTOM_PACKAGE_LABEL_CLASS}
                    value={customForm.consistency_min_days}
                    onChange={handleConsistencyMinDaysChange}
                    onBlur={handleConsistencyMinDaysBlur}
                    onStep={stepConsistencyMinDays}
                    decrementDisabled={currentConsistencyMinDaysValue <= 1}
                    incrementDisabled={currentConsistencyMinDaysValue >= currentConsistencyWindowDaysValue - 1}
                    decrementLabel="Decrease min days in window"
                    incrementLabel="Increase min days in window"
                  />

                  {error ? <Alert variant="error">{error}</Alert> : null}

                  <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full" icon={loading ? 'progress_activity' : 'add_card'}>
                    {loading ? 'Adding…' : 'Add subscription'}
                  </Button>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
