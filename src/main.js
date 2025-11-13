import { onAuthReady } from '/src/authentication.js';
import { db } from '/src/firebaseConfig.js';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

// Read quote of the day from Firestore in real-time
function readQuote(day) {
  const quoteEl = document.getElementById('quote-goes-here');
  if (!quoteEl) return;

  function applyTextFromSnap(snap) {
    if (snap?.exists()) {
      const data = snap.data() || {};
      // Accept either `quote` or `quotes` field
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
        // Fallback: listen to monday as default if today's doc missing
        const fallbackRef = doc(db, 'quotes', 'monday');
        onSnapshot(fallbackRef, (fsnap) => applyTextFromSnap(fsnap));
      }
    },
    (err) => {
      console.warn('Quote listener error:', err);
    }
  );
}

// Show greeting using Firestore user profile if available
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
    if (nameEl) nameEl.textContent = `${name}`;

    // Load friends list
    loadFriendsList(user.uid);
  });
}

// Load and display friends list
async function loadFriendsList(uid) {
  const friendsList = document.getElementById('friendsList');
  if (!friendsList) return;

  let sentFriends = new Map();
  let receivedFriends = new Map();

  const sentFriendsQuery = query(
    collection(db, 'friendships'),
    where('fromUserId', '==', uid),
    where('status', '==', 'accepted')
  );

  const receivedFriendsQuery = query(
    collection(db, 'friendships'),
    where('toUserId', '==', uid),
    where('status', '==', 'accepted')
  );

  const renderFriendsList = async () => {
    const allFriends = new Map();

    sentFriends.forEach((friend) => {
      allFriends.set(friend.id, friend);
    });
    receivedFriends.forEach((friend) => {
      allFriends.set(friend.id, friend);
    });

    const friends = Array.from(allFriends.values());

    friendsList.innerHTML = '';

    if (friends.length === 0) {
      friendsList.innerHTML = '<li class="list-group-item">No friends yet. Add some to get started.</li>';
    } else {
      // Show max 5 friends
      const displayFriends = friends.slice(0, 5);
      
      for (const friend of displayFriends) {
        const friendData = await getUserData(friend.friendId);
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        const userName = friendData?.displayName || friendData?.email || 'User';
        
        li.innerHTML = `
          <span>${userName}</span>
          <span class="badge bg-success rounded-pill">Friend</span>
        `;
        friendsList.appendChild(li);
      }

      // Add "View All" link if more than 5 friends
      if (friends.length > 5) {
        const viewAllLi = document.createElement('li');
        viewAllLi.className = 'list-group-item text-center';
        viewAllLi.innerHTML = `<a href="friends.html" class="text-decoration-none">View all friends (${friends.length})</a>`;
        friendsList.appendChild(viewAllLi);
      }
    }
  };

  async function getUserData(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  onSnapshot(sentFriendsQuery, (snapshot) => {
    sentFriends.clear();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      sentFriends.set(docSnap.id, {
        id: docSnap.id,
        friendId: data.toUserId,
        ...data,
      });
    });
    renderFriendsList();
  });

  onSnapshot(receivedFriendsQuery, (snapshot) => {
    receivedFriends.clear();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      receivedFriends.set(docSnap.id, {
        id: docSnap.id,
        friendId: data.fromUserId,
        ...data,
      });
    });
    renderFriendsList();
  });
}

// Call on load
// Allow override via ?day=monday (for testing), else use today's weekday
const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
try {
  const params = new URLSearchParams(location.search);
  const override = (params.get('day') || '').toLowerCase();
  const today = override || dayNames[new Date().getDay()] || 'tuesday';
  readQuote(today);
} catch {
  readQuote('tuesday');
}
showDashboard();
