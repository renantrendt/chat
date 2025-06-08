// Firebase configuration
// Using a demo Firebase project for testing purposes
// In a production app, you would use your own Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyDxJaU8bLdx7sSJ8fcRd2jC_KortS189G8",
  authDomain: "msg-demo-app-3a985.firebaseapp.com",
  databaseURL: "https://msg-demo-app-3a985-default-rtdb.firebaseio.com",
  projectId: "msg-demo-app-3a985",
  storageBucket: "msg-demo-app-3a985.appspot.com",
  messagingSenderId: "506729163523",
  appId: "1:506729163523:web:a4b5c76bf86b9136f3e5d1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get a reference to the database service
const database = firebase.database();
