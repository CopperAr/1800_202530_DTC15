// src/schedule.js

import { onAuthReady } from "/src/authentication.js";

onAuthReady((user) => {
    const el = document.getElementById("schedule-content");
    if (!el) return;
    if (!user) {
        el.innerHTML = `<p>Please <a href="login.html">log in</a> to view your schedule.</p>`;
        return;
    }

    // Temporary content — replace later with Firestore data or calendar logic
    el.innerHTML = `
        <ul>
            <li>Monday: Gym with friends</li>
            <li>Wednesday: Study group at 2PM</li>
            <li>Friday: Dinner hangout</li>
        </ul>
    `;
});
