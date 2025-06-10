-- SQL for creating the necessary tables in Supabase

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rooms (skip if policy already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Allow anyone to read rooms'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anyone to read rooms" ON rooms FOR SELECT USING (true)';
  END IF;
END $$;

-- Allow anyone to insert rooms (skip if policy already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Allow anyone to insert rooms'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anyone to insert rooms" ON rooms FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add a foreign key constraint
  CONSTRAINT fk_room_code FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read messages (skip if policy already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Allow anyone to read messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anyone to read messages" ON messages FOR SELECT USING (true)';
  END IF;
END $$;

-- Allow anyone to insert messages (skip if policy already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Allow anyone to insert messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anyone to insert messages" ON messages FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- Enable realtime for this table (safe to run multiple times)
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
