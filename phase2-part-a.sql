-- Phase 2 - PART A: Fix Active Users Table
-- Run this section first

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

-- Test the functions
SELECT cleanup_inactive_users();

-- Check current active users
SELECT username, room_code, is_active, last_active 
FROM active_users 
ORDER BY last_active DESC; 