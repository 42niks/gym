import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type Package, type Subscription, ApiError } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard' },
  { to: '/owner/members', label: 'Members' },
];

export default function OwnerNewSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: packages = [], isLoading } = useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/api/packages'),
  });

  function handlePackageSelect(pkg: Package) {
    setSelectedPackage(pkg);
    setAmount(String(pkg.price));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackage) return;
    setError('');
    setLoading(true);
    try {
      await api.post<Subscription>(`/api/members/${id}/subscriptions`, {
        package_id: selectedPackage.id,
        start_date: startDate,
        amount: parseFloat(amount),
      });
      navigate(`/owner/members/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const byType = packages.reduce<Record<string, Package[]>>((acc, pkg) => {
    if (!acc[pkg.service_type]) acc[pkg.service_type] = [];
    acc[pkg.service_type].push(pkg);
    return acc;
  }, {});

  return (
    <>
      <NavBar links={ownerLinks} />
      <div className="px-4 pt-4 pb-8">
        <Link to={`/owner/members/${id}`} className="inline-flex items-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5 transition-colors">
          ← Member
        </Link>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">New subscription</h2>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {Object.entries(byType).map(([type, pkgs]) => (
                <div key={type}>
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{type}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {pkgs.map(pkg => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handlePackageSelect(pkg)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${
                          selectedPackage?.id === pkg.id
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md shadow-brand-500/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{pkg.sessions} sessions</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{pkg.duration_months}mo</p>
                        <p className={`text-sm font-black mt-1.5 ${selectedPackage?.id === pkg.id ? 'text-brand-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          ₹{pkg.price.toLocaleString('en-IN')}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedPackage && (
              <Card className="p-5 space-y-4">
                <Input label="Start date" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input label="Amount (₹)" type="number" required min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)} />

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating…' : 'Create subscription'}
                </Button>
              </Card>
            )}
          </form>
        )}
      </div>
    </>
  );
}
