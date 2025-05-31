-- Create profile_items table for storing user preferences across devices
CREATE TABLE IF NOT EXISTS profile_items (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    background TEXT,
    profile_picture TEXT,
    name_color TEXT DEFAULT '#ffffff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profile_items_username ON profile_items(username);

-- Enable Row Level Security
ALTER TABLE profile_items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read profile data
CREATE POLICY "Allow public read access to profile_items" ON profile_items
    FOR SELECT
    USING (true);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Allow users to insert their own profile" ON profile_items
    FOR INSERT
    WITH CHECK (true);

-- Create policy to allow users to update their own profile
CREATE POLICY "Allow users to update their own profile" ON profile_items
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_profile_items_updated_at BEFORE UPDATE ON profile_items
    FOR EACH ROW EXECUTE FUNCTION update_profile_items_updated_at();

-- Add foreign key constraint to ensure username exists in user_name table
ALTER TABLE profile_items
    ADD CONSTRAINT fk_profile_items_username
    FOREIGN KEY (username)
    REFERENCES user_name(username)
    ON DELETE CASCADE; 