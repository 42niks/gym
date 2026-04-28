import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, type ManagedPackage, ApiError } from '../../lib/api.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';
import Alert from '../../components/Alert.js';
import { getFirstFormErrorMessage } from '../../lib/formValidation.js';

interface PackageFormData {
  service_type: string;
  sessions: string;
  duration_months: string;
  price: string;
  consistency_window_days: string;
  consistency_min_days: string;
}

const emptyForm: PackageFormData = {
  service_type: '',
  sessions: '1',
  duration_months: '1',
  price: '',
  consistency_window_days: '7',
  consistency_min_days: '1',
};

const CUSTOM_SERVICE_TYPE = '__custom__';
const PACKAGE_FIELD_LABEL_CLASS = 'pl-4 not-italic';
const serviceTypeOptions = [
  '1:1 Personal Training',
  'Group Personal Training',
  'MMA/Kickboxing Personal Training',
];

function formToPayload(form: PackageFormData) {
  return {
    service_type: form.service_type.trim(),
    sessions: parseInt(form.sessions, 10),
    duration_months: parseInt(form.duration_months, 10),
    price: parseInt(form.price, 10),
    consistency_window_days: parseInt(form.consistency_window_days, 10),
    consistency_min_days: parseInt(form.consistency_min_days, 10),
    is_active: true,
  };
}

function StepperInput({
  id,
  label,
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

  const inputClass =
    'field-control min-w-0 flex-1 text-center';

  return (
    <div>
      <label
        htmlFor={id}
        className={`field-label ${PACKAGE_FIELD_LABEL_CLASS}`}
      >
        {label}
      </label>
      <div className="flex w-full items-center gap-2">
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
          className={inputClass}
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

export default function OwnerNewPackagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PackageFormData>(emptyForm);
  const [serviceTypeChoice, setServiceTypeChoice] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [error, setError] = useState('');
  const [errorPulse, setErrorPulse] = useState(0);
  const [loading, setLoading] = useState(false);

  function showError(message: string) {
    setError(message);
    setErrorPulse(v => v + 1);
  }

  function normalizeSessions(value: string) {
    const digits = value.replace(/\D+/g, '');
    if (!digits) return '';
    return String(Math.max(1, parseInt(digits, 10)));
  }

  function stepSessions(delta: number) {
    setForm(current => {
      const next = Math.max(1, (parseInt(current.sessions, 10) || 1) + delta);
      return { ...current, sessions: String(next) };
    });
  }

  function handleSessionsChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(current => ({ ...current, sessions: normalizeSessions(e.target.value) }));
  }

  function handleSessionsBlur() {
    setForm(current => ({ ...current, sessions: current.sessions ? current.sessions : '1' }));
  }

  function normalizeDurationMonths(value: string) {
    const digits = value.replace(/\D+/g, '');
    if (!digits) return '';
    return String(Math.max(1, parseInt(digits, 10)));
  }

  function stepDurationMonths(delta: number) {
    setForm(current => {
      const next = Math.max(1, (parseInt(current.duration_months, 10) || 1) + delta);
      return { ...current, duration_months: String(next) };
    });
  }

  function handleDurationMonthsChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(current => ({ ...current, duration_months: normalizeDurationMonths(e.target.value) }));
  }

  function handleDurationMonthsBlur() {
    setForm(current => ({ ...current, duration_months: current.duration_months ? current.duration_months : '1' }));
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');
    setForm(current => ({ ...current, price: digits }));
  }

  function handleConsistencyWindowDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '');

    setForm(current => {
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
    setForm(current => {
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

    setForm(current => {
      if (!digits) {
        return { ...current, consistency_min_days: '' };
      }

      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextMinDays = Math.min(Math.max(1, parseInt(digits, 10)), windowDays - 1);

      return { ...current, consistency_min_days: String(nextMinDays) };
    });
  }

  function handleConsistencyMinDaysBlur() {
    setForm(current => {
      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const nextMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), windowDays - 1);

      return { ...current, consistency_min_days: String(nextMinDays) };
    });
  }

  function stepConsistencyWindowDays(delta: number) {
    setForm(current => {
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
    setForm(current => {
      const windowDays = Math.max(5, parseInt(current.consistency_window_days, 10) || 7);
      const currentMinDays = Math.min(Math.max(1, parseInt(current.consistency_min_days, 10) || 1), windowDays - 1);
      const nextMinDays = Math.min(windowDays - 1, Math.max(1, currentMinDays + delta));

      return {
        ...current,
        consistency_min_days: String(nextMinDays),
      };
    });
  }

  function handleServiceTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setServiceTypeChoice(value);
    setForm(current => ({
      ...current,
      service_type: value === CUSTOM_SERVICE_TYPE ? customServiceType : value,
    }));
  }

  function handleCustomServiceTypeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCustomServiceType(value);
    setForm(current => ({ ...current, service_type: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const validationError = getFirstFormErrorMessage(e.currentTarget);
    if (validationError) {
      showError(validationError);
      return;
    }
    setLoading(true);

    try {
      const created = await api.post<ManagedPackage>('/api/packages', formToPayload(form));
      await queryClient.invalidateQueries({ queryKey: ['owner-packages'] });
      navigate(`/packages?type=${encodeURIComponent(created.service_type)}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const currentSessionsValue = Math.max(1, parseInt(form.sessions, 10) || 1);
  const currentDurationMonthsValue = Math.max(1, parseInt(form.duration_months, 10) || 1);
  const currentConsistencyWindowDaysValue = Math.max(5, parseInt(form.consistency_window_days, 10) || 7);
  const currentConsistencyMinDaysValue = Math.min(
    Math.max(1, parseInt(form.consistency_min_days, 10) || 1),
    currentConsistencyWindowDaysValue - 1,
  );

  return (
    <div className="page-stack max-w-3xl">
        <Link to="/packages" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Packages
        </Link>
        <h2 className="page-title mb-6 mt-2">NEW PACKAGE</h2>

        <form onSubmit={handleSubmit} noValidate className="glass-panel space-y-4 p-5 sm:p-6">
          <div>
            <label
              htmlFor="service-type"
              className={`field-label ${PACKAGE_FIELD_LABEL_CLASS}`}
            >
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
                {serviceTypeOptions.map(option => (
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
              <label
                htmlFor="custom-service-type"
                className={`field-label ${PACKAGE_FIELD_LABEL_CLASS} flex items-center gap-2`}
              >
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
              id="sessions"
              label="Sessions"
              value={form.sessions}
              onChange={handleSessionsChange}
              onBlur={handleSessionsBlur}
              onStep={stepSessions}
              decrementDisabled={currentSessionsValue <= 1}
              decrementLabel="Decrease sessions"
              incrementLabel="Increase sessions"
            />
            <StepperInput
              id="duration-months"
              label="Duration (months)"
              value={form.duration_months}
              onChange={handleDurationMonthsChange}
              onBlur={handleDurationMonthsBlur}
              onStep={stepDurationMonths}
              decrementDisabled={currentDurationMonthsValue <= 1}
              decrementLabel="Decrease duration months"
              incrementLabel="Increase duration months"
            />
            <Input
              label="Price (₹)"
              labelClassName={PACKAGE_FIELD_LABEL_CLASS}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={form.price}
              onChange={handlePriceChange}
              className="text-right"
            />
            <StepperInput
              id="consistency-window-days"
              label="Consistency window (days)"
              value={form.consistency_window_days}
              onChange={handleConsistencyWindowDaysChange}
              onBlur={handleConsistencyWindowDaysBlur}
              onStep={stepConsistencyWindowDays}
              decrementDisabled={currentConsistencyWindowDaysValue <= 5}
              decrementLabel="Decrease consistency window days"
              incrementLabel="Increase consistency window days"
            />
          </div>

          <StepperInput
            id="consistency-min-days"
            label="Min days in window"
            value={form.consistency_min_days}
            onChange={handleConsistencyMinDaysChange}
            onBlur={handleConsistencyMinDaysBlur}
            onStep={stepConsistencyMinDays}
            decrementDisabled={currentConsistencyMinDaysValue <= 1}
            incrementDisabled={currentConsistencyMinDaysValue >= currentConsistencyWindowDaysValue - 1}
            decrementLabel="Decrease min days in window"
            incrementLabel="Increase min days in window"
          />

          {error ? (
            <div key={errorPulse} className="form-error-flash">
              <Alert variant="error">{error}</Alert>
            </div>
          ) : null}

          <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full" icon={loading ? 'progress_activity' : 'library_add'}>
            Create package
          </Button>
        </form>
    </div>
  );
}
