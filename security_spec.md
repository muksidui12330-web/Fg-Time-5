# Security Specification for FG TIME

## 1. Data Invariants
1. A post cannot be created or updated with an authorId different from `request.auth.uid`.
2. A like can only be created by the authenticated user whose `userId` matches `request.auth.uid`.
3. Comments can only be created with `authorId == request.auth.uid`.
4. Stories and Reels can only be created and deleted by their creator (`authorId == request.auth.uid`).
5. Only conversation participants can read or send messages in that conversation.
6. A user's notification subcollection is strictly readable and modifiable only by that user.
7. Profile updates are restricted to the document owner (`request.auth.uid == userId`).
8. Abuse reports can only be submitted by authenticated users, with `reporterId == request.auth.uid`.
9. All string and text fields are strictly bounded by size limits to prevent Denial of Wallet attacks.
10. System and sensitive fields (e.g., identity IDs) cannot be altered after creation.

## 2. The "Dirty Dozen" Payloads
1. **Ghost Author Post**: Creating a post where `authorId` is set to another user's UID.
2. **Oversized Post Content Payload**: Sending a post with a 2MB content string.
3. **Spoofed Like**: Creating `/posts/{postId}/likes/{victimId}` while authenticated as `attackerId`.
4. **Foreign Comment Deletion**: Deleting another user's comment without authorization.
5. **Private Message Snoop**: Querying messages from a conversation where the user is not in `participants`.
6. **Notification Infiltration**: Writing fake notifications directly into another user's notification collection without being the action initiator.
7. **Profile Takeover**: Sending an update to `/users/{victimId}` with malicious profile data.
8. **Malicious Report Spoof**: Creating a report where `reporterId` does not match the authenticated caller.
9. **Story Mutation**: Attempting to edit another user's story media URL.
10. **Reel Hijack**: Attempting to delete a reel owned by another creator.
11. **Negative Follower Count Injection**: Writing arbitrary follower counts directly to another user document.
12. **Unauthenticated Write**: Creating posts or messages without being signed in (`request.auth == null`).

## 3. Test Runner
Validation assertions ensure that each of the Dirty Dozen payloads returns `PERMISSION_DENIED` at the Firestore security boundary.
