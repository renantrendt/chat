// Supabase Configuration
// Using Supabase JS v2 client library

// Initialize Supabase client
const supabaseUrl = 'https://lsalesizrnvfwfhszwrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYWxlc2l6cm52ZndmaHN6d3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxOTI1MjUsImV4cCI6MjA2Mjc2ODUyNX0.sgPlol4-f6irBui3bcrYULIb0ldZNHsd9dyG6uRMRU0';

// Create a global variable to hold the client
let supabaseClient = null;

// Function to initialize Supabase
async function initSupabase() {
  console.log('Initializing Supabase connection...');
  
  try {
    // Test connection
    const { data, error } = await supabase.from('health_check').select('*').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('Supabase initialization error:', err);
    return false;
  }
}

// Function to create necessary tables if they don't exist
async function setupSupabaseTables() {
  // Note: This would typically be done through Supabase dashboard or migrations
  // This is just a placeholder to show what tables would be needed
  
  console.log('Tables should be created in Supabase dashboard with the following SQL:');
  
  const createRoomsTableSQL = `
  CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL
  );
  
  -- Enable Row Level Security
  ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
  
  -- Allow anyone to read rooms
  CREATE POLICY "Allow anyone to read rooms" ON rooms
    FOR SELECT USING (true);
  
  -- Allow authenticated users to insert rooms
  CREATE POLICY "Allow anyone to insert rooms" ON rooms
    FOR INSERT WITH CHECK (true);
  `;
  
  const createMessagesTableSQL = `
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add an index for faster queries
    CONSTRAINT fk_room_code FOREIGN KEY (room_code) REFERENCES rooms(code)
  );
  
  -- Enable Row Level Security
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
  
  -- Allow anyone to read messages
  CREATE POLICY "Allow anyone to read messages" ON messages
    FOR SELECT USING (true);
  
  -- Allow anyone to insert messages
  CREATE POLICY "Allow anyone to insert messages" ON messages
    FOR INSERT WITH CHECK (true);
  
  -- Enable realtime for this table
  ALTER TABLE messages REPLICA IDENTITY FULL;
  `;
  
  console.log('Rooms Table SQL:');
  console.log(createRoomsTableSQL);
  console.log('\nMessages Table SQL:');
  console.log(createMessagesTableSQL);
  
  return {
    roomsSQL: createRoomsTableSQL,
    messagesSQL: createMessagesTableSQL
  };
}

// Export functions and client
window.supabaseClient = supabase;
window.initSupabase = initSupabase;
window.setupSupabaseTables = setupSupabaseTables;
