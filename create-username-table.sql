-- Create user_name table for VIP functionality
CREATE TABLE IF NOT EXISTS user_name (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    is_vip BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_user_name_username ON user_name(username);
CREATE INDEX IF NOT EXISTS idx_user_name_is_vip ON user_name(is_vip);

-- Enable Row Level Security
ALTER TABLE user_name ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read user_name data
CREATE POLICY "Allow public read access to user_name" ON user_name
    FOR SELECT
    USING (true);

-- Create policy to allow only authenticated users to insert their own username
CREATE POLICY "Allow users to insert their own username" ON user_name
    FOR INSERT
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_user_name_updated_at BEFORE UPDATE ON user_name
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some example users (you can modify these)
-- INSERT INTO user_name (username, is_vip) VALUES 
-- ('Bernardo', true),
-- ('TestUser', false);

-- Query to manually set VIP status (run in Supabase SQL editor)
-- UPDATE user_name SET is_vip = true WHERE username = 'YourUsername'; 