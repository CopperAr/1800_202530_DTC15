// src/firebaseConfig.js
// -------------------------------------------------------------
// Firebase initialization for the DTC15 project.
// Uses the provided Firebase web configuration to connect
// the web application to the dtc15-fd364 Firebase project.
// -------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// The Firebase configuration values supplied for the project.
const firebaseConfig = {
  apiKey: "AIzaSyA2YV95u4k1p0WGdHvXGiLlWJIZF7MWbVo",
  authDomain: "dtc15-fd364.firebaseapp.com",
  projectId: "dtc15-fd364",
  storageBucket: "dtc15-fd364.firebasestorage.app",
  messagingSenderId: "718650563781",
  appId: "1:718650563781:web:29d5f6d1c6c8bbba10a4ac",
  measurementId: "G-9DBRV18TX7",
};

// Initialize Firebase using the supplied configuration.
const app = initializeApp(firebaseConfig);

// Export the Firebase Auth instance for use across the app.
const auth = getAuth(app);

export { app, auth, firebaseConfig };
