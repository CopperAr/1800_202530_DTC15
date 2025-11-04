import { getAuth, onAuthStateChanged } from "firebase/auth";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  const userIDEl = document.getElementById("userID-goes-here");
  if (user) {
    // User is signed in, get their UID
    const uid = user.uid;
    console.log("User UID:", uid);
    userIDEl.textContent = `${uid}`;
    // You can now use this UID to access their data in Firestore
  } else {
    // User is signed out
    console.log("No user signed in.");
  }
});


//copy userID to clipboard
document.getElementById("copyButton").addEventListener("click", function () {
  const inputField = document.getElementById("userID-goes-here");
  const feedbackMessage = document.getElementById("feedbackMessage");

  // Use the Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(inputField.textContent)
      .then(() => {
        feedbackMessage.style.display = "block";
        setTimeout(() => {
          feedbackMessage.style.display = "none";
        }, 2000); // Hide after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy text.");
      });
  } else {
    // Fallback for older browsers (e.g., using document.execCommand)
    inputField.select();
    document.execCommand("copy");
    feedbackMessage.style.display = "block";
    setTimeout(() => {
      feedbackMessage.style.display = "none";
    }, 2000);
  }
});
