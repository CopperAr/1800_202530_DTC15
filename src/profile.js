import { getAuth, onAuthStateChanged } from "firebase/auth";
import { logoutUser } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const auth = getAuth();

//declare constants for profileView
const profileView = document.getElementById("profileView");
const editBtn = document.getElementById("editBtn");
const signOutBtn = document.getElementById("signOutBtn");
const contactBtn = document.getElementById("contactBtn");

//declare constants for editProfileView
const editProfileView = document.getElementById("editProfileView");
const discardEditBtn = document.getElementById("discardEditBtn");
const saveButton = document.getElementById("saveButton");

// Declare constants for Contact dialog window
const contactDialog = document.getElementById("contact-dialog");
const closeContactDialog = document.getElementById("closeContactDialog")


//toggles the display of html section between visibile and none
function setVisible(el, visible) {
  if (el) {
    el.classList.toggle("d-none", !visible);
  }
}

// Get user name, pronouns, city, and email from firestore
function populateUserInfo() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const nameEl = document.getElementById("name-goes-here");
      const pronounsEl = document.getElementById("pronouns-goes-here");
      const cityEl = document.getElementById("city-goes-here");
      const emailEl = document.getElementById("email-goes-here");

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const {
            displayName = "",
            email = "",
            pronouns = "",
            city = "",
          } = userData;

          if (nameEl)
            nameEl.textContent = displayName || user.displayName || "User";
          if (pronounsEl) pronounsEl.textContent = pronouns;
          if (cityEl) cityEl.textContent = city;
          if (emailEl) emailEl.value = email || user.email;

          const nameInput = document.getElementById("nameInput");
          const pronounInput = document.getElementById("pronounInput");
          const cityInput = document.getElementById("cityInput");

          if (nameInput) nameInput.value = displayName || "";
          if (pronounInput) pronounInput.value = pronouns || "";
          if (cityInput) cityInput.value = city || "";
        } else {
          if (nameEl)
            nameEl.textContent = user.displayName || user.email || "User";
          if (emailEl) emailEl.value = user.email || "";
        }
      } catch (error) {
        console.error("Error getting user document:", error);
      }
    } else {
      console.log("No user signed in.");
      window.location.href = "index.html";
    }
  });
}

//populates info when page first loads
populateUserInfo();

// profileView -> editProfileView
if (editBtn) {
  editBtn.addEventListener("click", () => {
    setVisible(profileView, false);
    setVisible(editProfileView, true);
  });
}

// editProfileView -> profileView
if (discardEditBtn) {
  discardEditBtn.addEventListener("click", () => {
    setVisible(editProfileView, false);
    setVisible(profileView, true);
    populateUserInfo(); //Resets any unsaved changes in Edit Profile form
  });
}

/* Saves any changes to user Info, then
 editProfileView -> profileView */
if (saveButton) {
  saveButton.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("No user is signed in. Please log in first.");
      return;
    }
    // get new values from html form
    const newName = document.getElementById("nameInput").value;
    const newPronouns = document.getElementById("pronounInput").value;
    const newCity = document.getElementById("cityInput").value;

    try {
      // update firestore with new values
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newName,
        pronouns: newPronouns,
        city: newCity,
      });
      console.log("User document successfully updated!");

      // After saving edits, display profile page and load updated info from firestore
      setVisible(editProfileView, false);
      setVisible(profileView, true);
      populateUserInfo();
    } catch (error) {
      console.error("Error updating user document:", error);
      alert("Failed to update profile. Please try again.");
    }
  });
}

// Copy e-mail address to clipboard
const copyButton = document.getElementById("copyButton");
if (copyButton) {
  copyButton.addEventListener("click", function () {
    const emailField = document.getElementById("email-goes-here");
    const feedbackMessage = document.getElementById("feedbackMessage");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(emailField.value)
        .then(() => {
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
      emailField.select();
      document.execCommand("copy");
      feedbackMessage.style.display = "block";
      setTimeout(() => {
        feedbackMessage.style.display = "none";
      }, 2000);
    }
  });
}

// Log out user, which will redirect to index.html
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


// Open contact dialog window from profileView
contactBtn.addEventListener("click", () => {
  contactDialog.showModal();
});


// Close contact dialog window from profileView
closeContactDialog.addEventListener("click", () => {
  contactDialog.close();
});
