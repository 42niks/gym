import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ManagedPackage, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import Icon from '../../components/Icon.js';
import { ownerLinks } from './ownerLinks.js';

interface PackageTab {
  key: string;
  label: string;
  title: string;
  icon: string;
  packages: ManagedPackage[];
  count: number;
  archived: boolean;
}

const ARCHIVED_PACKAGES_TAB = '__archived__';

const tabMeta = [
  { match: '1:1 personal training', icon: 'person', label: '1:1' },
  { match: 'group personal training', icon: 'groups', label: 'Group' },
  { match: 'mma/kickboxing personal training', icon: 'sports_mma', label: 'MMA' },
  { match: 'boxing', icon: 'sports_mma', label: 'Boxing' },
] as const;

function getTabRank(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  const index = tabMeta.findIndex((item) => normalized.includes(item.match));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getTabIcon(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return tabMeta.find((item) => normalized.includes(item.match))?.icon ?? 'inventory_2';
}

function getTabLabel(serviceType: string) {
  const normalized = serviceType.trim().toLowerCase();
  return tabMeta.find((item) => normalized.includes(item.match))?.label ?? serviceType;
}

function buildTabs(packages: ManagedPackage[]): PackageTab[] {
  const activePackages = packages.filter((pkg) => pkg.is_active);
  const archivedPackages = packages.filter((pkg) => !pkg.is_active);
  const grouped = new Map<string, ManagedPackage[]>();

  for (const pkg of activePackages) {
    const current = grouped.get(pkg.service_type) ?? [];
    current.push(pkg);
    grouped.set(pkg.service_type, current);
  }

  const activeTabs = Array.from(grouped.entries())
    .sort(([left], [right]) => {
      const rankDiff = getTabRank(left) - getTabRank(right);
      return rankDiff !== 0 ? rankDiff : left.localeCompare(right);
    })
    .map(([serviceType, items]) => ({
      key: serviceType,
      label: getTabLabel(serviceType),
      title: serviceType,
      icon: getTabIcon(serviceType),
      packages: items,
      count: items.length,
      archived: false,
    }));

  return [
    ...activeTabs,
    {
      key: ARCHIVED_PACKAGES_TAB,
      label: 'Archived',
      title: 'Archived Packages',
      icon: 'archive',
      packages: archivedPackages,
      count: archivedPackages.length,
      archived: true,
    },
  ];
}

function formatPrice(price: number) {
  if (!Number.isFinite(price)) {
    return '--';
  }
  return `₹${price.toLocaleString('en-IN')}`;
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

function getSubscribedCount(pkg: ManagedPackage) {
  const activeCount = Number.isFinite(pkg.active_subscription_count)
    ? Math.max(0, Math.trunc(pkg.active_subscription_count))
    : 0;
  const upcomingCount = Number.isFinite(pkg.upcoming_subscription_count)
    ? Math.max(0, Math.trunc(pkg.upcoming_subscription_count))
    : 0;

  return activeCount + upcomingCount;
}

function BottomPackageTabs({
  tabs,
  selectedKey,
  onSelect,
}: {
  tabs: PackageTab[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefMap = useRef<Record<string, HTMLButtonElement | null>>({});
  const didInitScroll = useRef(false);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const activeTab = selectedKey ? tabRefMap.current[selectedKey] : null;
    if (!scrollEl || !activeTab) return;

    const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
    if (maxScrollLeft <= 0) return;

    const activeIndex = tabs.findIndex((tab) => tab.key === selectedKey);
    const isFirst = activeIndex === 0;
    const isLast = activeIndex === tabs.length - 1;

    let targetScrollLeft: number;
    if (isFirst) {
      targetScrollLeft = 0;
    } else if (isLast) {
      targetScrollLeft = maxScrollLeft;
    } else {
      const scrollRect = scrollEl.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      const tabCenterInScroll = scrollEl.scrollLeft + (tabRect.left - scrollRect.left) + (tabRect.width / 2);
      targetScrollLeft = tabCenterInScroll - (scrollEl.clientWidth / 2);
    }

    const clamped = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
    if (!didInitScroll.current) {
      scrollEl.scrollLeft = clamped;
      didInitScroll.current = true;
      return;
    }

    scrollEl.scrollTo({ left: clamped, behavior: 'smooth' });
  }, [selectedKey, tabs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div
        className="mx-auto max-w-5xl px-3 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="members-view-dock pointer-events-auto overflow-hidden rounded-[1.7rem] border border-black backdrop-blur-xl dark:border-white">
          <div ref={scrollRef} className="members-view-tabs-scroll overflow-x-auto px-3 py-3">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => {
                const active = tab.key === selectedKey;

                return (
                  <div key={tab.key} className="flex items-center gap-2">
                    {tab.archived ? (
                      <span aria-hidden="true" className="h-7 w-px shrink-0 rounded-full bg-gray-500/65 dark:bg-gray-300/55" />
                    ) : null}
                    <button
                      ref={(element) => {
                        tabRefMap.current[tab.key] = element;
                      }}
                      type="button"
                      aria-label={`${tab.title} ${tab.count}`}
                      title={tab.title}
                      onClick={() => onSelect(tab.key)}
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerPackagesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [archiveError, setArchiveError] = useState('');

  const { data: packageData = [], isLoading } = useQuery<ManagedPackage[]>({
    queryKey: ['owner-packages'],
    queryFn: () => api.get('/api/packages'),
  });

  const packages = Array.isArray(packageData)
    ? packageData.filter((pkg): pkg is ManagedPackage =>
      pkg !== null
      && typeof pkg === 'object'
      && typeof pkg.service_type === 'string'
      && pkg.service_type.trim().length > 0,
    ).map((pkg) => ({ ...pkg, service_type: pkg.service_type.trim() }))
    : [];

  const tabs = buildTabs(packages);
  const requestedType = searchParams.get('type');
  const firstActiveKey = tabs.find((tab) => !tab.archived)?.key ?? tabs[0]?.key ?? null;
  const selectedKey = tabs.some((tab) => tab.key === requestedType)
    ? requestedType
    : requestedType && packages.some((pkg) => !pkg.is_active && pkg.service_type === requestedType)
      ? ARCHIVED_PACKAGES_TAB
      : firstActiveKey;
  const selectedTab = tabs.find((tab) => tab.key === selectedKey) ?? null;

  function handleTabSelect(key: string) {
    const nextParams = new URLSearchParams(searchParams);

    if (key === firstActiveKey && key !== ARCHIVED_PACKAGES_TAB) {
      nextParams.delete('type');
    } else {
      nextParams.set('type', key);
    }

    setSearchParams(nextParams);
  }

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
      <div
        className="page-stack"
        style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="page-title">PACKAGES</h2>
          <Link
            to="/packages/new"
            className="owner-packages-cta-frame inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black font-label text-[0.72rem] font-bold italic uppercase tracking-[0.18em] text-black shadow-panel transition-all hover:shadow-glow-brand dark:border-white dark:text-white"
          >
            <span aria-hidden="true" className="owner-packages-cta-surface brand-duotone-button-sm" />
            <span className="relative z-10 inline-flex h-full w-full items-center justify-center gap-1.5 rounded-[calc(9999px-1px)] px-3.5">
              <Icon name="add" className="text-[0.95rem]" />
              NEW
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : packages.length === 0 ? (
          <div className="empty-state">No packages yet</div>
        ) : selectedTab ? (
          <>
            <div className="px-1">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
                  <Icon name={selectedTab.icon} className="text-[1.25rem] text-black/80 dark:text-white/85" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 font-headline text-[2rem] font-black italic leading-[0.92] tracking-[-0.04em] text-black dark:text-white sm:text-[2.3rem]">
                      {selectedTab.title}
                    </h3>
                    <span className="shrink-0 text-right font-headline text-[2rem] font-black italic leading-[0.92] tracking-[-0.04em] text-black dark:text-white sm:text-[2.3rem]">
                      {selectedTab.count}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
            {archiveError ? (
              <div className="border-b border-black px-4 py-3 dark:border-white sm:px-5">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{archiveError}</p>
              </div>
            ) : null}

            {selectedTab.packages.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-black dark:text-white">
                No archived packages
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`w-full border-collapse text-left ${selectedTab.archived ? 'min-w-[56rem]' : 'min-w-[46rem]'}`}>
                  <thead>
                    <tr className="bg-black/[0.03] dark:bg-white/[0.03]">
                      {selectedTab.archived ? (
                        <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                          Package
                        </th>
                      ) : null}
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
                      <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
                        Members subscribed
                      </th>
                      <th className="px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70 sm:px-5">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTab.packages.map((pkg) => {
                      const subscribedCount = getSubscribedCount(pkg);
                      const isArchiving = archivingId === pkg.id;

                      return (
                        <tr
                          key={pkg.id}
                          className={`border-t border-black align-top dark:border-white ${
                            pkg.is_active ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]' : 'bg-black/[0.03] dark:bg-white/[0.03]'
                          }`}
                        >
                          {selectedTab.archived ? (
                            <td className="px-4 py-3.5 sm:px-5">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] border border-black bg-white/70 shadow-sm shadow-black/5 dark:border-white dark:bg-white/5">
                                  <Icon name={getTabIcon(pkg.service_type)} className="text-[1.05rem] text-black/75 dark:text-white/75" />
                                </span>
                                <p className="text-sm font-semibold text-black/70 dark:text-white/75">
                                  {pkg.service_type}
                                </p>
                              </div>
                            </td>
                          ) : null}
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
            )}
            </Card>
          </>
        ) : null}
      </div>

      {!isLoading && packages.length > 0 ? (
        <BottomPackageTabs tabs={tabs} selectedKey={selectedKey} onSelect={handleTabSelect} />
      ) : null}
    </AppShell>
  );
}
