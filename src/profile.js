import { getAuth, onAuthStateChanged } from "firebase/auth";
import { onAuthReady } from "/src/authentication.js";
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc, onSnapshot } from "firebase/firestore";


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
          document.getElementById("name-goes-here").textContent = displayName;
          document.getElementById("userID-goes-here").textContent = uid;

          //Populate Edit Page
          document.getElementById("nameInput").value = displayName;
          if (pronouns) document.getElementById("pronounInput").value = pronouns;
          if (city) document.getElementById("cityInput").value = city;
          
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
// Function to enable editing of user info form fields
//------------------------------------------------------------- 
document.querySelector('#editBtn').addEventListener('click', editUserInfo);
function editUserInfo() {
    //Enable the form fields
    document.getElementById('personalInfoFields').disabled = false;
}

//-------------------------------------------------------------
// Function to save updated user info from the profile form
//-------------------------------------------------------------
document.querySelector('#saveButton').addEventListener('click', saveUserInfo);   //Add event listener for save button
async function saveUserInfo() {
		  const user = auth.currentUser;   // ✅ get the currently logged-in user
	    if (!user) {
		    alert("No user is signed in. Please log in first.");
		    return;
		  }
     //enter code here

     //a) get user entered values

     //b) update user's document in Firestore

     //c) disable edit 
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
