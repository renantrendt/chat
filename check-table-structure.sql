-- Check current table structures

-- 1. Check if users table already exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 2. Check active_users table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'active_users'
ORDER BY ordinal_position;

-- 3. Check what data is in active_users
SELECT * FROM active_users LIMIT 5;

-- 4. Check if users table has any data
SELECT COUNT(*) as user_count FROM users; 