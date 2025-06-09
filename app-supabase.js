// DOM Elements
const homeScreen = document.getElementById('home-screen');
const joinRoomScreen = document.getElementById('join-room-screen');
const createRoomScreen = document.getElementById('create-room-screen');
const chatRoomScreen = document.getElementById('chat-room-screen');

const usernameContainer = document.getElementById('username-container');
const homeButtons = document.getElementById('home-buttons');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const userDisplay = document.getElementById('user-display');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinBtn = document.getElementById('join-btn');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyCodeBtn = document.getElementById('copy-code-btn');
const enterRoomBtn = document.getElementById('enter-room-btn');
const currentRoomCode = document.getElementById('current-room-code');

const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const saveConversationBtn = document.getElementById('save-conversation-btn');
const connectionStatus = document.getElementById('connection-status');

// Last visited rooms elements
const lastVisitedSection = document.getElementById('last-visited-section');
const lastVisitedRooms = document.getElementById('last-visited-rooms');
const noRoomsMessage = document.getElementById('no-rooms-message');

// App State
let currentUser = null;
let currentRoom = null;
let messages = [];
let messageSubscription = null;

// Local Storage Keys
const USERNAME_KEY = 'msg_username';
const ROOMS_KEY = 'msg_rooms';
const MESSAGES_KEY = 'msg_messages';
const SAVED_CONVERSATIONS_KEY = 'msg_saved_conversations';

// Make currentUser and currentRoom globally accessible for message-status.js
window.currentUser = null;
window.currentRoom = null;

// Centralized Subscription Manager
const subscriptionManager = {
    subscriptions: new Map(),
    timers: new Map(),
    observers: new Map(),
    
    // Register a subscription for tracking
    register(key, subscription, type = 'subscription') {
        console.log(`Registering ${type}: ${key}`);
        this.subscriptions.set(key, { subscription, type });
    },
    
    // Register a timer for tracking
    registerTimer(key, timerId) {
        console.log(`Registering timer: ${key}`);
        this.timers.set(key, timerId);
    },
    
    // Register an observer for tracking
    registerObserver(key, observer) {
        console.log(`Registering observer: ${key}`);
        this.observers.set(key, observer);
    },
    
    // Clean up all subscriptions in proper order
    async cleanupAll() {
        console.log('Starting coordinated cleanup...');
        const errors = [];
        
        // 1. Clear all timers first (they might interfere with cleanup)
        for (const [key, timerId] of this.timers) {
            try {
                console.log(`Clearing timer: ${key}`);
                clearTimeout(timerId);
                clearInterval(timerId);
            } catch (error) {
                console.error(`Error clearing timer ${key}:`, error);
                errors.push(`Timer ${key}: ${error.message}`);
            }
        }
        this.timers.clear();
        
        // 2. Disconnect all observers
        for (const [key, observer] of this.observers) {
            try {
                console.log(`Disconnecting observer: ${key}`);
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            } catch (error) {
                console.error(`Error disconnecting observer ${key}:`, error);
                errors.push(`Observer ${key}: ${error.message}`);
            }
        }
        this.observers.clear();
        
        // 3. Unsubscribe from all subscriptions in reverse order (LIFO)
        const subscriptionEntries = Array.from(this.subscriptions.entries()).reverse();
        for (const [key, { subscription, type }] of subscriptionEntries) {
            try {
                console.log(`Unsubscribing from ${type}: ${key}`);
                if (subscription && typeof subscription.unsubscribe === 'function') {
                    await subscription.unsubscribe();
                } else if (subscription && typeof subscription.untrack === 'function') {
                    // For presence channels
                    subscription.untrack();
                    if (typeof subscription.unsubscribe === 'function') {
                        await subscription.unsubscribe();
                    }
                }
            } catch (error) {
                console.error(`Error unsubscribing from ${key}:`, error);
                errors.push(`Subscription ${key}: ${error.message}`);
            }
        }
        this.subscriptions.clear();
        
        if (errors.length > 0) {
            console.warn('Cleanup completed with errors:', errors);
        } else {
            console.log('All subscriptions cleaned up successfully');
        }
        
        return { success: errors.length === 0, errors };
    },
    
    // Clean up specific subscription
    async cleanup(key) {
        if (this.subscriptions.has(key)) {
            const { subscription, type } = this.subscriptions.get(key);
            try {
                console.log(`Cleaning up ${type}: ${key}`);
                if (subscription && typeof subscription.unsubscribe === 'function') {
                    await subscription.unsubscribe();
                }
                this.subscriptions.delete(key);
                return { success: true };
            } catch (error) {
                console.error(`Error cleaning up ${key}:`, error);
                return { success: false, error: error.message };
            }
        }
        return { success: true }; // Already cleaned or doesn't exist
    }
};

// Make subscription manager globally accessible
window.subscriptionManager = subscriptionManager;

// Initialize App
async function initApp() {
    // Check if username exists in local storage
    currentUser = localStorage.getItem(USERNAME_KEY);
    
    if (currentUser) {
        // Set global variable for message-status.js
        window.currentUser = currentUser;
        
        // Insert username into user_name table if not exists
        try {
            const { data, error } = await window.supabaseClient
                .from('user_name')
                .insert([{ username: currentUser }])
                .select();
            
            if (error && error.code !== '23505') { // 23505 is unique violation (username already exists)
                console.error('Error inserting username:', error);
            }
        } catch (err) {
            console.error('Failed to save username to database:', err);
        }
        
        // Show home buttons if username exists
        usernameContainer.style.display = 'none';
        homeButtons.style.display = 'block';
        userDisplay.textContent = currentUser;
        
        // Apply profile color to username display
        const profile = await window.getUserProfile(currentUser);
        if (profile && profile.color) {
            userDisplay.style.color = profile.color;
        }
        
        // Re-initialize VIP background features now that we have a username
        if (window.initVIPBackground) {
            console.log('Re-initializing VIP background after username load...');
            await window.initVIPBackground();
        }
        
        // Load last visited rooms for the current user
        loadLastVisitedRooms();
    }
    
    // Initialize unread notifications
    if (window.initUnreadNotifications) {
        window.initUnreadNotifications();
    }
    
    // Initialize profile
    if (window.initProfile) {
        await window.initProfile();
    }

    // Check Supabase connection
    try {
        // Test connection with the already initialized client
        if (window.supabaseClient) {
            window.supabaseClient.auth.getSession()
                .then(() => {
                    updateConnectionStatus('Connected');
                    console.log('Supabase connection verified');
                })
                .catch(err => {
                    console.error('Supabase connection test failed:', err);
                    updateConnectionStatus('Disconnected');
                });
        } else {
            throw new Error('Supabase client not found. Check if it was initialized in the HTML.');
        }
    } catch (error) {
        updateConnectionStatus('Disconnected');
        console.error('Failed to verify Supabase connection:', error);
    }

    // Add event listeners
    addEventListeners();
}

// Update connection status display
function updateConnectionStatus(status) {
    if (connectionStatus) {
        connectionStatus.textContent = `Status: ${status}`;
        connectionStatus.className = status.toLowerCase();
    }
}

// Event Listeners
function addEventListeners() {
    // Username form
    saveUsernameBtn.addEventListener('click', saveUsername);

    // Navigation buttons
    createRoomBtn.addEventListener('click', () => showScreen(createRoomScreen, createNewRoom));
    joinRoomBtn.addEventListener('click', () => showScreen(joinRoomScreen));
    
    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetScreen = document.getElementById(this.dataset.target);
            showScreen(targetScreen);
            
            // If leaving chat room
            if (this.parentElement.parentElement.id === 'chat-room-screen') {
                leaveRoom();
            }
        });
    });

    // Room functionality
    joinBtn.addEventListener('click', joinRoom);
    copyCodeBtn.addEventListener('click', copyRoomCode);
    enterRoomBtn.addEventListener('click', () => enterRoom(roomCodeDisplay.textContent));
    
    // Chat functionality
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            sendMessage(this.value.trim());
            this.value = '';
        }
    });
    
    // Send message button functionality
    sendMessageBtn.addEventListener('click', function() {
        if (messageInput.value.trim() !== '') {
            sendMessage(messageInput.value.trim());
            messageInput.value = '';
            messageInput.focus();
        }
    });
    
    saveConversationBtn.addEventListener('click', saveConversation);
}

// Username Functions
async function saveUsername() {
    const username = usernameInput.value.trim();
    
    if (username) {
        // Save to local storage
        localStorage.setItem(USERNAME_KEY, username);
        
        // Set current user
        currentUser = username;
        window.currentUser = username; // Also set globally
        
        // Insert username into user_name table in Supabase
        try {
            const { data, error } = await window.supabaseClient
                .from('user_name')
                .insert([{ username: username }])
                .select();
            
            if (error && error.code !== '23505') { // 23505 is unique violation (username already exists)
                console.error('Error inserting username:', error);
            } else {
                console.log('Username saved to database:', username);
            }
        } catch (err) {
            console.error('Failed to save username to database:', err);
        }
        
        // Display username
        userDisplay.textContent = username;
        
        // Apply profile color to username display
        const profile = await window.getUserProfile(username);
        if (profile && profile.color) {
            userDisplay.style.color = profile.color;
        }
        
        // Initialize VIP background features now that we have a username
        if (window.initVIPBackground) {
            console.log('Initializing VIP background after username save...');
            await window.initVIPBackground();
        }
        
        // Hide username container and show home buttons
        usernameContainer.style.display = 'none';
        homeButtons.style.display = 'block';
        
        // Load last visited rooms
        loadLastVisitedRooms();
    }
}

// Navigation Functions
function showScreen(screen, callback = null) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Show target screen
    screen.classList.add('active');
    
    // Execute callback if provided
    if (callback) callback();
}

// Room Functions
async function createNewRoom() {
    if (!currentUser) return;
    
    // Generate room code
    const roomCode = generateRoomCode();
    
    try {
        // Check if Supabase client is initialized
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        // Create room in Supabase
        const { data, error } = await window.supabaseClient
            .from('rooms')
            .insert([
                { code: roomCode, created_by: currentUser }
            ]);
        
        if (error) throw error;
        
        // Display room code
        roomCodeDisplay.textContent = roomCode;
        
        // Save room to local storage
        saveRoom(roomCode);
        
        console.log('Room created:', roomCode);
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Failed to create room. Please try again.');
    }
}

function generateRoomCode() {
    // Generate a random 6-character code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters.charAt(randomIndex);
    }
    
    return code;
}

function saveRoom(roomCode) {
    // Get saved rooms from local storage
    const savedRooms = JSON.parse(localStorage.getItem(ROOMS_KEY) || '[]');
    
    // Add room if it doesn't exist
    if (!savedRooms.includes(roomCode)) {
        savedRooms.push(roomCode);
        localStorage.setItem(ROOMS_KEY, JSON.stringify(savedRooms));
    }
}

async function joinRoom() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (roomCode) {
        try {
            // Check if room exists in Supabase
            const { data, error } = await window.supabaseClient
                .from('rooms')
                .select('code')
                .eq('code', roomCode)
                .single();
            
            if (error) {
                console.error('Error checking room:', error);
                alert('Room not found. Please check the code and try again.');
                return;
            }
            
            // Room exists, enter it
            enterRoom(roomCode);
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room. Please try again.');
        }
    }
}

async function enterRoom(roomCode) {
    if (!roomCode || !currentUser) return;
    
    // Set current room
    currentRoom = roomCode;
    window.currentRoom = roomCode; // Also set globally
    
    // Save room to local storage
    saveRoom(roomCode);
    
    // Save to last visited rooms in Supabase
    await saveLastVisitedRoom(roomCode);
    
    // Display room code in chat screen
    currentRoomCode.textContent = roomCode;
    
    console.log('Entering room:', roomCode);
    
    // Show chat screen
    showScreen(chatRoomScreen);
    
    // Load messages for this room
    await loadMessages(roomCode);
    
    // Initialize reaction system for this room
    if (window.subscribeToReactions) {
        window.subscribeToReactions();
    }
    
    // Load all reactions for displayed messages
    if (window.loadAllReactions) {
        await window.loadAllReactions();
    }
    
    // Clear unread count for this room
    if (window.clearUnreadForRoom) {
        window.clearUnreadForRoom(roomCode);
    }
    
    // Subscribe to unread messages for this room
    if (window.subscribeToUnreadMessages) {
        window.subscribeToUnreadMessages(roomCode);
    }
    
    // Start activity tracking for message status
    if (window.startActivityTracking) {
        window.startActivityTracking();
    }
    
    // Subscribe to message status updates
    if (window.subscribeToMessageStatus) {
        window.subscribeToMessageStatus();
    }
    
    // Setup message visibility observer for read receipts
    if (window.setupMessageVisibilityObserver) {
        window.setupMessageVisibilityObserver();
    }
    
    // Initialize room presence tracking
    if (window.initRoomPresence) {
        window.initRoomPresence(roomCode, currentUser);
    }
    
    // Focus on message input
    messageInput.focus();
}

async function leaveRoom() {
    const roomToLeave = currentRoom; // Store room before clearing
    console.log('Leaving room:', roomToLeave);
    
    try {
        // Use centralized cleanup for coordinated subscription management
        const cleanupResult = await subscriptionManager.cleanupAll();
        
        if (!cleanupResult.success) {
            console.warn('Some cleanup operations failed:', cleanupResult.errors);
        }
        
        // Additional cleanup for systems that might need room context
        try {
            // Mark user as offline for this room
            if (window.markUserOffline) {
                await window.markUserOffline();
            }
        } catch (error) {
            console.error('Error marking user offline:', error);
        }
        
        // Clean up UI elements that don't need subscriptions
        try {
            // Hide reaction menus
            if (window.hideReactionMenu) {
                window.hideReactionMenu();
            }
            
            // Close emoji picker
            if (window.closeEmojiPicker) {
                window.closeEmojiPicker();
            }
        } catch (error) {
            console.error('Error cleaning up UI elements:', error);
        }
        
    } catch (error) {
        console.error('Error during room cleanup:', error);
    } finally {
        // Reset room state AFTER cleanup is complete
        currentRoom = null;
        window.currentRoom = null;
        messages = [];
        messagesContainer.innerHTML = '';
        
        console.log('Room cleanup completed for:', roomToLeave);
    }
}

function copyRoomCode() {
    const roomCode = roomCodeDisplay.textContent;
    
    // Copy to clipboard with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                showCopiedFeedback();
            })
            .catch(err => {
                console.error('Failed to copy room code:', err);
                fallbackCopy(roomCode);
            });
    } else {
        fallbackCopy(roomCode);
    }
}

function fallbackCopy(text) {
    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.value = text;
    
    // Append to body
    document.body.appendChild(tempInput);
    
    // Select and copy
    tempInput.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopiedFeedback();
        } else {
            console.error('Failed to copy with execCommand');
        }
    } catch (err) {
        console.error('Failed to copy with fallback:', err);
    }
    
    // Remove the temporary element
    document.body.removeChild(tempInput);
}

function showCopiedFeedback() {
    // Change button text
    const originalText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = 'Copied!';
    
    // Reset after a delay
    setTimeout(() => {
        copyCodeBtn.textContent = originalText;
    }, 2000);
}

// Message Functions - Optimized for performance
async function loadMessages(roomCode) {
    console.log('🚀 Fast loading messages for room:', roomCode);
    
    // Clear messages container
    messagesContainer.innerHTML = '';
    messages = [];
    
    // Initialize presence system immediately (don't wait for messages)
    if (window.initRoomPresence) {
        window.initRoomPresence(roomCode, currentUser);
    }
    
    try {
        // Load only recent messages first (last 100) for fast initial load
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', roomCode)
            .order('timestamp', { ascending: false })
            .limit(100); // Only load recent messages initially
        
        if (error) throw error;
        
        console.log(`📦 Loaded ${data.length} recent messages for room ${roomCode}`);
        
        if (data && data.length > 0) {
            // Reverse to get chronological order
            messages = [...data.reverse()];
            
            // Show loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'messages-loading';
            loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading messages...</div>';
            messagesContainer.appendChild(loadingDiv);
            
            // Display messages in parallel (much faster)
            const messagePromises = messages.map(message => displayMessageFast(message));
            await Promise.all(messagePromises);
            
            // Remove loading indicator
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
            
            // Add "Load More" button if we got 100 messages (means there might be more)
            if (data.length === 100) {
                addLoadMoreButton(roomCode);
            }
            
            scrollToBottom();
            
            // Load enhanced features after basic messages are shown (non-blocking)
            setTimeout(() => {
                loadMessageEnhancements();
            }, 100);
        }
        
        // Subscribe to new messages
        subscribeToMessages(roomCode);
        
        console.log('✅ Fast message loading completed');
        
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        alert('Failed to load messages. Please try refreshing the page.');
    }
}

// Fast message display without blocking operations
async function displayMessageFast(message) {
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
    
    // Create basic message content first (fast)
    messageElement.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <div class="timestamp">${timestamp}</div>
                <div class="sender" style="color: #ffffff">${message.sender}</div>
            </div>
        </div>
        <div class="content">${message.content}</div>
    `;
    
    // Add to container immediately
    messagesContainer.appendChild(messageElement);
    
    return messageElement;
}

// Load message enhancements after basic display (non-blocking)
async function loadMessageEnhancements() {
    console.log('🎨 Loading message enhancements...');
    
    try {
        // Get all message elements
        const messageElements = document.querySelectorAll('.message[data-message-id]');
        
        // Process enhancements in batches to avoid blocking
        const batchSize = 10;
        for (let i = 0; i < messageElements.length; i += batchSize) {
            const batch = Array.from(messageElements).slice(i, i + batchSize);
            
            // Process batch in parallel
            await Promise.all(batch.map(async (messageElement) => {
                const messageId = messageElement.dataset.messageId;
                const sender = messageElement.dataset.sender;
                
                // Find the original message data
                const messageData = messages.find(m => m.id === messageId);
                if (!messageData) return;
                
                // Get profile data
                const profile = await window.getUserProfile(sender);
                
                // Update sender styling with profile data
                const senderElement = messageElement.querySelector('.sender');
                if (senderElement && profile) {
                    senderElement.style.color = profile.color;
                    if (profile.isVIP) {
                        senderElement.classList.add('vip-user');
                    }
                }
                
                // Add profile image if exists
                if (profile.image) {
                    const messageHeader = messageElement.querySelector('.message-header');
                    const profileImg = document.createElement('img');
                    profileImg.src = profile.image;
                    profileImg.alt = sender;
                    profileImg.className = 'message-profile-img';
                    messageHeader.insertBefore(profileImg, messageHeader.firstChild);
                }
                
                // Add reply preview if this is a reply
                if (messageData.reply_to_message_id) {
                    const replyPreviewHtml = await createReplyPreviewForMessage(messageData.reply_to_message_id);
                    if (replyPreviewHtml) {
                        messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml);
                    }
                }
                
                // Add reaction arrow
                if (window.addReactionArrowToMessage) {
                    window.addReactionArrowToMessage(messageElement, messageId);
                }
                
                // Add message status for sent messages
                if (messageData.sender === currentUser && messageData.status && window.addMessageStatus) {
                    window.addMessageStatus(messageElement, messageData.status);
                }
            }));
            
            // Small delay between batches to keep UI responsive
            if (i + batchSize < messageElements.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // Load reactions for all messages (last, as it's least important)
        if (window.loadAllReactions) {
            setTimeout(() => {
                window.loadAllReactions();
            }, 200);
        }
        
        console.log('✅ Message enhancements loaded');
        
    } catch (error) {
        console.error('❌ Error loading message enhancements:', error);
    }
}

// Add Load More button for older messages
function addLoadMoreButton(roomCode) {
    // Remove existing load more button if any
    const existingButton = document.getElementById('load-more-messages');
    if (existingButton) {
        existingButton.remove();
    }
    
    const loadMoreButton = document.createElement('div');
    loadMoreButton.id = 'load-more-messages';
    loadMoreButton.innerHTML = `
        <button class="load-more-btn" onclick="loadMoreMessages('${roomCode}')">
            📜 Load More Messages
        </button>
    `;
    loadMoreButton.style.cssText = `
        text-align: center;
        padding: 15px;
        border-bottom: 1px solid #333;
        background: #1a1a1a;
    `;
    
    // Add styling for the button
    const style = document.createElement('style');
    style.textContent = `
        .load-more-btn {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        .load-more-btn:hover {
            background: #3a3a3a;
        }
        .load-more-btn:disabled {
            background: #1a1a1a;
            color: #666;
            cursor: not-allowed;
        }
    `;
    if (!document.getElementById('load-more-styles')) {
        style.id = 'load-more-styles';
        document.head.appendChild(style);
    }
    
    // Insert at the top of messages container
    messagesContainer.insertBefore(loadMoreButton, messagesContainer.firstChild);
}

// Load older messages
window.loadMoreMessages = async function(roomCode) {
    const loadMoreButton = document.getElementById('load-more-messages');
    if (!loadMoreButton) return;
    
    const button = loadMoreButton.querySelector('.load-more-btn');
    const originalText = button.textContent;
    
    try {
        // Disable button and show loading
        button.disabled = true;
        button.textContent = '⏳ Loading...';
        
        // Get oldest message timestamp for pagination
        const oldestTimestamp = messages.length > 0 ? messages[0].timestamp : new Date().toISOString();
        
        // Load older messages
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', roomCode)
            .lt('timestamp', oldestTimestamp)
            .order('timestamp', { ascending: false })
            .limit(50); // Load 50 older messages
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            console.log(`📦 Loaded ${data.length} older messages`);
            
            // Reverse to get chronological order and prepend to messages
            const olderMessages = data.reverse();
            messages.unshift(...olderMessages);
            
            // Display older messages at the top
            const oldScrollHeight = messagesContainer.scrollHeight;
            
            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Display older messages in parallel
            const messagePromises = olderMessages.map(message => displayMessageFast(message));
            const messageElements = await Promise.all(messagePromises);
            
            // Add to fragment in reverse order (oldest first)
            messageElements.reverse().forEach(element => {
                fragment.appendChild(element);
            });
            
            // Insert after load more button
            messagesContainer.insertBefore(fragment, loadMoreButton.nextSibling);
            
            // Restore scroll position
            const newScrollHeight = messagesContainer.scrollHeight;
            messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;
            
            // Load enhancements for new messages
            setTimeout(() => {
                loadMessageEnhancementsForRange(0, olderMessages.length);
            }, 100);
            
            // Remove load more button if we got fewer than 50 messages (no more to load)
            if (data.length < 50) {
                loadMoreButton.remove();
            } else {
                // Re-enable button
                button.disabled = false;
                button.textContent = originalText;
            }
        } else {
            // No more messages to load
            loadMoreButton.remove();
        }
        
    } catch (error) {
        console.error('❌ Error loading more messages:', error);
        button.disabled = false;
        button.textContent = originalText;
        alert('Failed to load more messages. Please try again.');
    }
};

// Load enhancements for a specific range of messages
async function loadMessageEnhancementsForRange(startIndex, count) {
    try {
        const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]')).slice(startIndex, startIndex + count);
        
        // Process in smaller batches for older messages
        const batchSize = 5;
        for (let i = 0; i < messageElements.length; i += batchSize) {
            const batch = messageElements.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (messageElement) => {
                const messageId = messageElement.dataset.messageId;
                const sender = messageElement.dataset.sender;
                
                const messageData = messages.find(m => m.id === messageId);
                if (!messageData) return;
                
                // Get profile data
                const profile = await window.getUserProfile(sender);
                
                // Update sender styling
                const senderElement = messageElement.querySelector('.sender');
                if (senderElement && profile) {
                    senderElement.style.color = profile.color;
                    if (profile.isVIP) {
                        senderElement.classList.add('vip-user');
                    }
                }
                
                // Add profile image
                if (profile.image) {
                    const messageHeader = messageElement.querySelector('.message-header');
                    const profileImg = document.createElement('img');
                    profileImg.src = profile.image;
                    profileImg.alt = sender;
                    profileImg.className = 'message-profile-img';
                    messageHeader.insertBefore(profileImg, messageHeader.firstChild);
                }
                
                // Add reply preview
                if (messageData.reply_to_message_id) {
                    const replyPreviewHtml = await createReplyPreviewForMessage(messageData.reply_to_message_id);
                    if (replyPreviewHtml) {
                        messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml);
                    }
                }
                
                // Add reaction arrow
                if (window.addReactionArrowToMessage) {
                    window.addReactionArrowToMessage(messageElement, messageId);
                }
            }));
            
            // Small delay between batches
            if (i + batchSize < messageElements.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    } catch (error) {
        console.error('❌ Error loading enhancements for message range:', error);
    }
}

function subscribeToMessages(roomCode) {
    // Clean up any existing subscription
    subscriptionManager.cleanup('messages');
    
    // Subscribe to real-time updates for this room
    messageSubscription = window.supabaseClient
        .channel(`messages_channel_${roomCode}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `room_code=eq.${roomCode}`
            }, 
            async (payload) => {
                const newMessage = payload.new;
                console.log('Real-time message received:', newMessage);
                
                // Verify we're still in the same room
                if (currentRoom !== roomCode) {
                    return;
                }
                
                // Only process if it's not already in our messages array
                if (!messages.some(m => m.id === newMessage.id)) {
                    // Just append new messages (they should be newest)
                    messages.push(newMessage);
                    await displayMessage(newMessage);
                    scrollToBottom();
                }
            }
        )
        .subscribe((status) => {
            console.log(`Subscription status for room ${roomCode}:`, status);
        });
    
    // Register with subscription manager
    subscriptionManager.register('messages', messageSubscription, 'message-updates');
}

async function sendMessage(content) {
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
        
        // Add reply_to_message_id if in reply mode
        if (window.currentReplyMessageId) {
            message.reply_to_message_id = window.currentReplyMessageId;
            console.log('💬 Sending reply to message:', window.currentReplyMessageId);
        }
        
        console.log('Sending message:', message);
        
        // Insert into Supabase
        const { data, error } = await window.supabaseClient
            .from('messages')
            .insert([message])
            .select();
        
        if (error) throw error;
        
        console.log('Message sent successfully:', data);
        
        // Clear reply state after sending
        if (window.currentReplyMessageId) {
            console.log('🧹 Clearing reply state after sending');
            if (window.hideReplyPreview) {
                window.hideReplyPreview();
            }
            if (window.cancelReply) {
                window.cancelReply();
            }
        }
        
        // Let the real-time subscription handle displaying the message
        // This ensures proper chronological ordering and prevents duplicates
        
        // Clear input
        messageInput.value = '';
        
        // Update delivery status for other users (if function exists)
        if (window.updateMessageDeliveryStatus) {
            await window.updateMessageDeliveryStatus();
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Create reply preview HTML for a message
async function createReplyPreviewForMessage(originalMessageId) {
    try {
        console.log('📄 Creating reply preview for original message:', originalMessageId);
        
        // Try to get original message from database
        const { data: originalMessage, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('id', originalMessageId)
            .single();
        
        if (error || !originalMessage) {
            console.warn('❌ Could not find original message:', originalMessageId);
            return `<div class="message-reply-preview deleted">
                <span class="reply-icon">↩️</span>
                <span class="original-message-deleted">Original message deleted</span>
            </div>`;
        }
        
        // Truncate content for preview
        const truncatedContent = window.truncateMessageForPreview ? 
            window.truncateMessageForPreview(originalMessage.content) : 
            originalMessage.content.substring(0, 80) + '...';
        
        console.log('✅ Created reply preview for:', originalMessage.sender);
        
        return `<div class="message-reply-preview" onclick="scrollToMessage('${originalMessageId}')">
            <span class="reply-icon">↩️</span>
            <div class="original-message-info">
                <span class="original-sender">${originalMessage.sender}</span>
                <span class="original-content">${truncatedContent}</span>
            </div>
        </div>`;
        
    } catch (error) {
        console.error('❌ Error creating reply preview:', error);
        return '';
    }
}

async function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Add message ID and sender as data attributes for status tracking
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
    
    // Get user profile
    const profile = await window.getUserProfile(message.sender);
    
    // Format timestamp
    const timestamp = formatMessageTime(message.timestamp);
    
    // Create message header with profile image
    let profileImageHtml = '';
    if (profile.image) {
        profileImageHtml = `<img src="${profile.image}" alt="${message.sender}" class="message-profile-img">`;
    }
    
    // Add VIP class if user is VIP
    const vipClass = profile.isVIP ? 'vip-user' : '';
    
    // Check if this is a reply message and create reply preview
    let replyPreviewHtml = '';
    if (message.reply_to_message_id) {
        replyPreviewHtml = await createReplyPreviewForMessage(message.reply_to_message_id);
    }
    
    // Create message content with timestamp
    messageElement.innerHTML = `
        ${replyPreviewHtml}
        <div class="message-header">
            ${profileImageHtml}
            <div class="message-info">
                <div class="timestamp">${timestamp}</div>
                <div class="sender ${vipClass}" style="color: ${profile.color}">${message.sender}</div>
            </div>
        </div>
        <div class="content">${message.content}</div>
    `;
    
    // Add status for sent messages
    if (message.sender === currentUser && message.status && window.addMessageStatus) {
        window.addMessageStatus(messageElement, message.status);
    }
    
    // Add to container
    messagesContainer.appendChild(messageElement);
    
    // Add reaction arrow and functionality
    console.log('Checking for reaction system availability...', {
        hasFunction: !!window.addReactionArrowToMessage,
        messageId: message.id,
        systemInitialized: window.reactionSystemInitialized
    });
    
    if (window.addReactionArrowToMessage) {
        console.log('Calling addReactionArrowToMessage for message:', message.id);
        window.addReactionArrowToMessage(messageElement, message.id);
    } else {
        console.warn('window.addReactionArrowToMessage is not available');
    }
    
    // Observe this message for read status (if not sent by current user)
    if (window.visibilityObserver && message.sender !== currentUser) {
        window.visibilityObserver.observe(messageElement);
    }
    
    // Scroll to bottom
    scrollToBottom();
}

// Format timestamp for display
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    // Format time as HH:MM (24-hour format)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function saveConversation() {
    if (!currentRoom || messages.length === 0) return;
    
    // Get saved conversations from local storage
    const savedConversations = JSON.parse(localStorage.getItem(SAVED_CONVERSATIONS_KEY) || '[]');
    
    // Create conversation object
    const conversation = {
        roomCode: currentRoom,
        messages: messages,
        savedAt: new Date().toISOString()
    };
    
    // Add to saved conversations
    savedConversations.push(conversation);
    
    // Save back to local storage
    localStorage.setItem(SAVED_CONVERSATIONS_KEY, JSON.stringify(savedConversations));
    
    // Visual feedback
    const originalText = saveConversationBtn.textContent;
    saveConversationBtn.textContent = 'Saved!';
    
    setTimeout(() => {
        saveConversationBtn.textContent = originalText;
    }, 2000);
}

// Last Visited Rooms Functions
async function saveLastVisitedRoom(roomCode) {
    if (!currentUser || !roomCode) return;
    
    try {
        // First check if this room already exists for the user
        const { data: existingData, error: existingError } = await window.supabaseClient
            .from('last_visited_rooms')
            .select('id')
            .eq('username', currentUser)
            .eq('room_code', roomCode)
            .single();
        
        if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is the error code for 'no rows found'
            console.error('Error checking existing room:', existingError);
            return;
        }
        
        if (existingData) {
            // Room exists, update the timestamp
            const { error: updateError } = await window.supabaseClient
                .from('last_visited_rooms')
                .update({ visited_at: new Date().toISOString() })
                .eq('id', existingData.id);
                
            if (updateError) {
                console.error('Error updating last visited room:', updateError);
            }
        } else {
            // Room doesn't exist, insert new record
            const { error: insertError } = await window.supabaseClient
                .from('last_visited_rooms')
                .insert([
                    { 
                        username: currentUser, 
                        room_code: roomCode, 
                        visited_at: new Date().toISOString() 
                    }
                ]);
                
            if (insertError) {
                console.error('Error inserting last visited room:', insertError);
            }
        }
        
        // Reload the last visited rooms on the home screen
        if (homeScreen.classList.contains('active')) {
            loadLastVisitedRooms();
        }
        
    } catch (error) {
        console.error('Error saving last visited room:', error);
    }
}

async function loadLastVisitedRooms() {
    if (!currentUser) return;
    
    try {
        // Get the 10 most recently visited rooms for the current user
        const { data, error } = await window.supabaseClient
            .from('last_visited_rooms')
            .select('room_code, visited_at')
            .eq('username', currentUser)
            .order('visited_at', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error loading last visited rooms:', error);
            return;
        }
        
        // Clear the container
        lastVisitedRooms.innerHTML = '';
        
        // Show or hide the no rooms message
        if (!data || data.length === 0) {
            noRoomsMessage.style.display = 'block';
            return;
        }
        
        // Hide the no rooms message
        noRoomsMessage.style.display = 'none';
        
        // Display the rooms
        data.forEach(room => {
            // Create room item element
            const roomItem = document.createElement('div');
            roomItem.classList.add('room-item');
            
            // Format the visited time
            const visitedTime = formatVisitedTime(room.visited_at);
            
            // Get unread count for this room
            const unreadCount = window.getUnreadCount ? window.getUnreadCount(room.room_code) : 0;
            const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
            
            // Set the HTML content
            roomItem.innerHTML = `
                <div class="room-info">
                    <div class="room-code">${room.room_code} ${unreadBadge}</div>
                    <div class="room-visited">Last visited: ${visitedTime}</div>
                </div>
                <button class="enter-room-btn" data-room-code="${room.room_code}">Enter</button>
            `;
            
            // Add event listener to the enter button
            const enterBtn = roomItem.querySelector('.enter-room-btn');
            enterBtn.addEventListener('click', function() {
                const roomCode = this.getAttribute('data-room-code');
                enterRoom(roomCode);
            });
            
            // Add to the container
            lastVisitedRooms.appendChild(roomItem);
            
            // Subscribe to unread messages for this room (to track while on home screen)
            if (window.subscribeToUnreadMessages) {
                window.subscribeToUnreadMessages(room.room_code);
            }
        });
        
    } catch (error) {
        console.error('Error loading last visited rooms:', error);
    }
}

// Format the visited time for display
function formatVisitedTime(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const visitedDate = new Date(timestamp);
    const now = new Date();
    
    // Calculate the difference in milliseconds
    const diffMs = now - visitedDate;
    
    // Convert to minutes, hours, days
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Format based on the difference
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
        // Format as date
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return visitedDate.toLocaleDateString(undefined, options);
    }
}

// Scroll to message functionality
function scrollToMessage(messageId) {
    console.log('🎯 Scrolling to message:', messageId);
    
    try {
        // Find the message element
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (!messageElement) {
            console.warn('❌ Message not found in current view:', messageId);
            showScrollFeedback('Message not visible in current view', 'warning');
            return;
        }
        
        // Smooth scroll to message
        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        
        // Highlight the message after scrolling
        setTimeout(() => {
            highlightMessage(messageElement);
        }, 500); // Delay to let scroll animation finish
        
        console.log('✅ Scrolled to message successfully');
        
    } catch (error) {
        console.error('❌ Error scrolling to message:', error);
        showScrollFeedback('Error finding message', 'error');
    }
}

// Highlight a message with animation
function highlightMessage(messageElement) {
    if (!messageElement) return;
    
    console.log('✨ Highlighting message');
    
    // Add highlight class
    messageElement.classList.add('message-highlight');
    
    // Remove highlight class after animation
    setTimeout(() => {
        messageElement.classList.remove('message-highlight');
        console.log('✅ Message highlight removed');
    }, 2000); // Match animation duration
}

// Show feedback for scroll actions
function showScrollFeedback(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `scroll-feedback scroll-feedback-${type}`;
    feedback.textContent = message;
    
    // Style the feedback
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#57a85a'};
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        animation: feedbackSlide 3s ease-out forwards;
    `;
    
    // Add CSS animation for feedback
    const style = document.createElement('style');
    style.textContent = `
        @keyframes feedbackSlide {
            0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            15% { opacity: 1; transform: translateX(-50%) translateY(0); }
            85% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    
    if (!document.querySelector('#scroll-feedback-styles')) {
        style.id = 'scroll-feedback-styles';
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 3000);
}

// Test function for scroll navigation
function testScrollNavigation() {
    console.log('🎯 Testing scroll navigation...');
    
    // Find all messages
    const messageElements = document.querySelectorAll('.message[data-message-id]');
    if (messageElements.length === 0) {
        console.error('❌ No messages found to test with');
        return;
    }
    
    // Get a random message (but not the last one so we can see the scroll effect)
    const randomIndex = Math.floor(Math.random() * Math.max(1, messageElements.length - 1));
    const testMessage = messageElements[randomIndex];
    const messageId = testMessage.dataset.messageId;
    
    console.log('📝 Testing scroll to message:', messageId);
    
    // Scroll to bottom first to make the effect more visible
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Wait a moment, then scroll to the test message
    setTimeout(() => {
        scrollToMessage(messageId);
        console.log('✅ Scroll navigation test initiated!');
    }, 1000);
}

// Make functions globally available
window.scrollToMessage = scrollToMessage;
window.highlightMessage = highlightMessage;
window.showScrollFeedback = showScrollFeedback;
window.testScrollNavigation = testScrollNavigation;

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
