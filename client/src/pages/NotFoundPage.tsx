import AppShell from '../components/AppShell.js';

interface NotFoundLink {
  to: string;
  label: string;
  icon: string;
}

export default function NotFoundPage({ links }: { links: NotFoundLink[] }) {
  return (
    <AppShell links={links}>
      <div className="page-stack">
        <div>
          <p className="section-eyebrow">Page not found</p>
          <h2 className="page-title mt-2">404</h2>
          <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            This page is not available for your account.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
