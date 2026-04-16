# Button label loading width shift

Some buttons changed their text while entering a loading state (for example, `MARK TODAY` -> `MARKING TODAY`). On small screens this could increase button content width and cause horizontal overflow or visual layout shift.

## Impact
- Member home check-in action could spill out of viewport width on narrow devices.
- Other buttons showed jitter when loading text length differed from idle text.

## Root cause
Loading state was represented by both icon swap and label swap. The label swap changed text length and therefore changed content width.

## Fix
Keep button labels constant across idle and loading states, and represent loading using:
- disabled state
- loading/progress icon

## Updated locations
- `client/src/pages/member/MemberHomePage.tsx` (`MARK TODAY` kept constant)
- `client/src/pages/owner/OwnerMemberDetailPage.tsx` (`Mark attendance` kept constant)
- `client/src/pages/owner/OwnerNewPackagePage.tsx` (`Create package` kept constant)
- `client/src/pages/LoginPage.tsx` (`Sign in` kept constant)
