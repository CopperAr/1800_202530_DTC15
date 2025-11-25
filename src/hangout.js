/*******************************************************
 *  Hangout Page Controller
 *  -----------------------------------------------------
 *  This file controls the Hangouts page. It lets a user:
 *   - Create hangouts (title, date, time, location, notes)
 *   - Select participants (friends + themselves)
 *   - View upcoming vs past hangouts
 *   - View hangout details in a modal
 *   - Edit participants in a modal
 *   - Delete hangouts
 *******************************************************/

import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc,
    updateDoc,
    getDocs,
    getDoc,
} from "firebase/firestore";



/*******************************************************
 *  Date Utilities
 *  -----------------------------------------------------
 *  Handle:
 *   - Parsing Firestore Timestamps / Date / string
 *   - Normalizing to local Date objects
 *   - Formatting dates for display
 *   - Checking if a hangout is upcoming or in the past
 *******************************************************/

const DATE_DISPLAY_STYLE = "long"; // "short" | "long"



/*******************************************************
 * Apply a "HH:MM" time string to a Date object
 *
 * @param {Date} dateObj
 * @param {string} timeVal
 *******************************************************/
function applyTime(dateObj, timeVal) {
    if (!timeVal) return;

    const parts = String(timeVal).split(":").map(Number);
    const hh = parts[0] || 0;
    const mm = parts[1] || 0;

    dateObj.setHours(hh, mm, 0, 0);
}



/*******************************************************
 * Parse different date inputs into a Date object in local time
 *
 * Accepts:
 *  - Firestore Timestamp (has .toDate())
 *  - Date instance
 *  - "yyyy-mm-dd"
 *  - "mm/dd/yyyy"
 *  - Anything parseable by new Date(...)
 *
 * Optionally applies a time string "HH:MM"
 *******************************************************/
function parseDateToLocal(dateVal, timeVal) {
    // Firestore Timestamp
    if (dateVal && typeof dateVal.toDate === "function") {
        const d = dateVal.toDate();
        applyTime(d, timeVal);
        return d;
    }

    // Date instance
    if (dateVal instanceof Date) {
        const d = new Date(dateVal.getTime());
        applyTime(d, timeVal);
        return d;
    }

    // String formats
    if (typeof dateVal === "string") {
        // ISO "yyyy-mm-dd"
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            const [y, m, day] = dateVal.split("-").map(Number);
            const d = new Date(y, m - 1, day, 0, 0, 0, 0);
            applyTime(d, timeVal);
            return d;
        }

        // "mm/dd/yyyy"
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateVal)) {
            const [mm, dd, yyyy] = dateVal.split("/").map(Number);
            const d = new Date(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
            applyTime(d, timeVal);
            return d;
        }

        // Fallback: try native parse
        const parsed = new Date(dateVal);
        if (!Number.isNaN(parsed.getTime())) {
            applyTime(parsed, timeVal);
            return parsed;
        }
    }

    // Parsing failed
    return null;
}



/*******************************************************
 * Convert a date-like value to "yyyy-mm-dd" for storage
 *******************************************************/
function toISO_YMD(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;
}



/*******************************************************
 * Format date as "mm/dd/yyyy"
 *******************************************************/
function formatDateShort(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "N/A";

    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();

    return `${mm}/${dd}/${yyyy}`;
}



/*******************************************************
 * Format date as "17th of November, 2025"
 *******************************************************/
function formatDateLong(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "N/A";

    const day = d.getDate();

    const suffix = (n) => {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return "st";
        if (mod10 === 2 && mod100 !== 12) return "nd";
        if (mod10 === 3 && mod100 !== 13) return "rd";
        return "th";
    };

    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    return `${day}${suffix(day)} of ${months[d.getMonth()]}, ${d.getFullYear()}`;
}



/*******************************************************
 * Wrapper that chooses short/long display style
 *******************************************************/
function formatDateDisplay(dateLike) {
    return DATE_DISPLAY_STYLE === "long"
        ? formatDateLong(dateLike)
        : formatDateShort(dateLike);
}



/*******************************************************
 * Return true if the hangout is in the future or today
 *******************************************************/
function isUpcoming(hangout) {
    const dt = parseDateToLocal(hangout.date, hangout.startTime);
    if (!dt || Number.isNaN(dt.getTime())) return true; // default to upcoming
    return dt.getTime() >= Date.now();
}



/*******************************************************
 * Return true if the hangout is strictly in the past
 *******************************************************/
function isPast(hangout) {
    const dt = parseDateToLocal(hangout.date, hangout.startTime);
    if (!dt || Number.isNaN(dt.getTime())) return false;
    return dt.getTime() < Date.now();
}



/*******************************************************
 *  User Label Caching
 *  -----------------------------------------------------
 *  We store names in Firestore (displayName/name/email)
 *  To avoid many repeated reads, we cache them in memory
 *******************************************************/

const userLabelCache = new Map();



/*******************************************************
 * Get a "label" for a single user:
 *  displayName > name > email > uid
 *******************************************************/
async function getUserLabel(uid) {
    if (userLabelCache.has(uid)) return userLabelCache.get(uid);

    let label = uid;
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
            const data = snap.data();
            label = data.displayName || data.name || data.email || uid;
        }
    } catch {
        // Ignore errors, fall back to uid
    }

    userLabelCache.set(uid, label);
    return label;
}



/*******************************************************
 * Get labels for multiple user IDs (in order)
 *******************************************************/
async function getUserLabels(uids) {
    const out = [];
    for (const id of uids) {
        out.push(await getUserLabel(id));
    }
    return out;
}



/*******************************************************
 *  Main Page Logic
 *  -----------------------------------------------------
 *  Runs when DOM is ready. Sets up:
 *   - DOM references
 *   - In-memory state
 *   - Friend loading
 *   - Hangout list rendering
 *   - Modals (details + edit participants)
 *   - Auth + Firestore listeners
 *   - "Create Hangout" form submission
 *******************************************************/



document.addEventListener("DOMContentLoaded", () => {
    /*******************************************************
     * DOM Element References
     *******************************************************/
    const form = document.getElementById("hangoutForm");

    const nameInput = document.getElementById("hangoutName");
    const dateInput = document.getElementById("hangoutDate");
    const startTimeInput = document.getElementById("hangoutStartTime");
    const endTimeInput = document.getElementById("hangoutEndTime");
    const locationInput = document.getElementById("hangoutLocation");
    const descriptionInput = document.getElementById("hangoutDescription");

    const friendsListEl = document.getElementById("friendsList");
    const listEl = document.getElementById("hangoutList");

    const btnUpcoming = document.getElementById("btnUpcoming");
    const btnPast = document.getElementById("btnPast");

    // Details modal (view hangout)
    const detailsModalEl = document.getElementById("hangoutDetailsModal");
    const detailsTitleEl = document.getElementById("hangoutDetailsTitle");
    const detailsBodyEl = document.getElementById("hangoutDetailsBody");
    const detailsModal = new bootstrap.Modal(detailsModalEl);

    // Edit participants modal
    const editModalEl = document.getElementById("editParticipantsModal");
    const editModal = new bootstrap.Modal(editModalEl);
    const editFriendsListEl = document.getElementById("editFriendsList");
    const saveParticipantsBtn = document.getElementById("saveParticipantsBtn");


    /*******************************************************
     * In-Memory State
     *******************************************************/
    let allHangouts = [];       // All of the user's hangouts
    let currentFilter = "upcoming";     // "upcoming" | "past"
    let currentUser = null;     // Authenticated user
    let acceptedFriends = [];       // { uid, name } for each friend

    let editingHangout = null;      // Hangout currently being edited


    /*******************************************************
     * Load Friends
     * -----------------------------------------------------
     * Fetch all accepted friendships involving this user,
     * then build the checkboxes in the Create Hangout form
     *******************************************************/
    async function loadFriends(uid) {
        acceptedFriends = [];

        const fsRef = collection(db, "friendships");

        // Friendships where current user is sender
        const q1 = query(
            fsRef,
            where("fromUserId", "==", uid),
            where("status", "==", "accepted")
        );

        // Friendships where current user is receiver
        const q2 = query(
            fsRef,
            where("toUserId", "==", uid),
            where("status", "==", "accepted")
        );

        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        // Unique friend IDs
        const friendIds = new Set();
        s1.forEach((docSnap) => friendIds.add(docSnap.data().toUserId));
        s2.forEach((docSnap) => friendIds.add(docSnap.data().fromUserId));

        // Build array: { uid, name }
        acceptedFriends = [];
        for (const fid of friendIds) {
            acceptedFriends.push({
                uid: fid,
                name: await getUserLabel(fid),
            });
        }

        // Render checkboxes in the create-hangout form
        if (!friendsListEl) return;

        friendsListEl.innerHTML = "";

        if (!acceptedFriends.length) {
            friendsListEl.innerHTML =
                `<div class="col-12 text-muted">No accepted friends yet.</div>`;
            return;
        }

        acceptedFriends.forEach((fr) => {
            const col = document.createElement("div");
            col.className = "col-12 col-md-4";
            col.innerHTML = `
                <div class="form-check">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        value="${fr.uid}"
                        id="friend-${fr.uid}"
                    >
                    <label class="form-check-label" for="friend-${fr.uid}">
                        ${fr.name}
                    </label>
                </div>
            `;
            friendsListEl.appendChild(col);
        });
    }


    /*******************************************************
     * Render Hangout List
     * -----------------------------------------------------
     * Render all hangouts into the <ul id="hangoutList">
     * according to the current filter (upcoming/past).
     *******************************************************/
    function renderList() {
        listEl.innerHTML = "";

        const filtered = allHangouts.filter((h) =>
            currentFilter === "upcoming" ? isUpcoming(h) : isPast(h)
        );

        // No items message
        if (!filtered.length) {
            const li = document.createElement("li");
            li.className = "list-group-item text-muted";
            li.textContent =
                currentFilter === "upcoming"
                    ? "No upcoming hangouts."
                    : "No past hangouts.";
            listEl.appendChild(li);
            return;
        }

        // One list item per hangout
        filtered.forEach((h) => {
            const li = document.createElement("li");
            li.className =
                "list-group-item d-flex justify-content-between align-items-start";

            // Left side: text info
            const left = document.createElement("div");
            left.className = "me-3";

            const title = h.title || "(untitled hangout)";
            const dateObj = parseDateToLocal(h.date);
            const dateStr = formatDateDisplay(dateObj);

            const startTime = h.startTime || "";
            const endTime = h.endTime || "";
            const location = h.location || "";
            const description = h.description || "";

            const timeText = startTime
                ? endTime
                    ? `${startTime}–${endTime}`
                    : startTime
                : "";

            left.innerHTML = `
                <div class="fw-semibold">
                    ${title}${dateStr !== "N/A" || timeText
                    ? ` (${[dateStr, timeText].filter(Boolean).join(" · ")})`
                    : ""
                }
                </div>
                ${location
                    ? `<div class="text-muted small">Location: ${location}</div>`
                    : ""
                }
                ${description
                    ? `<div class="small mt-1 text-truncate">${description}</div>`
                    : ""
                }
                ${Array.isArray(h.participants) && h.participants.length
                    ? `<div class="small text-muted mt-1">Participants: ${h.participants.length}</div>`
                    : ""
                }
            `;

            // Right side: action buttons
            const right = document.createElement("div");
            right.className = "btn-group";

            // View
            const viewBtn = document.createElement("button");
            viewBtn.className = "btn btn-sm btn-outline-secondary";
            viewBtn.textContent = "View";
            viewBtn.addEventListener("click", () => openDetailsModal(h));

            // Edit participants
            const editBtn = document.createElement("button");
            editBtn.className = "btn btn-sm btn-outline-primary";
            editBtn.textContent = "Edit participants";
            editBtn.addEventListener("click", () => openEditParticipants(h));

            // Delete
            const delBtn = document.createElement("button");
            delBtn.className = "btn btn-sm btn-outline-danger";
            delBtn.textContent = "Delete";
            delBtn.addEventListener("click", async () => {
                const ok = confirm(`Delete hangout "${title}"?`);
                if (!ok) return;

                try {
                    await deleteDoc(doc(db, "hangouts", h.id));
                } catch (err) {
                    console.error("Failed to delete hangout:", err);
                    alert("Failed to delete hangout.");
                }
            });

            right.appendChild(viewBtn);
            right.appendChild(editBtn);
            right.appendChild(delBtn);

            li.appendChild(left);
            li.appendChild(right);
            listEl.appendChild(li);
        });
    }

    /*******************************************************
     * Details Modal
     * -----------------------------------------------------
     * Shows one hangout in detail, including:
     *   - Formatted date/time
     *   - Location
     *   - Description
     *   - Participant names (resolved from UIDs)
     *******************************************************/
    function openDetailsModal(hangout) {
        const title = hangout.title || "(untitled hangout)";
        detailsTitleEl.textContent = title;

        const dateText = formatDateDisplay(parseDateToLocal(hangout.date));

        const timeText = hangout.startTime
            ? hangout.endTime
                ? `${hangout.startTime} – ${hangout.endTime}`
                : hangout.startTime
            : "N/A";

        const loc = hangout.location || "N/A";
        const desc =
            hangout.description ||
            "<span class='text-muted'>No description provided.</span>";

        detailsBodyEl.innerHTML = `
            <p><strong>Date:</strong> ${dateText}</p>
            <p><strong>Time:</strong> ${timeText}</p>
            <p><strong>Location:</strong> ${loc}</p>
            <p><strong>Description:</strong><br>${desc}</p>
            <p>
                <strong>Participants:</strong><br>
                <span id="participantNames" class="text-muted">Loading…</span>
            </p>
        `;

        detailsModal.show();

        // Load participant names asynchronously
        (async () => {
            const ids =
                Array.isArray(hangout.participants) && hangout.participants.length
                    ? hangout.participants
                    : currentUser
                        ? [currentUser.uid]
                        : [];

            const names = await getUserLabels(ids);
            const span = detailsBodyEl.querySelector("#participantNames");
            if (span) {
                span.textContent = names.join(", ");
            }
        })();
    }


    /*******************************************************
     * Edit Participants Modal
     * -----------------------------------------------------
     * Allows modifying which friends are included in a
     * hangout. The current user is always included
     *******************************************************/
    function openEditParticipants(hangout) {
        editingHangout = hangout;
        editFriendsListEl.innerHTML = "";

        if (!acceptedFriends.length) {
            editFriendsListEl.innerHTML =
                `<div class="col-12 text-muted">No accepted friends to add.</div>`;
            editModal.show();
            return;
        }

        acceptedFriends.forEach((fr) => {
            const col = document.createElement("div");
            col.className = "col-12";

            const checked =
                Array.isArray(hangout.participants) &&
                    hangout.participants.includes(fr.uid)
                    ? "checked"
                    : "";

            col.innerHTML = `
                <div class="form-check">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        value="${fr.uid}"
                        id="edit-friend-${fr.uid}"
                        ${checked}
                    >
                    <label class="form-check-label" for="edit-friend-${fr.uid}">
                        ${fr.name}
                    </label>
                </div>
            `;
            editFriendsListEl.appendChild(col);
        });

        editModal.show();
    }

    saveParticipantsBtn.addEventListener("click", async () => {
        if (!editingHangout || !currentUser) return;

        const checks = editFriendsListEl.querySelectorAll(
            'input[type="checkbox"]'
        );

        const selected = Array.from(checks)
            .filter((c) => c.checked)
            .map((c) => c.value);

        // Always include current user
        const participants = Array.from(
            new Set([currentUser.uid, ...selected])
        );

        try {
            await updateDoc(
                doc(db, "hangouts", editingHangout.id),
                { participants }
            );
            editModal.hide();
        } catch (err) {
            console.error("Failed to save participants:", err);
            alert("Failed to save participants.");
        }
    });

    /*******************************************************
     * Filter Buttons (Upcoming / Past)
     *******************************************************/
    function setFilter(filter) {
        currentFilter = filter;

        if (filter === "upcoming") {
            btnUpcoming.classList.add("active");
            btnUpcoming.classList.replace(
                "btn-outline-secondary",
                "btn-outline-primary"
            );

            btnPast.classList.remove("active");
            btnPast.classList.replace(
                "btn-outline-primary",
                "btn-outline-secondary"
            );
        } else {
            btnPast.classList.add("active");
            btnPast.classList.replace(
                "btn-outline-secondary",
                "btn-outline-primary"
            );

            btnUpcoming.classList.remove("active");
            btnUpcoming.classList.replace(
                "btn-outline-primary",
                "btn-outline-secondary"
            );
        }

        renderList();
    }

    btnUpcoming.addEventListener("click", () => setFilter("upcoming"));
    btnPast.addEventListener("click", () => setFilter("past"));

    /*******************************************************
     * Authentication + Firestore Wiring
     * -----------------------------------------------------
     * After auth:
     *  - Redirect if logged out
     *  - Load friends
     *  - Listen to user's hangouts in real time
     *  - Handle "Create Hangout" form submission
     *******************************************************/
    onAuthReady(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;

        // Build friend list UI
        await loadFriends(user.uid);

        const hangoutsCol = collection(db, "hangouts");
        const myHangouts = query(
            hangoutsCol,
            where("userId", "==", user.uid)
        );

        // Real-time listener for this user's hangouts
        onSnapshot(myHangouts, (snap) => {
            allHangouts = [];
            snap.forEach((docSnap) => {
                allHangouts.push({
                    id: docSnap.id,
                    ...docSnap.data(),
                });
            });
            renderList();
        });


        /***************************************************
         * Create Hangout Form Submit
         ***************************************************/
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = nameInput.value.trim();
            const rawDate = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const location = locationInput.value.trim();
            const description = descriptionInput.value.trim();

            // Basic validation
            if (!title || !rawDate || !startTime) {
                alert("Please fill in hangout name, date, and start time.");
                return;
            }

            // Ensure we store "yyyy-mm-dd"
            const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
                ? rawDate
                : toISO_YMD(new Date(rawDate)) || rawDate;

            // Selected friends from form
            const checked = friendsListEl
                ? friendsListEl.querySelectorAll(
                    'input[type="checkbox"]:checked'
                )
                : [];
            const selectedFriends = Array.from(checked).map((c) => c.value);

            // Always include the owner (current user)
            const participants = Array.from(
                new Set([user.uid, ...selectedFriends])
            );

            try {
                await addDoc(hangoutsCol, {
                    userId: user.uid,
                    title,
                    date: isoDate,
                    startTime,
                    endTime: endTime || null,
                    location: location || null,
                    description: description || null,
                    participants,
                    status: "planned",
                    createdAt: serverTimestamp(),
                });

                // Clear form inputs after create
                form.reset();
            } catch (err) {
                console.error("Failed to create hangout:", err);
                alert(`Could not create hangout: ${err.code || err.message}`);
            }
        });
    });
});
