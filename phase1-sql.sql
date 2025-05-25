-- Phase 1: Double Check Mark Feature SQL

-- 1. Add message status tracking to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 2. Update message_reads table structure (if needed)
-- This table tracks which users have read which messages
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    room_code TEXT NOT NULL,
    UNIQUE(message_id, user_id)
);

-- 3. Update active_users table for tracking online status
CREATE TABLE IF NOT EXISTS active_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    room_code TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_status ON messages(room_code, status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_status ON messages(sender, status);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id, room_code);
CREATE INDEX IF NOT EXISTS idx_active_users_username ON active_users(username);
CREATE INDEX IF NOT EXISTS idx_active_users_last_active ON active_users(last_active);

-- 5. Enable Row Level Security
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for message_reads
CREATE POLICY "Anyone can insert message_reads" ON message_reads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view message_reads" ON message_reads
    FOR SELECT USING (true);

-- 7. Create policies for active_users
CREATE POLICY "Anyone can insert active_users" ON active_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view active_users" ON active_users
    FOR SELECT USING (true);

CREATE POLICY "Anyone can update active_users" ON active_users
    FOR UPDATE USING (true);

-- 8. Function to mark user as active
CREATE OR REPLACE FUNCTION update_user_activity(p_username TEXT, p_room_code TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO active_users (username, room_code, last_active, is_active)
    VALUES (p_username, p_room_code, NOW(), true)
    ON CONFLICT (username) 
    DO UPDATE SET 
        room_code = EXCLUDED.room_code,
        last_active = NOW(),
        is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to mark inactive users (for cleanup job)
CREATE OR REPLACE FUNCTION mark_inactive_users()
RETURNS void AS $$
BEGIN
    UPDATE active_users 
    SET is_active = false 
    WHERE last_active < NOW() - INTERVAL '1 minute' 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 10. Function to update message delivery status
CREATE OR REPLACE FUNCTION update_message_delivery_status(p_room_code TEXT)
RETURNS void AS $$
BEGIN
    -- Mark messages as delivered for active users in the room
    UPDATE messages m
    SET status = 'delivered',
        delivered_at = NOW()
    WHERE m.room_code = p_room_code
    AND m.status = 'sent'
    AND EXISTS (
        SELECT 1 FROM active_users au
        WHERE au.room_code = p_room_code
        AND au.is_active = true
        AND au.username != m.sender
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_read(p_message_id UUID, p_username TEXT, p_room_code TEXT)
RETURNS void AS $$
BEGIN
    -- Insert into message_reads
    INSERT INTO message_reads (message_id, user_id, room_code)
    VALUES (p_message_id, p_username, p_room_code)
    ON CONFLICT (message_id, user_id) DO NOTHING;
    
    -- Update message status if reader is not the sender
    UPDATE messages
    SET status = 'read',
        read_at = NOW()
    WHERE id = p_message_id
    AND sender != p_username
    AND status != 'read';
END;
$$ LANGUAGE plpgsql;

-- 12. Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE active_users; 