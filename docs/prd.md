# Product Requirements Document

## 1. Overview

### 1.1 Problem Statement

The gym currently tracks member attendance in a physical register. In practice, members often do not consistently mark attendance, which means the owner does not have a reliable view of member consistency or subscription usage.

Subscription tracking and renewal reminders are also managed manually. This creates operational overhead for the owner and increases the risk of missed or delayed renewals.

The product should digitize attendance tracking, give members a simple way to understand their progress within an active subscription, and help the owner monitor upcoming renewals.

### 1.2 Goals

- Give the owner to manage members on the product (onboarding/offboarding).
- Give members visibility into their attendance and subscription progress. 
- Give the owner a clear view of active subscriptions, attendance progress, and upcoming renewals. 
- Give the owner a way to manually keep member subscriptions updated with payments completed outside the product.
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
- Login session mamangement in backend.
- Hardcoded fixed service package details.

#### Member View

- Package-defined consistency status
- Marking attendance for the current day
- Subscription history (all details)
- Renewal reminder

#### Owner View

- Owner creation/updation of members
- Owner creation/updation of subscriptions
- Visibility of package-defined consistency status for each member
- Visibility into upcoming renewals
- Renewal reminder

### 3.2 Non-Goals (for this version)

- Online payment collection
- Automatic tracking of payments completed externally
- Support for multiple gyms or branches
- Complex service package management through the app UI
- Backdated attendance marking by members and owner
- Renewal reminders being sent as notifications on external channels
- Broad feature expansion before validating real-world adoption

## 4. Product Rules & Assumptions

### 4.0 Roles

- There is exactly one owner account for the gym in MVP.
- All non-owner users are members.
- Only the owner can create and update member records.

### 4.1 Session

- A session represents a single gym visit by a member.
- A member can mark attendance only when they have an active subscription. Attended sessions and remaining sessions are updated for that subscription.
- A member can mark at most one attendance entry per calendar day.
- No member or owner is currently allowed to mark backdated attendance.

### 4.2 Subscription

- A subscription is a member-specific instance of a package.
- A subscription has a start date, end date, total sessions, attended sessions, remaining sessions, and an amount.
- A subscription is associated with one service type.
- A subscription is considered `active` if the current date is between the start and end date along with a non zero number of remaining sessions.
- If the number of remaining sessions drops to zero before the end date is reached, the subscription is considered as `completed`.
- There is no rollover of sessions if they remain unutilised even at the end of a subscription.
- Overlapping subscriptions are not allowed.
- Only the owner creates subscriptions post manual verification of completed payments. Subscriptions can be created for a future date as well.

### 4.3 Renewal

- A renewal is the member's next subscription after the current subscription.
- If a future subscription already exists for a member, renewal reminders should be suppressed.
- Renewal reminders should be active if any one of the following is true
    1. There are less than 3 remaining sessions: "Your subscription ends soon, please renew."
    2. There are less than 5 days before the subscription ends: "Your subscription ends soon, please renew."
    3. There is no active subscription: "You have no active subscription, please activate."
- It is possible that the user can have an upcoming subscription (a subscription that starts at a later date) and no active subscription. In that case, the message "You have no active subscription, please activate." is expected.

### 4.4 Consistency

- Members should be able to understand whether they are maintaining the attendance rhythm expected for their active package.
- For MVP, consistency is defined using a package-specific rolling attendance rule.
- Each package must define:
    1. A rolling window in calendar days
    2. A minimum number of exercise days within that window
- A member is considered consistent when their number of attended exercise days within the current rolling window is greater than or equal to the threshold defined by their active package.
- Attendance for consistency must be measured in exercise days rather than sessions, since a member can mark at most one attendance entry per calendar day.
- This metric is intended to describe recent attendance behaviour only. It does not imply that skipped sessions can be compensated for by extra attendance outside the package policy.
- A message like "You have been consistent for the last 14 days" or "You have been consistent for the last 30 days" is expected. 
- For a consistency rule of "2 exercise days in 7 days" and a message "You have been consistent for the last 30 days" is to be interpreted as "Every window of 7 consecutive days for the last 30 days has at least 2 exercise days".
- If number of consistent days are less than as specified by the consistency rule, then "You are building your consistency, keep it up!" is expected.
- The number of consistent days can stretch outside of subscription boundaries. For example, if a member renews subscription monthly and has been attended all sessions for the last 3 months, then "You have been consistent for the last 90 days" is expected. Only the last consistent period is expected to be referenced, and not previous ones.

## 5. Domain Model & Key Concepts

### 5.1 Member

#### Attributes

- Full name
- Phone number
- Join date
- Billing history - list of all subscriptions, past, present and future.
- Consistency rule adherence history - list of all date periods when consistency rule has been met (even historical).

### 5.2 Service Packages

- There is a fixed set of packages for each service type.
- Packages are updated infrequently. Current ones are specified in appendix.
- Giving the owner the ability to update packages from the app UI is out of scope for MVP.
- Unused sessions do not roll over unless explicitly stated by the package policy, which is out of scope for MVP.
- Each package includes a consistency rule used to evaluate recent attendance. 
- A consistency rule consists of a rolling window in days and a minimum number of exercise days within that window.
- Consistency rule is to be derived from the specified number of sessions and duration, and expressed for a minimum window of 7 days.

#### 1:1 Personal Training


| No. of sessions | Duration | Price  | Consistency rule |
| --------------- | -------- | ------ | ---------------- |
| 8               | 1 month  | 19,900 | 2 exercise days in 7 days |
| 12              | 1 month  | 29,500 | 3 exercise days in 7 days |
| ...             | ...      | ...    | ... |


#### Group Personal Training


| No. of sessions | Duration | Price  | Consistency rule |
| --------------- | -------- | ------ | ---------------- |
| 12              | 1 month  | 14,500 | 3 exercise days in 7 days |
| 16              | 1 month  | 18,900 | 4 exercise days in 7 days |
| ...             | ...      | ...    | ... |


### 5.3 Subscription

This is a member-specific instance of a package.

#### Attributes

- Service type: `1:1 Personal Training`, `Group Personal Training`
- Start date
- End date
- Amount
- Total sessions
- Attended sessions
- Remaining sessions
- Attended session dates
- Package consistency rule snapshot
- If subscription start date is in future, the it is `upcoming`. If subscription is active (as per definition of active), then it is `active`. Past subscription have no such label.

### 5.4 Session

- A session is a single attendance record for a member on a specific date.
- Only one session can exist per member per day.

## 6. User Stories

### 6.1 Member Stories

- As a member, I want to be motivated to mark my attendance.
- As a member, I want to mark my attendance so that my progress is recorded.
- As a member, I want to see how many sessions I have attended and how many remain in my current subscription.
- As a member, I want to understand how consistently I have attended during my active subscription period.
- As a member, I want to be reminded when I need to renew my subscription.

### 6.2 Owner Stories

- As the owner, I want to create a new member and store their details.
- As the owner, I want to create and manage subscriptions for members.
- As the owner, I want to see how many sessions each member has attended in their current subscription.
- As the owner, I want to know which members are nearing renewal and whether a future subscription has already been recorded.

## 7. Core Features (MVP)

### 7.1 Shared Platform Features

- Single login flow with backend session management
- Role-based routing to Member view or Owner view

### 7.2 Member Features

- Mark attendance for the current day when an active subscription exists
- View active subscription progress, including total, attended, and remaining sessions
- View subscription history across past, active, and upcoming subscriptions
- View package-defined consistency status and progress messaging
- View in-app renewal reminders when renewal conditions are met

### 7.3 Owner Features

- Create and update member records
- Create and update member subscriptions using fixed package definitions
- View subscription progress for each member
- View package-defined consistency status for each member
- View upcoming renewals and renewal reminder status


## 8. Functional Requirements

- The system must provide a single login flow with backend session management.
- The system must route authenticated users to the Member view or Owner view based on their role.
- The system must allow only the owner to create and update member records.
- The system must allow only the owner to create and update subscriptions for a member.
- The system must create subscriptions only from the fixed package definitions available in MVP.
- The system must prevent overlapping subscriptions for the same member.
- The system must allow a member to mark attendance only when an active subscription exists.
- The system must prevent more than one attendance entry per member per calendar day.
- The system must not allow backdated attendance marking by either members or the owner.
- The system must update attended sessions and remaining sessions immediately after a valid attendance entry is recorded.
- The system must show the member the active subscription summary, including total, attended, and remaining sessions.
- The system must show the member subscription history across past, active, and upcoming subscriptions.
- The system must evaluate consistency using the rolling attendance rule defined by the member's active package.
- The system must show the member their current consistency status using the defined progress messaging rules.
- The system must show renewal reminders when any of the defined renewal conditions are met.
- The system must suppress renewal reminders when a future subscription already exists.
- The system must show the owner each member's subscription progress and consistency status.
- The system must surface to the owner members who are approaching renewal based on the defined session and date thresholds.


## 9. User Flows

### 9.1 Owner Creates Member and Subscription

1. Owner creates a new member profile.
2. Owner selects a package and creates a subscription for that member.
3. The member becomes eligible to mark attendance while the subscription is active.

### 9.2 Member Marks Attendance

1. Member opens the product.
2. Member sees the current active subscription summary.
3. Member marks attendance for the day.
4. The system records the session and updates attended and remaining session counts.

### 9.3 Owner Reviews Upcoming Renewals

1. Owner opens the renewal view.
2. Owner sees members whose subscriptions are nearing completion or expiry.
3. Owner checks whether a future subscription has already been recorded.
4. If no future subscription exists, the owner follows up with the member.

> PM Review Comment: We should add one more flow for what the member sees when no active subscription exists.

## 10. Design & UX Considerations

### 10.1 Design Principles

- Simple and mobile-first
- Fast to use during gym check-in
- Easy for the owner to understand without training
- Focused on operational clarity rather than feature depth

### 10.2 UX Notes

- Attendance marking should require as few steps as possible.
- Subscription progress should be visible at a glance.
- Renewal risk should be easy for the owner to scan quickly.

> PM Review Comment: If members are expected to self-mark attendance regularly, the UX for this single action is the most important part of the product and should be treated as a primary design concern.

## 11. Technical Considerations

### 11.1 Tech Stack

To be decided.

### 11.2 Integrations

To be decided.

> PM Review Comment: If reminders require external delivery, the integration choice should be made early because it affects cost, compliance, and implementation complexity.

### 11.3 Constraints & Assumptions

- The product is intended for a single gym.
- Package definitions are relatively stable.
- Package definitions for MVP are fixed in code or seeded data and include the package-specific consistency rule.
- The owner is willing to move away from spreadsheet-first operations for this workflow.

> PM Review Comment: Add any assumptions around device access, for example whether members are expected to use their own phones and whether the owner will use the product primarily on mobile or desktop.

## 12. Open Questions

## 13. Appendix

### Service Packages

#### 1:1 Personal Training

1. 8 sessions, 1 month, 19,100
2. 24 sessions, 3 months, 59,000
3. 12 sessions, 1 month, 29,500
4. 36 sessions, 3 months, 85,800

#### MMA/Kickboxing Personal Training

1. 4 sessions, 1 month, 9,600
2. 8 sessions, 1 month, 18,800
3. 12 sessions, 1 month, 26,400

#### Group Personal Training

1. 12 sessions, 1 month, 14,500
2. 36 sessions, 3 months, 42,000
3. 16 sessions, 1 month, 18,900
4. 48 sessions, 3 months, 54,000
5. 30 sessions, 4 months, 42,500
6. 40 sessions, 5 months, 56,000
7. 16 sessions, 2 months, 22,800
