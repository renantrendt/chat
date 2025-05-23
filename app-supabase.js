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

// Initialize App
async function initApp() {
    // Check if username exists in local storage
    currentUser = localStorage.getItem(USERNAME_KEY);
    
    if (currentUser) {
        // Show home buttons if username exists
        usernameContainer.style.display = 'none';
        homeButtons.style.display = 'block';
        userDisplay.textContent = currentUser;
        
        // Load last visited rooms for the current user
        loadLastVisitedRooms();
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
function saveUsername() {
    const username = usernameInput.value.trim();
    
    if (username) {
        currentUser = username;
        localStorage.setItem(USERNAME_KEY, username);
        
        usernameContainer.style.display = 'none';
        homeButtons.style.display = 'block';
        userDisplay.textContent = username;
        
        // Load last visited rooms for the new user
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
    
    // Focus on message input
    messageInput.focus();
}

function leaveRoom() {
    console.log('Leaving room:', currentRoom);
    
    // Unsubscribe from real-time updates
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
    
    // Reset room state
    currentRoom = null;
    messages = [];
    messagesContainer.innerHTML = '';
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

// Message Functions
async function loadMessages(roomCode) {
    // Clear messages container
    messagesContainer.innerHTML = '';
    messages = [];
    
    try {
        // Load existing messages from Supabase
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_code', roomCode)
            .order('timestamp', { ascending: true });
        
        if (error) throw error;
        
        console.log(`Loaded ${data.length} messages for room ${roomCode}`);
        
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
        
    } catch (error) {
        console.error('Error loading messages:', error);
        alert('Failed to load messages. Please try refreshing the page.');
    }
}

function subscribeToMessages(roomCode) {
    // Unsubscribe from any existing subscription
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    // Subscribe to real-time updates for this room
    messageSubscription = window.supabaseClient
        .channel('messages_channel')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `room_code=eq.${roomCode}`
            }, 
            (payload) => {
                const newMessage = payload.new;
                console.log('Real-time message received:', newMessage);
                
                // Only display if it's not already in our messages array
                if (!messages.some(m => m.id === newMessage.id)) {
                    messages.push(newMessage);
                    displayMessage(newMessage);
                    scrollToBottom();
                }
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
        });
}

async function sendMessage(content) {
    if (!currentRoom || !currentUser || !content) return;
    
    try {
        // Create message object
        const message = {
            room_code: currentRoom,
            sender: currentUser,
            content: content,
            timestamp: new Date().toISOString()
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
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
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
    
    // Add to container
    messagesContainer.appendChild(messageElement);
    
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
        // Get the 5 most recently visited rooms for the current user
        const { data, error } = await window.supabaseClient
            .from('last_visited_rooms')
            .select('room_code, visited_at')
            .eq('username', currentUser)
            .order('visited_at', { ascending: false })
            .limit(5);
        
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
            
            // Set the HTML content
            roomItem.innerHTML = `
                <div class="room-info">
                    <div class="room-code">${room.room_code}</div>
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

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
