export default function ProfileFieldRow({
  label,
  value,
  compact,
  /** Wrap at spaces only; right-aligned block. Use for long display names. */
  wrapWords,
}: {
  label: string;
  value: string;
  /** Owner member detail profile form only; member profile stays default. */
  compact?: boolean;
  wrapWords?: boolean;
}) {
  const valueTypography = compact
    ? 'text-right text-base font-semibold text-black dark:text-white'
    : 'text-right text-sm font-semibold text-black dark:text-white';
  const valueWrap = wrapWords
    ? 'min-w-0 flex-1 whitespace-normal break-normal'
    : 'min-w-0 flex-1 break-words';

  return (
    <div
      className={
        compact
          ? 'flex min-h-[3.25rem] items-center justify-between gap-3'
          : 'flex items-center justify-between gap-4 py-4'
      }
    >
      <span className="shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">
        {label}
      </span>
      <span className={`${valueWrap} ${valueTypography}`}>{value}</span>
    </div>
  );
}
