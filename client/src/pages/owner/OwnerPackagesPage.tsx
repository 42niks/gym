import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type ManagedPackage } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Input from '../../components/Input.js';
import Spinner from '../../components/Spinner.js';
import Alert from '../../components/Alert.js';
import { ownerLinks } from './ownerLinks.js';

type StatusFilter = 'all' | 'active' | 'inactive';
type EditorMode = 'create' | 'edit';

interface PackageFormState {
  service_type: string;
  sessions: string;
  duration_months: string;
  price: string;
  consistency_window_days: string;
  consistency_min_days: string;
  is_active: boolean;
}

const serviceTypePresets = [
  '1:1 Personal Training',
  'MMA/Kickboxing Personal Training',
  'Group Personal Training',
];

function emptyForm(): PackageFormState {
  return {
    service_type: '',
    sessions: '',
    duration_months: '',
    price: '',
    consistency_window_days: '7',
    consistency_min_days: '',
    is_active: true,
  };
}

function sameFormState(a: PackageFormState, b: PackageFormState) {
  return (
    a.service_type === b.service_type &&
    a.sessions === b.sessions &&
    a.duration_months === b.duration_months &&
    a.price === b.price &&
    a.consistency_window_days === b.consistency_window_days &&
    a.consistency_min_days === b.consistency_min_days &&
    a.is_active === b.is_active
  );
}

function toFormState(pkg: ManagedPackage): PackageFormState {
  return {
    service_type: pkg.service_type,
    sessions: String(pkg.sessions),
    duration_months: String(pkg.duration_months),
    price: String(pkg.price),
    consistency_window_days: String(pkg.consistency_window_days),
    consistency_min_days: String(pkg.consistency_min_days),
    is_active: pkg.is_active,
  };
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatMonths(value: number) {
  return `${value} month${value === 1 ? '' : 's'}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong';
}

function statLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default function OwnerPackagesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [form, setForm] = useState<PackageFormState>(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: packages = [], isLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['owner-packages'],
    queryFn: () => api.get('/api/owner/packages'),
  });

  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId) ?? null;

  useEffect(() => {
    if (editorMode === 'create') {
      return;
    }

    if (selectedPackage) {
      const nextForm = toFormState(selectedPackage);
      setForm(current => (sameFormState(current, nextForm) ? current : nextForm));
      return;
    }

    if (packages.length > 0) {
      if (selectedPackageId !== packages[0].id) {
        setSelectedPackageId(packages[0].id);
      }
    } else {
      const nextForm = emptyForm();
      setForm(current => (sameFormState(current, nextForm) ? current : nextForm));
    }
  }, [editorMode, packages, selectedPackage, selectedPackageId]);

  const packageGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = packages.filter(pkg => {
      if (statusFilter === 'active' && !pkg.is_active) return false;
      if (statusFilter === 'inactive' && pkg.is_active) return false;
      if (serviceFilter !== 'all' && pkg.service_type !== serviceFilter) return false;
      if (!normalizedSearch) return true;

      return [
        pkg.service_type,
        `${pkg.sessions} sessions`,
        `${pkg.duration_months} months`,
        String(pkg.price),
      ].some(value => value.toLowerCase().includes(normalizedSearch));
    });

    return filtered.reduce<Record<string, ManagedPackage[]>>((acc, pkg) => {
      if (!acc[pkg.service_type]) {
        acc[pkg.service_type] = [];
      }
      acc[pkg.service_type].push(pkg);
      return acc;
    }, {});
  }, [packages, search, serviceFilter, statusFilter]);

  const serviceTypes = Array.from(new Set(packages.map(pkg => pkg.service_type)));
  const activeCount = packages.filter(pkg => pkg.is_active).length;
  const inactiveCount = packages.length - activeCount;
  const liveDependencyCount = packages.reduce(
    (total, pkg) => total + pkg.active_subscription_count + pkg.upcoming_subscription_count,
    0,
  );

  const createMutation = useMutation({
    mutationFn: (payload: Omit<PackageFormState, 'is_active'> & { is_active: boolean }) =>
      api.post<ManagedPackage>('/api/owner/packages', payload),
    onSuccess: async (saved) => {
      setFormError('');
      setEditorMode('edit');
      setSelectedPackageId(saved.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-packages'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Omit<PackageFormState, 'is_active'> & { is_active: boolean } }) =>
      api.patch<ManagedPackage>(`/api/owner/packages/${id}`, payload),
    onSuccess: async (saved) => {
      setFormError('');
      setEditorMode('edit');
      setSelectedPackageId(saved.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-packages'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/api/owner/packages/${id}`),
    onSuccess: async () => {
      setFormError('');
      setEditorMode('create');
      setSelectedPackageId(null);
      setForm(emptyForm());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-packages'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  function updateField<K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function openCreate(prefill?: ManagedPackage | null) {
    setFormError('');
    setEditorMode('create');
    setSelectedPackageId(null);
    setForm(prefill ? { ...toFormState(prefill), is_active: true } : emptyForm());
  }

  function openEdit(pkg: ManagedPackage) {
    setFormError('');
    setEditorMode('edit');
    setSelectedPackageId(pkg.id);
  }

  function buildPayload() {
    return {
      service_type: form.service_type.trim(),
      sessions: form.sessions.trim(),
      duration_months: form.duration_months.trim(),
      price: form.price.trim(),
      consistency_window_days: form.consistency_window_days.trim(),
      consistency_min_days: form.consistency_min_days.trim(),
      is_active: form.is_active,
    };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    const payload = buildPayload();

    if (editorMode === 'create') {
      createMutation.mutate(payload);
      return;
    }

    if (!selectedPackage) {
      setFormError('Pick a package to edit');
      return;
    }

    updateMutation.mutate({ id: selectedPackage.id, payload });
  }

  function handleDelete() {
    if (!selectedPackage) return;
    if (!window.confirm(`Delete ${selectedPackage.service_type} (${selectedPackage.sessions} sessions)?`)) {
      return;
    }

    deleteMutation.mutate(selectedPackage.id);
  }

  const isWorking =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const sessionsValue = Number.parseInt(form.sessions || '0', 10) || 0;
  const monthsValue = Number.parseInt(form.duration_months || '0', 10) || 0;
  const priceValue = Number.parseInt(form.price || '0', 10) || 0;
  const windowValue = Number.parseInt(form.consistency_window_days || '0', 10) || 0;
  const minDaysValue = Number.parseInt(form.consistency_min_days || '0', 10) || 0;
  const derivedWeeklyCadence =
    sessionsValue > 0 && monthsValue > 0 ? Math.max(1, Math.round(sessionsValue / (monthsValue * 4))) : 0;
  const isUsedPackage = (selectedPackage?.subscription_count ?? 0) > 0;

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack">
        <div className="page-header">
          <div>
            <p className="section-eyebrow">Owner controls</p>
            <h2 className="page-title mt-2">PACKAGES</h2>
            <p className="mt-3 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Control the package catalog, retire old offers, and tune consistency rules without losing subscription history.
            </p>
          </div>
          <Button onClick={() => openCreate()} icon="add_box" className="text-sm">
            New package
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="section-eyebrow">Live catalog</p>
            <p className="mt-3 font-headline text-4xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
              {activeCount}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Active sellable packages</p>
          </Card>
          <Card className="p-5">
            <p className="section-eyebrow">Retired</p>
            <p className="mt-3 font-headline text-4xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
              {inactiveCount}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Hidden from new subscriptions</p>
          </Card>
          <Card className="p-5">
            <p className="section-eyebrow">Service types</p>
            <p className="mt-3 font-headline text-4xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
              {serviceTypes.length}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Distinct training categories</p>
          </Card>
          <Card className="p-5">
            <p className="section-eyebrow">Live dependencies</p>
            <p className="mt-3 font-headline text-4xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
              {liveDependencyCount}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Active or upcoming subscriptions</p>
          </Card>
        </div>

        <Card className="space-y-4 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <Input
              label="Search packages"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by type, sessions, months, or price"
            />
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-2xl border px-4 py-3 font-label text-[0.7rem] font-bold uppercase tracking-[0.18em] transition-all ${
                    statusFilter === filter
                      ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                      : 'border-transparent bg-black/[0.03] text-gray-500 hover:bg-black/[0.05] hover:text-gray-900 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setServiceFilter('all')}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
                serviceFilter === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                  : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.06] hover:text-gray-900 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.09] dark:hover:text-white'
              }`}
            >
              All service types
            </button>
            {serviceTypes.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceFilter(type)}
                className={`rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
                  serviceFilter === type
                    ? 'bg-brand-500 text-white dark:bg-accent-500'
                    : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.06] hover:text-gray-900 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.09] dark:hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="space-y-5">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : Object.keys(packageGroups).length === 0 ? (
              <div className="empty-state">No packages match this view</div>
            ) : (
              Object.entries(packageGroups).map(([serviceType, items]) => (
                <Card key={serviceType} className="p-3 sm:p-4">
                  <div className="mb-4 flex items-start justify-between gap-3 px-2">
                    <div>
                      <p className="section-eyebrow">Service type</p>
                      <h3 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{serviceType}</h3>
                    </div>
                    <Badge variant="gray" icon="category">
                      {statLabel(items.length, 'package', 'packages')}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {items.map(pkg => {
                      const selected = editorMode === 'edit' && selectedPackageId === pkg.id;
                      const dependencyCount = pkg.active_subscription_count + pkg.upcoming_subscription_count;

                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => openEdit(pkg)}
                          className={`w-full rounded-[1.6rem] border p-4 text-left transition-all ${
                            selected
                              ? 'border-white/70 bg-white bg-brand-gradient shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark'
                              : 'border-white/60 bg-white/80 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/60 dark:border-white/10 dark:bg-surface-dark/80 dark:hover:bg-surface-raised/85'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-headline text-2xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                                {pkg.sessions} sessions
                              </p>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {formatMonths(pkg.duration_months)} · {formatCurrency(pkg.price)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={pkg.is_active ? 'green' : 'gray'} icon={pkg.is_active ? 'visibility' : 'visibility_off'}>
                                {pkg.is_active ? 'Sellable' : 'Retired'}
                              </Badge>
                              <Badge variant={dependencyCount > 0 ? 'blue' : 'gray'} icon={dependencyCount > 0 ? 'bolt' : 'history'}>
                                {dependencyCount > 0 ? `${dependencyCount} live` : `${pkg.subscription_count} used`}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                Consistency
                              </p>
                              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                {pkg.consistency_min_days} days / {pkg.consistency_window_days}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                Total usage
                              </p>
                              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                {statLabel(pkg.subscription_count, 'subscription', 'subscriptions')}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-black/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                Upcoming
                              </p>
                              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                {statLabel(pkg.upcoming_subscription_count, 'renewal', 'renewals')}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ))
            )}
          </div>

          <div className="xl:sticky xl:top-[6.6rem] xl:self-start">
            <Card gradient className="overflow-hidden p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-eyebrow">{editorMode === 'create' ? 'Create package' : 'Edit package'}</p>
                  <h3 className="mt-2 font-headline text-3xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                    {editorMode === 'create' ? 'New offer' : 'Package detail'}
                  </h3>
                </div>
                {editorMode === 'edit' && selectedPackage ? (
                  <Badge variant={selectedPackage.is_active ? 'green' : 'gray'} icon={selectedPackage.is_active ? 'sell' : 'block'}>
                    {selectedPackage.is_active ? 'Sellable' : 'Retired'}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-5 rounded-[1.6rem] bg-white/70 p-4 shadow-sm shadow-black/5 dark:bg-black/20">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Preview</p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {form.service_type || 'Service type'}
                    </p>
                    <p className="mt-2 font-headline text-3xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                      {sessionsValue || 0} sessions
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {monthsValue > 0 ? formatMonths(monthsValue) : 'Add duration'} · {priceValue > 0 ? formatCurrency(priceValue) : 'Set price'}
                    </p>
                  </div>
                  <Badge variant={form.is_active ? 'green' : 'gray'} icon={form.is_active ? 'visibility' : 'visibility_off'}>
                    {form.is_active ? 'Live' : 'Hidden'}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black/[0.04] px-3 py-3 dark:bg-white/[0.05]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Current rule
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {minDaysValue || 0} in {windowValue || 0} days
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/[0.04] px-3 py-3 dark:bg-white/[0.05]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Derived rhythm
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {derivedWeeklyCadence > 0 ? `~${derivedWeeklyCadence} days / 7` : 'Waiting for inputs'}
                    </p>
                  </div>
                </div>
              </div>

              {editorMode === 'edit' && selectedPackage && isUsedPackage ? (
                <Alert variant="info">
                  This package already has {statLabel(selectedPackage.subscription_count, 'subscription', 'subscriptions')}. Commercial fields stay locked to protect history, but you can still retire it or adjust the consistency rule.
                </Alert>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 block font-label text-[0.68rem] font-bold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
                    Service type presets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {serviceTypePresets.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        disabled={editorMode === 'edit' && isUsedPackage}
                        onClick={() => updateField('service_type', preset)}
                        className={`rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
                          form.service_type === preset
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                            : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.06] hover:text-gray-900 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.09] dark:hover:text-white'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Service type"
                  value={form.service_type}
                  onChange={event => updateField('service_type', event.target.value)}
                  placeholder="Custom coaching package"
                  disabled={editorMode === 'edit' && isUsedPackage}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Sessions"
                    type="number"
                    min="1"
                    step="1"
                    value={form.sessions}
                    onChange={event => updateField('sessions', event.target.value)}
                    disabled={editorMode === 'edit' && isUsedPackage}
                  />
                  <Input
                    label="Duration (months)"
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration_months}
                    onChange={event => updateField('duration_months', event.target.value)}
                    disabled={editorMode === 'edit' && isUsedPackage}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Price (INR)"
                    type="number"
                    min="1"
                    step="1"
                    value={form.price}
                    onChange={event => updateField('price', event.target.value)}
                    disabled={editorMode === 'edit' && isUsedPackage}
                  />
                  <Input
                    label="Consistency window"
                    type="number"
                    min="1"
                    step="1"
                    value={form.consistency_window_days}
                    onChange={event => updateField('consistency_window_days', event.target.value)}
                  />
                  <Input
                    label="Min exercise days"
                    type="number"
                    min="1"
                    step="1"
                    value={form.consistency_min_days}
                    onChange={event => updateField('consistency_min_days', event.target.value)}
                  />
                </div>

                <div>
                  <p className="mb-2 block font-label text-[0.68rem] font-bold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
                    Selling status
                  </p>
                  <div className="glass-panel flex gap-2 p-1">
                    <button
                      type="button"
                      onClick={() => updateField('is_active', true)}
                      className={`flex-1 rounded-[1.2rem] border px-4 py-2 font-label text-[0.72rem] font-bold uppercase tracking-[0.18em] transition-all ${
                        form.is_active
                          ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                          : 'border-transparent text-gray-500 hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('is_active', false)}
                      className={`flex-1 rounded-[1.2rem] border px-4 py-2 font-label text-[0.72rem] font-bold uppercase tracking-[0.18em] transition-all ${
                        !form.is_active
                          ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                          : 'border-transparent text-gray-500 hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      Retired
                    </button>
                  </div>
                </div>

                {formError ? <Alert variant="error">{formError}</Alert> : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit" disabled={isWorking} icon={isWorking ? 'progress_activity' : editorMode === 'create' ? 'add_box' : 'save'}>
                    {isWorking ? 'Saving…' : editorMode === 'create' ? 'Create package' : 'Save changes'}
                  </Button>

                  {editorMode === 'edit' && selectedPackage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => openCreate(selectedPackage)}
                      icon="content_copy"
                      disabled={isWorking}
                    >
                      Duplicate as new
                    </Button>
                  ) : null}

                  {editorMode === 'create' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setForm(emptyForm())}
                      disabled={isWorking}
                      icon="ink_eraser"
                    >
                      Clear
                    </Button>
                  ) : null}

                  {editorMode === 'edit' && selectedPackage && selectedPackage.subscription_count === 0 ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDelete}
                      disabled={isWorking}
                      icon="delete"
                    >
                      Delete unused
                    </Button>
                  ) : null}
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
