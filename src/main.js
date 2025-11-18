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

/* quote of the day*/

function readQuote(day) {
  const quoteEl = document.getElementById('quote-goes-here');
  if (!quoteEl) return;

  function applyTextFromSnap(snap) {
    if (snap?.exists()) {
      const data = snap.data() || {};
      const text = data.quote || data.quotes || '';
      quoteEl.textContent = text;
      return !!text;
    }
    return false;
  }

  const quoteDocRef = doc(db, 'quotes', day);
  onSnapshot(
    quoteDocRef,
    (snap) => {
      const ok = applyTextFromSnap(snap);
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

/* user greetings + friends*/
function showDashboard() {
  const nameEl = document.getElementById('name-goes-here');

  onAuthReady(async (user) => {
    if (!user) {
      location.href = 'index.html';
      return;
    }
    let name = user.displayName || user.email || 'friend';

    try {
      const uref = doc(db, 'users', user.uid);
      const usnap = await getDoc(uref);
      if (usnap.exists()) {
        name = usnap.data().displayName || usnap.data().name || name;
      }
    } catch (e) {
      console.warn('Failed to read user profile:', e);
    }

    if (nameEl) nameEl.textContent = name;

    loadFriendsList(user.uid);
  });
}

/* friends list */
async function loadFriendsList(uid) {
  const friendsList = document.getElementById('friendsList');
  if (!friendsList) return;

  // Query BOTH directions, no duplicates
  const acceptedQuery = query(
    collection(db, 'friendships'),
    or(
      and(where('fromUserId', '==', uid), where('status', '==', 'accepted')),
      and(where('toUserId', '==', uid), where('status', '==', 'accepted'))
    )
  );

  onSnapshot(acceptedQuery, async (snapshot) => {
    const friendMap = new Map();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // determine friendId independent of direction
      const friendId = data.fromUserId === uid ? data.toUserId : data.fromUserId;

      if (!friendMap.has(friendId)) {
        friendMap.set(friendId, {
          friendId,
          docIds: [docSnap.id],
        });
      } else {
        friendMap.get(friendId).docIds.push(docSnap.id);
      }
    });

    // Convert deduped result to array
    const friends = [];

    for (const { friendId } of friendMap.values()) {
      const friendData = await getUserData(friendId);

      friends.push({
        friendId,
        name: friendData?.displayName || friendData?.email || 'User',
      });
    }

    // Render
    friendsList.innerHTML = '';

    if (friends.length === 0) {
      friendsList.innerHTML =
        '<li class="list-group-item text-muted">No friends yet. Add some to get started.</li>';
      return;
    }

    // Show max 5 friends
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

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

try {
  const params = new URLSearchParams(location.search);
  const override = (params.get('day') || '').toLowerCase();
  const today = override || dayNames[new Date().getDay()] || 'tuesday';
  readQuote(today);
} catch {
  readQuote('tuesday');
}

showDashboard();
