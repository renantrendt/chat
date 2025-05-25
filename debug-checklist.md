# Debug Checklist - Double Check Marks Not Showing

## Issue
Single check appears, but double checks don't show even though message_reads table is updating correctly.

## Things to Check

### 1. Enable Realtime in Supabase
- Go to your Supabase Dashboard
- Navigate to **Database > Replication**
- Find the **messages** table
- Make sure the **Realtime** toggle is ON
- If not, turn it on and wait a minute

### 2. Check Browser Console
Open browser console (F12) and look for:
- `Message status subscription: {status: 'SUBSCRIBED'}` - Should show when entering room
- `Message status update received:` - Should show when message status changes
- `Updating message status to: delivered` or `read` - Should show the new status

### 3. Test the Update Function Manually
In the browser console, while in a chat room, run:
```javascript
// Get all sent messages
const sentMessages = document.querySelectorAll('.message.sent');
// Add delivered status to first message
if (sentMessages[0]) {
    addMessageStatus(sentMessages[0], 'delivered');
}
```

If this works and shows double checks, then the CSS is fine and it's a realtime/subscription issue.

### 4. Check Message IDs
Make sure messages have data-message-id attributes:
```javascript
// In browser console
document.querySelectorAll('[data-message-id]').length
```
Should return number > 0 if messages have IDs.

### 5. Manual SQL Check
Run this in Supabase SQL editor to see message statuses:
```sql
SELECT id, sender, content, status, delivered_at, read_at 
FROM messages 
WHERE room_code = 'YOUR_ROOM_CODE' 
ORDER BY timestamp DESC 
LIMIT 10;
```

## Quick Fix to Test
If realtime isn't working, add this temporary polling solution to test the UI:
```javascript
// Add to browser console while in chat
setInterval(async () => {
    const { data } = await supabaseClient
        .from('messages')
        .select('id, status')
        .eq('room_code', currentRoom);
    
    data?.forEach(msg => {
        const el = document.querySelector(`[data-message-id="${msg.id}"]`);
        if (el && msg.status) {
            addMessageStatus(el, msg.status);
        }
    });
}, 2000);
``` 