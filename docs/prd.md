# Product Requirements Document

## 1. Overview

### 1.1 Problem Statement

The gym currently tracks member attendance in a physical register. In practice, members often do not consistently mark attendance, which means the owner does not have a reliable view of member consistency or subscription usage.

Subscription tracking and renewal reminders are also managed manually. This creates operational overhead for the owner and increases the risk of missed or delayed renewals.

The product should digitize attendance tracking, give members a simple way to understand their progress within an active subscription, and help the owner monitor upcoming renewals.

### 1.2 Goals

- Give the owner the ability to manage members on the product (onboarding/offboarding).
- Give members visibility into their attendance and subscription progress.
- Give the owner a clear view of active subscriptions, attendance progress, and upcoming renewals.
- Give the owner a way to manually keep member subscription records up to date with payments completed outside the product.
- Reduce manual effort spent tracking subscriptions and sending renewal reminders.

### 1.3 Product Strategy

The product strategy is to make attendance tracking feel useful and motivating for members, rather than purely administrative.

Showing members positive progress signals, such as streaks and/or milestone-based summaries, is expected to increase repeat logins and encourage them to mark attendance consistently. Examples may include messages such as "perfect attendance for the last 5 weeks" or "2 full months of complete attendance."

The same visibility should also be available to the owner. Since the owner also acts as a coach, they can use this information to personally appreciate members, reinforce good habits, and motivate continued consistency.

This strategy assumes that a combination of self-visible progress and coach reinforcement will improve attendance marking behavior and make the product more engaging than a simple logging tool.

Based on feedback from users, we can choose to pick various options like streaks, milestones, adherence scores, etc. or even a combination of those.

## 2. Users & Stakeholders

### 2.1 Target Users

1. Members
2. Owner

### 2.2 User Personas

#### 1. Member

- A member subscribes to one of the available gym packages.
- A member typically attends the gym two to three times per week, depending on the package. On any given day, there can only be up to one workout.
- A member pays the subscription fee directly to the owner.
- A member needs a simple way to mark attendance and track subscription utilisation.
- Members use fitness trackers. Workout tracking needs to be explicitly started and stopped on some of these which is fairly easy for a user to forget.
- Members need to be reminded to pay the owner the subscription fees as all payments are manual.

#### 2. Owner

- There is a single owner for this gym. Owner is also a coach. There are other coaches at the gym who are not target users.
- The owner currently manages onboarding, offboarding, subscription tracking, and renewal follow-up manually.
- Operational records are currently maintained in spreadsheets and a physical attendance register.
- The owner needs a lightweight system that reduces manual tracking effort without introducing unnecessary complexity.

### 2.3 Stakeholders

- Members
- Owner

## 3. MVP Scope

### 3.1 In Scope

- One login page which routes to Member view or Owner view based on the user who has logged in.
- Login session management in backend.
- Fixed seeded service package definitions.

#### Member View

- Package-defined consistency status
- Marking attendance for the current day
- Subscription history (all details)
- Renewal reminder

#### Owner View

- Owner creation/updation of members
- Owner creation of subscriptions and early completion of active/upcoming subscriptions
- Visibility of package-defined consistency status for each member
- Visibility into upcoming renewals
- Renewal reminder

### 3.2 Non-Goals (for this version)

- Online payment collection
- Automatic tracking of payments completed externally
- Support for multiple gyms or branches
- Complex service package management through the app UI
- Backdated attendance marking by members or the owner
- Renewal reminders being sent as notifications on external channels
- Member password change through the app
- Broad feature expansion before validating real-world adoption

## 4. Product Rules & Assumptions

### 4.0 Roles

- There is exactly one owner account for the gym in MVP.
- All non-owner users are members.
- Only the owner can create and update member records.
- The owner can archive a member to remove them from the main member list only if the member has no active or upcoming subscriptions. All historical data is preserved. Archived members are accessible from the member list via a separate "Show Archived" view.
- Archived members cannot log in or mark attendance.
- Creating a new subscription for an archived member automatically unarchives them, returning them to the active member list.
- Users log in using email and password.
- A member's mobile number serves as their login password. No separate password field is stored; the system uses the mobile number as the authentication credential. There is no in-app password change or password reset flow.
- The owner may update a member's full name or mobile number after account creation. No other member fields are editable after creation. Updating a member's mobile number also changes their login credential, since the mobile number is the password.
- Member email is required, must be globally unique across all members (including archived members), and is matched case-insensitively for uniqueness.
- Duplicate phone numbers are allowed.
- The owner account and one initial member account are created by directly seeding the database. Credentials are stored in a local seed file that is not committed to version control. The same seed file is used for local development, local test, and production databases.

### 4.1 Session

- A session represents a single gym visit by a member.
- A member can mark attendance only when they have an active subscription. Attended sessions and remaining sessions are updated for that subscription.
- A member can mark at most one attendance entry per calendar day.
- No member or owner is currently allowed to mark backdated attendance.
- The owner may add an attendance entry for a member for the current local calendar day only if the member has an active subscription, is not archived, and has not already marked attendance for that day. Attendance is always associated with the currently active subscription. This is the only attendance correction available to the owner.
- Once the local calendar day has passed, attendance for that date cannot be changed by either members or the owner.
- Once attendance is marked, it cannot be erased by either members or the owner.

### 4.2 Subscription

- A subscription is a member-specific instance of a package.
- A subscription has a start date, end date, total sessions, attended sessions, remaining sessions, and an amount.
- A subscription is associated with one service type.
- The amount is automatically populated from the package price at the time of subscription creation. It is not editable at creation or thereafter. Price changes to a package do not affect existing subscriptions.
- Subscription lifecycle states are derived at query time from the current date and remaining sessions. No lifecycle state is stored.
- A subscription is considered `active` if the current date is between the start and end date (inclusive), remaining sessions is greater than zero, and the owner has not manually completed it.
- A subscription is considered `upcoming` if its start date is in the future and the owner has not manually completed it.
- A subscription is considered `completed` if the current date is past the end date, all sessions have been used (remaining sessions = 0), or the owner has manually completed it.
- There is no rollover of sessions if they remain unutilised at the end of a subscription.
- Subscriptions cannot be edited once created.
- The owner can manually mark any active or upcoming subscription as completed. This immediately moves the subscription to `completed`, freezes its counters as-is, keeps all already-recorded attendance history unchanged, and cannot be reverted.
- Overlapping subscriptions are not allowed. Subscription date ranges are inclusive. A new subscription start date cannot match an existing active or upcoming subscription end date, and a new subscription is valid only when its start date is strictly later than the end date of every active or upcoming subscription for that member. Overlap is evaluated only against active and upcoming subscriptions. Completed subscriptions are excluded from overlap checks, allowing a new subscription to be created in their place.
- Only the owner creates subscriptions post manual verification of completed payments. Subscriptions can be created for the current local date or a future date. Past dates are not allowed for subscription creation.

### 4.3 Renewal

- A renewal is the member's next subscription after the current subscription.
- Multiple future subscriptions are allowed as long as they do not overlap.
- Renewal messaging follows this exact logic:
    1. If an active subscription exists, determine whether it is nearing end by checking whether fewer than 3 sessions remain or fewer than 5 days remain before the subscription end date.
    2. If the active subscription is nearing end and no upcoming subscription exists, show: "Your subscription ends soon, please renew."
    3. If no active subscription exists and an upcoming subscription exists, show: "Your subscription starts on [start date of the earliest upcoming subscription]."
    4. If no active subscription exists and no upcoming subscription exists, show: "You have no active subscription, please activate."
    5. In all other cases, no renewal message is shown.

### 4.4 Consistency

- Consistency is a first-class product concept and should be prioritised above subscription counting in member-facing progress communication.
- Members should be able to understand whether they are maintaining the attendance rhythm expected for their active package.
- For MVP, consistency is defined using a package-specific rolling attendance rule.
- Each package must define:
    1. A rolling window in calendar days
    2. A minimum number of exercise days within that window
- A member is considered consistent when their number of attended exercise days within the current rolling window is greater than or equal to the threshold defined by their active package.
- Attendance for consistency must be measured in exercise days rather than sessions, since a member can mark at most one attendance entry per calendar day.
- Consistency rules are derived from the package by dividing the number of sessions by the number of weeks in the package duration (where 1 month = 4 weeks), and rounding to the nearest integer, expressed as exercise days in a 7-day window. For example, 12 sessions in 1 month (4 weeks) = 12/4 = 3 exercise days in 7 days. The stored seeded rule for each package is authoritative; the formula is explanatory only. The full seeded package list is maintained in [service-packages.md](docs/service-packages.md).
- This metric is intended to describe recent attendance behaviour only. It does not imply that skipped sessions can be compensated for by extra attendance outside the package policy.
- A message like "You have been consistent for the last 14 days" or "You have been consistent for the last 30 days" is expected.
- For a consistency rule of "2 exercise days in 7 days" and a message "You have been consistent for the last 30 days", this is to be interpreted as "Every window of 7 consecutive days for the last 30 days has at least 2 exercise days".
- Consistency should be evaluated using the member's full attendance history and may stretch across subscription boundaries. For example, if a member renews subscription monthly and has been consistent for the last 3 months, then "You have been consistent for the last 90 days" is expected. Only the current continuous consistent period is expected to be referenced.
- The consistency rule to apply at any moment is the rule of the currently active package. If the package's consistency rule is updated in the seed data, the change retroactively affects consistency evaluation for all members currently on that package. This is intentional and accepted behaviour.
- Consistency evaluation requires that at least `window_days` have elapsed since the member's earliest ever subscription start date. Until this threshold is met, always show the building message regardless of attendance. For example, for a "2 exercise days in 7 days" rule, the building message is always shown until at least 7 days have passed from the member's earliest subscription start date.
- For each calendar day (once eligible for evaluation), determine whether the trailing rolling window ending on that day satisfies the active package's consistency rule.
- "You have been consistent for the last X days" means X is the length of the current continuous suffix ending today for which every day satisfies the consistency rule.
- If the current continuous consistent suffix is shorter than the rolling window (including when a member is new and does not yet have enough attendance history), show: "You are building your consistency, keep it up!"
- Historical consistency is not stored and is not displayed. Historically, only attended dates and subscription records are shown.

### 4.5 Calendar & Time

- The gym's local timezone is Asia/Kolkata (IST, UTC+5:30). All date calculations use this timezone.
- One attendance entry is allowed per member per local calendar date.
- Subscription status is determined using the current local date.
- Package durations such as 1 month, 2 months, or 3 months are calendar durations starting from the subscription start date.
- The subscription end date is derived as the day before the same calendar date after the package duration has elapsed. For example, a 1 month subscription starting on 2026-04-07 ends on 2026-05-06. If the derived target date does not exist in the calendar (for example, adding 1 month to January 31 yields February 31, which does not exist), the target date is rounded to the last valid day of that month (e.g. February 28 in a common year, February 29 in a leap year), and the end date is one day before that.
- "Fewer than 5 days remain" means the local date difference between today and subscription end date is 4 days or less.

## 5. Domain Model & Key Concepts

### 5.1 Member

#### Attributes

- Full name (editable by owner)
- Email (not editable after creation)
- Phone number (editable by owner; also serves as login password)
- Join date (automatically set to the current local date at account creation time; not provided as input and not editable after creation)
- Status: `active`, `archived`
- Billing history - list of all subscriptions, past, present and future.
- Current consistency is derived from attendance history and the currently active subscription rule. No consistency history or adherence state is stored separately in MVP.

### 5.2 Service Packages

- There is a fixed set of packages for each service type.
- Packages are updated infrequently. The full production package list with pre-computed consistency rules is maintained in [service-packages.md](docs/service-packages.md).
- A package is uniquely identified by the combination of its service type, number of sessions, duration, and price. This combination is guaranteed to be unique within the seeded data.
- Once a package is seeded, it is immutable. Packages cannot be removed or edited; only new packages may be added.
- Giving the owner the ability to update packages from the app UI is out of scope for MVP.
- Unused sessions do not roll over unless explicitly stated by the package policy, which is out of scope for MVP.
- Each package includes a consistency rule used to evaluate recent attendance.
- A consistency rule consists of a rolling window in days and a minimum number of exercise days within that window.
- Consistency rule is derived by dividing the number of sessions by the number of weeks in the package duration (1 month = 4 weeks), rounding to the nearest integer, expressed as exercise days in a 7-day window. The stored seeded rule for each package is authoritative. The formula is explanatory only.
- The package examples below are illustrative only. [service-packages.md](docs/service-packages.md) is the authoritative source for the full MVP package set, prices, and consistency rules.

#### 1:1 Personal Training

| No. of sessions | Duration | Price (INR) | Consistency rule |
| --------------- | -------- | ----------- | ---------------- |
| 8               | 1 month  | 19,900      | 2 exercise days in 7 days |
| 12              | 1 month  | 29,500      | 3 exercise days in 7 days |
| ...             | ...      | ...         | ... |

#### Group Personal Training

| No. of sessions | Duration | Price (INR) | Consistency rule |
| --------------- | -------- | ----------- | ---------------- |
| 12              | 1 month  | 14,500      | 3 exercise days in 7 days |
| 16              | 1 month  | 18,900      | 4 exercise days in 7 days |
| ...             | ...      | ...         | ... |

### 5.3 Subscription

This is a member-specific instance of a package.

#### Attributes

- Service type: `1:1 Personal Training`, `MMA/Kickboxing Personal Training`, `Group Personal Training`
- Start date
- End date
- Amount (auto-populated from package price at creation; not editable at creation or thereafter; not affected by subsequent package price changes)
- Total sessions
- Attended sessions
- Remaining sessions
- Owner completed (boolean; true if the owner has manually marked this subscription as completed)

#### Derived (not stored)

- Lifecycle state: `upcoming`, `active`, `completed` — derived at query time from current date, remaining sessions, and the owner completed flag per the rules in §4.2.

### 5.4 Session

- A session is a single attendance record for a member on a specific date.
- Only one session can exist per member per day.

## 6. User Stories

### 6.1 Member Stories

- As a member, I want to be motivated to mark my attendance.
- As a member, I want to mark my attendance so that my progress is recorded.
- As a member, I want to see how many sessions I have attended and how many remain in my current subscription.
- As a member, I want to understand how consistently I have attended in recent history using my active package's rule.
- As a member, I want to be reminded when I need to renew my subscription.

### 6.2 Owner Stories

- As the owner, I want to create a new member and store their details.
- As the owner, I want to archive a member when they leave the gym without losing their history.
- As the owner, I want to create subscriptions for members and end them early when needed.
- As the owner, I want to see how many sessions each member has attended in their current subscription.
- As the owner, I want to know which members are nearing renewal and whether a future subscription has already been recorded.

## 7. Core Features (MVP)

### 7.1 Shared Platform Features

- Single login flow with backend session management
- Role-based routing to Member view or Owner view
- Email and password based authentication

### 7.2 Member Features

- Mark attendance for the current day when an active subscription exists
- View active subscription progress, including total, attended, and remaining sessions
- View subscription history across completed, active, and upcoming subscriptions
- View package-defined consistency status and progress messaging
- View in-app renewal reminders when renewal conditions are met

### 7.3 Owner Features

- Create and update member records
- Archive member records
- Create subscriptions and manually complete active/upcoming subscriptions using fixed seeded package definitions
- View subscription progress for each member
- View package-defined consistency status for each member when that member has an active subscription, displayed as a compact label: "Consistent: Xd" (where X is the number of days in the current consistent suffix) or "Building consistency" when the member is not yet consistently meeting the threshold
- View member lists for archived members, active members, renewal follow-up, and members with no active subscription
- Add attendance for a member for the current local day if the member has an active subscription, is not archived, and has not already marked it

## 8. Functional Requirements

- The system must provide a single login flow with backend session management.
- The system must route authenticated users to the Member view or Owner view based on their role.
- The system must authenticate users using email and password.
- The system must use a member's mobile number as their login password. No separate password field is stored; authentication compares the submitted password directly to the member's mobile number.
- The system must automatically set a member's join date to the current local date at account creation time. Join date is not provided as input and is not editable after creation.
- The system must allow the owner to update only a member's full name and mobile number after account creation. Updating the mobile number also changes the member's login credential.
- The system must allow only the owner to create and update member records.
- The system must allow only the owner to archive member records.
- The system must reject archiving when the member has any active or upcoming subscription.
- The system must prevent archived members from logging in or marking attendance.
- Creating a new subscription for an archived member must automatically unarchive them.
- The system must allow only the owner to create subscriptions and manually complete active or upcoming subscriptions for a member.
- The system must create subscriptions only from the fixed seeded package definitions available in MVP.
- The system must not allow subscription creation with a past start date.
- The system must prevent overlapping subscriptions for the same member, including boundary-date overlap where a new subscription start date matches the end date of an existing active or upcoming subscription.
- The system must allow a member to mark attendance only when an active subscription exists.
- The system must prevent more than one attendance entry per member per calendar day.
- The system must not allow backdated attendance marking by either members or the owner.
- The system must allow the owner to add an attendance entry for a member for the current local calendar day only if the member has an active subscription, is not archived, and has not already marked attendance for that day.
- The system must not allow attendance deletion by either members or the owner.
- The system must update attended sessions and remaining sessions immediately after a valid attendance entry is recorded.
- The system must show the member the active subscription summary, including total, attended, and remaining sessions.
- The system must show the member subscription history across completed, active, and upcoming subscriptions. Completed and active subscriptions must be shown together in reverse chronological order. Upcoming subscriptions must be shown in a separate list in chronological order.
- The system must enforce globally unique email addresses across all members, including archived members.
- The system must evaluate consistency using the rolling attendance rule defined by the member's active package.
- The system must show the member their current consistency status using the defined progress messaging rules.
- The system must not store historical consistency state or historical consistency-rule snapshots.
- The system must show renewal reminders when any of the defined renewal conditions are met.
- The system must not show a nearing-end renewal reminder when an upcoming subscription already exists.
- The system must show the owner each non-archived member's subscription progress and current consistency status when that member has an active subscription.
- The system must provide the owner with separate lists for non-archived members, archived members, members whose subscription is ending soon and have no upcoming subscription, and non-archived members who have no active subscription.

## 9. User Flows

### 9.1 Authentication

#### 9.1.1 User Logs In and Is Routed by Role

1. User opens the product and sees the login screen.
2. User enters their email and password and submits.
3. The system authenticates the user and identifies their role.
4. If the user is a member, they are routed to the Member view.
5. If the user is the owner, they are routed to the Owner view.

#### 9.1.2 User Enters Incorrect Credentials

1. User opens the product and sees the login screen.
2. User enters an incorrect email or password and submits.
3. The system rejects the login and shows an error message.
4. User can retry.

### 9.2 Member — Attendance

#### 9.2.1 Member Marks Attendance

1. Member opens the product and sees the home screen, which always shows the attendance action area and shows consistency status only when an active subscription exists.
2. The consistency status reflects the rolling rule of the active package. A positive message is shown if the member is consistent; an encouraging message is shown if not.
3. Member taps the attendance button.
4. The system records the session and updates attended and remaining session counts.
5. The system shows immediate success feedback and disables the attendance button for the rest of the local day.

#### 9.2.2 Member Has Already Marked Attendance Today

1. Member opens the product and sees the home screen.
2. The attendance button is visible but inactive for the rest of the day.
3. A message confirms that attendance has already been marked for today.

#### 9.2.3 Member Has No Active Subscription — Upcoming Exists

1. Member opens the product and sees the home screen.
2. Consistency status is not shown as there is no active package to evaluate against.
3. The attendance button is visible but inactive.
4. A banner shows: "Your subscription starts on [start date of the earliest upcoming subscription]."

#### 9.2.4 Member Has No Active Subscription — No Upcoming

1. Member opens the product and sees the home screen.
2. Consistency status is not shown as there is no active package to evaluate against.
3. The attendance button is visible but inactive.
4. A banner shows: "You have no active subscription, please activate."

### 9.3 Member — Subscriptions

#### 9.3.1 Member Views Subscription Summary and History

1. Member navigates to the subscription section.
2. If an active subscription exists, the member sees it including total, attended, and remaining sessions.
3. If no active subscription exists but an upcoming subscription exists, the member sees an empty state: "You do not have an active subscription yet. Your next subscription starts on [start date of the earliest upcoming subscription]."
4. If no active subscription exists and no upcoming subscription exists, the member sees an empty state: "You do not have an active subscription."
5. If the member has no subscription history at all, the member sees an empty state: "You do not have any subscription history yet."
6. The member can scroll to view completed and upcoming subscriptions when those records exist. Completed and active subscriptions are displayed together in a single list in reverse chronological order. Upcoming subscriptions are displayed in a separate section in chronological order.

### 9.4 Member — Renewal

#### 9.4.1 Member Sees a Renewal Reminder

1. Member opens the product.
2. If fewer than 3 sessions remain or fewer than 5 days remain on the active subscription, and no upcoming subscription exists, a renewal prompt is shown: "Your subscription ends soon, please renew."
3. If there is no active subscription and an upcoming subscription exists, the member sees: "Your subscription starts on [start date]."
4. If there is no active subscription and no upcoming subscription exists, the member sees: "You have no active subscription, please activate."
5. If an active subscription is nearing end but an upcoming subscription already exists, no renewal message is shown.

### 9.5 Owner — Member Management

#### 9.5.1 Owner Creates a New Member

1. Owner opens the member management section.
2. Owner enters the new member's details: full name, email, and phone number. Email is required, must be globally unique (including archived members), and is matched case-insensitively for uniqueness. Join date is not an input; it is automatically set to the current local date.
3. The system sets the member's initial password to their mobile number (i.e. the mobile number field is the login credential).
4. Owner submits and the member record is created.
5. The member can now be assigned a subscription.

#### 9.5.2 Owner Updates an Existing Member Record

1. Owner opens the member list and selects a member.
2. Owner may edit only the member's full name or mobile number. Email, join date, and all other fields are not editable after creation.
3. Updating the member's mobile number also changes their login credential, since the mobile number is the password.
4. Owner saves the changes and the record is updated.

#### 9.5.3 Owner Archives a Member

1. Owner opens the member list and selects a member.
2. Owner chooses to archive the member.
3. If the member has any active or upcoming subscription, the system rejects the action and shows an error.
4. Otherwise, the system prompts for confirmation, noting that the member will be removed from the main list and will not be able to log in or mark attendance. All history is preserved, and creating a new subscription for this member later will unarchive them.
5. Owner confirms and the member is archived. The member no longer appears in the main member list but is accessible via the "Show Archived" view.

#### 9.5.4 Owner Views an Individual Member's Detail

1. Owner opens the member list and selects a member.
2. Owner sees the member's full profile: personal details, active subscription progress, full consistency message (same format as the member-facing message), and subscription history (completed and active together in reverse chronological order; upcoming in a separate chronological list).
3. Owner can navigate to create a new subscription or mark an existing one as completed from this view.

### 9.6 Owner — Subscription Management

#### 9.6.1 Owner Creates a Subscription for a Member

1. Owner selects a member.
2. Owner selects a service type and package from the fixed package definitions.
3. Owner sets the subscription start date. Past dates are not allowed.
4. The system derives the end date, total sessions, amount, and consistency rule from the selected package.
5. The system validates that the subscription does not overlap with any existing active or upcoming subscription for that member, including boundary dates.
6. Owner confirms and the subscription is created.
7. If the member was archived, they are automatically unarchived.

#### 9.6.2 Owner Tries to Create an Overlapping Subscription

1. Owner selects a member and begins creating a new subscription following the flow in 9.6.1.
2. The system detects that the selected dates overlap with an existing active or upcoming subscription for that member, including the case where the new start date is the same as an existing end date.
3. The system rejects the submission and shows an error indicating the conflict.
4. Owner can either adjust the start date to avoid the overlap or mark the conflicting subscription as completed first following the flow in 9.6.3.

#### 9.6.3 Owner Marks a Subscription as Completed

1. Owner selects a member and opens their subscription history.
2. Owner selects an active or upcoming subscription to mark as completed.
3. The system prompts the owner to confirm, noting that this action cannot be reverted.
4. Owner confirms and the subscription is immediately moved to completed. Historical attendance remains unchanged and the subscription counters stay frozen.
5. A replacement subscription may start on the same day because completed subscriptions are excluded from overlap checks.

#### 9.6.4 Owner Adds Attendance for a Member

1. Owner opens a member's detail view on the current local calendar day.
2. If the member has an active subscription, is not archived, and has not already marked attendance for today, the owner can add an attendance entry on behalf of the member.
3. The system records the session and immediately recalculates attended sessions, remaining sessions, and consistency status.
4. If the member has already marked attendance for today, if the member has no active subscription, if the member is archived, or if the local calendar day has already passed, the add action is not available.

### 9.7 Owner — Monitoring

#### 9.7.1 Owner Reviews the Member List

1. Owner opens the member list, which is sorted alphabetically by member name.
2. Owner sees the list of all non-archived members sorted alphabetically.
3. For members with an active subscription, the owner sees active subscription progress and current consistency status at a glance. Consistency is shown as a compact label: "Consistent: Xd" or "Building consistency".
4. Owner can identify members who are off-track on consistency or low on remaining sessions.
5. Owner can toggle to the "Show Archived" view to see archived members separately, also sorted alphabetically.

#### 9.7.2 Owner Identifies Members Approaching Renewal and Creates a New Subscription

1. Owner opens the renewal view.
2. Owner sees a list of members whose subscriptions are nearing completion or expiry based on session and date thresholds and do not have an upcoming subscription.
3. Owner also sees a list of all non-archived members who do not currently have an active subscription.
4. For a member without a future subscription, the owner follows up with them to confirm payment.
5. If an existing subscription needs to be ended early, the owner marks it as completed following the flow in 9.6.3.
6. Once payment is confirmed, the owner creates a new subscription for that member following the flow in 9.6.1.

## 10. Design & UX Considerations

### 10.1 Design Principles

- Simple and mobile-first
- Fast to use during gym check-in
- Easy for the owner to understand without training
- Focused on operational clarity rather than feature depth
- Prioritise the primary action. On the member home screen, marking attendance should be the most visually prominent action.
- Make status understandable in under a few seconds. Members and the owner should be able to identify current state quickly without reading dense text.
- Use positive reinforcement without ambiguity. Consistency messaging should feel motivating, while operational states such as no active subscription, archived member, or attendance already marked should remain explicit.
- Protect irreversible actions. Ending a subscription early or archiving a member should require confirmation with clear consequences.
- Prefer recognition over recall. The screen should surface the most relevant next action and current state instead of expecting the user to remember details.
- Design for repeat use. Frequent actions should stay in stable positions and feel familiar across repeated daily use.
- Optimise for one-hand mobile use. Primary actions and critical status should be easy to reach and interact with on a phone.
- Keep owner workflows dense but scannable. The owner should be able to review many members quickly without losing clarity.

### 10.2 UX Notes

- Attendance marking should require as few steps as possible.
- Subscription progress should be visible at a glance.
- Renewal risk should be easy for the owner to scan quickly.
- The member home screen should present information in this order: attendance action, current consistency message, active subscription summary, and renewal message if applicable.
- Attendance marking should be a one-tap action from the member home screen.
- After attendance is marked, the system should show immediate success feedback and disable the attendance action for the rest of the local day.
- Disabled attendance states should always explain why the action is unavailable, such as attendance already marked, no active subscription, or archived member.
- Consistency should be communicated as the primary progress signal for members, while subscription counts should remain visible as supporting context.
- Renewal messaging should be presented as a clear banner or status block, but should not visually overpower the primary attendance action for members with an active subscription.
- Subscription progress should be understandable through both numeric counts and a simple visual representation.
- The owner member list should be optimised for fast scanning using clear status labels for active subscription, nearing renewal, consistency state when applicable, and archived state.
- The owner detail view should keep risky actions such as archive member and complete subscription visibly separate from routine actions.
- Risky owner actions should require confirmation dialogs with plain-language consequences.
- Forms should minimise typing on mobile by using selection controls, date pickers, and sensible defaults where possible.
- Empty states should be explicit and helpful, especially for no active subscription, no subscription history, no members nearing renewal, and no attendance recorded yet in the current consistency window.
- Error states should be specific and actionable, especially for login failure, overlapping subscriptions, and attendance correction after the day has ended.
- Loading and saving states should be visible so users know whether an action is in progress or has succeeded.
- Status should not rely on color alone. Important states should also use text labels and, where helpful, icons.
- Tap targets should be comfortably sized for mobile use, and destructive actions should be spaced away from routine actions to reduce mistakes.

## 11. Technical Considerations

- No external integrations needed for payments or notifications.
- The full list of service packages is maintained in [service-packages.md](docs/service-packages.md). It is to be used as production data.
- This is to be deployed on Cloudflare using Workers for compute and D1 for database.

### 11.1 Tech Stack

- Package manager: `npm`
- Frontend: `React` with `Vite`
- Frontend routing: `React Router`
- Backend/API: `Hono` on Cloudflare Workers
- Database: `Cloudflare D1`

### 11.2 Data Seeding

- The owner account and one initial member account are seeded directly into the database using a local seed file.
- The seed file is not committed to version control.
- The same seed file is applied to local development, local test, and production databases.
- Package definitions are seeded as fixed data from [service-packages.md](docs/service-packages.md).

### 11.3 Constraints & Assumptions

- This is to be used on mobile only for now.
- The product is intended for a single gym.
- Package definitions are stable. Existing packages are immutable; only new packages may be added directly to the database when needed.
- Package definitions for MVP are fixed in seeded data and include the package-specific consistency rule.
- All date and time logic runs against Asia/Kolkata (IST, UTC+5:30).

## 12. Open Questions

Resolved in this document. The production service package list lives in [service-packages.md](docs/service-packages.md).
