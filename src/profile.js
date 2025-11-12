import { getAuth, onAuthStateChanged } from "firebase/auth";
import { onAuthReady } from "/src/authentication.js";
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";


function populateUserInfo() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // reference to the user document
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          const { displayName = "", uid = "", pronouns = "" ,city = "" } = userData;
          console.log(userData)
          //Populate Profile Page
          // if (!pronouns) setVisible(pronouns-go-here, false)
          document.getElementById("name-goes-here").textContent = displayName;
          document.getElementById("pronouns-go-here").textContent = pronouns;
          document.getElementById("city-goes-here").textContent = city;
          document.getElementById("userID-goes-here").textContent = uid;


          //Populate Edit Page
          document.getElementById("nameInput").value = displayName;
          document.getElementById("pronounInput").value = pronouns;
          document.getElementById("cityInput").value = city;
          
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error getting user document:", error);
      }
    } else {
      console.log("No user is signed in");
    }
  });
}

//call the function to run it
populateUserInfo();

//-------------------------------------------------------------
// Toggle between views
//-------------------------------------------------------------
function setVisible(el, visible) {
        el.classList.toggle('d-none', !visible);
    }

editBtn?.addEventListener("click", () => {
  setVisible(profileView, false);
  setVisible(editProfileView, true);
} )

discardEditBtn?.addEventListener("click", () => {
  setVisible(editProfileView, false);
  setVisible(profileView, true);
});


//-------------------------------------------------------------
// Function to save updated user info from the profile form
//-------------------------------------------------------------
document.querySelector('#saveButton').addEventListener('click', saveUserInfo);   //Add event listener for save button
async function saveUserInfo() {
  const user = auth.currentUser; // ✅ get the currently logged-in user
  if (!user) {
    alert("No user is signed in. Please log in first.");
    return;
  }
  //enter code here

  //a) get user entered values
  const newName = document.getElementById("nameInput").value; //get the value of the field with id="nameInput"
  const newPronouns = document.getElementById("pronounInput").value; //get the value of the field with id="pronounInput"
  const newCity = document.getElementById("cityInput").value; //get the value of the field with id="cityInput"

  //b) update user's document in Firestore
  await updateUserDocument(user.uid, newName, newPronouns, newCity); 

  //c) return to profile
  setVisible(editProfileView, false);
  setVisible(profileView, true);
  populateUserInfo();
}

//-------------------------------------------------------------
// Updates the user document in Firestore with new values
// Parameters:
//   uid (string)  – user’s UID
//   name, school, city (strings)
//-------------------------------------------------------------
async function updateUserDocument(uid, displayName, pronouns, city) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { displayName, pronouns, city });
    console.log("User document successfully updated!");
  } catch (error) {
    console.error("Error updating user document:", error);
  }
}

//-------------------------------------------------------------
//Copy userID to clipboard
//-------------------------------------------------------------
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
