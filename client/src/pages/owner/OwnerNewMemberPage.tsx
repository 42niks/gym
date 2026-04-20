import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type MemberProfile, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Input from '../../components/Input.js';
import Button from '../../components/Button.js';
import Alert from '../../components/Alert.js';
import { ownerLinks } from './ownerLinks.js';
import { getFirstFormErrorMessage } from '../../lib/formValidation.js';

function isValidYmdDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return !Number.isNaN(candidate.getTime())
    && candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export default function OwnerNewMemberPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joinDateInput, setJoinDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [errorPulse, setErrorPulse] = useState(0);
  const [loading, setLoading] = useState(false);

  function showError(message: string) {
    setError(message);
    setErrorPulse(v => v + 1);
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D+/g, '').slice(0, 10);
    setPhone(digits);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const validationError = getFirstFormErrorMessage(e.currentTarget);
    if (validationError) {
      showError(validationError);
      return;
    }
    if (!isValidYmdDate(joinDateInput)) {
      showError('Select a valid join date');
      return;
    }
    setLoading(true);
    try {
      const member = await api.post<MemberProfile>('/api/members', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        join_date: joinDateInput,
      });
      navigate(`/members/${member.id}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-3xl">
        <Link to="/members" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Members
        </Link>
        <h2 className="page-title mb-6 mt-2">NEW MEMBER</h2>

        <form onSubmit={handleSubmit} noValidate className="glass-panel space-y-4 p-5 sm:p-6">
          <Input label="Full name" labelClassName="ml-3 not-italic" type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
          <Input label="Email" labelClassName="ml-3 not-italic" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          <Input label="Phone" labelClassName="ml-3 not-italic" type="text" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} required value={phone} onChange={handlePhoneChange} placeholder="9876543210" />
          <Input
            label="Join date"
            labelClassName="ml-3 not-italic"
            type="date"
            required
            value={joinDateInput}
            onChange={e => setJoinDateInput(e.target.value)}
          />

          {error && (
            <div key={errorPulse} className="form-error-flash">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full" icon={loading ? 'progress_activity' : 'person_add'}>
            {loading ? 'Creating…' : 'Create member'}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
