// Debug Active Users - Run this in browser console

async function debugActiveUsers() {
    console.log('=== ACTIVE USERS DEBUG ===');
    
    // Check all active users
    const { data: activeUsers, error: activeError } = await supabaseClient
        .from('active_users')
        .select('*');
    
    console.log('All active users:', activeUsers);
    
    // Check active users in current room
    if (currentRoom) {
        const { data: roomUsers, error: roomError } = await supabaseClient
            .from('active_users')
            .select('*')
            .eq('room_code', currentRoom)
            .eq('is_active', true);
        
        console.log('Active users in room', currentRoom + ':', roomUsers);
    }
    
    // Check messages in current room
    if (currentRoom) {
        const { data: messages, error: msgError } = await supabaseClient
            .from('messages')
            .select('id, sender, content, status, delivered_at, read_at')
            .eq('room_code', currentRoom)
            .order('timestamp', { ascending: false })
            .limit(5);
        
        console.log('Recent messages:', messages);
    }
    
    // Test updating user activity
    if (currentUser && currentRoom) {
        console.log('Testing user activity update...');
        const { error } = await supabaseClient.rpc('update_user_activity', {
            p_username: currentUser,
            p_room_code: currentRoom
        });
        
        if (error) {
            console.error('Error updating activity:', error);
        } else {
            console.log('Activity updated successfully');
        }
    }
}

// Add to window for easy access
window.debugActiveUsers = debugActiveUsers;

console.log('Debug script loaded. Run debugActiveUsers() in console.'); 