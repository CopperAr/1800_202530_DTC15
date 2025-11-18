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

/* date formatting (display-only) */

// "short" = 11/17/2025
// "long" = 17th of November, 2025
const DATE_DISPLAY_STYLE = "long"; // "short" | "long"

function parseDateToLocal(dateVal, timeVal) {
    // Firestore Timestamp
    if (dateVal && typeof dateVal.toDate === "function") {
        const d = dateVal.toDate();
        applyTime(d, timeVal);
        return d;
    }
    // Already Date
    if (dateVal instanceof Date) {
        const d = new Date(dateVal.getTime());
        applyTime(d, timeVal);
        return d;
    }
    // Strings
    if (typeof dateVal === "string") {
        // ISO yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            const [y, m, d] = dateVal.split("-").map(Number);
            const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
            applyTime(dt, timeVal);
            return dt;
        }
        // mm/dd/yyyy
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateVal)) {
            const [mm, dd, yyyy] = dateVal.split("/").map(Number);
            const dt = new Date(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
            applyTime(dt, timeVal);
            return dt;
        }
        // Fallback to Date.parse
        const parsed = new Date(dateVal);
        if (!Number.isNaN(parsed.getTime())) {
            applyTime(parsed, timeVal);
            return parsed;
        }
    }
    return null;
}

function applyTime(dateObj, timeVal) {
    if (!timeVal) return;
    const parts = String(timeVal).split(":").map(Number);
    const hh = parts[0] || 0;
    const mm = parts[1] || 0;
    dateObj.setHours(hh, mm, 0, 0);
}

// store as yyyy-mm-dd
function toISO_YMD(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// normal: mm/dd/yyyy
function formatDateShort(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "N/A";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

// long: 17th of November, 2025
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

function formatDateDisplay(dateLike) {
    return DATE_DISPLAY_STYLE === "long"
        ? formatDateLong(dateLike)
        : formatDateShort(dateLike);
}

function isUpcoming(h) {
    const dt = parseDateToLocal(h.date, h.startTime);
    if (!dt || Number.isNaN(dt.getTime())) return true;
    return dt.getTime() >= Date.now();
}
function isPast(h) {
    const dt = parseDateToLocal(h.date, h.startTime);
    if (!dt || Number.isNaN(dt.getTime())) return false;
    return dt.getTime() < Date.now();
}

/* user label (names) cache */
const userLabelCache = new Map();

async function getUserLabel(uid) {
    if (userLabelCache.has(uid)) return userLabelCache.get(uid);
    let label = uid;
    try {
        const u = await getDoc(doc(db, "users", uid));
        if (u.exists()) {
            const d = u.data();
            label = d.displayName || d.name || d.email || uid;
        }
    } catch (_) {
        // ignore, fallback to uid
    }
    userLabelCache.set(uid, label);
    return label;
}

async function getUserLabels(uids) {
    const out = [];
    for (const id of uids) {
        out.push(await getUserLabel(id));
    }
    return out;
}

/* logika */

document.addEventListener("DOMContentLoaded", () => {
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

    const detailsModalEl = document.getElementById("hangoutDetailsModal");
    const detailsTitleEl = document.getElementById("hangoutDetailsTitle");
    const detailsBodyEl = document.getElementById("hangoutDetailsBody");
    const detailsModal = new bootstrap.Modal(detailsModalEl);

    const editModalEl = document.getElementById("editParticipantsModal");
    const editModal = new bootstrap.Modal(editModalEl);
    const editFriendsListEl = document.getElementById("editFriendsList");
    const saveParticipantsBtn = document.getElementById("saveParticipantsBtn");

    let allHangouts = [];
    let currentFilter = "upcoming";
    let currentUser = null;
    let acceptedFriends = [];

    // load accepted friends into checkboxes
    async function loadFriends(uid) {
        acceptedFriends = [];
        const fsRef = collection(db, "friendships");
        const q1 = query(
            fsRef,
            where("fromUserId", "==", uid),
            where("status", "==", "accepted")
        );
        const q2 = query(
            fsRef,
            where("toUserId", "==", uid),
            where("status", "==", "accepted")
        );
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const friendIds = new Set();
        s1.forEach((d) => friendIds.add(d.data().toUserId));
        s2.forEach((d) => friendIds.add(d.data().fromUserId));

        acceptedFriends = [];
        for (const fid of friendIds) {
            acceptedFriends.push({
                uid: fid,
                name: await getUserLabel(fid),
            });
        }

        if (friendsListEl) {
            friendsListEl.innerHTML = "";
            if (!acceptedFriends.length) {
                friendsListEl.innerHTML =
                    `<div class="col-12 text-muted">No accepted friends yet.</div>`;
            } else {
                for (const fr of acceptedFriends) {
                    const col = document.createElement("div");
                    col.className = "col-12 col-md-4";
                    col.innerHTML = `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${fr.uid}" id="friend-${fr.uid}">
                            <label class="form-check-label" for="friend-${fr.uid}">${fr.name}</label>
                        </div>`;
                    friendsListEl.appendChild(col);
                }
            }
        }
    }

    function renderList() {
        listEl.innerHTML = "";
        const filtered = allHangouts.filter((h) =>
            currentFilter === "upcoming" ? isUpcoming(h) : isPast(h)
        );

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

        filtered.forEach((h) => {
            const li = document.createElement("li");
            li.className =
                "list-group-item d-flex justify-content-between align-items-start";

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
                ${location ? `<div class="text-muted small">Location: ${location}</div>` : ""}
                ${description ? `<div class="small mt-1 text-truncate">${description}</div>` : ""}
                ${Array.isArray(h.participants) && h.participants.length
                    ? `<div class="small text-muted mt-1">Participants: ${h.participants.length}</div>`
                    : ""
                }
        `;

            const right = document.createElement("div");
            right.className = "btn-group";

            const viewBtn = document.createElement("button");
            viewBtn.className = "btn btn-sm btn-outline-secondary";
            viewBtn.textContent = "View";
            viewBtn.addEventListener("click", () => openDetailsModal(h));

            const editBtn = document.createElement("button");
            editBtn.className = "btn btn-sm btn-outline-primary";
            editBtn.textContent = "Edit participants";
            editBtn.addEventListener("click", () => openEditParticipants(h));

            const delBtn = document.createElement("button");
            delBtn.className = "btn btn-sm btn-outline-danger";
            delBtn.textContent = "Delete";
            delBtn.addEventListener("click", async () => {
                const ok = confirm(`Delete hangout "${title}"?`);
                if (!ok) return;
                try {
                    await deleteDoc(doc(db, "hangouts", h.id));
                } catch (e) {
                    console.error(e);
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

    // show names, not UIDs
    function openDetailsModal(h) {
        detailsTitleEl.textContent = h.title || "(untitled hangout)";

        const dateText = formatDateDisplay(parseDateToLocal(h.date));
        const timeText = h.startTime
            ? h.endTime
                ? `${h.startTime} – ${h.endTime}`
                : h.startTime
            : "N/A";
        const loc = h.location || "N/A";
        const desc =
            h.description ||
            "<span class='text-muted'>No description provided.</span>";

        detailsBodyEl.innerHTML = `
            <p><strong>Date:</strong> ${dateText}</p>
            <p><strong>Time:</strong> ${timeText}</p>
            <p><strong>Location:</strong> ${loc}</p>
            <p><strong>Description:</strong><br>${desc}</p>
            <p><strong>Participants:</strong><br>
                <span id="participantNames" class="text-muted">Loading…</span>
            </p>
            `;

        detailsModal.show();

        // async load participant names
        (async () => {
            const ids =
                Array.isArray(h.participants) && h.participants.length
                    ? h.participants
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

    // edit participants
    let editingHangout = null;
    function openEditParticipants(h) {
        editingHangout = h;
        editFriendsListEl.innerHTML = "";
        if (!acceptedFriends.length) {
            editFriendsListEl.innerHTML =
                `<div class="col-12 text-muted">No accepted friends to add.</div>`;
        } else {
            for (const fr of acceptedFriends) {
                const col = document.createElement("div");
                col.className = "col-12";
                const checked =
                    Array.isArray(h.participants) && h.participants.includes(fr.uid)
                        ? "checked"
                        : "";
                col.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${fr.uid}" id="edit-friend-${fr.uid}" ${checked}>
                        <label class="form-check-label" for="edit-friend-${fr.uid}">${fr.name}</label>
                    </div>`;
                editFriendsListEl.appendChild(col);
            }
        }
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
        const participants = Array.from(
            new Set([currentUser.uid, ...selected])
        );
        try {
            await updateDoc(doc(db, "hangouts", editingHangout.id), { participants });
            editModal.hide();
        } catch (e) {
            console.error(e);
            alert("Failed to save participants.");
        }
    });

    // buttons
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

    // auth and firestore
    onAuthReady(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        currentUser = user;

        await loadFriends(user.uid);

        const hangoutsCol = collection(db, "hangouts");
        const myHangouts = query(hangoutsCol, where("userId", "==", user.uid));

        onSnapshot(myHangouts, (snap) => {
            allHangouts = [];
            snap.forEach((d) => allHangouts.push({ id: d.id, ...d.data() }));
            renderList();
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = nameInput.value.trim();
            const rawDate = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const location = locationInput.value.trim();
            const description = descriptionInput.value.trim();

            if (!title || !rawDate || !startTime) {
                alert("Please fill in hangout name, date, and start time.");
                return;
            }

            const iso = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
                ? rawDate
                : toISO_YMD(new Date(rawDate)) || rawDate;

            const checked = friendsListEl
                ? friendsListEl.querySelectorAll('input[type="checkbox"]:checked')
                : [];
            const selectedFriends = Array.from(checked).map((c) => c.value);
            const participants = Array.from(
                new Set([user.uid, ...selectedFriends])
            );

            try {
                await addDoc(hangoutsCol, {
                    userId: user.uid,
                    title,
                    date: iso,
                    startTime,
                    endTime: endTime || null,
                    location: location || null,
                    description: description || null,
                    participants,
                    status: "planned",
                    createdAt: serverTimestamp(),
                });
                form.reset();
            } catch (err) {
                console.error("Failed to create hangout:", err);
                alert(`Could not create hangout: ${err.code || err.message}`);
            }
        });
    });
});
