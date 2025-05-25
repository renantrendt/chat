// Manual Status Update Functions - For Testing

// Manually mark all sent messages as delivered
async function markAllAsDelivered() {
    if (!currentRoom) {
        console.log('No room selected');
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('messages')
        .update({ 
            status: 'delivered',
            delivered_at: new Date().toISOString()
        })
        .eq('room_code', currentRoom)
        .eq('status', 'sent')
        .select();
    
    if (error) {
        console.error('Error updating to delivered:', error);
    } else {
        console.log('Updated messages to delivered:', data);
        // Force UI update
        data?.forEach(msg => {
            const el = document.querySelector(`[data-message-id="${msg.id}"]`);
            if (el) {
                addMessageStatus(el, 'delivered');
            }
        });
    }
}

// Manually mark specific message as read
async function markAsRead(messageId) {
    const { data, error } = await supabaseClient
        .from('messages')
        .update({ 
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select();
    
    if (error) {
        console.error('Error updating to read:', error);
    } else {
        console.log('Updated message to read:', data);
        // Force UI update
        const el = document.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            addMessageStatus(el, 'read');
        }
    }
}

// Mark all messages in room as read
async function markAllAsRead() {
    if (!currentRoom) {
        console.log('No room selected');
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('messages')
        .update({ 
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('room_code', currentRoom)
        .in('status', ['sent', 'delivered'])
        .select();
    
    if (error) {
        console.error('Error updating to read:', error);
    } else {
        console.log('Updated messages to read:', data);
        // Force UI update
        data?.forEach(msg => {
            const el = document.querySelector(`[data-message-id="${msg.id}"]`);
            if (el) {
                addMessageStatus(el, 'read');
            }
        });
    }
}

// Add to window for easy access
window.markAllAsDelivered = markAllAsDelivered;
window.markAsRead = markAsRead;
window.markAllAsRead = markAllAsRead;

console.log('Manual status update functions loaded:');
console.log('- markAllAsDelivered() - Mark all sent messages as delivered');
console.log('- markAsRead("message-id") - Mark specific message as read');
console.log('- markAllAsRead() - Mark all messages as read'); 