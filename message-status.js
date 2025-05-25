// Message Status Management

// Activity tracking
let activityInterval = null;
let visibilityObserver = null;
let messageStatusSubscription = null;

// Start user activity tracking
async function startActivityTracking() {
    if (!currentUser || !currentRoom) return;
    
    // Update activity immediately
    await updateUserActivity();
    
    // Set up heartbeat every 30 seconds
    activityInterval = setInterval(async () => {
        await updateUserActivity();
    }, 30000);
    
    // Update activity when user returns to tab
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            await updateUserActivity();
        }
    });
}

// Stop activity tracking
function stopActivityTracking() {
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
    }
}

// Update user activity in database
async function updateUserActivity() {
    if (!currentUser || !currentRoom) return;
    
    try {
        // Use the new update_user_heartbeat function
        const { error } = await supabaseClient.rpc('update_user_heartbeat', {
            p_username: currentUser,
            p_room_code: currentRoom
        });
        
        if (error) {
            console.error('Error updating activity:', error);
        } else {
            // Check for delivered messages
            await updateMessageDeliveryStatus();
        }
    } catch (err) {
        console.error('Activity update failed:', err);
    }
}

// Update delivery status for messages in room
async function updateMessageDeliveryStatus() {
    if (!currentRoom) return;
    
    try {
        const { error } = await supabaseClient.rpc('update_message_delivery_status', {
            p_room_code: currentRoom
        });
        
        if (error) {
            console.error('Error updating delivery status:', error);
        }
    } catch (err) {
        console.error('Delivery status update failed:', err);
    }
}

// Mark message as read
async function markMessageAsRead(messageId) {
    if (!currentUser || !currentRoom) return;
    
    try {
        const { error } = await supabaseClient.rpc('mark_message_read', {
            p_message_id: messageId,
            p_username: currentUser,
            p_room_code: currentRoom
        });
        
        if (error) {
            console.error('Error marking message as read:', error);
        }
    } catch (err) {
        console.error('Mark as read failed:', err);
    }
}

// Set up visibility observer for messages
function setupMessageVisibilityObserver() {
    if (visibilityObserver) {
        visibilityObserver.disconnect();
    }
    
    const options = {
        root: messagesContainer,
        rootMargin: '0px',
        threshold: 0.5
    };
    
    visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const messageElement = entry.target;
                const messageId = messageElement.dataset.messageId;
                const sender = messageElement.dataset.sender;
                
                // Only mark as read if not sent by current user
                if (messageId && sender !== currentUser) {
                    markMessageAsRead(messageId);
                }
            }
        });
    }, options);
}

// Add status icon to message element
function addMessageStatus(messageElement, status) {
    console.log('addMessageStatus called with status:', status);
    
    // Remove existing status if any
    const existingStatus = messageElement.querySelector('.message-status');
    if (existingStatus) {
        console.log('Removing existing status');
        existingStatus.remove();
    }
    
    // Create status element
    const statusElement = document.createElement('span');
    statusElement.className = 'message-status';
    
    // Add appropriate check mark class
    const checkElement = document.createElement('span');
    switch(status) {
        case 'sent':
            checkElement.className = 'check-sent';
            break;
        case 'delivered':
            checkElement.className = 'check-delivered';
            break;
        case 'read':
            checkElement.className = 'check-read';
            break;
        default:
            console.log('Unknown status:', status);
            return;
    }
    
    console.log('Adding check element with class:', checkElement.className);
    statusElement.appendChild(checkElement);
    messageElement.appendChild(statusElement);
}

// Subscribe to message status updates
async function subscribeToMessageStatus() {
    if (!currentRoom) return;
    
    console.log('Setting up message status subscription for room:', currentRoom);
    
    // Unsubscribe from previous subscription
    if (messageStatusSubscription) {
        await messageStatusSubscription.unsubscribe();
    }
    
    // Subscribe to message updates for current room
    messageStatusSubscription = supabaseClient
        .channel(`message-status-${currentRoom}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `room_code=eq.${currentRoom}`
            },
            (payload) => {
                console.log('Message status update received:', payload);
                
                // Update message status in UI
                const messageElement = document.querySelector(`[data-message-id="${payload.new.id}"]`);
                console.log('Found message element:', messageElement);
                
                if (messageElement && payload.new.status) {
                    console.log('Updating message status to:', payload.new.status);
                    addMessageStatus(messageElement, payload.new.status);
                }
            }
        )
        .subscribe((status) => {
            console.log('Message status subscription:', status);
        });
}

// Clean up when leaving room
function cleanupMessageStatus() {
    stopActivityTracking();
    
    if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver = null;
    }
    
    if (messageStatusSubscription) {
        messageStatusSubscription.unsubscribe();
        messageStatusSubscription = null;
    }
    
    // Mark user as offline when leaving
    if (currentUser) {
        markUserOffline();
    }
}

// Mark user as offline
async function markUserOffline() {
    if (!currentUser) return;
    
    try {
        const { error } = await supabaseClient.rpc('update_user_online_status', {
            p_username: currentUser,
            p_is_online: false
        });
        
        if (error) {
            console.error('Error marking user offline:', error);
        }
    } catch (err) {
        console.error('Failed to mark user offline:', err);
    }
}

// Also mark offline when page unloads
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        // Use sendBeacon for reliability during page unload
        const data = JSON.stringify({
            username: currentUser,
            is_online: false
        });
        navigator.sendBeacon('/api/mark-offline', data);
    }
});

// Export functions
window.startActivityTracking = startActivityTracking;
window.stopActivityTracking = stopActivityTracking;
window.setupMessageVisibilityObserver = setupMessageVisibilityObserver;
window.addMessageStatus = addMessageStatus;
window.subscribeToMessageStatus = subscribeToMessageStatus;
window.cleanupMessageStatus = cleanupMessageStatus;
window.markMessageAsRead = markMessageAsRead;
window.markUserOffline = markUserOffline; 