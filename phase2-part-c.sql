-- Phase 2 - PART C: Users Table Enhancement
-- This creates a proper users table to centrally manage user information

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

-- 6. Function to update user online status
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

-- 7. Enable realtime for users table
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Test: Check the new users table
SELECT * FROM users ORDER BY last_active DESC;

-- Test: Check if migration worked
SELECT 
    'Active Users Table:' as source,
    COUNT(*) as count 
FROM active_users
UNION ALL
SELECT 
    'Users Table:' as source,
    COUNT(*) as count 
FROM users; 