-- Enable Realtime for Messages Table

-- First, check if realtime is enabled
-- Go to your Supabase Dashboard > Database > Replication
-- Make sure the "messages" table has realtime enabled

-- Or run this SQL to enable it:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- You might also need to enable it in the Supabase dashboard:
-- 1. Go to Database > Replication
-- 2. Find the "messages" table
-- 3. Toggle the "Realtime" switch to ON

-- To verify realtime is working, run:
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'; 