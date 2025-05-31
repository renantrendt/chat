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
        console.log('Sidebar update failed - list element or room code missing', { list: !!list, presenceRoomCode });
        return;
    }
    
    const data = getPresenceData();
    const roomUsers = data[presenceRoomCode] || {};
    
    console.log('Updating sidebar for room:', presenceRoomCode, 'Users:', roomUsers);
    
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
    
    console.log('Sidebar updated with', sortedUsers.length, 'users');
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
            console.log('User joined:', key);
            // Add user as online
            addUserToPresence(roomCode, key, true);
            // Show notification when someone joins
            if (key !== username) {
                showUserJoinNotification(key);
            }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key);
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
                const presenceTrack = await presenceChannel.track({
                    user: username,
                    online_at: new Date().toISOString()
                });
                console.log('Presence tracking started:', presenceTrack);
            }
        });
}

// Show notification when a user joins
async function showUserJoinNotification(username) {
    const notification = document.getElementById('user-join-notification');
    if (!notification) return;
    
    // Check if user is VIP
    let isVIP = false;
    if (window.checkVIPStatus) {
        isVIP = await window.checkVIPStatus(username);
    }
    
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
    
    // Hide after appropriate time (12 seconds for VIP, 8 for regular)
    const displayTime = isVIP ? 12000 : 8000;
    setTimeout(() => {
        notification.classList.remove('show');
        if (isVIP) {
            notification.classList.remove('vip');
        }
    }, displayTime);
}

// Show notification when a user leaves
async function showUserLeaveNotification(username) {
    const notification = document.getElementById('user-leave-notification');
    if (!notification) return;
    
    // Check if user is VIP
    let isVIP = false;
    if (window.checkVIPStatus) {
        isVIP = await window.checkVIPStatus(username);
    }
    
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
    
    // Hide after appropriate time (12 seconds for VIP, 8 for regular)
    const displayTime = isVIP ? 12000 : 8000;
    setTimeout(() => {
        notification.classList.remove('show');
        if (isVIP) {
            notification.classList.remove('vip');
        }
    }, displayTime);
}

// Clean up presence tracking
function cleanupRoomPresence() {
    if (presenceChannel) {
        presenceChannel.untrack();
        presenceChannel.unsubscribe();
        presenceChannel = null;
    }
    
    // Clear all cleanup timers
    Object.values(cleanupTimers).forEach(timer => clearTimeout(timer));
    cleanupTimers = {};
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