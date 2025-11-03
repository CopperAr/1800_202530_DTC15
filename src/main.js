import { onAuthReady } from '/src/authentication.js';
import { db } from '/src/firebaseConfig.js';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
