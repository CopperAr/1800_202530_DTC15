import { getAuth, onAuthStateChanged } from "firebase/auth";
import { logoutUser } from "/src/authentication.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  const nameEl = document.getElementById("name-goes-here");
  
  if (user) {
    if (nameEl) {
      nameEl.textContent = user.displayName || user.email || "User";
    }
  } else {
    console.log("No user signed in.");
    window.location.href = "index.html";
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
