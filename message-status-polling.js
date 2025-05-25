// Message Status Polling - Temporary solution for realtime issues

let statusPollingInterval = null;

// Start polling for message status updates
function startStatusPolling() {
    if (!currentRoom) return;
    
    console.log('Starting status polling for room:', currentRoom);
    
    // Poll every 2 seconds
    statusPollingInterval = setInterval(async () => {
        try {
            // First, update delivery status for the room
            await updateMessageDeliveryStatus();
            
            // Get all messages with their current status
            const { data, error } = await supabaseClient
                .from('messages')
                .select('id, status, sender')
                .eq('room_code', currentRoom);
            
            if (error) {
                console.error('Error polling message status:', error);
                return;
            }
            
            console.log('Polling found messages:', data?.length || 0);
            
            // Update status for each message
            data?.forEach(msg => {
                const messageElement = document.querySelector(`[data-message-id="${msg.id}"]`);
                if (messageElement && msg.status) {
                    // Check if this is a sent message (not received)
                    const isSentMessage = messageElement.classList.contains('sent');
                    
                    if (isSentMessage) {
                        // Check if status needs updating
                        const currentStatusElement = messageElement.querySelector('.message-status span');
                        const currentClass = currentStatusElement?.className || '';
                        
                        // Only update if status changed
                        if ((msg.status === 'delivered' && !currentClass.includes('check-delivered')) ||
                            (msg.status === 'read' && !currentClass.includes('check-read'))) {
                            console.log('Updating message status from polling:', msg.id, msg.status);
                            addMessageStatus(messageElement, msg.status);
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Status polling error:', err);
        }
    }, 2000);
}

// Stop polling
function stopStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
        console.log('Stopped status polling');
    }
}

// Override enterRoom to start polling
const originalEnterRoomWithPolling = window.enterRoom;
window.enterRoom = async function(roomCode) {
    // Call the already overridden function
    await originalEnterRoomWithPolling(roomCode);
    
    // Start polling
    startStatusPolling();
};

// Override leaveRoom to stop polling
const originalLeaveRoomWithPolling = window.leaveRoom;
window.leaveRoom = function() {
    // Stop polling
    stopStatusPolling();
    
    // Call the already overridden function
    originalLeaveRoomWithPolling();
};

console.log('Message status polling loaded'); 