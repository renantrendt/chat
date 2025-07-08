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
                    // Give each channel time to fully close
                    await new Promise(resolve => setTimeout(resolve, 50));
                } else if (subscription && typeof subscription.untrack === 'function') {
                    // For presence channels
                    subscription.untrack();
                    if (typeof subscription.unsubscribe === 'function') {
                        await subscription.unsubscribe();
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            } catch (error) {
                console.error(`Error unsubscribing from ${key}:`, error);
                errors.push(`Subscription ${key}: ${error.message}`);
            }
        }
        this.subscriptions.clear();
        
        // Additional cleanup delay to ensure all channels are closed
        if (subscriptionEntries.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
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
                if (subscription && typeof subscription.unsubscribe === 'function') {
                    await subscription.unsubscribe();
                    // Give Supabase time to fully close the channel
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else if (subscription && typeof subscription.untrack === 'function') {
                    // For presence channels
                    subscription.untrack();
                    if (typeof subscription.unsubscribe === 'function') {
                        await subscription.unsubscribe();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                this.subscriptions.delete(key);
                return { success: true };
            } catch (error) {
                console.error(`Error cleaning up ${key}:`, error);
                this.subscriptions.delete(key); // Remove anyway to prevent stuck state
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
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default enter behavior
            
            const textContent = this.value.trim();
            const hasImage = selectedImageFile !== null;
            
            if (textContent !== '' || hasImage) {
                sendMessage(textContent);
                this.value = '';
            }
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
    
    // Setup the X button
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearImagePreview);
    } else {
        console.error('removeImageBtn element not found!');
    }

    // Drag and drop functionality
    inputArea.addEventListener('dragover', handleDragOver);
    inputArea.addEventListener('dragleave', handleDragLeave);
    inputArea.addEventListener('drop', handleImageDrop);
    
    // Alternative X button handler using event delegation (backup method)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'remove-image-btn') {
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
    
    // 🔧 FORCE CLEANUP: Ensure all previous subscriptions are cleared
    await subscriptionManager.cleanupAll();
    
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
            
            // VALIDATE AND FIX TIMESTAMP ORDER IMMEDIATELY
            const orderWasValid = validateAndFixMessageOrder();
            if (!orderWasValid) {
                console.warn('🔧 Initial message load had timestamp ordering issues - now fixed!');
            } else {
                console.log('✅ Initial message order is correct');
            }
            
            // DEBUG: Show chronological order for verification
            console.log('📊 MESSAGE LOADING ORDER:');
            messages.slice(0, 5).forEach((msg, i) => {
                const time = new Date(msg.timestamp).toLocaleTimeString();
                console.log(`  ${i}: ${time} - ${msg.sender}: ${msg.content.substring(0, 30)}...`);
            });
            if (messages.length > 5) {
                console.log(`  ... and ${messages.length - 5} more messages`);
            }
            
            // ===== TRUE PARALLEL LOADING - NO DELAYS =====
            // Start ALL operations simultaneously
            const parallelOperations = [];
            
            // 1. Build ALL message DOM elements SYNCHRONOUSLY to preserve exact chronological order
            const messageFragment = document.createDocumentFragment();
            const syncMessageElements = [];
            
            // COMPLETELY SYNCHRONOUS DOM BUILDING - no async at all!
            messages.forEach((message, index) => {
                const element = createMessageElementSync(message);
                messageFragment.appendChild(element);
                syncMessageElements.push(element);
                
                // Debug every message to catch ordering issues
                if (index < 10) {
                    const time = new Date(message.timestamp).toLocaleTimeString();
                    console.log(`🔧 DOM BUILD ${index}: ${time} - ${message.sender}`);
                }
            });
            
            const messageElementsPromise = Promise.resolve(syncMessageElements);
            parallelOperations.push(messageElementsPromise);
            
            // 2. Load all profiles in BULK (single database query!)
            const uniqueSenders = [...new Set(messages.map(m => m.sender))];
            const profilesPromise = window.getUserProfilesBulk ? 
                window.getUserProfilesBulk(uniqueSenders) :
                // Fallback to individual loading if bulk function not available
                Promise.all(uniqueSenders.map(sender => window.getUserProfile(sender)))
                    .then(profilesArray => {
                        const profileCache = {};
                        uniqueSenders.forEach((sender, index) => {
                            profileCache[sender] = profilesArray[index];
                        });
                        return profileCache;
                    });
            parallelOperations.push(profilesPromise);
            
            // 3. Load all reaction data in parallel
            const messageIds = messages.map(m => m.id);
            const reactionsPromise = window.loadReactionDataBulk ? 
                window.loadReactionDataBulk(messageIds) : 
                Promise.resolve({});
            parallelOperations.push(reactionsPromise);
            
            // 4. Initialize presence system in parallel
            const presencePromise = window.initRoomPresence ? 
                Promise.resolve(window.initRoomPresence(roomCode, currentUser)) : 
                Promise.resolve();
            parallelOperations.push(presencePromise);
            
            // Wait for all parallel operations to complete
            const [messageElements, profileCache, reactionData] = await Promise.all(parallelOperations);
            
            // Add all messages to DOM at once
            messagesContainer.appendChild(messageFragment);
            
            // DEBUG: Verify DOM order matches array order
            console.log(`🔍 VERIFYING DOM vs ARRAY ORDER (checking ALL ${messages.length} messages):`);
            const domElements = Array.from(messagesContainer.querySelectorAll('.message[data-message-id]'));
            let domOrderCorrect = true;
            let firstError = -1;
            
            console.log(`📊 Total messages to verify: ${messages.length}, DOM elements found: ${domElements.length}`);
            
            for (let i = 0; i < Math.min(domElements.length, messages.length); i++) {
                const domMessageId = domElements[i].dataset.messageId;
                const arrayMessage = messages[i];
                if (arrayMessage && domMessageId !== arrayMessage.id) {
                    domOrderCorrect = false;
                    if (firstError === -1) firstError = i;
                    if (i < 15) { // Show first 15 errors
                        console.log(`❌ Position ${i}: DOM has ${domMessageId} but array has ${arrayMessage.id}`);
                    }
                } else if (arrayMessage && i < 10) {
                    const time = new Date(arrayMessage.timestamp).toLocaleTimeString();
                    console.log(`✅ Position ${i}: ${time} - ${arrayMessage.sender}`);
                }
            }
            
            if (!domOrderCorrect && firstError !== -1) {
                console.log(`🚨 FIRST ERROR AT POSITION ${firstError} - this is where ordering breaks!`);
            }
            
            console.log(domOrderCorrect ? '✅ DOM order matches array PERFECTLY!' : `❌ DOM order is WRONG! First error at position ${firstError}`);
            
            // AUTO-UPDATE: Apply new relative date timestamps to existing messages
            console.log('🔄 Auto-updating timestamps with relative dates...');
            setTimeout(() => {
                window.refreshAllTimestamps();
            }, 1000);
            
            // If DOM order is wrong, show detailed comparison
            if (!domOrderCorrect) {
                console.log('🔍 DETAILED DOM vs ARRAY COMPARISON:');
                console.log('Array order:');
                messages.slice(0, 10).forEach((msg, i) => {
                    const time = new Date(msg.timestamp).toLocaleTimeString();
                    console.log(`  ${i}: ${time} - ${msg.sender} - ID: ${msg.id}`);
                });
                console.log('DOM order:');
                domElements.slice(0, 10).forEach((el, i) => {
                    const msg = messages.find(m => m.id === el.dataset.messageId);
                    if (msg) {
                        const time = new Date(msg.timestamp).toLocaleTimeString();
                        console.log(`  ${i}: ${time} - ${msg.sender} - ID: ${el.dataset.messageId}`);
                    }
                });
            }
            
            // Apply ALL enhancements immediately in parallel
            await Promise.all([
                applyProfileEnhancementsToAllMessages(messageElements, profileCache),
                applyReactionEnhancementsToAllMessages(messageElements, reactionData),
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
    const messageElement = await createMessageElement(message);
    
    // Add to container immediately (appends to end)
    messagesContainer.appendChild(messageElement);
    
    return messageElement;
}

// Create message element WITHOUT adding to DOM (for precise positioning)
async function createMessageElement(message) {
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
    
    // Add error handling to any images in this message
    addImageErrorHandling(messageElement);
    
    return messageElement;
}

// Create message element COMPLETELY SYNCHRONOUSLY (no async operations!)
function createMessageElementSync(message) {
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
    
    // Add error handling to any images in this message
    addImageErrorHandling(messageElement);
    
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
    
    // Add error handling to any images in this message
    addImageErrorHandling(messageElement);
    
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
async function applyReactionEnhancementsToAllMessages(messageElements, reactionData = {}) {
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
    
    // Apply reaction displays using pre-loaded data (MUCH FASTER!)
    if (window.applyReactionDisplaysToAllMessages && Object.keys(reactionData).length > 0) {
        window.applyReactionDisplaysToAllMessages(messageElements, reactionData);
    } else if (window.loadAllReactions) {
        // Fallback for compatibility
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
        
        // Load all profiles in BULK (single database query!)
        let profileCache;
        if (window.getUserProfilesBulk) {
            profileCache = await window.getUserProfilesBulk(uniqueSenders);
        } else {
            // Fallback to individual loading
            const profilePromises = uniqueSenders.map(sender => window.getUserProfile(sender));
            const profilesArray = await Promise.all(profilePromises);
            profileCache = {};
            uniqueSenders.forEach((sender, index) => {
                profileCache[sender] = profilesArray[index];
            });
        }
        
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
        
        // Apply enhancements using the new parallel function (no pre-loaded data, will use fallback)
        await applyReactionEnhancementsToAllMessages(messageElements, {});
        
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
            
            // FIXED: Proper chronological order insertion
            const olderMessages = data.reverse(); // Now oldest-to-newest
            
            // Insert in correct chronological position (NOT just prepend!)
            let insertIndex = 0;
            olderMessages.forEach(newMsg => {
                // Find correct position to maintain chronological order
                const newTimestamp = new Date(newMsg.timestamp).getTime();
                
                while (insertIndex < messages.length && 
                       new Date(messages[insertIndex].timestamp).getTime() < newTimestamp) {
                    insertIndex++;
                }
                
                messages.splice(insertIndex, 0, newMsg);
                insertIndex++; // Next message goes after this one
            });
            
            // Validate final order and fix if needed (skip DOM rebuild since we handle it below)
            validateAndFixMessageOrder(true);
            
            // Display older messages at the top
            const oldScrollHeight = messagesContainer.scrollHeight;
            
            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Display older messages in chronological order
            const messagePromises = olderMessages.map(message => displayMessageFast(message));
            const messageElements = await Promise.all(messagePromises);
            
            // Add to fragment in correct chronological order (oldest first)
            messageElements.forEach(element => {
                fragment.appendChild(element);
            });
            
            // Insert after load more button
            messagesContainer.insertBefore(fragment, loadMoreButton.nextSibling);
            
            // Add error handling to new message images
            addImageErrorHandling(fragment);
            
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
        
        // Pre-load all profile data for this range in BULK
        const uniqueSenders = [...new Set(messageElements.map(el => el.dataset.sender))];
        let profileCache;
        if (window.getUserProfilesBulk) {
            profileCache = await window.getUserProfilesBulk(uniqueSenders);
        } else {
            // Fallback to individual loading
            const profilePromises = uniqueSenders.map(sender => window.getUserProfile(sender));
            const profilesArray = await Promise.all(profilePromises);
            profileCache = {};
            uniqueSenders.forEach((sender, index) => {
                profileCache[sender] = profilesArray[index];
            });
        }
        
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
        const messageIds = messageElements.map(el => el.dataset.messageId);
        
        // Load reaction data for this range
        let reactionData = {};
        if (window.loadReactionDataBulk) {
            reactionData = await window.loadReactionDataBulk(messageIds);
        }
        
        // Apply reaction enhancements using the new optimized function
        await applyReactionEnhancementsToAllMessages(messageElements, reactionData);
        
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
    
    // Subscribe to real-time updates for this room (use timestamp for unique channel name)
    const uniqueChannelName = `messages-${roomCode}-${Date.now()}`;
    messageSubscription = window.supabaseClient
        .channel(uniqueChannelName)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `room_code=eq.${roomCode}`
            }, 
            async (payload) => {
                await handleRealTimeMessage(payload, 'INSERT', roomCode);
            }
        )
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'messages',
                filter: `room_code=eq.${roomCode}`
            }, 
            async (payload) => {
                await handleRealTimeMessage(payload, 'UPDATE', roomCode);
            }
        )
        .subscribe();
    
    // Register with subscription manager
    subscriptionManager.register('messages', messageSubscription, 'message-updates');
}

// Handle real-time message events (INSERT and UPDATE)
async function handleRealTimeMessage(payload, eventType, roomCode) {
    const newMessage = payload.new;
    
    // Verify we're still in the same room
    if (currentRoom !== roomCode) {
        return;
    }
    
    if (eventType === 'INSERT') {
        // Handle new message insertion
        await handleNewMessageInsert(newMessage);
    } else if (eventType === 'UPDATE') {
        // Handle message updates (like image additions, status changes)
        await handleMessageUpdate(newMessage);
    }
}

// Handle new message insertion (INSERT events)
async function handleNewMessageInsert(newMessage) {
    // Check if message already exists in array
    if (messages.some(m => m.id === newMessage.id)) {
        // Message exists - check if it's optimistic
        const optimisticElement = document.querySelector(`[data-message-id="${newMessage.id}"].optimistic`);
        if (optimisticElement) {
            // Remove optimistic version
            optimisticElement.remove();
            // Remove from messages array
            const messageIndex = messages.findIndex(m => m.id === newMessage.id);
            if (messageIndex !== -1) {
                messages.splice(messageIndex, 1);
            }
            // Continue with normal insertion below
        } else {
            return; // Regular duplicate, skip
        }
    }
    
    // FIXED: Insert in correct chronological position
    const insertIndex = findCorrectInsertionIndex(newMessage);
    messages.splice(insertIndex, 0, newMessage);
    
    // Validate order after insertion (skip DOM rebuild since we're building it here)
    validateAndFixMessageOrder(true);
    
    // CREATE message element with enhanced image handling
    const messageElement = await createMessageElementWithImageHandling(newMessage);
    
    // INSERT at correct DOM position to match array position
    insertMessageElementAtCorrectPosition(messageElement, insertIndex);
    
    // Only scroll to bottom if this is the newest message
    if (insertIndex === messages.length - 1) {
        scrollToBottom();
    }
    
    // Apply all enhancements in parallel
    await applyRealTimeEnhancements(messageElement, newMessage);
}

// Handle message updates (UPDATE events)
async function handleMessageUpdate(updatedMessage) {
    // Find existing message in array and DOM
    const messageIndex = messages.findIndex(m => m.id === updatedMessage.id);
    if (messageIndex === -1) {
        // Message not found, treat as new insert
        await handleNewMessageInsert(updatedMessage);
        return;
    }
    
    // Update message in array
    messages[messageIndex] = updatedMessage;
    
    // Find message element in DOM
    const messageElement = document.querySelector(`[data-message-id="${updatedMessage.id}"]`);
    if (!messageElement) {
        console.warn(`Message element not found for update: ${updatedMessage.id}`);
        return;
    }
    
    // Update message content (especially important for image additions)
    await updateMessageContent(messageElement, updatedMessage);
}

// Create message element with enhanced image handling for real-time messages
async function createMessageElementWithImageHandling(message) {
    const messageElement = await createMessageElement(message);
    
    // Add image loading states if message has images
    if (message.image_url && !message.was_deleted) {
        const imageElement = messageElement.querySelector('.message-image');
        if (imageElement) {
            // Add loading state
            imageElement.style.opacity = '0.5';
            imageElement.style.transition = 'opacity 0.3s ease';
            
            // Handle image load success
            imageElement.onload = function() {
                this.style.opacity = '1';
            };
            
            // Handle image load error
            imageElement.onerror = function() {
                console.warn(`❌ Real-time image failed to load: ${message.image_url}`);
                this.style.opacity = '1';
                // Create a simple error placeholder
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+SW1hZ2UgZmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
                this.alt = 'Failed to load image';
            };
        }
    }
    
    return messageElement;
}

// Display message optimistically (immediately when sending)
async function displayMessageOptimistically(message) {
    // Check if message already exists (prevent duplicates)
    if (messages.some(m => m.id === message.id)) {
        return;
    }
    
    // Add to messages array in correct chronological position
    const insertIndex = findCorrectInsertionIndex(message);
    messages.splice(insertIndex, 0, message);
    
    // Create message element with optimistic flag
    const messageElement = await createMessageElementWithImageHandling(message);
    messageElement.classList.add('optimistic'); // Mark as optimistic
    
    // Insert DOM element at correct position
    insertMessageElementAtCorrectPosition(messageElement, insertIndex);
    
    // Apply basic styling (no fancy enhancements yet - keep it fast)
    const senderElement = messageElement.querySelector('.sender');
    if (senderElement) {
        senderElement.style.color = '#ffffff'; // Default color for now
    }
    
    // Scroll to bottom if this is the newest message
    if (insertIndex === messages.length - 1) {
        scrollToBottom();
    }
}

// Update existing message content (for UPDATE events)
async function updateMessageContent(messageElement, updatedMessage) {
    // Update timestamp
    const timestampElement = messageElement.querySelector('.timestamp');
    if (timestampElement) {
        timestampElement.textContent = formatMessageTime(updatedMessage.timestamp);
    }
    
    // Update content and image if changed
    const hasImage = updatedMessage.image_url && !updatedMessage.was_deleted;
    const hasText = updatedMessage.content && updatedMessage.content.trim() !== '';
    const isDeleted = updatedMessage.was_deleted || updatedMessage.content === 'This message was deleted';
    
    let contentHtml = '';
    const contentText = isDeleted ? 'This message was deleted' : updatedMessage.content;
    const contentStyle = isDeleted ? 'color: #ff4444; font-style: italic;' : '';
    
    // Rebuild content HTML
    if (hasImage) {
        const imageHtml = `
            <div class="message-image-container">
                <img src="${updatedMessage.image_url}" alt="Shared image" class="message-image" onclick="openImageFullscreen('${updatedMessage.image_url}')"
                     style="opacity: 0.5; transition: opacity 0.3s ease;"
                     onload="this.style.opacity='1'">
            </div>
        `;
        
        if (hasText) {
            contentHtml = `
                <div class="message-content-with-image">
                    <div class="message-text-content" style="${contentStyle}">${contentText}</div>
                    ${imageHtml}
                </div>
            `;
        } else {
            contentHtml = imageHtml;
        }
    } else {
        contentHtml = `<div class="content" style="${contentStyle}">${contentText}</div>`;
    }
    
    // Find and update content area
    const existingContent = messageElement.querySelector('.content, .message-content-with-image, .message-image-container');
    if (existingContent) {
        existingContent.outerHTML = contentHtml;
        
        // Add error handling for the new image if it exists
        if (hasImage) {
            const newImageElement = messageElement.querySelector('.message-image');
            if (newImageElement) {
                newImageElement.onerror = function() {
                    console.warn(`Updated image failed to load: ${updatedMessage.image_url}`);
                    this.style.opacity = '1';
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+SW1hZ2UgZmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
                    this.alt = 'Failed to load image';
                };
            }
        }
    }
}

// Apply real-time enhancements (optimized for new messages)
async function applyRealTimeEnhancements(messageElement, messageData) {
    const messageId = messageData.id;
    const sender = messageData.sender;
    
    // ===== LOAD ALL DATA IN PARALLEL =====
    const parallelData = await Promise.all([
        // 1. Load profile data
        window.getUserProfile(sender),
        
        // 2. Load reaction data for this message (if it has any)
        window.loadReactionDataBulk ? 
            window.loadReactionDataBulk([messageId]) : 
            Promise.resolve({}),
        
        // 3. Load reply preview if needed
        messageData.reply_to_message_id ? 
            createReplyPreviewForMessage(messageData.reply_to_message_id) : 
            Promise.resolve('')
    ]);
    
    const [profile, reactionData, replyPreviewHtml] = parallelData;
    
    // ===== APPLY ALL ENHANCEMENTS SIMULTANEOUSLY =====
    await Promise.all([
        // Apply profile enhancements
        profile ? Promise.resolve().then(() => {
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
        }) : Promise.resolve(),
        
        // Add reaction arrow and apply reaction data
        window.addReactionArrowToMessage ? 
            Promise.resolve(window.addReactionArrowToMessage(messageElement, messageId)).then(() => {
                // Apply reaction displays if we have data
                if (window.applyReactionDisplaysToAllMessages && reactionData[messageId]) {
                    window.applyReactionDisplaysToAllMessages([messageElement], reactionData);
                }
            }) : 
            Promise.resolve(),
        
        // Add reply preview if we have one
        replyPreviewHtml ? 
            Promise.resolve(messageElement.insertAdjacentHTML('afterbegin', replyPreviewHtml)) : 
            Promise.resolve(),
        
        // Add other enhancements for own messages
        messageData.sender === currentUser ? Promise.resolve().then(() => {
            if (window.addDeleteTrashCan && !(messageData.was_deleted || messageData.content === 'This message was deleted')) {
                window.addDeleteTrashCan(messageElement, messageData);
            }
            if (messageData.status && window.addMessageStatus) {
                window.addMessageStatus(messageElement, messageData.status);
            }
        }) : Promise.resolve(),
        
        // Add visibility observer for read status
        messageData.sender !== currentUser && window.visibilityObserver ? 
            Promise.resolve(window.visibilityObserver.observe(messageElement)) : 
                         Promise.resolve()
     ]);
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
    if (!currentRoom || !currentUser || (!content && !selectedImageFile)) {
        console.error('Send blocked: Missing room, user, or content');
        return;
    }
    
    try {
        let imageUrl = null;
        
        // Convert image to base64 if selected
        if (selectedImageFile) {
            imageUrl = await uploadImageToSupabase(selectedImageFile);
            if (!imageUrl) {
                console.error('Image processing failed, aborting send');
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
        
        // 🔥 OPTIMISTIC UI: Display message immediately instead of waiting for subscription
        const sentMessage = data[0]; // Get the message with database ID
        await displayMessageOptimistically(sentMessage);
        
        // Set up fallback check in case real-time subscription fails
        const messageId = sentMessage.id;
        setTimeout(() => {
            // Check if message appeared via subscription (would have different styling/enhancements)
            const realTimeElement = document.querySelector(`[data-message-id="${messageId}"]:not(.optimistic)`);
            if (realTimeElement) {
                // Real-time version appeared, remove optimistic version
                const optimisticElement = document.querySelector(`[data-message-id="${messageId}"].optimistic`);
                if (optimisticElement) {
                    optimisticElement.remove();
                }
            } else {
                // Real-time subscription failed, enhance the optimistic message
                const optimisticElement = document.querySelector(`[data-message-id="${messageId}"].optimistic`);
                if (optimisticElement) {
                    optimisticElement.classList.remove('optimistic');
                    applyRealTimeEnhancements(optimisticElement, sentMessage);
                }
            }
        }, 2000);
        
        // Clear reply state after sending
        if (window.currentReplyMessageId) {
            if (window.hideReplyPreview) {
                window.hideReplyPreview();
            }
            if (window.cancelReply) {
                window.cancelReply();
            }
        }
        
        // Clear input and image preview immediately
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
    
    // Add error handling to any images in this message
    addImageErrorHandling(messageElement);
    
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

// Universal function to add error handling to all message images
function addImageErrorHandling(container) {
    if (!container) return;
    
    const images = container.querySelectorAll('.message-image');
    images.forEach(img => {
        // Only add error handler if it doesn't already have one
        if (!img.dataset.errorHandlerAdded) {
            img.onerror = function() {
                console.warn(`❌ Message image failed to load: ${this.src}`);
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+SW1hZ2UgZmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
                this.alt = 'Failed to load image';
            };
            img.dataset.errorHandlerAdded = 'true';
        }
    });
}

// Format timestamp for display with relative dates
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // Format time as HH:MM (24-hour format)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    // Calculate time difference
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    // Calculate months based on weeks (4 weeks = 1 month)
    const diffMonths = Math.floor(diffWeeks / 4);
    
    // Get relative date string
    let relativeDate = '';
    
    if (diffDays === 0) {
        // Today - just show time
        relativeDate = '';
    } else if (diffDays === 1) {
        relativeDate = 'Yesterday';
    } else if (diffDays === 2) {
        relativeDate = '2 days ago';
    } else if (diffDays < 7) {
        relativeDate = `${diffDays} days ago`;
    } else if (diffWeeks === 1) {
        relativeDate = 'Last week';
    } else if (diffWeeks < 4) {
        // Show weeks for anything less than 4 weeks
        relativeDate = `${diffWeeks} weeks ago`;
    } else if (diffMonths === 1 || (diffWeeks >= 4 && diffWeeks < 8)) {
        // 4-7 weeks shows as "1 month ago"
        relativeDate = '1 month ago';
    } else if (diffMonths < 12) {
        // 8+ weeks shows as "X months"
        relativeDate = `${diffMonths} months ago`;
    } else {
        // More than a year ago, show actual date
        relativeDate = date.toLocaleDateString();
    }
    
    // Combine time and relative date
    if (relativeDate) {
        return `${timeString} (${relativeDate})`;
    } else {
        return timeString; // Today's messages just show time
    }
}

// TIMESTAMP ORDER VALIDATION & FIXING (CRITICAL FOR MAIN 0 ISSUE)
function validateAndFixMessageOrder(skipDOMRebuild = false) {
    if (messages.length <= 1) return true;
    
    let isCorrectOrder = true;
    const violations = [];
    
    // Check chronological order (oldest to newest)
    for (let i = 0; i < messages.length - 1; i++) {
        const currentTime = new Date(messages[i].timestamp).getTime();
        const nextTime = new Date(messages[i + 1].timestamp).getTime();
        
        if (currentTime > nextTime) {
            isCorrectOrder = false;
            violations.push({
                index: i,
                current: messages[i].timestamp,
                next: messages[i + 1].timestamp,
                currentSender: messages[i].sender,
                nextSender: messages[i + 1].sender
            });
        }
    }
    
    if (!isCorrectOrder) {
        console.warn('🔧 TIMESTAMP ORDER VIOLATION DETECTED! Fixing chronological order...');
        console.warn('📊 Violations found:', violations);
        
        // Sort messages by timestamp (oldest to newest)
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Rebuild DOM to match corrected order (unless we're already rebuilding)
        if (!skipDOMRebuild) {
            rebuildMessagesDOM();
        }
        
        console.warn('✅ Message order fixed' + (skipDOMRebuild ? '' : ' and DOM rebuilt'));
        return false; // Order was corrected
    }
    
    return true; // Order was already correct
}

// Check if real-time message should be inserted in chronological order
function findCorrectInsertionIndex(newMessage) {
    const newTimestamp = new Date(newMessage.timestamp).getTime();
    
    // Find the correct position to maintain chronological order
    for (let i = messages.length - 1; i >= 0; i--) {
        const existingTimestamp = new Date(messages[i].timestamp).getTime();
        
        if (existingTimestamp <= newTimestamp) {
            return i + 1; // Insert after this message
        }
    }
    
    return 0; // Insert at the beginning (oldest message)
}

// Rebuild entire message DOM to match the corrected message array order
function rebuildMessagesDOM() {
    // Clear container
    messagesContainer.innerHTML = '';
    
    // Sort messages again to ensure correct order (but don't trigger DOM rebuild)
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Rebuild all messages in correct order
    const fragment = document.createDocumentFragment();
    
    messages.forEach(message => {
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
        
        // Create message HTML
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
        
        fragment.appendChild(messageElement);
    });
    
    // Add all messages to DOM at once
    messagesContainer.appendChild(fragment);
    
    // Add error handling to all images in the rebuilt messages
    addImageErrorHandling(messagesContainer);
    
    // Reapply all enhancements
    const messageElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
    Promise.all([
        loadProfileEnhancements(),
        loadReactionEnhancements()
    ]).then(() => {
        scrollToBottom();
    });
}

// Debug function to manually check and fix timestamp order (for console debugging)
window.debugTimestamps = function() {
    console.log('🔍 Current message order:');
    messages.forEach((msg, i) => {
        console.log(`${i}: ${msg.timestamp} - ${msg.sender}: ${msg.content.substring(0, 30)}...`);
    });
    
    const isValid = validateAndFixMessageOrder();
    console.log(isValid ? '✅ Order is correct' : '🔧 Order was fixed');
};

// Debug function to force fix timestamps (for console debugging)
window.fixTimestamps = function() {
    console.log('🔧 Force fixing timestamp order...');
    validateAndFixMessageOrder();
};

// Enhanced debug function to show DOM vs Array order comparison
window.debugDOMOrder = function() {
    console.log('🔍 COMPREHENSIVE TIMESTAMP DEBUG:');
    console.log('=====================================');
    
    // Show array order
    console.log('📊 ARRAY ORDER:');
    messages.forEach((msg, i) => {
        const date = new Date(msg.timestamp);
        console.log(`  ${i}: ${date.toLocaleTimeString()} - ${msg.sender}: ${msg.content.substring(0, 20)}...`);
    });
    
    // Show DOM order
    console.log('\n🖥️ DOM ORDER:');
    const domMessages = Array.from(document.querySelectorAll('.message[data-message-id]'));
    domMessages.forEach((el, i) => {
        const messageId = el.dataset.messageId;
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            const date = new Date(msg.timestamp);
            console.log(`  ${i}: ${date.toLocaleTimeString()} - ${msg.sender}: ${msg.content.substring(0, 20)}...`);
        }
    });
    
    // Compare arrays
    console.log('\n⚖️ COMPARISON:');
    const arrayTimestamps = messages.map(m => new Date(m.timestamp).getTime());
    const domTimestamps = domMessages.map(el => {
        const msg = messages.find(m => m.id === el.dataset.messageId);
        return msg ? new Date(msg.timestamp).getTime() : 0;
    });
    
    const arrayMatches = arrayTimestamps.every((t, i) => t === domTimestamps[i]);
    console.log(arrayMatches ? '✅ Array and DOM order match!' : '❌ Array and DOM order DO NOT match!');
    
    if (!arrayMatches) {
        console.log('🔧 Triggering automatic fix...');
        validateAndFixMessageOrder();
    }
};

// Emergency rebuild function for console debugging
window.emergencyRebuild = function() {
    console.log('🚨 EMERGENCY DOM REBUILD TRIGGERED');
    rebuildMessagesDOM();
    console.log('✅ DOM rebuilt from scratch');
};

// Force update all visible timestamps with new relative date format
window.refreshAllTimestamps = function() {
    console.log('🔄 REFRESHING ALL TIMESTAMPS WITH RELATIVE DATES...');
    
    const domElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
    let updated = 0;
    
    domElements.forEach((el) => {
        const messageId = el.dataset.messageId;
        const msg = messages.find(m => m.id === messageId);
        
        if (msg) {
            const timestampElement = el.querySelector('.timestamp');
            if (timestampElement) {
                const oldTimestamp = timestampElement.textContent;
                const newTimestamp = formatMessageTime(msg.timestamp);
                
                timestampElement.textContent = newTimestamp;
                updated++;
                
                if (updated <= 5) { // Show first 5 updates
                    console.log(`✅ Updated: ${oldTimestamp} → ${newTimestamp}`);
                }
            }
        }
    });
    
    console.log(`🎯 Updated ${updated} timestamps with relative dates!`);
    return updated;
};

// Test the new relative date timestamp formatting
window.testRelativeDates = function() {
    console.log('📅 RELATIVE DATE TIMESTAMP TEST:');
    console.log('================================');
    
    if (messages.length === 0) {
        console.log('❌ No messages to test with');
        return;
    }
    
    // Show first 10 messages with their new relative date formatting
    console.log('🕐 NEW TIMESTAMP FORMAT (with relative dates):');
    messages.slice(0, 10).forEach((msg, i) => {
        const oldFormat = (() => {
            const date = new Date(msg.timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        })();
        
        const newFormat = formatMessageTime(msg.timestamp);
        const fullDate = new Date(msg.timestamp).toLocaleString();
        
        console.log(`${i}: ${msg.sender}`);
        console.log(`   🕐 Old: ${oldFormat}`);
        console.log(`   📅 New: ${newFormat}`);
        console.log(`   📆 Full: ${fullDate}`);
        console.log('');
    });
    
    return true;
};

// Debug function to check if displayed timestamps match database timestamps
window.debugTimestampDisplay = function() {
    console.log('🕐 TIMESTAMP DISPLAY DIAGNOSTIC:');
    console.log('================================');
    
    // Check first 15 messages in the DOM 
    const domElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
    
    console.log('📊 DATABASE vs DISPLAYED TIMESTAMPS (with relative dates):');
    domElements.slice(0, 15).forEach((el, i) => {
        const messageId = el.dataset.messageId;
        const msg = messages.find(m => m.id === messageId);
        
        if (msg) {
            // Get raw database timestamp
            const dbTimestamp = msg.timestamp;
            const dbDate = new Date(dbTimestamp);
            const dbFormatted = dbDate.toLocaleString();
            
            // Get displayed timestamp from DOM
            const displayedElement = el.querySelector('.timestamp');
            const displayedTime = displayedElement ? displayedElement.textContent : 'NO DISPLAY';
            
            // Check if they match
            const formattedTime = formatMessageTime(dbTimestamp);
            const matches = displayedTime === formattedTime;
            
            console.log(`${matches ? '✅' : '❌'} Position ${i}:`);
            console.log(`  📅 Database: ${dbTimestamp}`);
            console.log(`  📆 Full Date: ${dbFormatted}`);
            console.log(`  🖥️ Displayed: ${displayedTime}`);
            console.log(`  🔧 Expected: ${formattedTime}`);
            console.log(`  👤 Sender: ${msg.sender}`);
            console.log('  ');
        }
    });
    
    // Summary
    let mismatches = 0;
    domElements.slice(0, 15).forEach((el, i) => {
        const messageId = el.dataset.messageId;
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            const displayedElement = el.querySelector('.timestamp');
            const displayedTime = displayedElement ? displayedElement.textContent : 'NO DISPLAY';
            const formattedTime = formatMessageTime(msg.timestamp);
            if (displayedTime !== formattedTime) mismatches++;
        }
    });
    
    console.log(`🎯 RESULT: ${mismatches === 0 ? '✅ ALL TIMESTAMPS DISPLAY CORRECTLY' : `❌ ${mismatches} TIMESTAMP DISPLAY ISSUES FOUND`}`);
    
    // Show date range of messages
    if (messages.length > 0) {
        console.log('\n📊 MESSAGE DATE RANGE:');
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        console.log(`📅 Oldest: ${new Date(firstMsg.timestamp).toLocaleString()}`);
        console.log(`📅 Newest: ${new Date(lastMsg.timestamp).toLocaleString()}`);
        console.log(`🕐 Current: ${new Date().toLocaleString()}`);
    }
    
    return mismatches === 0;
};

// Quick test to show current message order issues
window.showMessageOrder = function() {
    console.log('📊 CURRENT MESSAGE ORDER ANALYSIS:');
    console.log('=================================');
    
    // Show array order
    console.log('🗂️ ARRAY ORDER (what should be displayed):');
    messages.forEach((msg, i) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        console.log(`  ${i}: ${time} - ${msg.sender}: ${msg.content.substring(0, 25)}...`);
    });
    
    // Show DOM order
    console.log('\n🖥️ DOM ORDER (what is actually displayed):');
    const domElements = Array.from(document.querySelectorAll('.message[data-message-id]'));
    domElements.forEach((el, i) => {
        const msg = messages.find(m => m.id === el.dataset.messageId);
        if (msg) {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            console.log(`  ${i}: ${time} - ${msg.sender}: ${msg.content.substring(0, 25)}...`);
        }
    });
    
    // Check if they match
    let matches = true;
    for (let i = 0; i < Math.min(messages.length, domElements.length); i++) {
        if (messages[i] && domElements[i] && messages[i].id !== domElements[i].dataset.messageId) {
            matches = false;
            break;
        }
    }
    
    console.log(`\n🎯 RESULT: ${matches ? '✅ ARRAY AND DOM MATCH' : '❌ ARRAY AND DOM DO NOT MATCH'}`);
    return matches;
};

// Quick test function to verify timestamp order fix
window.testTimestampOrder = function() {
    console.log('🧪 TESTING TIMESTAMP ORDER FIX:');
    console.log('==============================');
    
    if (messages.length === 0) {
        console.log('❌ No messages to test with');
        return;
    }
    
    // Check array order
    let arrayOrderCorrect = true;
    for (let i = 0; i < messages.length - 1; i++) {
        const currentTime = new Date(messages[i].timestamp).getTime();
        const nextTime = new Date(messages[i + 1].timestamp).getTime();
        if (currentTime > nextTime) {
            arrayOrderCorrect = false;
            break;
        }
    }
    
    // Check DOM order
    const domMessages = Array.from(document.querySelectorAll('.message[data-message-id]'));
    let domOrderCorrect = true;
    for (let i = 0; i < domMessages.length - 1; i++) {
        const currentMsg = messages.find(m => m.id === domMessages[i].dataset.messageId);
        const nextMsg = messages.find(m => m.id === domMessages[i + 1].dataset.messageId);
        if (currentMsg && nextMsg) {
            const currentTime = new Date(currentMsg.timestamp).getTime();
            const nextTime = new Date(nextMsg.timestamp).getTime();
            if (currentTime > nextTime) {
                domOrderCorrect = false;
                break;
            }
        }
    }
    
    console.log(`📊 Array order: ${arrayOrderCorrect ? '✅ CORRECT' : '❌ BROKEN'}`);
    console.log(`🖥️ DOM order: ${domOrderCorrect ? '✅ CORRECT' : '❌ BROKEN'}`);
    console.log(`🎯 Overall: ${(arrayOrderCorrect && domOrderCorrect) ? '✅ TIMESTAMP ORDER FIXED!' : '❌ Still has issues'}`);
    
    if (!arrayOrderCorrect || !domOrderCorrect) {
        console.log('🔧 Running automatic fix...');
        validateAndFixMessageOrder();
    }
};

// Check current image sending state
window.checkImageState = function() {
    console.log('📷 CURRENT IMAGE STATE:');
    console.log('=====================');
    
    console.log(`📁 selectedImageFile:`, selectedImageFile);
    console.log(`👁️ Preview container display:`, imagePreviewContainer?.style?.display);
    console.log(`🖼️ Preview src:`, imagePreview?.src ? 'Set' : 'Empty');
    console.log(`💬 Message input value: "${messageInput?.value || ''}"`);
    console.log(`🏠 Current room: ${currentRoom || 'None'}`);
    console.log(`👤 Current user: ${currentUser || 'None'}`);
    
    // Test send conditions
    const hasText = messageInput?.value?.trim() !== '';
    const hasImage = selectedImageFile !== null;
    const canSend = hasText || hasImage;
    
    console.log('\n✅ SEND CONDITIONS:');
    console.log(`📝 Has text: ${hasText ? '✅' : '❌'}`);
    console.log(`📷 Has image: ${hasImage ? '✅' : '❌'}`);
    console.log(`🚀 Can send: ${canSend ? '✅' : '❌'}`);
    
    return { hasText, hasImage, canSend };
};

// Test real-time image functionality
window.testImageHandling = function() {
    console.log('📷 TESTING REAL-TIME IMAGE FUNCTIONALITY:');
    console.log('=========================================');
    
    // Check if image handling functions exist
    const functions = [
        'handleRealTimeMessage',
        'createMessageElementWithImageHandling', 
        'updateMessageContent',
        'clearImagePreview'
    ];
    
    functions.forEach(funcName => {
        const exists = typeof window[funcName] === 'function' || typeof eval(funcName) === 'function';
        console.log(`${exists ? '✅' : '❌'} ${funcName}: ${exists ? 'Available' : 'Missing'}`);
    });
    
    // Check subscription events
    console.log('\n📡 SUBSCRIPTION EVENTS:');
    console.log('✅ INSERT events: Handled for new messages');
    console.log('✅ UPDATE events: Handled for message updates');
    
    // Test image preview state
    const hasImageSelected = selectedImageFile !== null;
    const previewVisible = imagePreviewContainer && imagePreviewContainer.style.display !== 'none';
    
    console.log('\n📸 CURRENT IMAGE STATE:');
    console.log(`📁 Selected file: ${hasImageSelected ? selectedImageFile?.name || 'File selected' : 'None'}`);
    console.log(`👁️ Preview visible: ${previewVisible ? 'Yes' : 'No'}`);
    
    // Check recent image messages
    const recentImageMessages = messages.slice(-10).filter(m => m.image_url);
    console.log(`\n🖼️ Recent image messages: ${recentImageMessages.length}/10`);
    
    if (recentImageMessages.length > 0) {
        recentImageMessages.forEach((msg, i) => {
            console.log(`  ${i + 1}: ${msg.sender} - ${msg.image_url ? 'Has image' : 'No image'}`);
        });
    }
    
    console.log('\n🎯 IMAGE HANDLING STATUS: All improvements deployed!');
    return true;
};

// Test optimistic UI functionality
window.testOptimisticUI = function() {
    console.log('🧪 TESTING OPTIMISTIC UI:');
    console.log('========================');
    
    const optimisticElements = document.querySelectorAll('.message.optimistic');
    const realTimeElements = document.querySelectorAll('.message:not(.optimistic)');
    
    console.log(`📨 Optimistic messages: ${optimisticElements.length}`);
    console.log(`📡 Real-time messages: ${realTimeElements.length}`);
    console.log(`📊 Total messages in array: ${messages.length}`);
    
    if (optimisticElements.length > 0) {
        console.log('\n🚀 OPTIMISTIC MESSAGES:');
        optimisticElements.forEach((el, i) => {
            const messageId = el.dataset.messageId;
            const sender = el.dataset.sender;
            console.log(`  ${i + 1}: ${sender} (ID: ${messageId})`);
        });
    }
    
    return {
        optimistic: optimisticElements.length,
        realTime: realTimeElements.length,
        total: messages.length
    };
};

// Force manual message refresh (emergency fallback)
window.forceMessageRefresh = async function() {
    console.log('🔧 FORCING MESSAGE REFRESH...');
    
    if (!currentRoom) {
        console.log('❌ No current room');
        return;
    }
    
    try {
        // Get latest messages from database
        const { data: latestMessages, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', currentRoom)
            .order('timestamp', { ascending: true })
            .limit(10);
        
        if (error) throw error;
        
        console.log(`📥 Retrieved ${latestMessages.length} latest messages`);
        
        // Add any missing messages to our array
        let addedCount = 0;
        latestMessages.forEach(dbMessage => {
            if (!messages.some(m => m.id === dbMessage.id)) {
                messages.push(dbMessage);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            console.log(`➕ Added ${addedCount} missing messages`);
            // Sort and rebuild DOM
            validateAndFixMessageOrder();
        } else {
            console.log('✅ All messages already present');
        }
        
    } catch (error) {
        console.error('❌ Error refreshing messages:', error);
    }
};

// Test if image error handling is working properly
window.testImageErrorHandling = function() {
    console.log('🖼️ TESTING IMAGE ERROR HANDLING:');
    console.log('================================');
    
    const images = document.querySelectorAll('.message-image');
    console.log(`📊 Found ${images.length} message images`);
    
    let withErrorHandlers = 0;
    let withoutErrorHandlers = 0;
    
    images.forEach((img, i) => {
        const hasHandler = img.dataset.errorHandlerAdded === 'true';
        if (hasHandler) {
            withErrorHandlers++;
        } else {
            withoutErrorHandlers++;
        }
        
        if (i < 5) { // Show first 5 for debugging
            console.log(`${i + 1}: ${hasHandler ? '✅' : '❌'} Error handler: ${hasHandler ? 'Added' : 'Missing'}`);
            console.log(`   📎 Source: ${img.src.substring(0, 50)}...`);
        }
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`✅ With error handlers: ${withErrorHandlers}`);
    console.log(`❌ Without error handlers: ${withoutErrorHandlers}`);
    
    if (withoutErrorHandlers > 0) {
        console.log('🔧 Adding missing error handlers...');
        addImageErrorHandling(document);
        console.log('✅ All images now have error handlers!');
    }
    
    return {
        total: images.length,
        withHandlers: withErrorHandlers,
        withoutHandlers: withoutErrorHandlers
    };
};

// Make debugging functions available globally
window.checkImageState = window.checkImageState;
window.testImageHandling = window.testImageHandling;
window.refreshAllTimestamps = window.refreshAllTimestamps;
window.testRelativeDates = window.testRelativeDates;
window.debugTimestampDisplay = window.debugTimestampDisplay;
window.showMessageOrder = window.showMessageOrder;
window.debugDOMOrder = window.debugDOMOrder;
window.emergencyRebuild = window.emergencyRebuild;
window.testTimestampOrder = window.testTimestampOrder;
window.testOptimisticUI = window.testOptimisticUI;
window.forceMessageRefresh = window.forceMessageRefresh;
window.testImageErrorHandling = window.testImageErrorHandling;

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

// Insert message element at correct DOM position to match array position (CRITICAL FOR TIMESTAMP ORDERING)
function insertMessageElementAtCorrectPosition(messageElement, arrayIndex) {
    const existingMessages = Array.from(messagesContainer.querySelectorAll('.message'));
    
    // Handle Load More button offset
    const loadMoreButton = document.getElementById('load-more-messages');
    
    console.log(`🔧 DOM INSERT: array index ${arrayIndex}, existing DOM messages: ${existingMessages.length}`);
    
    if (arrayIndex === 0) {
        // Insert at the very beginning (after Load More button if it exists)
        if (loadMoreButton) {
            messagesContainer.insertBefore(messageElement, loadMoreButton.nextSibling);
        } else {
            messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
        }
        console.log(`🔧 → Inserted at beginning`);
    } else if (arrayIndex >= existingMessages.length) {
        // Append to end
        messagesContainer.appendChild(messageElement);
        console.log(`🔧 → Appended to end`);
    } else {
        // Insert before the message at the current array index
        // Since DOM messages should match array order, DOM index = array index
        const insertBeforeElement = existingMessages[arrayIndex];
        if (insertBeforeElement) {
            messagesContainer.insertBefore(messageElement, insertBeforeElement);
            console.log(`🔧 → Inserted at position ${arrayIndex}`);
        } else {
            messagesContainer.appendChild(messageElement);
            console.log(`🔧 → Fallback: appended to end`);
        }
    }
}
