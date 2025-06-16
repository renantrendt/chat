// Message Delete System

// Global variables
let deleteModal = null;
let currentDeleteMessageId = null;

// Initialize delete system
function initDeleteSystem() {
    try {
        // Create delete confirmation modal
        createDeleteModal();
        
        // Set up event listeners
        setupDeleteEventListeners();
        
    } catch (error) {
        console.error('❌ Error initializing delete system:', error);
    }
}

// Create delete confirmation modal
function createDeleteModal() {
    // Remove existing modal if any
    if (deleteModal) {
        deleteModal.remove();
    }
    
    deleteModal = document.createElement('div');
    deleteModal.className = 'delete-modal';
    deleteModal.style.display = 'none';
    
    deleteModal.innerHTML = `
        <div class="delete-modal-content">
            <div class="delete-modal-header">
                <h3 style="color: #ff4444;">U sure about that :?</h3>
            </div>
            <div class="delete-modal-buttons">
                <button class="delete-yes-btn">Yes</button>
                <button class="delete-no-btn">No</button>
            </div>
        </div>
    `;
    
    // Add styling
    const style = document.createElement('style');
    style.textContent = `
        .delete-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        }
        
        .delete-modal-content {
            background-color: #2f3136;
            border-radius: 8px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 2px solid #ff4444;
        }
        
        .delete-modal-header h3 {
            margin: 0 0 25px 0;
            font-size: 20px;
            font-weight: bold;
        }
        
        .delete-modal-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        
        .delete-yes-btn, .delete-no-btn {
            padding: 12px 25px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.2s ease;
            min-width: 80px;
        }
        
        .delete-yes-btn {
            background-color: #ff4444;
            color: white;
        }
        
        .delete-yes-btn:hover {
            background-color: #ff2222;
            transform: translateY(-1px);
        }
        
        .delete-no-btn {
            background-color: #40444b;
            color: white;
        }
        
        .delete-no-btn:hover {
            background-color: #36393f;
            transform: translateY(-1px);
        }
        
        .message-delete-trash {
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: #ff4444;
            font-size: 16px;
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
            opacity: 0;
            transition: all 0.2s ease;
            z-index: 5;
        }
        
        .message:hover .message-delete-trash {
            opacity: 1;
        }
        
        .message-delete-trash:hover {
            background-color: rgba(255, 68, 68, 0.2);
            transform: scale(1.1);
        }
        
        .message {
            position: relative;
        }
        
        .message.deleted .content {
            color: #ff4444;
            font-style: italic;
        }
        
        .message-reply-preview.deleted .original-message-deleted {
            color: #ff4444;
            font-style: italic;
        }
    `;
    
    if (!document.getElementById('delete-modal-styles')) {
        style.id = 'delete-modal-styles';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(deleteModal);
}

// Set up event listeners
function setupDeleteEventListeners() {
    if (!deleteModal) return;
    
    // Yes button
    const yesBtn = deleteModal.querySelector('.delete-yes-btn');
    if (yesBtn) {
        yesBtn.addEventListener('click', confirmDeleteMessage);
    }
    
    // No button
    const noBtn = deleteModal.querySelector('.delete-no-btn');
    if (noBtn) {
        noBtn.addEventListener('click', cancelDeleteMessage);
    }
    
    // Close on backdrop click
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            cancelDeleteMessage();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && deleteModal.style.display === 'flex') {
            cancelDeleteMessage();
        }
    });
}

// Check if message can be deleted (15-minute window)
function canDeleteMessage(messageData) {
    if (!messageData || !messageData.timestamp) return false;
    
    const messageTime = new Date(messageData.timestamp);
    const now = new Date();
    const timeDiff = now - messageTime;
    const minutesDiff = timeDiff / (1000 * 60);
    
    // Allow deletion within 15 minutes
    return minutesDiff <= 15;
}

// Add delete trash can to message
function addDeleteTrashCan(messageElement, messageData) {
    if (!messageData || !canDeleteMessage(messageData)) {
        return; // Don't add trash can if can't delete
    }
    
    // Don't add trash can to already deleted messages
    if (messageData.was_deleted || messageData.content === 'This message was deleted') {
        return;
    }
    
    // Remove existing trash can
    const existingTrash = messageElement.querySelector('.message-delete-trash');
    if (existingTrash) {
        existingTrash.remove();
    }
    
    // Create trash can button
    const trashBtn = document.createElement('button');
    trashBtn.className = 'message-delete-trash';
    trashBtn.innerHTML = '🗑️';
    trashBtn.title = 'Delete message';
    trashBtn.setAttribute('data-message-id', messageData.id);
    
    // Add click event
    trashBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmation(messageData.id);
    });
    
    // Add to message element
    messageElement.appendChild(trashBtn);
}

// Show delete confirmation modal
function showDeleteConfirmation(messageId) {
    
    currentDeleteMessageId = messageId;
    
    if (deleteModal) {
        deleteModal.style.display = 'flex';
    }
}

// Confirm delete message
async function confirmDeleteMessage() {
    if (!currentDeleteMessageId) return;
    
    try {
        // Update Yes button to show loading
        const yesBtn = deleteModal.querySelector('.delete-yes-btn');
        const originalText = yesBtn.textContent;
        yesBtn.disabled = true;
        yesBtn.textContent = 'Deleting...';
        
        // Full update with all fields
        const updateData = {
            content: 'This message was deleted',
            was_deleted: true,
            deleted_at: new Date().toISOString()
        };
        
        // First verify this message belongs to current user
        const { data: messageCheck, error: checkError } = await window.supabaseClient
            .from('messages')
            .select('sender, content')
            .eq('id', currentDeleteMessageId)
            .single();
            
        if (checkError) {
            console.error('❌ Error checking message ownership:', checkError);
            throw new Error('Could not verify message ownership');
        }
        
        if (messageCheck.sender !== window.currentUser) {
            throw new Error('You can only delete your own messages');
        }
        
        const { data, error } = await window.supabaseClient
            .from('messages')
            .update(updateData)
            .eq('id', currentDeleteMessageId)
            .eq('sender', window.currentUser) // Double-check ownership in update
            .select();
        
        if (error) {
            console.error('❌ Supabase delete error details:', {
                error: error,
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }
        
        // Update message display immediately
        updateDeletedMessageDisplay(currentDeleteMessageId);
        
        // Update all reply previews that reference this deleted message
        updateReplyPreviewsForDeletedMessage(currentDeleteMessageId);
        
        // Remove any reactions for this message
        if (window.removeAllReactionsForMessage) {
            await window.removeAllReactionsForMessage(currentDeleteMessageId);
        }
        
        // Close modal
        cancelDeleteMessage();
        
        // Show success feedback
        if (window.showScrollFeedback) {
            window.showScrollFeedback('Message deleted', 'info');
        }
        
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        
        // Restore button state
        const yesBtn = deleteModal.querySelector('.delete-yes-btn');
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
        
        if (window.showScrollFeedback) {
            window.showScrollFeedback('Failed to delete message', 'error');
        }
    }
}

// Cancel delete message
function cancelDeleteMessage() {
    currentDeleteMessageId = null;
    
    if (deleteModal) {
        deleteModal.style.display = 'none';
    }
    
    // Restore Yes button state
    const yesBtn = deleteModal.querySelector('.delete-yes-btn');
    if (yesBtn) {
        yesBtn.disabled = false;
        yesBtn.textContent = 'Yes';
    }
}

// Update deleted message display
function updateDeletedMessageDisplay(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Update content
    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
        contentElement.textContent = 'This message was deleted';
        contentElement.style.color = '#ff4444';
        contentElement.style.fontStyle = 'italic';
    }
    
    // Remove trash can
    const trashBtn = messageElement.querySelector('.message-delete-trash');
    if (trashBtn) {
        trashBtn.remove();
    }
    
    // Remove reactions
    const reactionsContainer = messageElement.querySelector('.reactions-container');
    if (reactionsContainer) {
        reactionsContainer.remove();
    }
    
    // Add deleted class
    messageElement.classList.add('deleted');
}

// Update all reply previews that reference a deleted message
function updateReplyPreviewsForDeletedMessage(deletedMessageId) {
    // Find all reply previews that might reference this deleted message
    const allReplyPreviews = document.querySelectorAll('.message-reply-preview');
    
    allReplyPreviews.forEach(preview => {
        // Check if this preview's onclick references the deleted message
        const onclickAttr = preview.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(deletedMessageId)) {
            // Update the preview to show deleted message
            preview.innerHTML = `
                <span class="reply-icon">↩️</span>
                <span class="original-message-deleted" style="color: #ff4444; font-style: italic;">This message was deleted</span>
            `;
            preview.classList.add('deleted');
            
            // Remove the onclick since we can't scroll to a deleted message
            preview.removeAttribute('onclick');
            preview.style.cursor = 'default';
        }
    });
}

// Function to remove all reactions for a deleted message
async function removeAllReactionsForMessage(messageId) {
    try {
        const { error } = await window.supabaseClient
            .from('reactions')
            .delete()
            .eq('message_id', messageId);
        
        if (error) throw error;
        
    } catch (error) {
        console.error('❌ Error removing reactions for deleted message:', error);
    }
}

// Cleanup function
function cleanupDeleteSystem() {
    // Remove modal
    if (deleteModal && deleteModal.parentNode) {
        deleteModal.parentNode.removeChild(deleteModal);
        deleteModal = null;
    }
    
    // Remove all trash cans
    const allTrashCans = document.querySelectorAll('.message-delete-trash');
    allTrashCans.forEach(trash => {
        try {
            trash.remove();
        } catch (error) {
            console.warn('Error removing trash can:', error);
        }
    });
    
    // Reset state
    currentDeleteMessageId = null;
}

// Make functions available globally
window.initDeleteSystem = initDeleteSystem;
window.addDeleteTrashCan = addDeleteTrashCan;
window.canDeleteMessage = canDeleteMessage;
window.showDeleteConfirmation = showDeleteConfirmation;
window.removeAllReactionsForMessage = removeAllReactionsForMessage;
window.cleanupDeleteSystem = cleanupDeleteSystem;
window.updateDeletedMessageDisplay = updateDeletedMessageDisplay;
window.updateReplyPreviewsForDeletedMessage = updateReplyPreviewsForDeletedMessage;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeleteSystem);
} else {
    initDeleteSystem();
} 