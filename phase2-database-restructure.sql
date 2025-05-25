-- Phase 2: Database Restructuring
-- This script implements the database changes outlined in .next ideas

-- ============================================
-- PART A: Fix Active Users Table
-- ============================================

-- First, let's check and fix the active_users table
-- The issue is that all users show as active even when they're not

-- 1. Create a function to properly track user activity with heartbeat
CREATE OR REPLACE FUNCTION update_user_heartbeat(p_username TEXT, p_room_code TEXT)
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

-- 2. Create a more aggressive cleanup function (30 seconds instead of 1 minute)
CREATE OR REPLACE FUNCTION cleanup_inactive_users()
RETURNS void AS $$
BEGIN
    UPDATE active_users 
    SET is_active = false 
    WHERE last_active < NOW() - INTERVAL '30 seconds' 
      AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a cron job or trigger to run cleanup regularly
-- Note: This requires pg_cron extension or manual periodic execution

-- ============================================
-- PART B: Messages Table Restructuring
-- ============================================

-- 1. First, backup the current data from columns we're removing
CREATE TABLE IF NOT EXISTS messages_backup_phase2 AS
SELECT id, status, delivered_at, read_at, sender, room_code
FROM messages
WHERE status IS NOT NULL OR delivered_at IS NOT NULL OR read_at IS NOT NULL;

-- 2. Remove the unnecessary columns from messages table
ALTER TABLE messages 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS delivered_at,
DROP COLUMN IF EXISTS read_at,
DROP COLUMN IF EXISTS seen,
DROP COLUMN IF EXISTS seen_at,
DROP COLUMN IF EXISTS recipient;

-- 3. Create the new 'seen' table as specified
CREATE TABLE IF NOT EXISTS seen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,  -- ID of the user who saw the message
    seen BOOLEAN DEFAULT false,
    seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- 4. Create indexes for the seen table
CREATE INDEX IF NOT EXISTS idx_seen_message_id ON seen(message_id);
CREATE INDEX IF NOT EXISTS idx_seen_user_id ON seen(user_id);
CREATE INDEX IF NOT EXISTS idx_seen_seen_at ON seen(seen_at);

-- 5. Enable RLS for seen table
ALTER TABLE seen ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for seen table
CREATE POLICY "Anyone can insert seen" ON seen
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view seen" ON seen
    FOR SELECT USING (true);

CREATE POLICY "Anyone can update seen" ON seen
    FOR UPDATE USING (true);

-- 7. Migrate existing data to the new seen table
-- This migrates from message_reads table if it exists
INSERT INTO seen (message_id, user_id, seen, seen_at)
SELECT 
    message_id,
    user_id,
    true as seen,
    read_at as seen_at
FROM message_reads
ON CONFLICT (message_id, user_id) DO NOTHING;

-- ============================================
-- PART C: Users Table Enhancement
-- ============================================

-- 1. Create the enhanced users table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- 3. Enable RLS for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for users table
CREATE POLICY "Anyone can view users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert users" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update users" ON users
    FOR UPDATE USING (true);

-- 5. Migrate data from active_users to users table
INSERT INTO users (username, is_online, last_active)
SELECT 
    username,
    is_active as is_online,
    last_active
FROM active_users
ON CONFLICT (username) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    last_active = EXCLUDED.last_active;

-- ============================================
-- Update Functions for New Structure
-- ============================================

-- 1. Function to mark a message as seen
CREATE OR REPLACE FUNCTION mark_message_as_seen(
    p_message_id UUID, 
    p_user_id TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO seen (message_id, user_id, seen, seen_at)
    VALUES (p_message_id, p_user_id, true, NOW())
    ON CONFLICT (message_id, user_id) 
    DO UPDATE SET 
        seen = true,
        seen_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 2. Function to get unseen message count for a user in a room
CREATE OR REPLACE FUNCTION get_unseen_count(
    p_user_id TEXT,
    p_room_code TEXT
)
RETURNS INTEGER AS $$
DECLARE
    unseen_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO unseen_count
    FROM messages m
    LEFT JOIN seen s ON m.id = s.message_id AND s.user_id = p_user_id
    WHERE m.room_code = p_room_code
    AND m.sender != p_user_id
    AND (s.seen IS NULL OR s.seen = false);
    
    RETURN unseen_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to update user online status
CREATE OR REPLACE FUNCTION update_user_online_status(
    p_username TEXT,
    p_is_online BOOLEAN
)
RETURNS void AS $$
BEGIN
    INSERT INTO users (username, is_online, last_active)
    VALUES (p_username, p_is_online, NOW())
    ON CONFLICT (username) 
    DO UPDATE SET 
        is_online = p_is_online,
        last_active = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Enable Realtime for New Tables
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE seen;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- ============================================
-- Cleanup Notes
-- ============================================

-- After verifying everything works:
-- 1. Drop the old message_reads table: DROP TABLE IF EXISTS message_reads;
-- 2. Drop the messages_backup_phase2 table: DROP TABLE IF EXISTS messages_backup_phase2;
-- 3. Consider dropping active_users table after migrating to users table

COMMENT ON TABLE messages_backup_phase2 IS 'Backup of removed columns from Phase 2 restructuring. Safe to drop after verification.';
COMMENT ON TABLE seen IS 'Tracks which users have seen which messages';
COMMENT ON TABLE users IS 'Central user management table with online status'; 