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
  getDocs,
} from "firebase/firestore";

// For nice labels (displayName > name > email > uid)
const friendLabelCache = new Map();
async function labelForUser(uid) {
  if (friendLabelCache.has(uid)) return friendLabelCache.get(uid);
  let label = uid;
  try {
    const u = await getDoc(doc(db, "users", uid));
    if (u.exists()) {
      const d = u.data();
      label = d.displayName || d.name || d.email || uid;
    }
  } catch (_) {
    // ignore
  }
  friendLabelCache.set(uid, label);
  return label;
}

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

  onAuthReady((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    const uid = user.uid;

    /* Pending friend requests */
    const requestsQuery = query(
      collection(db, "friendships"),
      where("toUserId", "==", uid),
      where("status", "==", "pending")
    );

    onSnapshot(
      requestsQuery,
      async (snapshot) => {
        friendRequestsList.innerHTML = "";
        const requests = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        requestCountBadge.textContent = requests.length;

        if (!requests.length) {
          friendRequestsList.innerHTML =
            '<li class="list-group-item text-muted">No pending requests.</li>';
          return;
        }

        for (const req of requests) {
          const fromUserData = await getUserData(req.fromUserId);
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center";

          const userName =
            fromUserData?.displayName ||
            fromUserData?.email ||
            req.fromUserId;
          const userEmail = fromUserData?.email || "";

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

        friendRequestsList.querySelectorAll(".accept-btn").forEach((btn) => {
          btn.addEventListener("click", () =>
            acceptFriendRequest(btn.dataset.id)
          );
        });
        friendRequestsList.querySelectorAll(".reject-btn").forEach((btn) => {
          btn.addEventListener("click", () =>
            rejectFriendRequest(btn.dataset.id)
          );
        });
      },
      (error) => {
        console.error("Error listening to friend requests:", error);
      }
    );

    /* Accepted friends (no duplicates) */
    const acceptedQuery = query(
      collection(db, "friendships"),
      or(
        and(
          where("fromUserId", "==", uid),
          where("status", "==", "accepted")
        ),
        and(
          where("toUserId", "==", uid),
          where("status", "==", "accepted")
        )
      )
    );

    onSnapshot(
      acceptedQuery,
      async (snapshot) => {
        const friendMap = new Map();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const friendId =
            data.fromUserId === uid ? data.toUserId : data.fromUserId;

          if (!friendMap.has(friendId)) {
            friendMap.set(friendId, {
              friendId,
              docIds: [docSnap.id],
            });
          } else {
            friendMap.get(friendId).docIds.push(docSnap.id);
          }
        });

        const friends = [];
        for (const { friendId, docIds } of friendMap.values()) {
          const friendData = await getUserData(friendId);
          friends.push({
            friendId,
            docIds,
            name:
              friendData?.displayName ||
              friendData?.email ||
              (await labelForUser(friendId)),
            email: friendData?.email || "",
          });
        }

        friendCountBadge.textContent = friends.length.toString();
        myFriendsList.innerHTML = "";

        if (!friends.length) {
          myFriendsList.innerHTML =
            '<li class="list-group-item text-muted">No friends yet. Add some to get started!</li>';
          return;
        }

        for (const friend of friends) {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center";

          li.innerHTML = `
            <div>
              <strong>${friend.name}</strong>
              <br><small class="text-muted">${friend.email}</small>
            </div>
            <button class="btn btn-outline-danger btn-sm remove-btn" data-docids="${friend.docIds.join(
            ","
          )}">Remove</button>
          `;

          myFriendsList.appendChild(li);
        }

        myFriendsList.querySelectorAll(".remove-btn").forEach((btn) => {
          btn.addEventListener("click", () =>
            removeFriend(btn.dataset.docids.split(","))
          );
        });
      },
      (error) => {
        console.error("Error listening to accepted friendships:", error);
      }
    );
  });

  /* Add Friend form */
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
      const friendUserId = await getUserIdByEmail(friendEmail);

      if (!friendUserId) {
        showMessage("User not found. Please check the email address.", "danger");
        return;
      }

      const existing = await checkFriendshipExists(
        currentUser.uid,
        friendUserId
      );
      if (existing) {
        showMessage(
          "Friend request already sent or you are already friends.",
          "warning"
        );
        return;
      }

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

  function showMessage(message, type = "info") {
    addFriendMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => {
      addFriendMessage.innerHTML = "";
    }, 5000);
  }

  async function getUserData(userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) return userDoc.data();
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }

  async function getUserIdByEmail(email) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].id;
      return null;
    } catch (error) {
      console.error("Error in getUserIdByEmail:", error);
      return null;
    }
  }

  // Very simple symmetric check (any status)
  async function checkFriendshipExists(userId1, userId2) {
    try {
      const friendshipsRef = collection(db, "friendships");
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
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      return !s1.empty || !s2.empty;
    } catch (error) {
      console.error("Error checking friendship:", error);
      return false;
    }
  }

  async function acceptFriendRequest(requestId) {
    try {
      await updateDoc(doc(db, "friendships", requestId), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("Failed to accept friend request. Please try again.");
    }
  }

  async function rejectFriendRequest(requestId) {
    const confirmed = confirm(
      "Are you sure you want to reject this friend request?"
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "friendships", requestId));
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      alert("Failed to reject friend request. Please try again.");
    }
  }

  // Accepts one id or an array of ids
  async function removeFriend(friendshipIds) {
    const confirmed = confirm("Are you sure you want to remove this friend?");
    if (!confirmed) return;

    const ids = Array.isArray(friendshipIds) ? friendshipIds : [friendshipIds];

    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(db, "friendships", id))));
    } catch (error) {
      console.error("Error removing friend:", error);
      alert("Failed to remove friend. Please try again.");
    }
  }
});