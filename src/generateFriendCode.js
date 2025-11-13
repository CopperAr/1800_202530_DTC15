import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc, updateDoc, where, collection, query, getDocs } from "firebase/firestore";


// Generate 6 digit friend code
export async function generateFriendCode() {
    try {
        const currentFriendCodes = doc(db, "users", "friendCode");
        console.log(currentFriendCodes)
        //console.log(currentFriendCodes.length);
        let newFriendCode;
        do {
          newFriendCode = Math.floor(Math.random * 1_000_000);
          newFriendCode = toString(newFriendCode).padStart(6, "0");
        } while (doesValueExists("users", "friendCode", newFriendCode));
        return newFriendCode;
    }
    catch {
        console.log("error in generator")
    }
}



const doesValueExists = async (collectionName, fieldName, valueToFind) => {
  // 1. Construct a query
  const collectionRef = collection(db, collectionName);
  const q = query(collectionRef, where(fieldName, "==", valueToFind));

  // 2. Get the documents
  const querySnapshot = await getDocs(q);

  // 3. Check for existence
  if (!querySnapshot.empty) {
    console.log("A document with the specific value exists.");
    // You can also iterate through the documents if needed
    // querySnapshot.forEach((doc) => { ... });
    return true;
  } else {
    console.log("No document with the specific value was found.");
    return false;
  }
};

// Example usage:
// isValueExists("users", "email", "test@example.com");

