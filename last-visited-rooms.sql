-- SQL for creating the last_visited_rooms table in Supabase

-- Create last_visited_rooms table
CREATE TABLE IF NOT EXISTS last_visited_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL,
  room_code TEXT NOT NULL,
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a foreign key constraint
  CONSTRAINT fk_room_code FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
  
  -- Create a unique constraint to ensure we don't have duplicate entries for the same user and room
  UNIQUE(username, room_code)
);

-- Enable Row Level Security
ALTER TABLE last_visited_rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read last_visited_rooms
CREATE POLICY "Allow anyone to read last_visited_rooms" 
  ON last_visited_rooms 
  FOR SELECT 
  USING (true);

-- Allow anyone to insert last_visited_rooms
CREATE POLICY "Allow anyone to insert last_visited_rooms" 
  ON last_visited_rooms 
  FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to update their own last_visited_rooms
CREATE POLICY "Allow anyone to update their own last_visited_rooms" 
  ON last_visited_rooms 
  FOR UPDATE 
  USING (username = current_user)
  WITH CHECK (username = current_user);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_last_visited_rooms_username_visited_at 
  ON last_visited_rooms(username, visited_at DESC);
