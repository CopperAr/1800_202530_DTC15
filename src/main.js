// -------------------------------------------------------------
// src/main.js
// -------------------------------------------------------------
// Main dashboard page logic for the Hang Out app.
// Displays:
// - Daily quote based on current day of the week
// - User greeting with display name
// - Friends list preview (max 5 friends)
// -------------------------------------------------------------

import { onAuthReady } from '/src/authentication.js';
import { db } from '/src/firebaseConfig.js';
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  or,
  and
} from 'firebase/firestore';

// -------------------------------------------------------------
// Quote of the Day System
// -------------------------------------------------------------
// Reads and displays a motivational quote from Firestore based
// on the current day of the week. Uses real-time listener to
// sync updates automatically.
// -------------------------------------------------------------

// -------------------------------------------------------------
// readQuote(day)
// -------------------------------------------------------------
// Fetches and displays a quote for the specified day.
// Falls back to Monday's quote if the requested day has no quote.
//
// Parameters:
//   day (string) - Day name in lowercase (e.g., "monday", "tuesday")
// -------------------------------------------------------------
function readQuote(day) {
  const quoteEl = document.getElementById('quote-goes-here');
  if (!quoteEl) return;

  // Helper function to extract quote text from Firestore snapshot
  function applyTextFromSnap(snap) {
    if (snap?.exists()) {
      const data = snap.data() || {};
      // Try multiple field names for flexibility
      const text = data.quote || data.quotes || data.text || '';
      
      // Display the quote as-is from database
      quoteEl.textContent = text;
      return !!text; // Return true if quote was found
    }
    return false; // No quote found
  }

  // Set up real-time listener for the quote document
  const quoteDocRef = doc(db, 'quotes', day);
  onSnapshot(
    quoteDocRef,
    (snap) => {
      const ok = applyTextFromSnap(snap);
      // If no quote found and not already trying Monday, fallback to Monday's quote
      if (!ok && day !== 'monday') {
        const fallbackRef = doc(db, 'quotes', 'monday');
        onSnapshot(fallbackRef, (fsnap) => applyTextFromSnap(fsnap));
      }
    },
    (err) => {
      console.warn('Quote listener error:', err);
    }
  );
}

// -------------------------------------------------------------
// User Dashboard System
// -------------------------------------------------------------
// Displays personalized greeting and friends list for logged-in user.
// Redirects to login page if user is not authenticated.
// -------------------------------------------------------------

// -------------------------------------------------------------
// showDashboard()
// -------------------------------------------------------------
// Initializes the dashboard by loading user info and friends list.
// Runs when the page loads.
// -------------------------------------------------------------
function showDashboard() {
  const nameEl = document.getElementById('name-goes-here');

  // Wait for Firebase auth to initialize
  onAuthReady(async (user) => {
    // Redirect to login if not authenticated
    if (!user) {
      location.href = 'index.html';
      return;
    }
    
    // Default to display name or email from auth
    let name = user.displayName || user.email || 'friend';

    // Try to get more detailed name from Firestore user profile
    try {
      const uref = doc(db, 'users', user.uid);
      const usnap = await getDoc(uref);
      if (usnap.exists()) {
        name = usnap.data().displayName || usnap.data().name || name;
      }
    } catch (e) {
      console.warn('Failed to read user profile:', e);
    }

    // Display the greeting
    if (nameEl) nameEl.textContent = name;

    // Load and display friends list
    loadFriendsList(user.uid);
  });
}

// -------------------------------------------------------------
// Friends List System
// -------------------------------------------------------------
// Displays a preview of the user's accepted friends (max 5).
// Uses real-time listener to sync changes automatically.
// -------------------------------------------------------------

// -------------------------------------------------------------
// loadFriendsList(uid)
// -------------------------------------------------------------
// Loads and displays the user's friends list with real-time updates.
// Queries both directions of friendship (fromUserId and toUserId)
// to handle bidirectional relationships.
//
// Parameters:
//   uid (string) - Current user's ID
// -------------------------------------------------------------
async function loadFriendsList(uid) {
  const friendsList = document.getElementById('friendsList');
  if (!friendsList) return;

  // Query friendships in BOTH directions to handle bidirectional relationships
  // This ensures we find all friends regardless of who initiated the friendship
  const acceptedQuery = query(
    collection(db, 'friendships'),
    or(
      and(where('fromUserId', '==', uid), where('status', '==', 'accepted')),
      and(where('toUserId', '==', uid), where('status', '==', 'accepted'))
    )
  );

  // Set up real-time listener for friendship changes
  onSnapshot(acceptedQuery, async (snapshot) => {
    // Use Map to deduplicate friends (in case of bidirectional records)
    const friendMap = new Map();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Determine the friend's ID (the other person in the relationship)
      const friendId = data.fromUserId === uid ? data.toUserId : data.fromUserId;

      // Store friend info, tracking all document IDs for this friendship
      if (!friendMap.has(friendId)) {
        friendMap.set(friendId, {
          friendId,
          docIds: [docSnap.id],
        });
      } else {
        // If friend already exists, add this document ID (bidirectional case)
        friendMap.get(friendId).docIds.push(docSnap.id);
      }
    });

    // Convert deduplicated Map to array and fetch user data
    const friends = [];

    // Fetch user data for each unique friend
    for (const { friendId } of friendMap.values()) {
      const friendData = await getUserData(friendId);

      friends.push({
        friendId,
        name: friendData?.displayName || friendData?.email || 'User',
      });
    }

    // Render the friends list
    friendsList.innerHTML = '';

    // Show empty state if no friends
    if (friends.length === 0) {
      friendsList.innerHTML =
        '<li class="list-group-item text-muted">No friends yet. Add some to get started.</li>';
      return;
    }

    // Limit display to first 5 friends for preview
    const displayFriends = friends.slice(0, 5);
    for (const friend of displayFriends) {
      const li = document.createElement('li');
      li.className =
        'list-group-item d-flex justify-content-between align-items-center';

      li.innerHTML = `
        <span>${friend.name}</span>
        <span class="badge bg-success rounded-pill">Friend</span>
      `;
      friendsList.appendChild(li);
    }

    // If more than 5 friends, show "View all" link
    if (friends.length > 5) {
      const viewAllLi = document.createElement('li');
      viewAllLi.className = 'list-group-item text-center';
      viewAllLi.innerHTML = `
        <a href="friends.html" class="text-decoration-none">
          View all friends (${friends.length})
        </a>
      `;
      friendsList.appendChild(viewAllLi);
    }
  });
}

// -------------------------------------------------------------
// getUserData(userId)
// -------------------------------------------------------------
// Fetches user profile data from Firestore.
//
// Parameters:
//   userId (string) - User ID to fetch data for
//
// Returns: Promise<Object|null> - User data or null if not found
// -------------------------------------------------------------
async function getUserData(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) return userDoc.data();
    return null;
  } catch (e) {
    console.error('Error fetching user data:', e);
    return null;
  }
}

// -------------------------------------------------------------
// Page Initialization
// -------------------------------------------------------------
// Determines current day and loads appropriate quote.
// Supports ?day=monday URL parameter for testing.
// -------------------------------------------------------------

// Day names array indexed by JavaScript's getDay() (0=Sunday)
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

try {
  // Check for day override in URL query string (for testing)
  const params = new URLSearchParams(location.search);
  const override = (params.get('day') || '').toLowerCase();
  // Use override if provided, otherwise use current day
  const today = override || dayNames[new Date().getDay()] || 'tuesday';
  readQuote(today);
} catch {
  // Fallback to Tuesday if date parsing fails
  readQuote('tuesday');
}

// Initialize the dashboard
showDashboard();
