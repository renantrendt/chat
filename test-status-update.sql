-- Test Status Update Functions

-- 1. First, check current message statuses
SELECT id, room_code, sender, content, status, delivered_at, read_at 
FROM messages 
WHERE room_code = 'SF6IDK'  -- Replace with your room code
ORDER BY timestamp DESC;

-- 2. Check active users
SELECT * FROM active_users;

-- 3. Manually test the delivery status update
SELECT update_message_delivery_status('SF6IDK');  -- Replace with your room code

-- 4. Check messages again to see if status changed
SELECT id, room_code, sender, content, status, delivered_at, read_at 
FROM messages 
WHERE room_code = 'SF6IDK'  -- Replace with your room code
ORDER BY timestamp DESC;

-- 5. Test marking a specific message as read
-- First get a message ID from the query above, then:
-- SELECT mark_message_read('YOUR-MESSAGE-ID-HERE', 'OTHER-USERNAME', 'SF6IDK'); 