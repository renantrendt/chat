# Testing Guide - Double Check Mark Feature

## Setup Complete! 🎉

The double check mark feature is now implemented. Here's how to test it:

## Testing Steps

### 1. Basic Setup
- Open the app in two different browsers (or one regular + one incognito window)
- Create a username for each window (e.g., "Alice" and "Bob")

### 2. Test Message Status
1. **Alice creates a room** and gets a room code
2. **Bob joins the room** using the code
3. **Alice sends a message**
   - You should see a single gray check ✓ (sent)
   - When Bob is in the room, it should change to double gray checks ✓✓ (delivered)
   - When Bob scrolls to see the message, it should turn to blue double checks ✓✓ (read)

### 3. Test Offline Behavior
1. **Bob leaves the room** (goes back to home screen)
2. **Alice sends another message**
   - Should show only single check ✓ (sent)
3. **Bob rejoins the room**
   - Alice's message should update to double gray checks ✓✓ (delivered)
   - When Bob scrolls to see it, should turn blue ✓✓ (read)

## What's Working

✅ Single check mark when message is sent
✅ Double gray check marks when recipient is online
✅ Blue double check marks when message is read
✅ Real-time status updates
✅ User activity tracking (30-second heartbeat)
✅ Visibility detection (marks as read when scrolled into view)

## Troubleshooting

If check marks aren't showing:
1. Check browser console for errors
2. Make sure you ran all the SQL in Supabase
3. Refresh both browser windows
4. Check that Supabase realtime is enabled for the messages table

## Note on Cleanup Job

The automatic cleanup job (to mark users as inactive) requires pg_cron which may not be available on your Supabase plan. Without it, users might appear online longer than expected, but the feature will still work - just with a slight delay in status updates. 