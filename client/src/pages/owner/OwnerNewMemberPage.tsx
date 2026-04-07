import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type MemberProfile, ApiError } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard' },
  { to: '/owner/members', label: 'Members' },
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
    <>
      <NavBar links={ownerLinks} />
      <div className="px-4 pt-4 pb-8">
        <Link to="/owner/members" className="inline-flex items-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5 transition-colors">
          ← Members
        </Link>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">New member</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full name" type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
          <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          <Input label="Phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" />
          <Input label="Join date" type="date" required value={joinDate} onChange={e => setJoinDate(e.target.value)} />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Creating…' : 'Create member'}
          </Button>
        </form>
      </div>
    </>
  );
}
