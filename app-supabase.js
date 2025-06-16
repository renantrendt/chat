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

// Image upload elements
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageFileInput = document.getElementById('image-file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const inputArea = document.querySelector('.input-area');

// Last visited rooms elements
const lastVisitedSection = document.getElementById('last-visited-section');
const lastVisitedRooms = document.getElementById('last-visited-rooms');
const noRoomsMessage = document.getElementById('no-rooms-message');

// App State
let currentUser = null;
let currentRoom = null;
let messages = [];
let messageSubscription = null;
let selectedImageFile = null;

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
        this.subscriptions.set(key, { subscription, type });
    },
    
    // Register a timer for tracking
    registerTimer(key, timerId) {
        this.timers.set(key, timerId);
    },
    
    // Register an observer for tracking
    registerObserver(key, observer) {
        this.observers.set(key, observer);
    },
    
    // Clean up all subscriptions in proper order
    async cleanupAll() {
        const errors = [];
        
        // 1. Clear all timers first (they might interfere with cleanup)
        for (const [key, timerId] of this.timers) {
            try {
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
        if (e.key === 'Enter' && (this.value.trim() !== '' || selectedImageFile)) {
            sendMessage(this.value.trim());
            this.value = '';
        }
    });
    
    // Send message button functionality
    sendMessageBtn.addEventListener('click', function() {
        if (messageInput.value.trim() !== '' || selectedImageFile) {
            sendMessage(messageInput.value.trim());
            messageInput.value = '';
            messageInput.focus();
        }
    });
    
    saveConversationBtn.addEventListener('click', saveConversation);

    // Image upload functionality
    imageUploadBtn.addEventListener('click', () => {
        imageFileInput.click();
    });

    imageFileInput.addEventListener('change', handleImageSelect);
    
    // Debug and fix the X button
    console.log('removeImageBtn element:', removeImageBtn);
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearImagePreview);
        console.log('✅ X button event listener attached');
    } else {
        console.error('❌ removeImageBtn element not found!');
    }

    // Drag and drop functionality
    inputArea.addEventListener('dragover', handleDragOver);
    inputArea.addEventListener('dragleave', handleDragLeave);
    inputArea.addEventListener('drop', handleImageDrop);
    
    // Alternative X button handler using event delegation (backup method)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'remove-image-btn') {
            console.log('🗑️ X button clicked via event delegation');
            clearImagePreview();
        }
    });
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
            
            // Clean up delete system
            if (window.cleanupDeleteSystem) {
                window.cleanupDeleteSystem();
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
    // Clear messages container
    messagesContainer.innerHTML = '';
    messages = [];
    
    try {
        // Load messages from database
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', roomCode)
            .order('timestamp', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Reverse to get chronological order
            messages = [...data.reverse()];
            
            // ===== TRUE PARALLEL LOADING - NO DELAYS =====
            // Start ALL operations simultaneously
            const parallelOperations = [];
            
            // 1. Build all message DOM elements in parallel
            const messageFragment = document.createDocumentFragment();
            const messageElementsPromise = Promise.all(
                messages.map(message => displayMessageFastToFragment(message))
            ).then(messageElements => {
                messageElements.forEach(element => messageFragment.appendChild(element));
                return messageElements;
            });
            parallelOperations.push(messageElementsPromise);
            
            // 2. Load all profiles in parallel (while DOM elements are being built)
            const uniqueSenders = [...new Set(messages.map(m => m.sender))];
            const profilesPromise = Promise.all(
                uniqueSenders.map(sender => window.getUserProfile(sender))
            ).then(profilesArray => {
                const profileCache = {};
                uniqueSenders.forEach((sender, index) => {
                    profileCache[sender] = profilesArray[index];
                });
                return profileCache;
            });
            parallelOperations.push(profilesPromise);
            
            // 3. Initialize presence system in parallel
            const presencePromise = window.initRoomPresence ? 
                Promise.resolve(window.initRoomPresence(roomCode, currentUser)) : 
                Promise.resolve();
            parallelOperations.push(presencePromise);
            
            // Wait for all parallel operations to complete
            const [messageElements, profileCache] = await Promise.all(parallelOperations);
            
            // Add all messages to DOM at once
            messagesContainer.appendChild(messageFragment);
            
            // Apply ALL enhancements immediately in parallel
            await Promise.all([
                applyProfileEnhancementsToAllMessages(messageElements, profileCache),
                applyReactionEnhancementsToAllMessages(messageElements),
                loadReplyPreviewsForAllMessages(messageElements)
            ]);
            
            // Add "Load More" button if needed
            if (data.length === 100) {
                addLoadMoreButton(roomCode);
            }
            
            scrollToBottom();
        }
        
        // Subscribe to new messages
        subscribeToMessages(roomCode);
        
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
    
    // Check if message was deleted
    const isDeleted = message.was_deleted || message.content === 'This message was deleted';
    const contentText = isDeleted ? 'This message was deleted' : message.content;
    const contentStyle = isDeleted ? 'color: #ff4444; font-style: italic;' : '';
    
    // Handle image content (fast)
    const hasImage = message.image_url && !isDeleted;
    const hasText = contentText && contentText.trim() !== '';
    
    let imageHtml = '';
    if (hasImage) {
        imageHtml = `
            <div class="message-image-container">
                <img src="${message.image_url}" alt="Shared image" class="message-image" onclick="openImageFullscreen('${message.image_url}')">
            </div>
        `;
    }
    
    // Create content HTML based on what's available
    let contentHtml = '';
    if (hasText && hasImage) {
        // Both text and image
        contentHtml = `
            <div class="message-content-with-image">
                <div class="message-text-content" style="${contentStyle}">${contentText}</div>
                ${imageHtml}
            </div>
        `;
    } else if (hasImage) {
        // Image only
        contentHtml = imageHtml;
    } else {
        // Text only (or deleted message)
        contentHtml = `<div class="content" style="${contentStyle}">${contentText}</div>`;
    }
    
    // Create basic message content first (fast)
    messageElement.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <div class="timestamp">${timestamp}</div>
                <div class="sender" style="color: #ffffff">${message.sender}</div>
            </div>
        </div>
        ${contentHtml}
    `;
    
    // Add deleted class if needed
    if (isDeleted) {
        messageElement.classList.add('deleted');
    }
    
    // Add to container immediately
    messagesContainer.appendChild(messageElement);
    
    return messageElement;
}

// Build message element for document fragment (parallel loading)
async function displayMessageFastToFragment(message) {
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
    
    // Check if message was deleted
    const isDeleted = message.was_deleted || message.content === 'This message was deleted';
    const contentText = isDeleted ? 'This message was deleted' : message.content;
    const contentStyle = isDeleted ? 'color: #ff4444; font-style: italic;' : '';
    
    // Handle image content
    const hasImage = message.image_url && !isDeleted;
    const hasText = contentText && contentText.trim() !== '';
    
    let imageHtml = '';
    if (hasImage) {
        imageHtml = `
            <div class="message-image-container">
                <img src="${message.image_url}" alt="Shared image" class="message-image" onclick="openImageFullscreen('${message.image_url}')">
            </div>
        `;
    }
    
    // Create content HTML based on what's available
    let contentHtml = '';
    if (hasText && hasImage) {
        contentHtml = `
            <div class="message-content-with-image">
                <div class="message-text-content" style="${contentStyle}">${contentText}</div>
                ${imageHtml}
            </div>
        `;
    } else if (hasImage) {
        contentHtml = imageHtml;
    } else {
        contentHtml = `<div class="content" style="${contentStyle}">${contentText}</div>`;
    }
    
    // Create message content
    messageElement.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <div class="timestamp">${timestamp}</div>
                <div class="sender" style="color: #ffffff">${message.sender}</div>
            </div>
        </div>
        ${contentHtml}
    `;
    
    // Add deleted class if needed
    if (isDeleted) {
        messageElement.classList.add('deleted');
    }
    
    return messageElement;
}

// Apply profile enhancements to all messages at once (parallel loading)
async function applyProfileEnhancementsToAllMessages(messageElements, profileCache) {
    await Promise.all(messageElements.map(async (messageElement) => {
        const sender = messageElement.dataset.sender;
        const profile = profileCache[sender];
        if (!profile) return;
        
        // Update sender styling with colors and VIP status
        const senderElement = messageElement.querySelector('.sender');
        if (senderElement) {
            senderElement.style.color = profile.color;
            if (profile.isVIP) {
                senderElement.classList.add('vip-user');
            }
        }
        
        // Add profile image
        if (profile.image) {
            const messageHeader = messageElement.querySelector('.message-header');
            if (messageHeader && !messageHeader.querySelector('.message-profile-img')) {
                const profileImg = document.createElement('img');
                profileImg.src = profile.image;
                profileImg.alt = sender;
                profileImg.className = 'message-profile-img';
                messageHeader.insertBefore(profileImg, messageHeader.firstChild);
            }
        }
    }));
}

// Apply reaction enhancements to all messages at once (parallel loading)
async function applyReactionEnhancementsToAllMessages(messageElements) {
    await Promise.all(messageElements.map(async (messageElement) => {
        const messageId = messageElement.dataset.messageId;
        const messageData = messages.find(m => m.id === messageId);
        if (!messageData) return;
        
        // Add reaction arrow
        if (window.addReactionArrowToMessage) {
            window.addReactionArrowToMessage(messageElement, messageId);
        }
        
        // Don't add buttons to deleted messages
        const isDeleted = messageData.was_deleted || messageData.content === 'This message was deleted';
        
        if (!isDeleted) {
            // Add delete trash can for own recent messages
            if (window.addDeleteTrashCan && messageData.sender === currentUser) {
                window.addDeleteTrashCan(messageElement, messageData);
            }
            
            // Add message status for sent messages
            if (messageData.sender === currentUser && messageData.status && window.addMessageStatus) {
                window.addMessageStatus(messageElement, messageData.status);
            }
        }
        
        // Add visibility observer for read status
        if (window.visibilityObserver && messageData.sender !== currentUser) {
            window.visibilityObserver.observe(messageElement);
        }
    }));
    
    // Load actual reactions for all messages at once
    if (window.loadAllReactions) {
        window.loadAllReactions();
    }
}

// Load reply previews for all messages at once (parallel loading)
async function loadReplyPreviewsForAllMessages(messageElements) {
    const replyMessages = messages.filter(m => m.reply_to_message_id);
    if (replyMessages.length === 0) return;
    
    await Promise.all(replyMessages.map(async (messageData) => {
        const messageElement = messageElements.find(el => el.dataset.messageId === messageData.id);
        if (messageElement && messageData.reply_to_message_id) {
            const replyPreviewHtml = await createReplyPreviewForMessage(messageData.reply_to_message_id);
            if (replyPreviewHtml) {
                messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml);
            }
        }
    }));
}

// Load profile enhancements (legacy function - now uses parallel loading)
async function loadProfileEnhancements() {
    try {
        const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
        const uniqueSenders = [...new Set(messageElements.map(el => el.dataset.sender))];
        
        // Load all profiles in parallel
        const profilePromises = uniqueSenders.map(sender => window.getUserProfile(sender));
        const profilesArray = await Promise.all(profilePromises);
        
        // Create profile cache
        const profileCache = {};
        uniqueSenders.forEach((sender, index) => {
            profileCache[sender] = profilesArray[index];
        });
        
        // Apply enhancements using the new parallel function
        await applyProfileEnhancementsToAllMessages(messageElements, profileCache);
        
        // Load reply previews immediately (no delay)
        await loadReplyPreviews();
        
    } catch (error) {
        console.error('❌ Error loading profile enhancements:', error);
    }
}

// Load reaction enhancements (legacy function - now uses parallel loading)
async function loadReactionEnhancements() {
    try {
        const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
        
        // Apply enhancements using the new parallel function
        await applyReactionEnhancementsToAllMessages(messageElements);
        
    } catch (error) {
        console.error('❌ Error loading reaction enhancements:', error);
    }
}

// Load reply previews (legacy function - now uses parallel loading)
async function loadReplyPreviews() {
    const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
    await loadReplyPreviewsForAllMessages(messageElements);
}

// Load all message enhancements in parallel (legacy function - no delays)
async function loadMessageEnhancements() {
    // Load all enhancements in parallel instead of with delays
    await Promise.all([
        loadProfileEnhancements(),
        loadReactionEnhancements()
    ]);
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
            
            // Load enhancements for older messages in parallel
            await Promise.all([
                loadProfileEnhancementsForRange(0, olderMessages.length),
                loadReactionEnhancementsForRange(0, olderMessages.length)
            ]);
            
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

// Load profile enhancements for a specific range (for Load More)
async function loadProfileEnhancementsForRange(startIndex, count) {
    try {
        const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]')).slice(startIndex, startIndex + count);
        
        // Pre-load all profile data for this range in parallel
        const uniqueSenders = [...new Set(messageElements.map(el => el.dataset.sender))];
        const profilePromises = uniqueSenders.map(sender => window.getUserProfile(sender));
        const profilesArray = await Promise.all(profilePromises);
        
        // Create profile cache
        const profileCache = {};
        uniqueSenders.forEach((sender, index) => {
            profileCache[sender] = profilesArray[index];
        });
        
        // Apply profile enhancements in parallel
        await Promise.all(messageElements.map(async (messageElement) => {
            const sender = messageElement.dataset.sender;
            const profile = profileCache[sender];
            if (!profile) return;
            
            // Update sender styling
            const senderElement = messageElement.querySelector('.sender');
            if (senderElement) {
                senderElement.style.color = profile.color;
                if (profile.isVIP) {
                    senderElement.classList.add('vip-user');
                }
            }
            
            // Add profile image
            if (profile.image) {
                const messageHeader = messageElement.querySelector('.message-header');
                if (messageHeader && !messageHeader.querySelector('.message-profile-img')) {
                    const profileImg = document.createElement('img');
                    profileImg.src = profile.image;
                    profileImg.alt = sender;
                    profileImg.className = 'message-profile-img';
                    messageHeader.insertBefore(profileImg, messageHeader.firstChild);
                }
            }
        }));
        
        // Load reply previews for this range immediately
        const replyMessages = messageElements
            .map(el => messages.find(m => m.id === el.dataset.messageId))
            .filter(m => m && m.reply_to_message_id);
        
        if (replyMessages.length > 0) {
            await Promise.all(replyMessages.map(async (messageData) => {
                const messageElement = document.querySelector(`[data-message-id="${messageData.id}"]`);
                if (messageElement && messageData.reply_to_message_id) {
                    const replyPreviewHtml = await createReplyPreviewForMessage(messageData.reply_to_message_id);
                    if (replyPreviewHtml) {
                        messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml);
                    }
                }
            }));
        }
        
    } catch (error) {
        console.error('❌ Error loading profile enhancements for range:', error);
    }
}

// Load reaction enhancements for a specific range (for Load More)
async function loadReactionEnhancementsForRange(startIndex, count) {
    try {
        const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]')).slice(startIndex, startIndex + count);
        
        // Apply reaction enhancements in parallel
        await Promise.all(messageElements.map(async (messageElement) => {
            const messageId = messageElement.dataset.messageId;
            const messageData = messages.find(m => m.id === messageId);
            if (!messageData) return;
            
            // Add reaction arrow
            if (window.addReactionArrowToMessage) {
                window.addReactionArrowToMessage(messageElement, messageId);
            }
            
            // Don't add enhancements to deleted messages
            const isDeleted = messageData.was_deleted || messageData.content === 'This message was deleted';
            
            if (!isDeleted) {
                // Add delete trash can for own recent messages
                if (window.addDeleteTrashCan && messageData.sender === currentUser) {
                    window.addDeleteTrashCan(messageElement, messageData);
                }
            }
        }));
        
    } catch (error) {
        console.error('❌ Error loading reaction enhancements for range:', error);
    }
}

// Load all enhancements for a range in parallel (legacy function - no delays)
async function loadMessageEnhancementsForRange(startIndex, count) {
    // Load all enhancements in parallel instead of with delays
    await Promise.all([
        loadProfileEnhancementsForRange(startIndex, count),
        loadReactionEnhancementsForRange(startIndex, count)
    ]);
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
                
                // Verify we're still in the same room
                if (currentRoom !== roomCode) {
                    return;
                }
                
                // Only process if it's not already in our messages array
                if (!messages.some(m => m.id === newMessage.id)) {
                    // Just append new messages (they should be newest)
                    messages.push(newMessage);
                    
                    // Use FAST display for immediate appearance
                    const messageElement = await displayMessageFast(newMessage);
                    scrollToBottom();
                    
                    // PARALLEL LOADING for real-time messages - no delays!
                    const messageId = newMessage.id;
                    const sender = newMessage.sender;
                    
                    // Apply ALL enhancements immediately in parallel
                    const profile = await window.getUserProfile(sender);
                    
                    // Apply profile enhancements immediately
                    if (profile) {
                        const senderElement = messageElement.querySelector('.sender');
                        if (senderElement) {
                            senderElement.style.color = profile.color;
                            if (profile.isVIP) {
                                senderElement.classList.add('vip-user');
                            }
                        }
                        
                        // Add profile image
                        if (profile.image) {
                            const messageHeader = messageElement.querySelector('.message-header');
                            if (messageHeader && !messageHeader.querySelector('.message-profile-img')) {
                                const profileImg = document.createElement('img');
                                profileImg.src = profile.image;
                                profileImg.alt = sender;
                                profileImg.className = 'message-profile-img';
                                messageHeader.insertBefore(profileImg, messageHeader.firstChild);
                            }
                        }
                    }
                    
                    // Apply reaction and reply enhancements immediately
                    await Promise.all([
                        // Add reaction arrow
                        window.addReactionArrowToMessage ? 
                            Promise.resolve(window.addReactionArrowToMessage(messageElement, messageId)) : 
                            Promise.resolve(),
                        
                        // Add reply preview if needed
                        newMessage.reply_to_message_id ? 
                            createReplyPreviewForMessage(newMessage.reply_to_message_id).then(replyPreviewHtml => {
                                if (replyPreviewHtml) {
                                    messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml);
                                }
                            }) : 
                            Promise.resolve()
                    ]);
                    
                    // Add other enhancements for own messages
                    if (newMessage.sender === currentUser) {
                        if (window.addDeleteTrashCan && !(newMessage.was_deleted || newMessage.content === 'This message was deleted')) {
                            window.addDeleteTrashCan(messageElement, newMessage);
                        }
                        if (newMessage.status && window.addMessageStatus) {
                            window.addMessageStatus(messageElement, newMessage.status);
                        }
                    }
                    
                    // Add visibility observer for read status
                    if (window.visibilityObserver && newMessage.sender !== currentUser) {
                        window.visibilityObserver.observe(messageElement);
                    }
                }
            }
        )
        .subscribe();
    
    // Register with subscription manager
    subscriptionManager.register('messages', messageSubscription, 'message-updates');
}

// Image handling functions
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (validateImageFile(file)) {
            displayImagePreview(file);
            selectedImageFile = file;
        }
    }
}

function handleDragOver(event) {
    event.preventDefault();
    inputArea.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    inputArea.classList.remove('drag-over');
}

function handleImageDrop(event) {
    event.preventDefault();
    inputArea.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (validateImageFile(file)) {
            displayImagePreview(file);
            selectedImageFile = file;
        }
    }
}

function validateImageFile(file) {
    // Check file type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, or GIF)');
        return false;
    }
    
    // Check file size (8MB = 8 * 1024 * 1024 bytes)
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Image size must be less than 8MB');
        return false;
    }
    
    return true;
}

function displayImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        imagePreview.src = e.target.result;
        imagePreviewContainer.style.display = 'block';
        messageInput.placeholder = 'Add a caption (optional)...';
    };
    reader.readAsDataURL(file);
}

function clearImagePreview() {
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '';
    selectedImageFile = null;
    imageFileInput.value = '';
    messageInput.placeholder = 'Type a message...';
}

async function uploadImageToSupabase(file) {
    if (!file) return null;
    
    try {
        // Convert image to base64 (same as profile system)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                resolve(e.target.result); // This is the base64 data URL
            };
            reader.onerror = function(error) {
                console.error('Error converting image to base64:', error);
                reject(error);
            };
            reader.readAsDataURL(file);
        });
        
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Failed to process image. Please try again.');
        return null;
    }
}

async function sendMessage(content) {
    if (!currentRoom || !currentUser || (!content && !selectedImageFile)) return;
    
    try {
        let imageUrl = null;
        
        // Convert image to base64 if selected
        if (selectedImageFile) {
            imageUrl = await uploadImageToSupabase(selectedImageFile);
            if (!imageUrl) {
                return; // Image processing failed, don't send message
            }
        }
        
        // Create message object with status
        const message = {
            room_code: currentRoom,
            sender: currentUser,
            content: content || '', // Allow empty content if there's an image
            image_url: imageUrl,
            timestamp: new Date().toISOString(),
            status: 'sent' // Add default status
        };
        
        // Add reply_to_message_id if in reply mode
        if (window.currentReplyMessageId) {
            message.reply_to_message_id = window.currentReplyMessageId;
        }
        
        // Insert into Supabase
        const { data, error } = await window.supabaseClient
            .from('messages')
            .insert([message])
            .select();
        
        if (error) throw error;
        
        // Clear reply state after sending
        if (window.currentReplyMessageId) {
            if (window.hideReplyPreview) {
                window.hideReplyPreview();
            }
            if (window.cancelReply) {
                window.cancelReply();
            }
        }
        
        // Let the real-time subscription handle displaying the message
        // This ensures proper chronological ordering and prevents duplicates
        
        // Clear input and image preview
        messageInput.value = '';
        clearImagePreview();
        
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
        // Try to get original message from database
        const { data: originalMessage, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('id', originalMessageId)
            .single();
        
        if (error || !originalMessage) {
            return `<div class="message-reply-preview deleted">
                <span class="reply-icon">↩️</span>
                <span class="original-message-deleted" style="color: #ff4444; font-style: italic;">This message was deleted</span>
            </div>`;
        }
        
        // Check if the message is marked as deleted
        if (originalMessage.was_deleted || originalMessage.content === 'This message was deleted') {
            return `<div class="message-reply-preview deleted">
                <span class="reply-icon">↩️</span>
                <span class="original-message-deleted" style="color: #ff4444; font-style: italic;">This message was deleted</span>
            </div>`;
        }
        
        // Truncate content for preview
        const truncatedContent = window.truncateMessageForPreview ? 
            window.truncateMessageForPreview(originalMessage.content) : 
            originalMessage.content.substring(0, 80) + '...';
        
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
    
    // Check if message was deleted
    const isDeleted = message.was_deleted || message.content === 'This message was deleted';
    const contentText = isDeleted ? 'This message was deleted' : message.content;
    const contentStyle = isDeleted ? 'color: #ff4444; font-style: italic;' : '';
    
    // Handle image content
    const hasImage = message.image_url && !isDeleted;
    const hasText = contentText && contentText.trim() !== '';
    
    let imageHtml = '';
    if (hasImage) {
        imageHtml = `
            <div class="message-image-container">
                <img src="${message.image_url}" alt="Shared image" class="message-image" onclick="openImageFullscreen('${message.image_url}')">
            </div>
        `;
    }

    // Check if this is a reply message and create reply preview
    let replyPreviewHtml = '';
    if (message.reply_to_message_id) {
        replyPreviewHtml = await createReplyPreviewForMessage(message.reply_to_message_id);
    }
    
    // Create message content with timestamp
    let contentHtml = '';
    if (hasText && hasImage) {
        // Both text and image
        contentHtml = `
            <div class="message-content-with-image">
                <div class="message-text-content" style="${contentStyle}">${contentText}</div>
                ${imageHtml}
            </div>
        `;
    } else if (hasImage) {
        // Image only
        contentHtml = imageHtml;
    } else {
        // Text only (or deleted message)
        contentHtml = `<div class="content" style="${contentStyle}">${contentText}</div>`;
    }
    
    messageElement.innerHTML = `
        ${replyPreviewHtml}
        <div class="message-header">
            ${profileImageHtml}
            <div class="message-info">
                <div class="timestamp">${timestamp}</div>
                <div class="sender ${vipClass}" style="color: ${profile.color}">${message.sender}</div>
            </div>
        </div>
        ${contentHtml}
    `;
    
    // Add deleted class if needed
    if (isDeleted) {
        messageElement.classList.add('deleted');
    }
    
    // Add status for sent messages
    if (message.sender === currentUser && message.status && window.addMessageStatus) {
        window.addMessageStatus(messageElement, message.status);
    }
    
    // Add to container
    messagesContainer.appendChild(messageElement);
    
    // Add reaction arrow and functionality
    if (window.addReactionArrowToMessage) {
        window.addReactionArrowToMessage(messageElement, message.id);
    }
    
    // Add delete trash can for own recent messages (only if not deleted)
    if (!isDeleted && window.addDeleteTrashCan && message.sender === currentUser) {
        window.addDeleteTrashCan(messageElement, message);
    }
    
    // Observe this message for read status (if not sent by current user)
    if (window.visibilityObserver && message.sender !== currentUser) {
        window.visibilityObserver.observe(messageElement);
    }
    
    // Scroll to bottom
    scrollToBottom();
}

// Open image in fullscreen
function openImageFullscreen(imageUrl) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    
    overlay.appendChild(img);
    
    // Close on click
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    document.body.appendChild(overlay);
}

// Make function globally accessible
window.openImageFullscreen = openImageFullscreen;

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
    try {
        // Find the message element
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (!messageElement) {
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
        
    } catch (error) {
        console.error('❌ Error scrolling to message:', error);
        showScrollFeedback('Error finding message', 'error');
    }
}

// Highlight a message with animation
function highlightMessage(messageElement) {
    if (!messageElement) return;
    
    // Add highlight class
    messageElement.classList.add('message-highlight');
    
    // Remove highlight class after animation
    setTimeout(() => {
        messageElement.classList.remove('message-highlight');
    }, 2000); // Match animation duration
}

// Show feedback for scroll actions
function showScrollFeedback(message, type = 'info') {
    
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
    
    // Scroll to bottom first to make the effect more visible
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Wait a moment, then scroll to the test message
    setTimeout(() => {
        scrollToMessage(messageId);
    }, 1000);
}

// Make functions globally available
window.scrollToMessage = scrollToMessage;
window.highlightMessage = highlightMessage;
window.showScrollFeedback = showScrollFeedback;
window.testScrollNavigation = testScrollNavigation;

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
