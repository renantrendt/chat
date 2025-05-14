// Firebase Debug Helper
// This script adds debugging functionality to help troubleshoot Firebase connection issues

// Add this script after firebase-config.js but before app.js

// Firebase connection status monitor
function monitorFirebaseConnection() {
  const connectedRef = firebase.database().ref('.info/connected');
  
  connectedRef.on('value', (snap) => {
    const status = snap.val() ? 'Connected' : 'Disconnected';
    console.log(`Firebase Status: ${status} at ${new Date().toLocaleTimeString()}`);
    
    // Add visual indicator
    updateConnectionStatus(status);
  });
}

// Create visual status indicator
function createStatusIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'firebase-status';
  indicator.style.position = 'fixed';
  indicator.style.bottom = '10px';
  indicator.style.right = '10px';
  indicator.style.padding = '5px 10px';
  indicator.style.borderRadius = '4px';
  indicator.style.fontSize = '12px';
  indicator.style.fontWeight = 'bold';
  indicator.style.zIndex = '1000';
  indicator.textContent = 'Firebase: Connecting...';
  indicator.style.backgroundColor = '#f0ad4e';
  indicator.style.color = 'white';
  
  document.body.appendChild(indicator);
  return indicator;
}

// Update connection status indicator
function updateConnectionStatus(status) {
  let indicator = document.getElementById('firebase-status');
  
  if (!indicator) {
    indicator = createStatusIndicator();
  }
  
  if (status === 'Connected') {
    indicator.style.backgroundColor = '#5cb85c';
    indicator.textContent = 'Firebase: Connected';
  } else {
    indicator.style.backgroundColor = '#d9534f';
    indicator.textContent = 'Firebase: Disconnected';
  }
}

// Message debugging
function setupMessageDebugging() {
  // Override the original sendMessage function to add debugging
  if (window.originalSendMessage === undefined) {
    window.originalSendMessage = window.sendMessage;
    
    window.sendMessage = function(content) {
      console.group('Sending Message');
      console.log('Content:', content);
      console.log('Room:', currentRoom);
      console.log('User:', currentUser);
      console.log('Time:', new Date().toLocaleTimeString());
      
      const result = window.originalSendMessage.call(this, content);
      
      console.log('Send complete');
      console.groupEnd();
      
      return result;
    };
  }
}

// Initialize debugging
document.addEventListener('DOMContentLoaded', function() {
  console.log('Firebase Debug Helper loaded');
  
  // Wait a moment for Firebase to initialize
  setTimeout(() => {
    monitorFirebaseConnection();
    setupMessageDebugging();
    
    // Log Firebase config
    console.log('Firebase Config:', {
      databaseURL: firebase.app().options.databaseURL,
      projectId: firebase.app().options.projectId
    });
  }, 1000);
});
