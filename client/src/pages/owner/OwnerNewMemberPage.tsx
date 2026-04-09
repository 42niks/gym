import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type MemberProfile, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';
import Alert from '../../components/Alert.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/owner/members', label: 'Members', icon: 'groups' },
];

export default function OwnerNewMemberPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const member = await api.post<MemberProfile>('/api/members', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        join_date: joinDate,
      });
      navigate(`/owner/members/${member.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-3xl">
        <Link to="/owner/members" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Members
        </Link>
        <p className="section-eyebrow">Owner actions</p>
        <h2 className="page-title mb-6 mt-2">New member</h2>
        <p className="-mt-3 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Create a member record with the contact details they’ll use to log in and manage their training.
        </p>

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-5 sm:p-6">
          <Input label="Full name" type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
          <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          <Input label="Phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" />
          <Input label="Join date" type="date" required value={joinDate} onChange={e => setJoinDate(e.target.value)} />

          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full" icon={loading ? 'progress_activity' : 'person_add'}>
            {loading ? 'Creating…' : 'Create member'}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
