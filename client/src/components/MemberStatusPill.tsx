import { forwardRef } from 'react';
import Icon from './Icon.js';

export type MemberStatusPillSpec = {
  key: string;
  label: string;
  icon?: string;
  tone?: 'default' | 'warning' | 'neutral';
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isConsistentFamilyPill(pill: MemberStatusPillSpec) {
  return pill.key === 'consistent' || pill.key === 'consistent-days';
}

function getToneClassName(pill: MemberStatusPillSpec) {
  return pill.tone === 'warning'
    ? 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300'
    : pill.tone === 'neutral'
      ? 'border-black/15 bg-black/[0.04] text-black/70 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/75'
      : pill.key === 'active'
        ? 'border-energy-300/40 bg-energy-100/60 text-energy-500 dark:border-energy-500/35 dark:bg-energy-500/10 dark:text-energy-300'
        : isConsistentFamilyPill(pill)
          ? 'border-brand-600/65 text-brand-50 dark:border-brand-400/40 dark:text-brand-50'
          : pill.key === 'building'
            ? 'border-brand-400/40 bg-brand-100/65 text-brand-600 dark:border-brand-400/35 dark:bg-brand-600/50 dark:text-brand-100'
            : 'border-black/15 bg-white/80 text-black dark:border-white/15 dark:bg-white/[0.06] dark:text-white';
}

const MemberStatusPill = forwardRef<HTMLSpanElement, {
  pill: MemberStatusPillSpec;
  className?: string;
  contentClassName?: string;
  iconClassName?: string;
}>(function MemberStatusPill({
  pill,
  className,
  contentClassName,
  iconClassName,
}, ref) {
  const toneClassName = getToneClassName(pill);
  const baseContentClass = joinClassNames(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[0.64rem] font-bold italic uppercase tracking-[0.16em]',
    contentClassName,
  );
  const resolvedIconClassName = joinClassNames('text-[0.9rem]', iconClassName);

  if (isConsistentFamilyPill(pill)) {
    return (
      <span
        ref={ref}
        className={joinClassNames('member-status-pill-consistent-frame inline-flex rounded-full border', toneClassName, className)}
      >
        <span className={joinClassNames(baseContentClass, 'member-status-pill-consistent-surface')}>
          {pill.icon ? <Icon name={pill.icon} className={resolvedIconClassName} /> : null}
          <span>{pill.label}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className={joinClassNames(baseContentClass, 'border', toneClassName, className)}
    >
      {pill.icon ? <Icon name={pill.icon} className={resolvedIconClassName} /> : null}
      <span>{pill.label}</span>
    </span>
  );
});

export default MemberStatusPill;
