export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  if (res.status === 401) {
    // Only redirect if not already on the login page (avoids infinite reload loop)
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new ApiError(401, 'Not authenticated');
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed: ${res.status}`);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  role: 'member' | 'owner';
  full_name: string;
  email: string;
}

export interface MemberProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  join_date: string;
  status: 'active' | 'archived';
}

export interface Subscription {
  id: number;
  package_id: number;
  service_type: string;
  start_date: string;
  end_date: string;
  total_sessions: number;
  attended_sessions: number;
  remaining_sessions: number;
  amount: number;
  owner_completed: boolean;
  lifecycle_state: 'active' | 'upcoming' | 'completed';
}

export interface ConsistencyRule {
  min_days: number;
  window_days: number;
}

export interface MemberSubscriptionAttendance {
  subscription: Subscription;
  consistency_rule: ConsistencyRule;
  consistency_window: ConsistencyWindow | null;
  attended_dates: string[];
}

export interface Consistency {
  status: 'consistent' | 'building';
  days?: number;
  message: string;
}

export interface ConsistencyWindow {
  start_date: string;
  end_date: string;
  streak_days: number;
}

export interface RecentAttendanceDay {
  date: string;
  attended: boolean;
}

export interface Renewal {
  kind: 'ends_soon' | 'starts_on' | 'no_active';
  message: string;
  upcoming_start_date?: string;
}

export interface ConsistencyRiskToday {
  streak_days: number;
  message: string;
}

export type OwnerMemberListView =
  | 'all'
  | 'no-plan'
  | 'renewal'
  | 'at-risk'
  | 'building'
  | 'consistent'
  | 'today'
  | 'archived';

export interface MemberHome {
  member: MemberProfile;
  active_subscription: Subscription | null;
  consistency: Consistency | null;
  consistency_window: ConsistencyWindow | null;
  renewal: Renewal | null;
  marked_attendance_today: boolean;
  recent_attendance: RecentAttendanceDay[];
}

export interface Package {
  id: number;
  service_type: string;
  sessions: number;
  duration_months: number;
  price: number;
  consistency_window_days: number;
  consistency_min_days: number;
  is_active: boolean;
}

export interface ManagedPackage extends Package {
  subscription_count: number;
  active_subscription_count: number;
  upcoming_subscription_count: number;
}

export interface MemberListItem extends MemberProfile {
  active_subscription: Subscription | null;
  consistency: Consistency | null;
  renewal: Renewal | null;
  consistency_risk_today: ConsistencyRiskToday | null;
  marked_attendance_today: boolean;
}

export interface MemberDetail extends MemberProfile {
  active_subscription: Subscription | null;
  consistency: Consistency | null;
  renewal: Renewal | null;
  marked_attendance_today: boolean;
}

export interface DashboardItem {
  member_id: number;
  full_name: string;
  status: string;
  active_subscription?: Subscription | null;
  consistency?: Consistency | null;
  marked_attendance_today?: boolean;
  renewal?: Renewal;
}

export interface AttendanceSummary {
  present_today: number;
  present_yesterday: number;
  delta: number;
}

export interface Dashboard {
  attendance_summary: AttendanceSummary;
  renewal_no_active: DashboardItem[];
  renewal_nearing_end: DashboardItem[];
  checked_in_today: DashboardItem[];
  active_members: DashboardItem[];
  archived_members: DashboardItem[];
}
