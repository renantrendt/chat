// Room Presence Tracking
let presenceChannel = null;
let presenceSubscription = null;

// Initialize room presence tracking
function initRoomPresence(roomCode, username) {
    if (!window.supabaseClient || !roomCode || !username) return;
    
    // Clean up any existing subscription
    cleanupRoomPresence();
    
    // Create a unique channel name for this room
    const channelName = `presence:${roomCode}`;
    
    // Create presence channel
    presenceChannel = window.supabaseClient.channel(channelName, {
        config: {
            presence: {
                key: username
            }
        }
    });
    
    // Subscribe to presence events
    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            console.log('Presence sync:', state);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('User joined:', key);
            // Show notification when someone joins
            if (key !== username) {
                showUserJoinNotification(key);
            }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key);
            // Show notification when someone leaves
            if (key !== username) {
                showUserLeaveNotification(key);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Track user presence
                const presenceTrack = await presenceChannel.track({
                    user: username,
                    online_at: new Date().toISOString()
                });
                console.log('Presence tracking started:', presenceTrack);
            }
        });
}

// Show notification when a user joins
function showUserJoinNotification(username) {
    const notification = document.getElementById('user-join-notification');
    if (!notification) return;
    
    // Set the notification text
    notification.textContent = `${username} joined the room`;
    
    // Show the notification
    notification.classList.add('show');
    
    // Hide after 8 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 8000);
}

// Show notification when a user leaves
function showUserLeaveNotification(username) {
    const notification = document.getElementById('user-leave-notification');
    if (!notification) return;
    
    // Set the notification text
    notification.textContent = `${username} left the room`;
    
    // Show the notification
    notification.classList.add('show');
    
    // Hide after 8 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 8000);
}

// Clean up presence tracking
function cleanupRoomPresence() {
    if (presenceChannel) {
        presenceChannel.untrack();
        presenceChannel.unsubscribe();
        presenceChannel = null;
    }
}

// Handle page unload/close
window.addEventListener('beforeunload', () => {
    if (presenceChannel) {
        // Try to untrack before leaving
        presenceChannel.untrack();
    }
});

// Export functions for use in other files
window.initRoomPresence = initRoomPresence;
window.cleanupRoomPresence = cleanupRoomPresence; 