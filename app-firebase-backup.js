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
const saveConversationBtn = document.getElementById('save-conversation-btn');

// App State
let currentUser = null;
let currentRoom = null;
let messages = [];
let messagesRef = null;
let newMessageListener = null;

// Local Storage Keys
const USERNAME_KEY = 'msg_username';
const ROOMS_KEY = 'msg_rooms';
const MESSAGES_KEY = 'msg_messages';
const SAVED_CONVERSATIONS_KEY = 'msg_saved_conversations';

// Initialize App
function initApp() {
    // Check if username exists in local storage
    currentUser = localStorage.getItem(USERNAME_KEY);
    
    if (currentUser) {
        // Show home buttons if username exists
        usernameContainer.style.display = 'none';
        homeButtons.style.display = 'block';
        userDisplay.textContent = currentUser;
    }

    // Verify Firebase connection
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            console.log('Connected to Firebase');
        } else {
            console.log('Disconnected from Firebase');
        }
    });

    // Add event listeners
    addEventListeners();
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
function createNewRoom() {
    // Generate a random 6-character room code
    const roomCode = generateRoomCode();
    
    // Display the room code
    roomCodeDisplay.textContent = roomCode;
    
    // Save room to local storage
    saveRoom(roomCode);
    
    // Create room in Firebase
    database.ref('rooms/' + roomCode).set({
        createdBy: currentUser,
        createdAt: new Date().toISOString()
    });
}

function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
}

function saveRoom(roomCode) {
    // Get existing rooms or initialize empty array
    let rooms = JSON.parse(localStorage.getItem(ROOMS_KEY) || '[]');
    
    // Add new room if it doesn't exist
    if (!rooms.includes(roomCode)) {
        rooms.push(roomCode);
        localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    }
}

function joinRoom() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (roomCode) {
        // Check if room exists in Firebase
        database.ref('rooms/' + roomCode).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Room exists, joining:', roomCode);
                    enterRoom(roomCode);
                } else {
                    console.log('Room does not exist:', roomCode);
                    alert('Room does not exist. Please check the code and try again.');
                }
            })
            .catch(error => {
                console.error('Error checking room:', error);
                alert('Error checking room. Please try again.');
            });
    }
}

function enterRoom(roomCode) {
    if (!roomCode) return;
    
    // Set current room
    currentRoom = roomCode;
    
    // Save room to local storage
    saveRoom(roomCode);
    
    // Display room code in chat screen
    currentRoomCode.textContent = roomCode;
    
    console.log('Entering room:', roomCode);
    
    // Show chat screen
    showScreen(chatRoomScreen);
    
    // Load messages for this room
    loadMessages(roomCode);
    
    // Focus on message input
    messageInput.focus();
}

function leaveRoom() {
    console.log('Leaving room:', currentRoom);
    
    // Remove Firebase listener when leaving room
    if (messagesRef && newMessageListener) {
        messagesRef.off('child_added', newMessageListener);
        console.log('Removed message listener');
        messagesRef = null;
        newMessageListener = null;
    }
    
    currentRoom = null;
    messagesContainer.innerHTML = '';
    messages = [];
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
                console.error('Failed to copy: ', err);
                fallbackCopy(roomCode);
            });
    } else {
        fallbackCopy(roomCode);
    }
}

function fallbackCopy(text) {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make it invisible
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        // Execute the copy command
        const successful = document.execCommand('copy');
        if (successful) {
            showCopiedFeedback();
        } else {
            console.error('Fallback copy failed');
            alert('Copy failed. Please manually copy this code: ' + text);
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
        alert('Copy failed. Please manually copy this code: ' + text);
    }
    
    // Clean up
    document.body.removeChild(textArea);
}

function showCopiedFeedback() {
    // Visual feedback
    const originalText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = 'Copied!';
    
    setTimeout(() => {
        copyCodeBtn.textContent = originalText;
    }, 2000);
}

// Message Functions
function loadMessages(roomCode) {
    // Clear messages container
    messagesContainer.innerHTML = '';
    messages = [];
    
    // Remove any existing listeners
    if (messagesRef && newMessageListener) {
        messagesRef.off('child_added', newMessageListener);
    }
    
    // Set up Firebase reference for this room
    messagesRef = database.ref('rooms/' + roomCode + '/messages');
    
    console.log('Setting up message listener for room:', roomCode);
    
    // Load existing messages
    messagesRef.once('value')
        .then((snapshot) => {
            const messagesData = snapshot.val();
            console.log('Initial messages loaded:', messagesData ? Object.keys(messagesData).length : 0);
            
            if (messagesData) {
                // Convert object to array and sort by timestamp
                const messageArray = Object.values(messagesData);
                messageArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // Display each message
                messageArray.forEach(message => {
                    // Store message ID to avoid duplicates
                    message.id = message.id || generateMessageId(message);
                    messages.push(message);
                    displayMessage(message);
                });
                
                // Scroll to bottom
                scrollToBottom();
            }
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
    
    // Listen for new messages
    newMessageListener = messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        message.id = message.id || snapshot.key;
        
        console.log('New message received:', message);
        
        // Only display if it's not already in our messages array
        if (!messages.some(m => m.id === message.id)) {
            messages.push(message);
            displayMessage(message);
            scrollToBottom();
        }
    }, (error) => {
        console.error('Error in message listener:', error);
    });
}

function sendMessage(content) {
    if (!currentRoom || !currentUser) return;
    
    // Create message object
    const message = {
        sender: currentUser,
        content: content,
        timestamp: new Date().toISOString(),
        id: generateMessageId({ sender: currentUser, timestamp: new Date().toISOString() })
    };
    
    console.log('Sending message:', message);
    
    // Add to Firebase
    messagesRef.push(message)
        .then(() => {
            console.log('Message sent successfully');
        })
        .catch(error => {
            console.error('Error sending message:', error);
            // Fallback to display message locally if Firebase fails
            if (!messages.some(m => m.id === message.id)) {
                messages.push(message);
                displayMessage(message);
                scrollToBottom();
            }
        });
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
    
    // Create message content
    messageElement.innerHTML = `
        <div class="sender">${message.sender}</div>
        <div class="content">${message.content}</div>
    `;
    
    // Add to container
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    scrollToBottom();
}

// No longer needed as we're using Firebase
// Keeping function signature for compatibility
function saveMessages() {
    // Messages are automatically saved to Firebase
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveConversation() {
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
    
    // Also save to Firebase for backup
    database.ref('saved_conversations/' + currentUser + '/' + new Date().getTime())
        .set(conversation);
    
    // Visual feedback (could be improved with a toast notification)
    const originalText = saveConversationBtn.textContent;
    saveConversationBtn.textContent = 'Saved!';
    
    setTimeout(() => {
        saveConversationBtn.textContent = originalText;
    }, 2000);
}

// Helper function to generate unique message IDs
function generateMessageId(message) {
    return `${message.sender}_${message.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
