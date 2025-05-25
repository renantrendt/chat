// Test Backend Message Status Tracking
// Run this in the browser console while in a chat room

console.log('=== Testing Backend Message Status Tracking ===');

// Check if message status functions exist
console.log('\n1. Checking if tracking functions exist:');
console.log('- startActivityTracking:', typeof window.startActivityTracking);
console.log('- updateUserActivity:', typeof window.updateUserActivity);
console.log('- markMessageAsRead:', typeof window.markMessageAsRead);
console.log('- addMessageStatus:', typeof window.addMessageStatus);

// Check current user and room
console.log('\n2. Current session info:');
console.log('- Current User:', window.currentUser || 'Not set');
console.log('- Current Room:', window.currentRoom || 'Not set');

// Check Supabase connection
console.log('\n3. Supabase connection:');
console.log('- Supabase Client:', window.supabaseClient ? 'Connected' : 'Not connected');

// Monitor message status updates
console.log('\n4. Setting up message status monitor...');
if (window.supabaseClient && window.currentRoom) {
    // Subscribe to message updates
    const subscription = window.supabaseClient
        .channel(`test-message-status-${window.currentRoom}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `room_code=eq.${window.currentRoom}`
            },
            (payload) => {
                console.log('\n📨 Message Status Update Detected:');
                console.log('- Event:', payload.eventType);
                console.log('- Message ID:', payload.new?.id || payload.old?.id);
                console.log('- Status:', payload.new?.status);
                console.log('- Full payload:', payload);
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
        });
    
    console.log('✅ Now monitoring message status updates. Send a message to test!');
    
    // Clean up after 5 minutes
    setTimeout(() => {
        subscription.unsubscribe();
        console.log('Test monitoring stopped after 5 minutes');
    }, 300000);
} else {
    console.log('❌ Cannot set up monitoring - missing Supabase client or room');
}

// Check active users
console.log('\n5. Checking active users functionality:');
if (window.supabaseClient && window.currentRoom) {
    window.supabaseClient
        .from('active_users')
        .select('*')
        .eq('room_code', window.currentRoom)
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching active users:', error);
            } else {
                console.log('Active users in room:', data);
            }
        });
}

console.log('\n=== Test script loaded. Check console for updates ==='); 