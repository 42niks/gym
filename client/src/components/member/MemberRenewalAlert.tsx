import Icon from '../Icon.js';

export const MEMBER_RENEWAL_ALERT_DEFAULT_MESSAGE = 'Your subscription ends soon, please renew.';

interface MemberRenewalAlertProps {
  message?: string;
}

export default function MemberRenewalAlert({ message = MEMBER_RENEWAL_ALERT_DEFAULT_MESSAGE }: MemberRenewalAlertProps) {
  return (
    <div
      role="region"
      aria-label="Subscription renewal"
      aria-live="polite"
      className="flex items-start gap-3 rounded-2xl border border-energy-300 bg-energy-50/90 px-4 py-3.5 text-black shadow-sm shadow-black/5 dark:border-energy-500/40 dark:bg-energy-500/15 dark:text-white"
    >
      <Icon name="emergency_home" className="mt-0.5 shrink-0 text-[1.35rem] text-black/70 dark:text-white" />
      <div className="min-w-0 flex-1">
        <p className="font-label text-[0.65rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">
          Renewal
        </p>
        <p className="mt-1 font-body text-[0.9rem] font-medium leading-snug text-black dark:text-white">
          {message}
        </p>
      </div>
    </div>
  );
}
