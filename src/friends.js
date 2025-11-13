// src/friends.js
// Friends management functionality for the Hang Out app

import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  or,
  and,
} from "firebase/firestore";

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  const addFriendForm = document.getElementById("addFriendForm");
  const friendUserIdInput = document.getElementById("friendUserId");
  const addFriendMessage = document.getElementById("addFriendMessage");
  const friendRequestsList = document.getElementById("friendRequestsList");
  const myFriendsList = document.getElementById("myFriendsList");
  const requestCountBadge = document.getElementById("requestCount");
  const friendCountBadge = document.getElementById("friendCount");

  if (
    !addFriendForm ||
    !friendUserIdInput ||
    !addFriendMessage ||
    !friendRequestsList ||
    !myFriendsList
  ) {
    console.warn("Friends page DOM elements not ready");
    return;
  }

  // Check authentication
  onAuthReady((user) => {
    if (!user) {
      // Not logged in → redirect to login page
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    const uid = user.uid;

    // Listen to incoming friend requests (where toUserId == current user && status == 'pending')
    const requestsQuery = query(
      collection(db, "friendships"),
      where("toUserId", "==", uid),
      where("status", "==", "pending")
    );

    onSnapshot(
      requestsQuery,
      async (snapshot) => {
        friendRequestsList.innerHTML = "";
        const requests = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          requests.push({ id: docSnap.id, ...data });
        }

        requestCountBadge.textContent = requests.length;

        if (requests.length === 0) {
          friendRequestsList.innerHTML =
            '<li class="list-group-item text-muted">No pending requests.</li>';
        } else {
          for (const req of requests) {
            const fromUserData = await getUserData(req.fromUserId);
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            
            const userName = fromUserData?.displayName || fromUserData?.email || req.fromUserId;
            const userEmail = fromUserData?.email || '';
            
            li.innerHTML = `
              <div>
                <strong>${userName}</strong>
                <br><small class="text-muted">${userEmail}</small>
              </div>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-success btn-sm accept-btn" data-id="${req.id}">Accept</button>
                <button class="btn btn-danger btn-sm reject-btn" data-id="${req.id}">Reject</button>
              </div>
            `;
            friendRequestsList.appendChild(li);
          }

          // Add event listeners for accept/reject buttons
          friendRequestsList.querySelectorAll(".accept-btn").forEach((btn) => {
            btn.addEventListener("click", () => acceptFriendRequest(btn.dataset.id));
          });

          friendRequestsList.querySelectorAll(".reject-btn").forEach((btn) => {
            btn.addEventListener("click", () => rejectFriendRequest(btn.dataset.id));
          });
        }
      },
      (error) => {
        console.error("Error listening to friend requests:", error);
      }
    );

    // Listen to accepted friendships (where user is either fromUserId or toUserId && status == 'accepted')
    const friendsQuery = query(
      collection(db, "friendships"),
      where("status", "==", "accepted")
    );

    onSnapshot(
      friendsQuery,
      async (snapshot) => {
        myFriendsList.innerHTML = "";
        const friends = [];

        console.log("Friends query snapshot size:", snapshot.size);
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          console.log("Checking friendship:", docSnap.id, data);
          
          // Only include if current user is part of this friendship
          if (data.fromUserId === uid || data.toUserId === uid) {
            const friendId = data.fromUserId === uid ? data.toUserId : data.fromUserId;
            friends.push({ id: docSnap.id, friendId, ...data });
            console.log("Added friend:", friendId);
          }
        }

        console.log("Total friends found:", friends.length);
        friendCountBadge.textContent = friends.length;

        if (friends.length === 0) {
          myFriendsList.innerHTML =
            '<li class="list-group-item text-muted">No friends yet. Add some to get started!</li>';
        } else {
          for (const friend of friends) {
            const friendData = await getUserData(friend.friendId);
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            
            const userName = friendData?.displayName || friendData?.email || friend.friendId;
            const userEmail = friendData?.email || '';
            
            li.innerHTML = `
              <div>
                <strong>${userName}</strong>
                <br><small class="text-muted">${userEmail}</small>
              </div>
              <button class="btn btn-outline-danger btn-sm remove-btn" data-id="${friend.id}">Remove</button>
            `;
            myFriendsList.appendChild(li);
          }

          // Add event listeners for remove buttons
          myFriendsList.querySelectorAll(".remove-btn").forEach((btn) => {
            btn.addEventListener("click", () => removeFriend(btn.dataset.id));
          });
        }
      },
      (error) => {
        console.error("Error listening to friends:", error);
      }
    );
  });

  // Handle "Add Friend" form submission
  addFriendForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser) {
      showMessage("Please log in first.", "danger");
      return;
    }

    const friendEmail = friendUserIdInput.value.trim();

    if (!friendEmail) {
      showMessage("Please enter an email address.", "danger");
      return;
    }

    if (friendEmail === currentUser.email) {
      showMessage("You cannot add yourself as a friend.", "danger");
      return;
    }

    try {
      // Find user by email
      const friendUserId = await getUserIdByEmail(friendEmail);
      
      if (!friendUserId) {
        showMessage("User not found. Please check the email address.", "danger");
        return;
      }

      // Check if friendship already exists
      const existingFriendship = await checkFriendshipExists(currentUser.uid, friendUserId);
      if (existingFriendship) {
        showMessage("Friend request already sent or you are already friends.", "warning");
        return;
      }

      // Create friend request
      await addDoc(collection(db, "friendships"), {
        fromUserId: currentUser.uid,
        toUserId: friendUserId,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showMessage("Friend request sent successfully!", "success");
      friendUserIdInput.value = "";
    } catch (error) {
      console.error("Error sending friend request:", error);
      showMessage("Failed to send friend request. Please try again.", "danger");
    }
  });

  // Helper function to display messages
  function showMessage(message, type = "info") {
    addFriendMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      addFriendMessage.innerHTML = "";
    }, 5000);
  }

  // Helper function to get user data from Firestore
  async function getUserData(userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }

  // Helper function to check if user exists
  async function checkUserExists(userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      return userDoc.exists();
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false;
    }
  }

  // Helper function to find user UID by email
  async function getUserIdByEmail(email) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      
      return new Promise((resolve) => {
        const unsubscribe = onSnapshot(q, (snapshot) => {
          unsubscribe();
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            resolve(userDoc.id);
          } else {
            resolve(null);
          }
        }, (error) => {
          console.error("Error finding user by email:", error);
          resolve(null);
        });
      });
    } catch (error) {
      console.error("Error in getUserIdByEmail:", error);
      return null;
    }
  }

  // Helper function to check if friendship already exists
  async function checkFriendshipExists(userId1, userId2) {
    try {
      const friendshipsRef = collection(db, "friendships");
      
      // Check both directions
      const q1 = query(
        friendshipsRef,
        where("fromUserId", "==", userId1),
        where("toUserId", "==", userId2)
      );
      
      const q2 = query(
        friendshipsRef,
        where("fromUserId", "==", userId2),
        where("toUserId", "==", userId1)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDoc(doc(friendshipsRef, "temp")), // Dummy call to avoid empty promises
        getDoc(doc(friendshipsRef, "temp"))
      ]);

      // Use onSnapshot to get real-time data (but we'll use it synchronously here)
      return new Promise((resolve) => {
        let found = false;
        let checkedQueries = 0;

        const checkComplete = () => {
          checkedQueries++;
          if (checkedQueries === 2) {
            resolve(found);
          }
        };

        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
          if (!snapshot.empty) {
            found = true;
          }
          unsubscribe1();
          checkComplete();
        });

        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
          if (!snapshot.empty) {
            found = true;
          }
          unsubscribe2();
          checkComplete();
        });
      });
    } catch (error) {
      console.error("Error checking friendship:", error);
      return false;
    }
  }

  // Accept friend request
  async function acceptFriendRequest(requestId) {
    try {
      console.log("Accepting friend request:", requestId);
      await updateDoc(doc(db, "friendships", requestId), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
      console.log("Friend request accepted successfully");
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("Failed to accept friend request. Please try again.");
    }
  }

  // Reject friend request
  async function rejectFriendRequest(requestId) {
    const confirmed = confirm("Are you sure you want to reject this friend request?");
    if (!confirmed) return;

    try {
      // You can either delete the request or update status to 'rejected'
      // Here we'll delete it
      await deleteDoc(doc(db, "friendships", requestId));
      console.log("Friend request rejected");
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      alert("Failed to reject friend request. Please try again.");
    }
  }

  // Remove friend
  async function removeFriend(friendshipId) {
    const confirmed = confirm("Are you sure you want to remove this friend?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      console.log("Friend removed");
    } catch (error) {
      console.error("Error removing friend:", error);
      alert("Failed to remove friend. Please try again.");
    }
  }
});

