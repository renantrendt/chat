-- Fix Delivery Status Update

-- Drop the old function
DROP FUNCTION IF EXISTS update_message_delivery_status(TEXT);

-- Create a simpler version that just marks all 'sent' messages as 'delivered' 
-- when there are other active users in the room
CREATE OR REPLACE FUNCTION update_message_delivery_status(p_room_code TEXT)
RETURNS void AS $$
BEGIN
    -- Update all 'sent' messages to 'delivered' in the room
    UPDATE messages 
    SET 
        status = 'delivered',
        delivered_at = NOW()
    WHERE 
        room_code = p_room_code
        AND status = 'sent';
END;
$$ LANGUAGE plpgsql;

-- Test it manually
-- SELECT update_message_delivery_status('YOUR_ROOM_CODE'); 