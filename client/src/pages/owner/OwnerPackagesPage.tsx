import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ManagedPackage, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import Icon from '../../components/Icon.js';
import { ownerLinks } from './ownerLinks.js';

interface PackageTab {
  serviceType: string;
  icon: string;
  packages: ManagedPackage[];
}

const tabMeta = [
  { match: '1:1 personal training', icon: 'person' },
  { match: 'group personal training', icon: 'groups' },
  { match: 'mma/kickboxing personal training', icon: 'sports_mma' },
  { match: 'boxing', icon: 'sports_mma' },
] as const;

function getTabRank(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  const index = tabMeta.findIndex(item => normalized.includes(item.match));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getTabIcon(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return tabMeta.find(item => normalized.includes(item.match))?.icon ?? 'inventory_2';
}

function buildTabs(packages: ManagedPackage[]): PackageTab[] {
  const grouped = new Map<string, ManagedPackage[]>();

  for (const pkg of packages) {
    const current = grouped.get(pkg.service_type) ?? [];
    current.push(pkg);
    grouped.set(pkg.service_type, current);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => {
      const rankDiff = getTabRank(left) - getTabRank(right);
      return rankDiff !== 0 ? rankDiff : left.localeCompare(right);
    })
    .map(([serviceType, items]) => ({
      serviceType,
      icon: getTabIcon(serviceType),
      packages: items,
    }));
}

function formatPrice(price: number) {
  return `₹${price.toLocaleString('en-IN')}`;
}

function formatDuration(months: number) {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

function formatConsistency(pkg: Pick<ManagedPackage, 'consistency_min_days' | 'consistency_window_days'>) {
  return `${pkg.consistency_min_days} in ${pkg.consistency_window_days} days`;
}

function getSubscribedCount(pkg: ManagedPackage) {
  return pkg.active_subscription_count + pkg.upcoming_subscription_count;
}

export default function OwnerPackagesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [archiveError, setArchiveError] = useState('');

  const { data: packages = [], isLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['owner-packages'],
    queryFn: () => api.get('/api/packages'),
  });

  const tabs = buildTabs(packages);
  const requestedType = searchParams.get('type');
  const selectedType = tabs.some(tab => tab.serviceType === requestedType)
    ? requestedType
    : tabs[0]?.serviceType ?? null;
  const selectedTab = tabs.find(tab => tab.serviceType === selectedType) ?? null;

  async function handleArchive(pkg: ManagedPackage) {
    if (!pkg.is_active) return;

    const confirmed = confirm(
      `Archive "${pkg.service_type}" (${pkg.sessions} sessions, ${pkg.duration_months}mo)? Existing members keep it, but it will no longer be available for renewal.`
    );
    if (!confirmed) return;

    setArchiveError('');
    setArchivingId(pkg.id);

    try {
      await api.patch(`/api/packages/${pkg.id}`, { is_active: false });
      await queryClient.invalidateQueries({ queryKey: ['owner-packages'] });
    } catch (error) {
      setArchiveError(error instanceof ApiError ? error.message : 'Failed to archive package');
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack">
        <div className="flex items-center justify-between gap-3">
          <h2 className="page-title">PACKAGES</h2>
          <Link
            to="/packages/new"
            className="owner-packages-cta-frame inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black p-px font-label text-[0.72rem] font-bold italic uppercase tracking-[0.18em] text-black shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-glow-brand dark:border-white dark:text-white"
          >
            <span aria-hidden="true" className="owner-packages-cta-surface brand-duotone-button" style={{ backgroundSize: '62% 185%, 86% 235%, 100% 100%' }} />
            <span className="relative z-10 inline-flex h-full w-full items-center justify-center rounded-[calc(9999px-1px)] px-3.5">
              + NEW
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : tabs.length === 0 ? (
          <div className="empty-state">No packages yet</div>
        ) : (
          <>
            <div className="glass-panel flex gap-3 overflow-x-auto p-2.5 sm:p-3">
              {tabs.map(tab => {
                const active = tab.serviceType === selectedType;

                return (
                  <button
                    key={tab.serviceType}
                    type="button"
                    aria-label={tab.serviceType}
                    title={tab.serviceType}
                    onClick={() => setSearchParams({ type: tab.serviceType })}
                    className={`owner-packages-tab-frame group aspect-square w-[4.9rem] shrink-0 border border-black transition-all duration-200 sm:w-[5.4rem] dark:border-white ${
                      active
                        ? '-translate-y-0.5 shadow-[0_18px_40px_rgba(0,0,0,0.14)]'
                        : 'shadow-sm shadow-black/5 hover:-translate-y-0.5 hover:shadow-panel'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-[calc(1.55rem-1px)] ${
                        active
                          ? 'bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,230,23,0.72),rgba(224,11,11,0.52))] dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(222,252,0,0.34),rgba(224,11,11,0.42))]'
                          : 'bg-white/70 dark:bg-white/10'
                      }`}
                    />
                    <span
                      className={`owner-packages-tab-surface flex items-center justify-center ${
                        active
                          ? 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(255,255,255,0.86)_48%,rgba(241,248,245,0.82)_100%)] text-black dark:bg-[radial-gradient(circle_at_top,rgba(42,41,43,0.98),rgba(24,24,27,0.96)_56%,rgba(18,18,20,0.98)_100%)] dark:text-white'
                          : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,245,245,0.84))] text-black/60 group-hover:text-black dark:bg-[linear-gradient(180deg,rgba(39,39,42,0.94),rgba(24,24,27,0.9))] dark:text-white/70 dark:group-hover:text-white'
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-2 -rotate-6 rounded-[1.35rem] bg-accent-400/20 blur-md dark:bg-energy-300/18"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full transition-all ${
                          active
                            ? 'bg-accent-500 shadow-[0_0_0_4px_rgba(224,11,11,0.12)] dark:bg-energy-300 dark:shadow-[0_0_0_4px_rgba(222,252,0,0.12)]'
                            : 'border border-black bg-black/5 dark:border-white dark:bg-white/5'
                        }`}
                      />
                      <Icon
                        name={tab.icon}
                        className={`relative z-10 transition-transform duration-200 ${
                          active
                            ? 'text-[2.45rem] sm:text-[2.7rem]'
                            : 'text-[2.25rem] group-hover:scale-105 sm:text-[2.45rem]'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedTab ? (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-black px-4 py-4 dark:border-white sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/70 shadow-sm shadow-black/5 dark:border-white dark:bg-white/5">
                      <Icon name={selectedTab.icon} className="text-[1.35rem] text-black/80 dark:text-white/80" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline text-2xl font-black italic uppercase tracking-tight text-black dark:text-white">
                        {selectedTab.serviceType}
                      </h3>
                    </div>
                  </div>
                </div>

                {archiveError ? (
                  <div className="border-b border-black px-4 py-3 dark:border-white sm:px-5">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">{archiveError}</p>
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="min-w-[46rem] w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-black/[0.03] dark:bg-white/[0.03]">
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                          Sessions
                        </th>
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                          Duration
                        </th>
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                          Price
                        </th>
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                          Consistency
                        </th>
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                          Members subscribed
                        </th>
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold italic uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTab.packages.map(pkg => {
                        const subscribedCount = getSubscribedCount(pkg);
                        const isArchiving = archivingId === pkg.id;

                        return (
                          <tr
                            key={pkg.id}
                            className={`border-t border-black align-top dark:border-white ${
                              pkg.is_active ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]' : 'bg-black/[0.03] dark:bg-white/[0.03]'
                            }`}
                          >
                            <td className="px-4 py-3.5 sm:px-5">
                              <p className={`text-base font-black ${pkg.is_active ? 'text-black dark:text-white' : 'text-black/60 dark:text-white/70'}`}>
                                {pkg.sessions}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className={`text-sm font-semibold ${pkg.is_active ? 'text-black dark:text-white' : 'text-black/60 dark:text-white/70'}`}>
                                {formatDuration(pkg.duration_months)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className={`text-sm font-black ${pkg.is_active ? 'text-black dark:text-white' : 'text-black/60 dark:text-white/70'}`}>
                                {formatPrice(pkg.price)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className={`text-sm ${pkg.is_active ? 'text-black/75 dark:text-white/80' : 'text-black/60 dark:text-white/70'}`}>
                                {formatConsistency(pkg)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className={`text-sm font-black ${pkg.is_active ? 'text-black dark:text-white' : 'text-black/60 dark:text-white/70'}`}>
                                {subscribedCount}
                              </p>
                              <p className="mt-1 text-xs text-black/60 dark:text-white/70">
                                {subscribedCount > 0
                                  ? `${pkg.active_subscription_count} live · ${pkg.upcoming_subscription_count} upcoming`
                                  : 'No live members'}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 sm:px-5">
                              {pkg.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => handleArchive(pkg)}
                                  disabled={isArchiving}
                                  className="inline-flex items-center gap-2 rounded-full font-label text-[0.68rem] font-bold italic uppercase tracking-[0.18em] text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <Icon name={isArchiving ? 'progress_activity' : 'archive'} className="text-[1rem]" />
                                  {isArchiving ? 'Archiving' : 'Archive'}
                                </button>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-black bg-white/70 px-3 py-1.5 font-label text-[0.62rem] font-bold italic uppercase tracking-[0.16em] text-black/60 shadow-sm shadow-black/5 dark:border-white dark:bg-white/5 dark:text-white/70">
                                  Archived
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
