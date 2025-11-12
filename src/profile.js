import { getAuth, onAuthStateChanged } from "firebase/auth";
import { logoutUser } from "/src/authentication.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  const userIDEl = document.getElementById("userID-goes-here");
  const nameEl = document.getElementById("name-goes-here");
  
  if (user) {
    const uid = user.uid;
    console.log("User UID:", uid);
    userIDEl.value = uid;
    
    if (nameEl) {
      nameEl.textContent = user.displayName || user.email || "User";
    }
  } else {
    console.log("No user signed in.");
    window.location.href = "index.html";
  }
});


document.getElementById("copyButton").addEventListener("click", function () {
  const inputField = document.getElementById("userID-goes-here");
  const feedbackMessage = document.getElementById("feedbackMessage");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(inputField.value)
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
    inputField.select();
    document.execCommand("copy");
    feedbackMessage.style.display = "block";
    setTimeout(() => {
      feedbackMessage.style.display = "none";
    }, 2000);
  }
});

const signOutBtn = document.getElementById("signOutBtn");
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
