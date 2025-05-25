// QUICK FIX FOR CHECKMARKS - Add this to your browser console while in a chat room

// Simulate message status updates every 2 seconds
let statusInterval = setInterval(() => {
    // Get all sent messages
    const sentMessages = document.querySelectorAll('.message.sent');
    
    sentMessages.forEach((msg, index) => {
        // Simulate progression: sent -> delivered -> read
        setTimeout(() => {
            // First show delivered (double gray checks)
            addMessageStatus(msg, 'delivered');
            
            // Then show read (double blue checks) after 3 seconds
            setTimeout(() => {
                addMessageStatus(msg, 'read');
            }, 3000);
        }, index * 1000); // Stagger the updates
    });
}, 5000);

// To stop the simulation, run: clearInterval(statusInterval)

console.log('Checkmark simulation started! Your messages will update to delivered then read.');
console.log('To stop, run: clearInterval(statusInterval)'); 