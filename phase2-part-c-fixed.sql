-- Phase 2 - PART C: App Users Table (Fixed)
-- This creates a separate table for messaging app users to avoid conflict with Supabase auth.users

-- 1. Create the app_users table for our messaging application
CREATE TABLE IF NOT EXISTS app_users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for app_users table
CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_is_online ON app_users(is_online);
CREATE INDEX IF NOT EXISTS idx_app_users_last_active ON app_users(last_active);

-- 3. Enable RLS for app_users table
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for app_users table
CREATE POLICY "Anyone can view app_users" ON app_users
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert app_users" ON app_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update app_users" ON app_users
    FOR UPDATE USING (true);

-- 5. Migrate data from active_users to app_users table
INSERT INTO app_users (username, is_online, last_active)
SELECT 
    username,
    is_active as is_online,
    last_active
FROM active_users
ON CONFLICT (username) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    last_active = EXCLUDED.last_active;

-- 6. Function to update user online status (updated to use app_users)
CREATE OR REPLACE FUNCTION update_user_online_status(
    p_username TEXT,
    p_is_online BOOLEAN
)
RETURNS void AS $$
BEGIN
    INSERT INTO app_users (username, is_online, last_active)
    VALUES (p_username, p_is_online, NOW())
    ON CONFLICT (username) 
    DO UPDATE SET 
        is_online = p_is_online,
        last_active = NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Update the heartbeat function to also update app_users
CREATE OR REPLACE FUNCTION update_user_heartbeat(p_username TEXT, p_room_code TEXT)
RETURNS void AS $$
BEGIN
    -- Update active_users table
    INSERT INTO active_users (username, room_code, last_active, is_active)
    VALUES (p_username, p_room_code, NOW(), true)
    ON CONFLICT (username) 
    DO UPDATE SET 
        room_code = EXCLUDED.room_code,
        last_active = NOW(),
        is_active = true;
    
    -- Also update app_users table
    INSERT INTO app_users (username, is_online, last_active)
    VALUES (p_username, true, NOW())
    ON CONFLICT (username) 
    DO UPDATE SET 
        is_online = true,
        last_active = NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. Enable realtime for app_users table
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;

-- Test: Check the new app_users table
SELECT * FROM app_users ORDER BY last_active DESC;

-- Test: Check if migration worked
SELECT 
    'Active Users Table:' as source,
    COUNT(*) as count 
FROM active_users
UNION ALL
SELECT 
    'App Users Table:' as source,
    COUNT(*) as count 
FROM app_users; 