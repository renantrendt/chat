# Room Presence Feature - Testing Guide

## Feature Description
When a user leaves a room (by clicking "Leave Room" or closing the browser tab), other users in the same room will see a notification that says "[username] left the room" in red color, displayed below the room code for 8 seconds.

## Implementation Details

### Files Modified/Created:
1. **index.html** - Added notification container in chat room screen
2. **styles.css** - Added styles for the leave notification
3. **room-presence.js** - New file handling presence tracking
4. **app-supabase.js** - Integrated presence tracking on room enter/leave

### How It Works:
- Uses Supabase Realtime Presence feature to track users in rooms
- Each room has a unique presence channel (`presence:ROOMCODE`)
- When a user joins a room, they're tracked in the presence channel
- When a user leaves (button click or tab close), they're untracked
- Other users receive a 'leave' event and see the notification

## Testing Instructions

### Method 1: Using the Test Page
1. Open `test-room-presence.html` in your browser
2. Open the same page in another browser window/tab (or incognito)
3. Enter different usernames in each window
4. Use the same room code (e.g., "TEST123")
5. Click "Join Room" in both windows
6. Click "Leave Room" in one window
7. The other window should show the notification

### Method 2: Using the Main App
1. Open the messaging app in two different browser windows
2. Create/save different usernames in each window
3. Have both users join the same room:
   - User 1: Create a room and share the code
   - User 2: Join using the room code
4. When User 1 clicks "Leave Room" or closes the tab
5. User 2 should see: "[User 1's name] left the room" notification

### Expected Behavior:
- Notification appears immediately when a user leaves
- Notification is red and appears below the room code
- Notification automatically disappears after 8 seconds
- Only users who are currently in the room see the notification
- The user who leaves doesn't see their own leave notification

## Troubleshooting

### If notifications aren't showing:
1. Check browser console for errors
2. Verify Supabase connection is active
3. Make sure both users are in the same room
4. Try refreshing both browser windows

### Console Logs:
The implementation includes console logs for debugging:
- "Presence sync" - Shows all users in room
- "User joined" - When someone enters
- "User left" - When someone leaves
- "Presence tracking started" - Confirms tracking is active

## Browser Compatibility
- Works best in modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Tab close detection may vary by browser 