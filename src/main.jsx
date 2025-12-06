import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import React from 'react'
import ReactDOM from 'react-dom/client'


// --- ADD THIS SECTION ---
window.__app_id = "1:774785880034:web:76fe312ff23cb1d51233bb"; // Unique ID for your artifact path
window.__firebase_config = {
  apiKey: "AIzaSyBwdWRjzCwqzk3X56SBcAdpFExAq5o6clw",
  authDomain: "sync-bridge-59a19.firebaseapp.com",
  projectId: "sync-bridge-59a19",
  storageBucket: "sync-bridge-59a19.firebasestorage.app",
  messagingSenderId: "774785880034",
  appId: "1:774785880034:web:76fe312ff23cb1d51233bb",
  measurementId: "G-8Q6LVMSKK7"
};
// ------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
