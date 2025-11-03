import { onAuthReady } from './authentication.js';

function showDashboard() {
  const nameEl = document.getElementById('name-goes-here');

  onAuthReady((user) => {
    if (!user) {
      // Not signed in → back to landing
      location.href = 'index.html';
      return;
    }
    const name = user.displayName || user.email || 'friend';
    if (nameEl) nameEl.textContent = `${name}`;
  });
}

showDashboard();

