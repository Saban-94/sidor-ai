# Security Specification - SabanOS

## Data Invariants
1. Orders must have a valid customer name and items list.
2. User Magic Pages are identified by a 4-digit ID and contain sensitive PII (phone, email).
3. Internal Team Chats are for internal team communication.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identity Spoofing**: Attempt to create a UserMagicPage with someone else's 4-digit ID.
2. **PII Leak**: Non-authenticated user trying to read user_magic_pages.
3. **Chat Scrapers**: Non-authenticated user trying to list all internal_team_chats.
4. **Shadow Update**: Adding an `isAdmin: true` field to a UserProfile via client SDK.
5. **Orphaned Message**: Sending a chat message with a non-existent senderId.
6. **Immutable Field Attack**: Trying to change the `createdAt` date of an order.
7. **Resource Poisoning**: Injecting 1MB of garbage into the `text` field of a chat message.
8. **Malicious ID**: Creating an order with ID "../../../root".
9. **Role Escalation**: User trying to update their own `role` in `user_magic_pages`.
10. **Global Read**: Trying to `get()` all documents from `/orders` without a date filter.
11. **Spoofed Admin**: Trying to access `/admin/users` resources by guessing the password (handled in UI, but rules must protect DB).
12. **Cross-Tenant Write**: User A trying to delete User B's reminder.

## Test Runner (Logic Check)
- [ ] `allow read: if isSignedIn()` for general collections.
- [ ] `allow read: if true` for public-ish magic pages? Actually, UserMagicPage might be accessed by customers, but the prompt says they are "VIP Magic Pages". I'll restrict them to authenticated users OR specific IDs.
- [ ] `allow write` in `user_magic_pages` should be restricted.

Actually, the "User Magic Page" is meant to be shared via a link like `https://.../user/[id]`. This implies that anyone with the link can view it (like a landing page). However, we should still protect it.
I'll allow public reads for `user_magic_pages` IF the ID is known, but protect writes.
Wait, if it's a "Magic Page" for a user, they might want to see it without a login.
I'll set `allow get` for `user_magic_pages` to `true` but `allow list` to `false`.
Internal chats MUST be `isSignedIn()`.

## Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|-------------------|--------------------|-------------------|
| orders | Blocked (uid check) | N/A | size() checks |
| user_magic_pages | Blocked (Admin only) | N/A | size() checks |
| internal_team_chats | Blocked (senderId check) | N/A | size() checks |
