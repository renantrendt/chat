// Room Presence Tracking
let presenceChannel = null;
let presenceSubscription = null;

// Sidebar state management
const PRESENCE_STORAGE_KEY = 'room_presence_data';
let presenceRoomCode = null;
let presenceUsername = null;
let cleanupTimers = {};

// Get presence data from localStorage
function getPresenceData() {
    const data = localStorage.getItem(PRESENCE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

// Save presence data to localStorage
function savePresenceData(data) {
    localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(data));
}

// Add or update user in presence list
function addUserToPresence(roomCode, username, isOnline = true) {
    const data = getPresenceData();
    
    if (!data[roomCode]) {
        data[roomCode] = {};
    }
    
    // Clear any existing cleanup timer for this user
    const timerKey = `${roomCode}-${username}`;
    if (cleanupTimers[timerKey]) {
        clearTimeout(cleanupTimers[timerKey]);
        delete cleanupTimers[timerKey];
    }
    
    data[roomCode][username] = {
        online: isOnline,
        lastSeen: Date.now()
    };
    
    savePresenceData(data);
    updatePresenceSidebar();
}

// Set user as offline
function setUserOffline(roomCode, username) {
    const data = getPresenceData();
    
    if (data[roomCode] && data[roomCode][username]) {
        data[roomCode][username].online = false;
        data[roomCode][username].lastSeen = Date.now();
        savePresenceData(data);
        
        // Set 45-minute cleanup timer
        const timerKey = `${roomCode}-${username}`;
        cleanupTimers[timerKey] = setTimeout(() => {
            removeUserFromPresence(roomCode, username);
        }, 45 * 60 * 1000); // 45 minutes
        
        // Register timer with subscription manager
        if (window.subscriptionManager) {
            window.subscriptionManager.registerTimer(`presence-timer-${timerKey}`, cleanupTimers[timerKey]);
        }
        
        updatePresenceSidebar();
    }
}

// Remove user from presence list
function removeUserFromPresence(roomCode, username) {
    const data = getPresenceData();
    
    if (data[roomCode] && data[roomCode][username]) {
        delete data[roomCode][username];
        savePresenceData(data);
        updatePresenceSidebar();
    }
}

// Update the sidebar UI
function updatePresenceSidebar() {
    const list = document.getElementById('user-presence-list');
    if (!list || !presenceRoomCode) {
        return;
    }
    
    const data = getPresenceData();
    const roomUsers = data[presenceRoomCode] || {};
    
    // Clear current list
    list.innerHTML = '';
    
    // Sort users: online first, then by name
    const sortedUsers = Object.entries(roomUsers).sort((a, b) => {
        if (a[1].online !== b[1].online) {
            return b[1].online - a[1].online; // Online users first
        }
        return a[0].localeCompare(b[0]); // Then alphabetically
    });
    
    // Create user entries
    sortedUsers.forEach(([username, info]) => {
        const entry = document.createElement('div');
        entry.className = 'user-presence-entry';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'user-presence-name';
        nameSpan.textContent = username;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `user-presence-status ${info.online ? 'online' : 'offline'}`;
        statusSpan.textContent = info.online ? 'Online' : 'Off';
        
        entry.appendChild(nameSpan);
        entry.appendChild(statusSpan);
        list.appendChild(entry);
    });
}

// Setup sidebar toggle functionality
function setupSidebarToggle() {
    const sidebar = document.getElementById('user-presence-sidebar');
    const hideBtn = document.getElementById('toggle-presence-sidebar');
    const showBtn = document.getElementById('show-presence-sidebar');
    
    if (!sidebar || !hideBtn || !showBtn) return;
    
    // Hide button functionality
    hideBtn.addEventListener('click', () => {
        sidebar.classList.add('hidden');
    });
    
    // Show button functionality
    showBtn.addEventListener('click', () => {
        sidebar.classList.remove('hidden');
    });
}

// Initialize room presence tracking
function initRoomPresence(roomCode, username) {
    if (!window.supabaseClient || !roomCode || !username) return;
    
    presenceRoomCode = roomCode;
    presenceUsername = username;
    
    // Setup sidebar toggle
    setupSidebarToggle();
    
    // Add current user to presence
    addUserToPresence(roomCode, username, true);
    
    // Clean up any existing subscription
    cleanupRoomPresence();
    
    // Create a unique channel name for this room
    // Use timestamp for unique channel name to prevent subscription conflicts
    const channelName = `presence-${roomCode}-${Date.now()}`;
    
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
            
            // Update online status for all users based on presence state
            const onlineUsers = Object.keys(state);
            const data = getPresenceData();
            const roomUsers = data[roomCode] || {};
            
            // Update status for all known users
            Object.keys(roomUsers).forEach(user => {
                if (onlineUsers.includes(user)) {
                    addUserToPresence(roomCode, user, true);
                } else if (user !== username) {
                    setUserOffline(roomCode, user);
                }
            });
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            // Add user as online
            addUserToPresence(roomCode, key, true);
            // Show notification when someone joins
            if (key !== username) {
                showUserJoinNotification(key);
            }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            // Set user as offline
            setUserOffline(roomCode, key);
            // Show notification when someone leaves
            if (key !== username) {
                showUserLeaveNotification(key);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Track user presence
                await presenceChannel.track({
                    user: username,
                    online_at: new Date().toISOString()
                });
            }
        });
    
    // Register presence channel with subscription manager
    if (window.subscriptionManager) {
        window.subscriptionManager.register('presence', presenceChannel, 'presence-tracking');
    }
    
    // Register cleanup timers with subscription manager
    if (window.subscriptionManager) {
        Object.entries(cleanupTimers).forEach(([key, timerId]) => {
            window.subscriptionManager.registerTimer(`presence-timer-${key}`, timerId);
        });
    }
}

// Show notification when a user joins (OPTIMIZED - uses cached profile data)
function showUserJoinNotification(username) {
    const notification = document.getElementById('user-join-notification');
    if (!notification) return;
    
    // Use cached profile data instead of database call for VIP status
    let isVIP = false;
    if (window.getUserProfile) {
        // Try to get cached profile data (this should be cached from message loading)
        window.getUserProfile(username).then(profile => {
            isVIP = profile?.isVIP || false;
            
            // Set the notification text based on VIP status
            if (isVIP) {
                notification.innerHTML = `👑 Bow to the presence of <strong>${username}</strong>`;
                notification.classList.add('vip');
            } else {
                notification.textContent = `${username} joined the room`;
                notification.classList.remove('vip');
            }
            
            // Show the notification
            notification.classList.add('show');
            
            // Hide after 8 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                if (isVIP) {
                    notification.classList.remove('vip');
                }
            }, 8000);
        }).catch(() => {
            // Fallback if profile loading fails
            notification.textContent = `${username} joined the room`;
            notification.classList.remove('vip');
            notification.classList.add('show');
            setTimeout(() => notification.classList.remove('show'), 8000);
        });
    } else {
        // Fallback if profile system not available
        notification.textContent = `${username} joined the room`;
        notification.classList.remove('vip');
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 8000);
    }
}

// Show notification when a user leaves (OPTIMIZED - uses cached profile data)
function showUserLeaveNotification(username) {
    const notification = document.getElementById('user-leave-notification');
    if (!notification) return;
    
    // Use cached profile data instead of database call for VIP status
    let isVIP = false;
    if (window.getUserProfile) {
        // Try to get cached profile data (this should be cached from message loading)
        window.getUserProfile(username).then(profile => {
            isVIP = profile?.isVIP || false;
            
            // Set the notification text based on VIP status
            if (isVIP) {
                notification.innerHTML = `Cry in tears <strong>${username}</strong> has left...`;
                notification.classList.add('vip');
            } else {
                notification.textContent = `${username} left the room`;
                notification.classList.remove('vip');
            }
            
            // Show the notification
            notification.classList.add('show');
            
            // Hide after 8 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                if (isVIP) {
                    notification.classList.remove('vip');
                }
            }, 8000);
        }).catch(() => {
            // Fallback if profile loading fails
            notification.textContent = `${username} left the room`;
            notification.classList.remove('vip');
            notification.classList.add('show');
            setTimeout(() => notification.classList.remove('show'), 8000);
        });
    } else {
        // Fallback if profile system not available
        notification.textContent = `${username} left the room`;
        notification.classList.remove('vip');
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 8000);
    }
}

// Clean up presence tracking - now handled by subscription manager
function cleanupRoomPresence() {
    // Subscriptions and timers are now handled by subscription manager
    // This function is kept for compatibility
}

// Handle page unload/close
window.addEventListener('beforeunload', () => {
    if (presenceChannel && presenceRoomCode && presenceUsername) {
        // Set current user as offline
        setUserOffline(presenceRoomCode, presenceUsername);
        // Try to untrack before leaving
        presenceChannel.untrack();
    }
});

// Export functions for use in other files
window.initRoomPresence = initRoomPresence;
window.cleanupRoomPresence = cleanupRoomPresence; 