// Message Status Integration - Patches for app-supabase.js

// Override the original displayMessage function to add status tracking
const originalDisplayMessage = window.displayMessage || function() {};
window.displayMessage = function(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Add message ID and sender as data attributes
    if (message.id) {
        messageElement.dataset.messageId = message.id;
    }
    messageElement.dataset.sender = message.sender;
    
    // Add class based on sender
    if (message.sender === currentUser) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }
    
    // Format timestamp
    const timestamp = formatMessageTime(message.timestamp);
    
    // Create message content with timestamp
    messageElement.innerHTML = `
        <div class="timestamp">${timestamp}</div>
        <div class="sender">${message.sender}</div>
        <div class="content">${message.content}</div>
    `;
    
    // Add status for sent messages
    if (message.sender === currentUser && message.status) {
        addMessageStatus(messageElement, message.status);
    }
    
    // Add to container
    messagesContainer.appendChild(messageElement);
    
    // Observe this message for read status
    if (visibilityObserver && message.sender !== currentUser) {
        visibilityObserver.observe(messageElement);
    }
    
    // Scroll to bottom
    scrollToBottom();
};

// Override enterRoom to start activity tracking
const originalEnterRoom = window.enterRoom;
window.enterRoom = async function(roomCode) {
    // Call original function
    await originalEnterRoom(roomCode);
    
    // Start activity tracking and status subscriptions
    await startActivityTracking();
    setupMessageVisibilityObserver();
    await subscribeToMessageStatus();
};

// Override leaveRoom to clean up
const originalLeaveRoom = window.leaveRoom;
window.leaveRoom = function() {
    // Clean up message status tracking
    cleanupMessageStatus();
    
    // Call original function
    originalLeaveRoom();
};

// Override loadMessages to set up observer after loading
const originalLoadMessages = window.loadMessages;
window.loadMessages = async function(roomCode) {
    // Clear messages container
    messagesContainer.innerHTML = '';
    messages = [];
    
    try {
        // Load existing messages from Supabase with status
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', roomCode)
            .order('timestamp', { ascending: true });
        
        if (error) throw error;
        
        console.log(`Loaded ${data.length} messages for room ${roomCode}`);
        
        // Set up visibility observer before displaying messages
        setupMessageVisibilityObserver();
        
        // Display existing messages
        if (data && data.length > 0) {
            data.forEach(message => {
                messages.push(message);
                displayMessage(message);
            });
            
            // Scroll to bottom
            scrollToBottom();
        }
        
        // Subscribe to new messages
        subscribeToMessages(roomCode);
        
        // Subscribe to message status updates
        await subscribeToMessageStatus();
        
    } catch (error) {
        console.error('Error loading messages:', error);
        alert('Failed to load messages. Please try refreshing the page.');
    }
};

// Override sendMessage to include status
const originalSendMessage = window.sendMessage;
window.sendMessage = async function(content) {
    if (!currentRoom || !currentUser || !content) return;
    
    try {
        // Create message object with status
        const message = {
            room_code: currentRoom,
            sender: currentUser,
            content: content,
            timestamp: new Date().toISOString(),
            status: 'sent' // Add default status
        };
        
        console.log('Sending message:', message);
        
        // Insert into Supabase
        const { data, error } = await window.supabaseClient
            .from('messages')
            .insert([message])
            .select();
        
        if (error) throw error;
        
        console.log('Message sent successfully:', data);
        
        // Display the message immediately without waiting for subscription
        if (data && data.length > 0) {
            const newMessage = data[0];
            // Check if this message is already in our messages array
            if (!messages.some(m => m.id === newMessage.id)) {
                messages.push(newMessage);
                displayMessage(newMessage);
                scrollToBottom();
            }
        }
        
        // Clear input
        messageInput.value = '';
        
        // Update delivery status for other users
        await updateMessageDeliveryStatus();
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Message status integration loaded');
    
    // Add send button event listener if not already added
    const sendBtn = document.getElementById('send-message-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const input = document.getElementById('message-input');
            if (input && input.value.trim()) {
                sendMessage(input.value.trim());
            }
        });
    }
}); 