// -------------------------------------------------------------
// src/generateFriendCode.js
// -------------------------------------------------------------
// Utility module for generating unique 6-digit friend codes.
// Used to create shareable codes for adding friends in the app.
// -------------------------------------------------------------

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc, updateDoc, where, collection, query, getDocs } from "firebase/firestore";

// -------------------------------------------------------------
// generateFriendCode()
// -------------------------------------------------------------
// Generates a unique 6-digit friend code for a user.
// The code is guaranteed to be unique by checking against
// existing codes in the Firestore "users" collection.
//
// Returns: Promise<string> - A 6-digit string code (e.g., "042531")
//
// Note: This function contains bugs and may not work correctly:
// - Math.random should be Math.random() (missing parentheses)
// - toString() should be String() or newFriendCode.toString()
// -------------------------------------------------------------
export async function generateFriendCode() {
    try {
        // Reference to the users collection (currently unused)
        const currentFriendCodes = doc(db, "users", "friendCode");
        console.log(currentFriendCodes)
        
        let newFriendCode;
        
        // Generate random codes until we find one that doesn't exist
        do {
          // Generate random number between 0 and 999,999
          newFriendCode = Math.floor(Math.random * 1_000_000);
          // Pad with leading zeros to ensure 6 digits
          newFriendCode = toString(newFriendCode).padStart(6, "0");
        } while (doesValueExists("users", "friendCode", newFriendCode));
        
        return newFriendCode;
    }
    catch {
        console.log("error in generator")
    }
}

// -------------------------------------------------------------
// doesValueExists(collectionName, fieldName, valueToFind)
// -------------------------------------------------------------
// Checks if a specific value exists in a Firestore collection field.
// Used to ensure friend codes are unique before assignment.
//
// Parameters:
//   collectionName (string) - Name of the Firestore collection
//   fieldName (string)      - Name of the field to search
//   valueToFind (any)       - Value to search for
//
// Returns: Promise<boolean> - true if value exists, false otherwise
//
// Example:
//   const exists = await doesValueExists("users", "friendCode", "123456");
// -------------------------------------------------------------
const doesValueExists = async (collectionName, fieldName, valueToFind) => {
  // 1. Construct a query to search for the value
  const collectionRef = collection(db, collectionName);
  const q = query(collectionRef, where(fieldName, "==", valueToFind));

  // 2. Execute the query and get matching documents
  const querySnapshot = await getDocs(q);

  // 3. Check if any documents were found
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

