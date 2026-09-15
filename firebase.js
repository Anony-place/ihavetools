// iHaveTools Firebase client initialization.
// Firebase config values are safe to ship in client-side code; access is
// controlled by Firebase Security Rules and authorized domains.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiqEbvBOS1SKJ2J9d-CmSZ1WIHHXKvwhk",
  authDomain: "portpolio-c68d7.firebaseapp.com",
  projectId: "portpolio-c68d7",
  storageBucket: "portpolio-c68d7.firebasestorage.app",
  messagingSenderId: "825673490043",
  appId: "1:825673490043:web:3266d2a9bfd7d5970d4cde",
  measurementId: "G-7GZ13H19Y3"
};

const app = initializeApp(firebaseConfig);

// Analytics is optional and may be unsupported in some browsers/environments.
// Expose the initialized app for future Firebase services.
export { app };

if (firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  }).catch(() => {
    // Keep the site functional if Analytics is unavailable.
  });
}
