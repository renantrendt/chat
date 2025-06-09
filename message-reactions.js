// Message Reactions System
// Predefined emojis for quick access
const PREDEFINED_EMOJIS = ['😅', '❤️', '🤣', '👍', '😂', '☠️'];

// Global variables for emoji picker (will be set when opened)
let currentReactionMessageId = null;
let emojiPickerModal = null;

// Track initialization state
let reactionSystemInitialized = false;

// Initialize reaction system
function initReactionSystem() {
    console.log('Initializing message reaction system...');
    
    try {
        // Prevent double initialization
        if (reactionSystemInitialized) {
            console.log('Reaction system: Already initialized, skipping...');
            return;
        }
        
        // Create emoji picker modal
        createEmojiPickerModal();
        console.log('Reaction system: Emoji picker modal created');
        
        // Set up event listeners for dynamic content
        setupReactionEventListeners();
        console.log('Reaction system: Event listeners set up');
        
        reactionSystemInitialized = true;
        window.reactionSystemInitialized = true;
        console.log('✅ Reaction system: Initialization completed successfully');
        console.log('✅ window.addReactionArrowToMessage is available:', typeof window.addReactionArrowToMessage);
        
    } catch (error) {
        console.error('❌ Reaction system: Error during initialization:', error);
        reactionSystemInitialized = false;
    }
}

// Validate that reaction system is ready
function validateReactionSystem() {
    if (!reactionSystemInitialized) {
        console.warn('Reaction system: System not initialized, attempting to initialize...');
        initReactionSystem();
        return reactionSystemInitialized;
    }
    return true;
}

// Create the emoji picker modal
function createEmojiPickerModal() {
    // Create modal backdrop
    emojiPickerModal = document.createElement('div');
    emojiPickerModal.className = 'emoji-picker-modal';
    emojiPickerModal.style.display = 'none';
    
    // Create modal content
    emojiPickerModal.innerHTML = `
        <div class="emoji-picker-content">
            <div class="emoji-picker-header">
                <h3>Pick an emoji</h3>
                <button class="emoji-picker-close">&times;</button>
            </div>
            <div class="emoji-grid">
                <!-- More emojis will be populated here -->
            </div>
        </div>
    `;
    
    // Populate with more emojis
    const emojiGrid = emojiPickerModal.querySelector('.emoji-grid');
    const allEmojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
        '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
        '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦',
        '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
        '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
        '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
        '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
        '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
        '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋',
        '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'
    ];
    
    allEmojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-option';
        emojiBtn.textContent = emoji;
        emojiBtn.addEventListener('click', () => selectEmoji(emoji));
        emojiGrid.appendChild(emojiBtn);
    });
    
    // Add close event listener
    emojiPickerModal.querySelector('.emoji-picker-close').addEventListener('click', closeEmojiPicker);
    
    // Close on backdrop click
    emojiPickerModal.addEventListener('click', (e) => {
        if (e.target === emojiPickerModal) {
            closeEmojiPicker();
        }
    });
    
    // Append to body
    document.body.appendChild(emojiPickerModal);
}

// Set up event listeners for reaction system
function setupReactionEventListeners() {
    // Clean up any existing listeners first
    cleanupReactionEventListeners();
    
    // Always use document-level delegation since reaction menus are added to body
        reactionEventHandler = handleReactionClicksWithValidation;
        reactionEventTarget = document;
        document.addEventListener('click', reactionEventHandler);
    console.log('Reaction system: Event delegation set up on document (to handle popups)');
}

// Handle all reaction-related clicks
function handleReactionClicks(e) {
    // Validate event and target
    if (!e || !e.target) return;
    
    try {
        // Handle down arrow clicks
        if (e.target.classList.contains('reaction-arrow')) {
            e.preventDefault();
            console.log('🎯 Arrow clicked - showing reaction menu');
            showReactionMenu(e.target);
            return;
        }
        
        // Handle react button clicks
        if (e.target.classList.contains('react-btn')) {
            e.preventDefault();
            console.log('🎯 React button clicked - showing emoji selector');
            showEmojiSelector(e.target);
            return;
        }
        
        // Handle reply button clicks
        if (e.target.classList.contains('reply-btn')) {
            e.preventDefault();
            console.log('💬 Reply button clicked - entering reply mode');
            
            const messageId = e.target.dataset.messageId;
            if (messageId) {
                enterReplyMode(messageId);
                hideReactionMenu();
            } else {
                console.warn('❌ Could not find message ID for reply');
            }
            return;
        }
        
        // Handle predefined emoji clicks
        if (e.target.classList.contains('predefined-emoji')) {
            e.preventDefault();
            const emoji = e.target.textContent;
            console.log('Emoji clicked:', emoji);
            
            // Get messageId from the emoji selector menu
            const emojiSelector = e.target.closest('.emoji-selector');
            const menu = emojiSelector ? emojiSelector.closest('.reaction-menu') : null;
            let messageId = null;
            
            if (menu && menu.dataset.messageId) {
                messageId = menu.dataset.messageId;
                console.log('Found messageId from menu:', messageId);
            } else {
                // Fallback: try to find from closest message
            const messageElement = e.target.closest('.message');
                if (messageElement && messageElement.dataset.messageId) {
                    messageId = messageElement.dataset.messageId;
                    console.log('Found messageId from message element:', messageId);
                }
            }
            
            if (messageId) {
                console.log('Adding reaction:', emoji, 'to message:', messageId);
                addReaction(messageId, emoji);
                hideReactionMenu();
            } else {
                console.warn('Reaction system: Could not find message ID for emoji click');
            }
            return;
        }
        
        // Handle + button clicks
        if (e.target.classList.contains('more-emojis-btn')) {
            e.preventDefault();
            console.log('🎯 + button clicked - opening full emoji picker');
            
            // Get messageId from the emoji selector menu (same as predefined emojis)
            const emojiSelector = e.target.closest('.emoji-selector');
            const menu = emojiSelector ? emojiSelector.closest('.reaction-menu') : null;
            let messageId = null;
            
            if (menu && menu.dataset.messageId) {
                messageId = menu.dataset.messageId;
                console.log('📝 Found messageId from menu:', messageId);
            } else {
                // Fallback: try to find from closest message
            const messageElement = e.target.closest('.message');
                if (messageElement && messageElement.dataset.messageId) {
                    messageId = messageElement.dataset.messageId;
                    console.log('📝 Found messageId from message element:', messageId);
                }
            }
            
            if (messageId) {
                console.log('🎨 Opening emoji picker for message:', messageId);
                openEmojiPicker(messageId);
                hideReactionMenu();
            } else {
                console.warn('❌ Could not find message ID for + button click');
            }
            return;
        }
        
        // Handle existing reaction clicks (remove own reactions)
        if (e.target.classList.contains('reaction-count')) {
            e.preventDefault();
            const messageElement = e.target.closest('.message');
            const emoji = e.target.dataset.emoji;
            const isOwnReaction = e.target.classList.contains('own-reaction');
            
            console.log('Reaction count clicked:', { emoji, isOwnReaction, messageId: messageElement?.dataset.messageId });
            
            if (messageElement && messageElement.dataset.messageId && emoji && isOwnReaction) {
                const messageId = messageElement.dataset.messageId;
                console.log('🗑️ Removing own reaction:', emoji, 'from message:', messageId);
                removeReaction(messageId, emoji);
            } else if (isOwnReaction) {
                console.warn('❌ Could not remove reaction - missing message info');
            } else {
                console.log('ℹ️ Not own reaction, ignoring click');
            }
            return;
        }
        
        // Close reaction menu if clicking outside
        if (!e.target.closest('.reaction-menu') && !e.target.classList.contains('reaction-arrow')) {
            hideReactionMenu();
        }
    } catch (error) {
        console.error('Reaction system: Error handling click event:', error);
    }
}

// Enhanced handler for document-level delegation with stricter validation
function handleReactionClicksWithValidation(e) {
    // Only process clicks that are inside messages container or reaction-related elements
    if (!e || !e.target) return;
    
    const messagesContainer = document.getElementById('messages-container');
    const isInMessagesContainer = messagesContainer && messagesContainer.contains(e.target);
    const isReactionRelated = e.target.closest('.reaction-menu') || 
                             e.target.classList.contains('reaction-arrow') ||
                             e.target.classList.contains('emoji-picker-modal') ||
                             e.target.closest('.emoji-picker-modal');
    
    // Only handle if it's in messages container or is reaction-related
    if (isInMessagesContainer || isReactionRelated) {
        handleReactionClicks(e);
    }
}

// Show reaction menu (with React button)
function showReactionMenu(arrow) {
    console.log('showReactionMenu called with arrow:', arrow);
    
    // Validate input
    if (!arrow) {
        console.warn('Reaction system: Cannot show reaction menu - arrow element is null');
        return;
    }
    
    // Hide any existing menu
    hideReactionMenu();
    
    const message = arrow.closest('.message');
    console.log('Found message element:', message, 'messageId:', message ? message.dataset.messageId : 'none');
    
    if (!message || !message.dataset.messageId) {
        console.warn('Reaction system: Cannot show reaction menu - message element not found or missing ID');
        return;
    }
    
    try {
        // Create reaction menu
        const menu = document.createElement('div');
        menu.className = 'reaction-menu';
        
        // Store message ID in the menu for later reference
        menu.dataset.messageId = message.dataset.messageId;
        
        menu.innerHTML = `
            <div class="menu-buttons">
                <button class="react-btn" data-message-id="${message.dataset.messageId}">React</button>
                <button class="reply-btn" data-message-id="${message.dataset.messageId}">Reply</button>
            </div>
        `;
        
        // Position the menu with better placement
        const rect = arrow.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top = rect.top;
        let left = rect.right + 10; // Position to the right initially
        
        // If not enough space to the right, position below
        if (left + 80 > viewportWidth) { // Estimate React button width
            left = rect.left;
            top = rect.bottom + 8;
        }
        
        // For mobile devices, ensure it fits on screen
        if (viewportWidth <= 768) {
            left = Math.max(10, Math.min(left, viewportWidth - 80));
        }
        
        // Ensure popup doesn't go off bottom of screen
        if (top > viewportHeight - 60) {
            top = rect.top - 45; // Position above the arrow
        }
        
        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.zIndex = '1000';
        
        console.log('Adding reaction menu to body with messageId:', message.dataset.messageId);
        
        // Add to body
        document.body.appendChild(menu);
        
        // Store reference for cleanup
        arrow.reactionMenu = menu;
        
        console.log('✅ Reaction menu created and positioned');
        
    } catch (error) {
        console.error('❌ Reaction system: Error showing reaction menu:', error);
    }
}

// Show emoji selector (predefined emojis + plus button)
function showEmojiSelector(reactBtn) {
    console.log('showEmojiSelector called with:', reactBtn);
    
    // Validate input
    if (!reactBtn || !reactBtn.parentElement) {
        console.warn('Reaction system: Cannot show emoji selector - react button or parent not found');
        return;
    }
    
    const menu = reactBtn.parentElement;
    let message = reactBtn.closest('.message');
    let messageId = null;
    
    // Try to get message ID from button data attribute if can't find message element
    if (!message) {
        messageId = reactBtn.dataset.messageId || menu.dataset.messageId;
        console.log('Could not find message element, using stored messageId:', messageId);
    } else {
        messageId = message.dataset.messageId;
    }
    
    console.log('showEmojiSelector - found elements:', {
        menu: menu,
        message: message,
        messageId: messageId,
        reactBtnDataId: reactBtn.dataset.messageId,
        menuDataId: menu.dataset.messageId
    });
    
    if (!messageId) {
        console.warn('Reaction system: Cannot show emoji selector - no message ID found');
        return;
    }
    
    try {
        console.log('Creating emoji selector with emojis:', PREDEFINED_EMOJIS);
        
        // Replace react button with emoji selector
        const emojiSelectorHTML = `
            <div class="emoji-selector">
                ${PREDEFINED_EMOJIS.map(emoji => 
                    `<button class="predefined-emoji">${emoji}</button>`
                ).join('')}
                <button class="more-emojis-btn">+</button>
            </div>
        `;
        
        console.log('Generated HTML:', emojiSelectorHTML);
        menu.innerHTML = emojiSelectorHTML;
        
        // Reposition the menu to accommodate the wider emoji selector
        // Use setTimeout to allow DOM to update with new content size
        setTimeout(() => {
            repositionReactionMenu(menu, messageId);
        }, 10);
        
        console.log('✅ Emoji selector displayed and repositioned successfully');
        
    } catch (error) {
        console.error('❌ Reaction system: Error showing emoji selector:', error);
    }
}

// Open full emoji picker modal
function openEmojiPicker(messageId) {
    console.log('🎨 Opening emoji picker modal for message:', messageId);
    
    if (!emojiPickerModal) {
        console.error('❌ Emoji picker modal not initialized');
        return;
    }
    
    currentReactionMessageId = messageId;
    emojiPickerModal.style.display = 'flex';
    
    console.log('✅ Emoji picker modal opened');
}

// Close emoji picker modal
function closeEmojiPicker() {
    console.log('❌ Closing emoji picker modal');
    
    if (emojiPickerModal) {
    emojiPickerModal.style.display = 'none';
    }
    
    currentReactionMessageId = null;
    console.log('✅ Emoji picker modal closed');
}

// Select emoji from picker
function selectEmoji(emoji) {
    console.log('🎯 Emoji selected from full picker:', emoji, 'for message:', currentReactionMessageId);
    
    if (currentReactionMessageId) {
        console.log('✅ Adding reaction from full picker');
        addReaction(currentReactionMessageId, emoji);
        closeEmojiPicker();
    } else {
        console.warn('❌ No message ID set for emoji picker');
    }
}

// Reposition reaction menu for better placement
function repositionReactionMenu(menu, messageId) {
    if (!menu || !messageId) return;
    
    try {
        // Find the message element
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            console.warn('Could not find message element for repositioning');
            return;
        }
        
        // Find the arrow button within the message
        const arrow = messageElement.querySelector('.reaction-arrow');
        if (!arrow) {
            console.warn('Could not find arrow button for repositioning');
            return;
        }
        
        // Get the arrow position
        const arrowRect = arrow.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // Calculate better position - place to the right of the message to avoid overlap
        let top = arrowRect.top;
        let left = arrowRect.right + 10; // Position to the right of the arrow
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // If there's not enough space to the right, place below the message
        if (left + menuRect.width > viewportWidth - 10) {
            left = arrowRect.left;
            top = arrowRect.bottom + 8; // More space to avoid text overlap
            
            // If still going off-screen to the right, adjust left position
            if (left + menuRect.width > viewportWidth - 10) {
                left = viewportWidth - menuRect.width - 10;
            }
        }
        
        // Adjust if menu would go off-screen to the left
        if (left < 10) {
            left = 10;
        }
        
        // Adjust if menu would go off-screen at the bottom
        if (top + menuRect.height > viewportHeight - 10) {
            top = arrowRect.top - menuRect.height - 8; // Position above with more space
        }
        
        // Apply the new position
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        
        console.log('Menu repositioned to:', { top, left });
        
    } catch (error) {
        console.error('Error repositioning reaction menu:', error);
    }
}

// Hide reaction menu
function hideReactionMenu() {
    const existingMenus = document.querySelectorAll('.reaction-menu');
    existingMenus.forEach(menu => menu.remove());
}

// Add reaction to message
async function addReaction(messageId, emoji) {
    console.log('🎯 addReaction called:', { messageId, emoji, user: window.currentUser });
    
    // Validate all required parameters
    if (!messageId) {
        console.warn('Reaction system: Cannot add reaction - message ID is missing');
        return;
    }
    
    if (!emoji || typeof emoji !== 'string') {
        console.warn('Reaction system: Cannot add reaction - emoji is missing or invalid');
        return;
    }
    
    if (!window.currentUser || !window.currentRoom) {
        console.warn('Reaction system: Cannot add reaction - user or room not set');
        return;
    }
    
    if (!window.supabaseClient) {
        console.error('Reaction system: Cannot add reaction - Supabase client not available');
        return;
    }
    
    try {
        console.log('🔍 Checking for existing reaction...', { 
            messageId, 
            username: window.currentUser,
            newEmoji: emoji 
        });
        
        // Check if user already has a reaction to this message (ONE REACTION PER USER RULE)
        const { data: existingReactions, error: checkError } = await window.supabaseClient
            .from('reactions')
            .select('*')
            .eq('message_id', messageId)
            .eq('username', window.currentUser);
        
        if (checkError) {
            console.error('❌ Error checking existing reactions:', checkError);
            throw checkError;
        }
        
        console.log('🔍 Found existing reactions:', existingReactions);
        
        if (existingReactions && existingReactions.length > 0) {
            // Replace existing reaction (DELETE + INSERT approach)
            const existingReaction = existingReactions[0];
            console.log(`🔄 Replacing ${existingReaction.emoji} with ${emoji} for user ${window.currentUser}`);
            console.log('🗑️ Deleting old reaction with ID:', existingReaction.id);
            
            // First, delete the existing reaction
            const { error: deleteError } = await window.supabaseClient
                .from('reactions')
                .delete()
                .eq('id', existingReaction.id);
            
            if (deleteError) {
                console.error('❌ Error deleting old reaction:', deleteError);
                throw deleteError;
            }
            
            console.log('✅ Old reaction deleted, now inserting new one');
            
            // Then insert the new reaction
            const { data: insertData, error: insertError } = await window.supabaseClient
                .from('reactions')
                .insert([{
                    message_id: messageId,
                    username: window.currentUser,
                    emoji: emoji
                }])
                .select();
            
            if (insertError) {
                console.error('❌ Error inserting new reaction:', insertError);
                throw insertError;
            }
            
            console.log(`✅ Successfully replaced reaction with ${emoji} for message ${messageId}`);
            console.log('📄 New reaction data:', insertData);
        } else {
            // Insert new reaction
            console.log(`➕ Adding new reaction ${emoji} for user ${window.currentUser}`);
            const { error: insertError } = await window.supabaseClient
                .from('reactions')
                .insert([{
                    message_id: messageId,
                    username: window.currentUser,
                    emoji: emoji
                }]);
            
            if (insertError) {
                console.error('❌ Error inserting reaction:', insertError);
                throw insertError;
            }
            console.log(`✅ Successfully added reaction ${emoji} to message ${messageId}`);
        }
        
        // Refresh reactions for this message
        console.log('🔄 Refreshing reactions display...');
        await loadReactionsForMessage(messageId);
        
    } catch (error) {
        console.error('❌ Reaction system: Error adding reaction:', error);
        console.error('❌ Error details:', error);
    }
}

// Remove reaction from message
async function removeReaction(messageId, emoji) {
    // Validate all required parameters
    if (!messageId) {
        console.warn('Reaction system: Cannot remove reaction - message ID is missing');
        return;
    }
    
    if (!emoji || typeof emoji !== 'string') {
        console.warn('Reaction system: Cannot remove reaction - emoji is missing or invalid');
        return;
    }
    
    if (!window.currentUser) {
        console.warn('Reaction system: Cannot remove reaction - user not set');
        return;
    }
    
    if (!window.supabaseClient) {
        console.error('Reaction system: Cannot remove reaction - Supabase client not available');
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('username', window.currentUser)
            .eq('emoji', emoji);
        
        if (error) throw error;
        
        console.log(`Reaction system: Removed reaction ${emoji} from message ${messageId}`);
        
        // Refresh reactions for this message
        await loadReactionsForMessage(messageId);
        
    } catch (error) {
        console.error('Reaction system: Error removing reaction:', error);
    }
}

// Load reactions for a specific message
async function loadReactionsForMessage(messageId) {
    console.log('📥 Loading reactions for message:', messageId);
    
    try {
        const { data: reactions, error } = await window.supabaseClient
            .from('reactions')
            .select('*')
            .eq('message_id', messageId);
        
        if (error) {
            console.error('❌ Error loading reactions:', error);
            throw error;
        }
        
        console.log('📥 Loaded reactions:', reactions);
        
        // Update reactions display
        updateReactionsDisplay(messageId, reactions || []);
        
    } catch (error) {
        console.error('❌ Error loading reactions:', error);
    }
}

// Update reactions display for a message
function updateReactionsDisplay(messageId, reactions) {
    console.log('📊 Updating reactions display for message:', messageId, 'reactions:', reactions);
    
    const message = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!message) {
        console.warn('❌ Message element not found for ID:', messageId);
        return;
    }
    
    let reactionsContainer = message.querySelector('.reactions-container');
    
    if (reactions.length === 0) {
        // Remove reactions container if no reactions
        if (reactionsContainer) {
            reactionsContainer.remove();
            console.log('🗑️ Removed empty reactions container');
        }
        return;
    }
    
    // Create reactions container if it doesn't exist
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container';
        message.appendChild(reactionsContainer);
        console.log('➕ Created new reactions container');
    }
    
    // Group reactions by emoji
    const groupedReactions = {};
    reactions.forEach(reaction => {
        if (!groupedReactions[reaction.emoji]) {
            groupedReactions[reaction.emoji] = [];
        }
        groupedReactions[reaction.emoji].push(reaction);
    });
    
    console.log('📊 Grouped reactions:', groupedReactions);
    
    // Generate HTML for reactions
    const reactionsHTML = Object.entries(groupedReactions).map(([emoji, reactionList]) => {
        const count = reactionList.length;
        const isOwnReaction = reactionList.some(r => r.username === window.currentUser);
        const ownReactionClass = isOwnReaction ? 'own-reaction' : '';
        const displayText = count > 1 ? `${emoji}${count}` : emoji;
        
        console.log(`💙 Reaction: ${emoji}, count: ${count}, isOwn: ${isOwnReaction}, display: ${displayText}`);
        
        return `<button class="reaction-count ${ownReactionClass}" data-emoji="${emoji}" title="React with ${emoji}">${displayText}</button>`;
    }).join('');
    
    reactionsContainer.innerHTML = reactionsHTML;
    console.log('✅ Reactions display updated successfully');
}

// Load all reactions for messages in current view
async function loadAllReactions() {
    if (!window.currentRoom) return;
    
    try {
        // Get all message IDs currently displayed
        const messageElements = document.querySelectorAll('.message[data-message-id]');
        const messageIds = Array.from(messageElements).map(el => el.dataset.messageId);
        
        if (messageIds.length === 0) return;
        
        // Load reactions for all these messages
        const { data: reactions, error } = await window.supabaseClient
            .from('reactions')
            .select('*')
            .in('message_id', messageIds);
        
        if (error) throw error;
        
        // Group reactions by message ID
        const reactionsByMessage = {};
        reactions.forEach(reaction => {
            if (!reactionsByMessage[reaction.message_id]) {
                reactionsByMessage[reaction.message_id] = [];
            }
            reactionsByMessage[reaction.message_id].push(reaction);
        });
        
        // Update display for each message
        Object.entries(reactionsByMessage).forEach(([messageId, messageReactions]) => {
            updateReactionsDisplay(messageId, messageReactions);
        });
        
    } catch (error) {
        console.error('Error loading all reactions:', error);
    }
}

// Subscribe to reaction changes
function subscribeToReactions() {
    if (!window.currentRoom) return;
    
    // Clean up previous subscription
    if (window.subscriptionManager) {
        window.subscriptionManager.cleanup('reactions');
    }
    
    // Subscribe to reaction changes for current room
    const reactionSubscription = window.supabaseClient
        .channel(`reactions_${window.currentRoom}`)
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'reactions'
            }, 
            async (payload) => {
                console.log('Reaction change received:', payload);
                
                // Reload reactions for the affected message
                if (payload.new && payload.new.message_id) {
                    await loadReactionsForMessage(payload.new.message_id);
                } else if (payload.old && payload.old.message_id) {
                    await loadReactionsForMessage(payload.old.message_id);
                }
            }
        )
        .subscribe();
    
    // Store subscription for cleanup and register with subscription manager
    window.reactionSubscription = reactionSubscription;
    if (window.subscriptionManager) {
        window.subscriptionManager.register('reactions', reactionSubscription, 'reaction-updates');
    }
}

// Store reference to event handler for cleanup
let reactionEventHandler = null;
let reactionEventTarget = null;

// Cleanup reactions - now handled by subscription manager, just clean UI
function cleanupReactions() {
    console.log('Reaction system: Starting cleanup...');
    
    try {
        // Clean up event listeners
        cleanupReactionEventListeners();
        
        // UI cleanup only - subscriptions handled by subscription manager
        hideReactionMenu();
        closeEmojiPicker();
        
        // Clean up any remaining reaction menus
        const allReactionMenus = document.querySelectorAll('.reaction-menu');
        allReactionMenus.forEach(menu => {
            try {
                menu.remove();
            } catch (error) {
                console.warn('Reaction system: Error removing reaction menu:', error);
            }
        });
        
        // Remove emoji picker modal
        if (emojiPickerModal && emojiPickerModal.parentNode) {
            try {
                emojiPickerModal.parentNode.removeChild(emojiPickerModal);
                emojiPickerModal = null;
            } catch (error) {
                console.warn('Reaction system: Error removing emoji picker modal:', error);
            }
        }
        
        // Reset initialization state
        reactionSystemInitialized = false;
        
        console.log('Reaction system: Cleanup completed');
        
    } catch (error) {
        console.error('Reaction system: Error during cleanup:', error);
    }
}

// Clean up event listeners to prevent conflicts
function cleanupReactionEventListeners() {
    if (reactionEventHandler && reactionEventTarget) {
        try {
            reactionEventTarget.removeEventListener('click', reactionEventHandler);
            console.log('Reaction system: Event listener removed');
        } catch (error) {
            console.warn('Reaction system: Error removing event listener:', error);
        }
        reactionEventHandler = null;
        reactionEventTarget = null;
    }
}

// Add reaction arrow and functionality to message
function addReactionArrowToMessage(messageElement, messageId) {
    console.log('Adding reaction arrow to message:', messageId);
    
    // Validate reaction system is ready
    if (!validateReactionSystem()) {
        console.warn('Reaction system not ready, skipping arrow for message:', messageId);
        return;
    }
    
    // Add message ID as data attribute
    messageElement.dataset.messageId = messageId;
    
    // Create reaction arrow
    const arrow = document.createElement('button');
    arrow.className = 'reaction-arrow';
    arrow.innerHTML = '↓';
    arrow.title = 'React to this message';
    
    // Add arrow to message (position it in the message header)
    const messageHeader = messageElement.querySelector('.message-header');
    if (messageHeader) {
        messageHeader.appendChild(arrow);
        console.log('Arrow added to message header for message:', messageId);
    } else {
        // Fallback: add to message element directly
        messageElement.appendChild(arrow);
        console.log('Arrow added directly to message element for message:', messageId);
    }
    
    // Load reactions for this message
    loadReactionsForMessage(messageId);
}

// Test function for manual testing
function testReactionPopup() {
    console.log('Testing reaction popup...');
    
    // Find a message element
    const messageElement = document.querySelector('.message');
    if (!messageElement) {
        console.error('No message found to test with');
        return;
    }
    
    // Create a test arrow button
    const testArrow = document.createElement('button');
    testArrow.className = 'reaction-arrow';
    testArrow.innerHTML = '↓';
    testArrow.style.position = 'fixed';
    testArrow.style.top = '50px';
    testArrow.style.left = '50px';
    testArrow.style.zIndex = '9999';
    testArrow.style.background = 'red';
    testArrow.style.color = 'white';
    testArrow.style.padding = '10px';
    testArrow.style.border = 'none';
    testArrow.style.cursor = 'pointer';
    testArrow.title = 'Test reaction arrow - click me!';
    
    document.body.appendChild(testArrow);
    
    console.log('Test arrow added to page. Click it to test the popup!');
    
    // Remove after 30 seconds
    setTimeout(() => {
        if (testArrow.parentNode) {
            testArrow.parentNode.removeChild(testArrow);
            console.log('Test arrow removed');
        }
    }, 30000);
}

// Test function for emoji picker
function testEmojiPicker() {
    console.log('🎨 Testing emoji picker...');
    
    // Find a message to test with
    const messageElement = document.querySelector('.message');
    if (!messageElement || !messageElement.dataset.messageId) {
        console.error('❌ No message with ID found to test with');
        return;
    }
    
    const messageId = messageElement.dataset.messageId;
    console.log('📝 Using message ID:', messageId);
    
    // Open emoji picker
    openEmojiPicker(messageId);
    
    console.log('✅ Emoji picker test initiated. The modal should be visible now!');
}

// Global reply state variables
let currentReplyMessageId = null;
let currentReplyMessage = null;

// Enter reply mode (Phase 3 implementation)
async function enterReplyMode(messageId) {
    console.log('💬 Entering reply mode for message:', messageId);
    
    try {
        // Get the original message data
        const originalMessage = await getMessageById(messageId);
        if (!originalMessage) {
            console.error('❌ Could not find original message');
            return;
        }
        
        console.log('📄 Original message:', originalMessage);
        
        // Store reply state
        currentReplyMessageId = messageId;
        currentReplyMessage = originalMessage;
        window.currentReplyMessageId = messageId;
        
        // Create and show reply preview
        showReplyPreview(originalMessage);
        
        // Focus message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.focus();
        }
        
        console.log('✅ Reply mode activated successfully');
        
    } catch (error) {
        console.error('❌ Error entering reply mode:', error);
    }
}

// Get message by ID from DOM or database
async function getMessageById(messageId) {
    // First try to find it in the current DOM
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const sender = messageElement.querySelector('.sender')?.textContent;
        const content = messageElement.querySelector('.content')?.textContent;
        
        if (sender && content) {
            return {
                id: messageId,
                sender: sender,
                content: content
            };
        }
    }
    
    // If not in DOM, fetch from database
    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .single();
        
        if (error) throw error;
        return data;
        
    } catch (error) {
        console.error('❌ Error fetching message from database:', error);
        return null;
    }
}

// Show reply preview above input
function showReplyPreview(originalMessage) {
    console.log('🖼️ Showing reply preview for:', originalMessage);
    
    // Remove any existing preview
    hideReplyPreview();
    
    // Create reply preview container
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.id = 'reply-preview';
    
    // Truncate message content based on screen width
    const displayContent = truncateMessageForPreview(originalMessage.content);
    
    replyPreview.innerHTML = `
        <div class="reply-preview-content">
            <div class="reply-preview-header">
                <span class="reply-icon">↩️</span>
                <span class="reply-text">Replying to <strong>${originalMessage.sender}</strong></span>
                <button class="cancel-reply-btn" title="Cancel reply">✕</button>
            </div>
            <div class="reply-preview-message">${displayContent}</div>
        </div>
    `;
    
    // Find the message input container and insert preview above it
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer) {
        messageInputContainer.parentNode.insertBefore(replyPreview, messageInputContainer);
        console.log('✅ Reply preview inserted above input');
    } else {
        console.error('❌ Could not find message input container');
        return;
    }
    
    // Add cancel button event listener
    const cancelBtn = replyPreview.querySelector('.cancel-reply-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelReply);
    }
}

// Hide/remove reply preview
function hideReplyPreview() {
    const existingPreview = document.getElementById('reply-preview');
    if (existingPreview) {
        existingPreview.remove();
        console.log('🗑️ Reply preview removed');
    }
}

// Cancel reply mode
function cancelReply() {
    console.log('❌ Canceling reply mode');
    
    // Clear reply state
    currentReplyMessageId = null;
    currentReplyMessage = null;
    window.currentReplyMessageId = null;
    
    // Hide preview
    hideReplyPreview();
    
    console.log('✅ Reply mode canceled');
}

// Truncate message content based on screen width
function truncateMessageForPreview(content) {
    const screenWidth = window.innerWidth;
    let maxLength;
    
    // Adjust max length based on screen size
    if (screenWidth <= 480) {
        maxLength = 60; // Mobile phones
    } else if (screenWidth <= 768) {
        maxLength = 80; // Tablets
    } else {
        maxLength = 120; // Desktop
    }
    
    if (content.length > maxLength) {
        return content.substring(0, maxLength) + '...';
    }
    return content;
}

// Test function for reply system
function testReplySystem() {
    console.log('💬 Testing reply system...');
    
    // Find a message to test with
    const messageElement = document.querySelector('.message');
    if (!messageElement || !messageElement.dataset.messageId) {
        console.error('❌ No message with ID found to test with');
        return;
    }
    
    const messageId = messageElement.dataset.messageId;
    console.log('📝 Using message ID:', messageId);
    
    // Enter reply mode
    enterReplyMode(messageId);
    
    console.log('✅ Reply system test initiated. Reply preview should appear above input!');
}

// Make functions available globally
window.initReactionSystem = initReactionSystem;
window.addReactionArrowToMessage = addReactionArrowToMessage;
window.loadAllReactions = loadAllReactions;
window.subscribeToReactions = subscribeToReactions;
window.cleanupReactions = cleanupReactions;
window.hideReactionMenu = hideReactionMenu;
window.closeEmojiPicker = closeEmojiPicker;
window.validateReactionSystem = validateReactionSystem;
window.cleanupReactionEventListeners = cleanupReactionEventListeners;
window.testReactionPopup = testReactionPopup;
window.testEmojiPicker = testEmojiPicker;
window.testReplySystem = testReplySystem;
window.enterReplyMode = enterReplyMode;
window.getMessageById = getMessageById;
window.showReplyPreview = showReplyPreview;
window.hideReplyPreview = hideReplyPreview;
window.cancelReply = cancelReply;
window.truncateMessageForPreview = truncateMessageForPreview;

// Initialize when DOM is ready - handle different loading states
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initReactionSystem); 
} else {
    // DOM already loaded, initialize immediately
    initReactionSystem();
} 