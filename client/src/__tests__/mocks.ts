import type {
  User, MemberHome, MemberProfile, GroupedSubscriptions,
  Subscription, Dashboard, DashboardItem, MemberListItem,
  MemberDetail, Package, Consistency, Renewal, ManagedPackage,
} from '../lib/api.js';

export const mockOwner: User = {
  id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit',
};

export const mockMember: User = {
  id: 2, role: 'member', full_name: 'Alex Kumar', email: 'member@thebase.fit',
};

export const mockSubscription: Subscription = {
  id: 1, package_id: 1, service_type: '1:1 Personal Training',
  start_date: '2026-04-01', end_date: '2026-04-30',
  total_sessions: 12, attended_sessions: 5, remaining_sessions: 7,
  amount: 29500, owner_completed: false, lifecycle_state: 'active',
};

export const mockCompletedSubscription: Subscription = {
  id: 2, package_id: 2, service_type: 'Group Personal Training',
  start_date: '2026-03-01', end_date: '2026-03-31',
  total_sessions: 12, attended_sessions: 12, remaining_sessions: 0,
  amount: 14500, owner_completed: true, lifecycle_state: 'completed',
};

export const mockUpcomingSubscription: Subscription = {
  id: 3, package_id: 1, service_type: '1:1 Personal Training',
  start_date: '2026-05-01', end_date: '2026-05-31',
  total_sessions: 12, attended_sessions: 0, remaining_sessions: 12,
  amount: 29500, owner_completed: false, lifecycle_state: 'upcoming',
};

export const mockConsistency: Consistency = {
  status: 'consistent', days: 14, message: 'Consistent for 14 days',
};

export const mockRenewalEndsSoon: Renewal = {
  kind: 'ends_soon', message: 'Your subscription ends in 3 days',
};

export const mockRenewalNoActive: Renewal = {
  kind: 'no_active', message: 'You have no active subscription, please activate.',
};

export const mockMemberProfile: MemberProfile = {
  id: 2, full_name: 'Alex Kumar', email: 'member@thebase.fit',
  phone: '9876543210', join_date: '2026-04-07', status: 'active',
};

export const mockMemberHome: MemberHome = {
  member: mockMemberProfile,
  active_subscription: mockSubscription,
  consistency: mockConsistency,
  renewal: null,
  marked_attendance_today: false,
  recent_attendance: [
    { date: '2026-04-02', attended: true },
    { date: '2026-04-03', attended: false },
    { date: '2026-04-04', attended: true },
    { date: '2026-04-05', attended: false },
    { date: '2026-04-06', attended: true },
    { date: '2026-04-07', attended: false },
    { date: '2026-04-08', attended: false },
  ],
};

export const mockGroupedSubscriptions: GroupedSubscriptions = {
  completed_and_active: [mockSubscription, mockCompletedSubscription],
  upcoming: [mockUpcomingSubscription],
};

export const mockPackages: Package[] = [
  { id: 1, service_type: '1:1 Personal Training', sessions: 12, duration_months: 1, price: 29500, consistency_window_days: 7, consistency_min_days: 3, is_active: true },
  { id: 2, service_type: '1:1 Personal Training', sessions: 24, duration_months: 3, price: 59000, consistency_window_days: 7, consistency_min_days: 2, is_active: true },
  { id: 3, service_type: 'Group Personal Training', sessions: 12, duration_months: 1, price: 14500, consistency_window_days: 7, consistency_min_days: 3, is_active: true },
];

export const mockManagedPackages: ManagedPackage[] = [
  {
    ...mockPackages[0],
    subscription_count: 6,
    active_subscription_count: 2,
    upcoming_subscription_count: 1,
  },
  {
    ...mockPackages[1],
    subscription_count: 0,
    active_subscription_count: 0,
    upcoming_subscription_count: 0,
  },
  {
    ...mockPackages[2],
    is_active: false,
    subscription_count: 3,
    active_subscription_count: 0,
    upcoming_subscription_count: 0,
  },
];

export const mockMemberListItem: MemberListItem = {
  ...mockMemberProfile,
  active_subscription: mockSubscription,
  consistency: mockConsistency,
  marked_attendance_today: false,
};

export const mockMemberDetail: MemberDetail = {
  ...mockMemberProfile,
  active_subscription: mockSubscription,
  consistency: mockConsistency,
  renewal: null,
  marked_attendance_today: false,
};

export const mockDashboard: Dashboard = {
  attendance_summary: {
    present_today: 1,
    present_yesterday: 0,
    delta: 1,
  },
  renewal_no_active: [
    { member_id: 3, full_name: 'Test User', status: 'active', renewal: mockRenewalNoActive },
  ],
  renewal_nearing_end: [],
  checked_in_today: [
    { member_id: 2, full_name: 'Alex Kumar', status: 'active', marked_attendance_today: true },
  ],
  active_members: [
    { member_id: 2, full_name: 'Alex Kumar', status: 'active', active_subscription: mockSubscription, consistency: mockConsistency, marked_attendance_today: false },
  ],
  archived_members: [],
};
