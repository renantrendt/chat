# Message Read Status Feature - To-Do List

## Phase 1: Double Check Mark Feature

### 1. Database Setup
- [x] Create check mark status enum in messages table (sent, delivered, read)
- [x] Add `is_read` boolean column to messages table
- [x] Add `read_at` timestamp column to messages table
- [x] Update message_reads table to track when each user reads each message
- [x] Create indexes on message_reads for performance

### 2. User Activity Tracking
- [x] Implement active_users table functionality to track when users are online
- [x] Add user activity heartbeat (update every 30 seconds while tab is active)
- [x] Add last_active timestamp to track user presence
- [x] Create cleanup job to mark users as inactive after timeout (e.g., 1 minute)

### 3. Check Mark Assets
- [x] Create/obtain single gray check mark icon
- [x] Create/obtain double check mark icon (gray for delivered, blue for read)
- [x] Add CSS classes for check mark states

### 4. Frontend Implementation
- [x] Modify message display to show check marks based on status
- [x] Add real-time listener for message status updates
- [x] Update message status when recipient is active and message enters viewport
- [x] Implement intersection observer to detect when messages are visible

### 5. Backend Logic
- [x] Create function to update message status to 'delivered' when recipient is online
- [x] Create function to update message status to 'read' when recipient views message
- [x] Set up real-time subscriptions for message status changes
- [x] Implement batch updates for multiple messages read at once

## Phase 2: Unread Message Count in Title

### 6. Unread Count Tracking
- [ ] Implement unread_counts table functionality
- [ ] Create function to calculate unread messages per room per user
- [ ] Update counts when messages are sent
- [ ] Update counts when messages are read

### 7. Title Update Feature
- [ ] Add JavaScript to update document.title with unread count
- [ ] Format: "Chat App (3)" when 3 unread messages
- [ ] Update count in real-time as messages arrive/are read
- [ ] Reset count when user views messages

## Technical Requirements
- [x] Ensure all database operations use Row Level Security
- [x] Add proper error handling for all database operations
- [x] Implement optimistic UI updates for better UX
- [x] Add loading states for async operations
- [ ] Test with multiple users simultaneously 