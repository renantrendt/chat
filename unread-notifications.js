// Unread Message Notifications for Browser Tab

// Store unread counts per room
const unreadCounts = new Map();
let originalTitle = 'Messaging App';
let currentUnreadCount = 0;
let isTabActive = true;
let unreadSubscription = null;

// Initialize unread notifications
function initUnreadNotifications() {
    // Store the original page title
    originalTitle = document.title || 'Messaging App';
    
    // Track tab visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Track when user is active in the tab
    document.addEventListener('click', markTabAsActive);
    document.addEventListener('keypress', markTabAsActive);
    
    console.log('Unread notifications initialized');
}

// Handle tab visibility changes
function handleVisibilityChange() {
    isTabActive = !document.hidden;
    
    if (isTabActive && window.currentRoom) {
        // User returned to tab, clear unread count for current room
        clearUnreadForRoom(window.currentRoom);
    }
}

// Mark tab as active
function markTabAsActive() {
    if (!isTabActive) {
        isTabActive = true;
        if (window.currentRoom) {
            clearUnreadForRoom(window.currentRoom);
        }
    }
}

// Subscribe to new messages for unread counting
async function subscribeToUnreadMessages(roomCode) {
    if (!roomCode || !window.currentUser) return;
    
    // Unsubscribe from previous subscription
    if (unreadSubscription) {
        await unreadSubscription.unsubscribe();
        unreadSubscription = null;
    }
    
    // Initialize count for this room if not exists
    if (!unreadCounts.has(roomCode)) {
        unreadCounts.set(roomCode, 0);
    }
    
    // Subscribe to new messages in this room
    unreadSubscription = window.supabaseClient
        .channel(`unread-${roomCode}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_code=eq.${roomCode}`
            },
            (payload) => {
                const newMessage = payload.new;
                
                // Only count as unread if:
                // 1. Message is not from current user
                // 2. Tab is not active OR user is in a different room
                if (newMessage.sender !== window.currentUser && 
                    (!isTabActive || window.currentRoom !== roomCode)) {
                    incrementUnreadCount(roomCode);
                }
            }
        )
        .subscribe((status) => {
            console.log('Unread subscription status:', status);
        });
}

// Increment unread count for a room
function incrementUnreadCount(roomCode) {
    const currentCount = unreadCounts.get(roomCode) || 0;
    unreadCounts.set(roomCode, currentCount + 1);
    
    // Update title if this is the current room
    if (window.currentRoom === roomCode) {
        updateBrowserTitle();
    }
}

// Clear unread count for a room
function clearUnreadForRoom(roomCode) {
    if (unreadCounts.has(roomCode)) {
        unreadCounts.set(roomCode, 0);
        
        // Update title if this is the current room
        if (window.currentRoom === roomCode) {
            updateBrowserTitle();
        }
    }
}

// Update browser tab title with unread count
function updateBrowserTitle() {
    if (!window.currentRoom) {
        document.title = originalTitle;
        return;
    }
    
    const unreadCount = unreadCounts.get(window.currentRoom) || 0;
    
    if (unreadCount > 0) {
        // Format: (8) Messaging App
        document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
        // No unread messages, show original title
        document.title = originalTitle;
    }
}

// Get unread count for a specific room
function getUnreadCount(roomCode) {
    return unreadCounts.get(roomCode) || 0;
}

// Get total unread count across all rooms
function getTotalUnreadCount() {
    let total = 0;
    for (const count of unreadCounts.values()) {
        total += count;
    }
    return total;
}

// Clean up when leaving a room
function cleanupUnreadNotifications() {
    if (unreadSubscription) {
        unreadSubscription.unsubscribe();
        unreadSubscription = null;
    }
}

// Reset all unread counts
function resetAllUnreadCounts() {
    unreadCounts.clear();
    updateBrowserTitle();
}

// Export functions
window.initUnreadNotifications = initUnreadNotifications;
window.subscribeToUnreadMessages = subscribeToUnreadMessages;
window.clearUnreadForRoom = clearUnreadForRoom;
window.updateBrowserTitle = updateBrowserTitle;
window.getUnreadCount = getUnreadCount;
window.getTotalUnreadCount = getTotalUnreadCount;
window.cleanupUnreadNotifications = cleanupUnreadNotifications;
window.resetAllUnreadCounts = resetAllUnreadCounts; 