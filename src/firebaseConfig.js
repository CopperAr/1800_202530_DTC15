// src/firebaseConfig.js
// -------------------------------------------------------------
// Firebase initialization for the DTC15 project (Hang Out).
// Reads configuration from Vite environment variables and exposes
// the Firebase Auth instance for login/signup/logout flows.
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// ---------------------------------------------------------
// Read Firebase configuration from Vite environment variables.
// Define these in your project .env file (prefixed with VITE_):
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// VITE_FIREBASE_PROJECT_ID=...
// VITE_FIREBASE_APP_ID=...
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase app and export Auth instance
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
