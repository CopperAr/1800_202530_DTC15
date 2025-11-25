// -------------------------------------------------------------
// src/profile.js
// -------------------------------------------------------------
// User profile management page for the Hang Out app.
// Allows users to:
// - View their profile information (name, pronouns, city, email)
// - Edit profile details
// - Copy email address to clipboard
// - Sign out
// - Access contact information
// -------------------------------------------------------------

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { logoutUser } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const auth = getAuth();

// -------------------------------------------------------------
// DOM Element References
// -------------------------------------------------------------
// Get references to all UI elements for profile view and edit modes
// -------------------------------------------------------------

// Profile view elements
const profileView = document.getElementById("profileView");
const editBtn = document.getElementById("editBtn");
const signOutBtn = document.getElementById("signOutBtn");
const contactBtn = document.getElementById("contactBtn");

// Edit profile view elements
const editProfileView = document.getElementById("editProfileView");
const discardEditBtn = document.getElementById("discardEditBtn");
const saveButton = document.getElementById("saveButton");

// Contact dialog elements
const contactDialog = document.getElementById("contact-dialog");
const closeContactDialog = document.getElementById("closeContactDialog")


// -------------------------------------------------------------
// setVisible(el, visible)
// -------------------------------------------------------------
// Utility function to toggle element visibility using Bootstrap classes.
//
// Parameters:
//   el - DOM element to toggle
//   visible (boolean) - true to show, false to hide
// -------------------------------------------------------------
function setVisible(el, visible) {
  if (el) {
    el.classList.toggle("d-none", !visible);
  }
}

// -------------------------------------------------------------
// populateUserInfo()
// -------------------------------------------------------------
// Fetches and displays user profile information from Firestore.
// Populates both the view mode and edit mode forms.
// Redirects to login if user is not authenticated.
// -------------------------------------------------------------
function populateUserInfo() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Get references to display elements
      const nameEl = document.getElementById("name-goes-here");
      const pronounsEl = document.getElementById("pronouns-goes-here");
      const cityEl = document.getElementById("city-goes-here");
      const emailEl = document.getElementById("email-goes-here");

      try {
        // Fetch user document from Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          // Extract user data with defaults
          const userData = userSnap.data();
          const {
            displayName = "",
            email = "",
            pronouns = "",
            city = "",
          } = userData;

          // Populate view mode elements
          if (nameEl)
            nameEl.textContent = displayName || user.displayName || "User";
          if (pronounsEl) pronounsEl.textContent = pronouns;
          if (cityEl) cityEl.textContent = city;
          if (emailEl) emailEl.value = email || user.email;

          // Populate edit mode form inputs
          const nameInput = document.getElementById("nameInput");
          const pronounInput = document.getElementById("pronounInput");
          const cityInput = document.getElementById("cityInput");

          if (nameInput) nameInput.value = displayName || "";
          if (pronounInput) pronounInput.value = pronouns || "";
          if (cityInput) cityInput.value = city || "";
        } else {
          // Firestore document doesn't exist, use auth data
          if (nameEl)
            nameEl.textContent = user.displayName || user.email || "User";
          if (emailEl) emailEl.value = user.email || "";
        }
      } catch (error) {
        console.error("Error getting user document:", error);
      }
    } else {
      // No user signed in, redirect to login
      console.log("No user signed in.");
      window.location.href = "index.html";
    }
  });
}

// Initialize profile data on page load
populateUserInfo();

// -------------------------------------------------------------
// View/Edit Mode Toggle Handlers
// -------------------------------------------------------------

// Switch from profile view to edit mode
if (editBtn) {
  editBtn.addEventListener("click", () => {
    setVisible(profileView, false);
    setVisible(editProfileView, true);
  });
}

// Switch from edit mode back to profile view (discards changes)
if (discardEditBtn) {
  discardEditBtn.addEventListener("click", () => {
    setVisible(editProfileView, false);
    setVisible(profileView, true);
    populateUserInfo(); // Reset any unsaved changes in Edit Profile form
  });
}

// -------------------------------------------------------------
// Save Profile Changes
// -------------------------------------------------------------
// Saves edited profile information to Firestore and returns to view mode.
// -------------------------------------------------------------
if (saveButton) {
  saveButton.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("No user is signed in. Please log in first.");
      return;
    }
    
    // Get new values from the edit form
    const newName = document.getElementById("nameInput").value;
    const newPronouns = document.getElementById("pronounInput").value;
    const newCity = document.getElementById("cityInput").value;

    try {
      // Update Firestore user document
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newName,
        pronouns: newPronouns,
        city: newCity,
      });
      console.log("User document successfully updated!");

      // Return to profile view and refresh data
      setVisible(editProfileView, false);
      setVisible(profileView, true);
      populateUserInfo();
    } catch (error) {
      console.error("Error updating user document:", error);
      alert("Failed to update profile. Please try again.");
    }
  });
}

// -------------------------------------------------------------
// Copy Email to Clipboard
// -------------------------------------------------------------
// Copies the user's email address to clipboard and shows feedback.
// -------------------------------------------------------------
const copyButton = document.getElementById("copyButton");
if (copyButton) {
  copyButton.addEventListener("click", function () {
    const emailField = document.getElementById("email-goes-here");
    const feedbackMessage = document.getElementById("feedbackMessage");

    // Use modern Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(emailField.value)
        .then(() => {
          // Show success feedback for 2 seconds
          feedbackMessage.style.display = "block";
          setTimeout(() => {
            feedbackMessage.style.display = "none";
          }, 2000);
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          alert("Failed to copy text.");
        });
    } else {
      // Fallback for older browsers
      emailField.select();
      document.execCommand("copy");
      feedbackMessage.style.display = "block";
      setTimeout(() => {
        feedbackMessage.style.display = "none";
      }, 2000);
    }
  });
}

// -------------------------------------------------------------
// Sign Out Handler
// -------------------------------------------------------------
// Logs out the user and redirects to the login page.
// -------------------------------------------------------------
if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  });
}

// -------------------------------------------------------------
// Contact Dialog Handlers
// -------------------------------------------------------------
// Opens and closes the contact information dialog.
// -------------------------------------------------------------

// Open contact dialog from profile view
contactBtn.addEventListener("click", () => {
  contactDialog.showModal();
});

// Close contact dialog
closeContactDialog.addEventListener("click", () => {
  contactDialog.close();
});
