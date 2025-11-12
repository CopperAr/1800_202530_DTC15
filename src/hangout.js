// src/hangout.js
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("hangoutForm");
    const nameInput = document.getElementById("hangoutName");
    const dateInput = document.getElementById("hangoutDate");
    const startTimeInput = document.getElementById("hangoutStartTime");
    const endTimeInput = document.getElementById("hangoutEndTime");
    const locationInput = document.getElementById("hangoutLocation");
    const descriptionInput = document.getElementById("hangoutDescription");

    const listEl = document.getElementById("hangoutList");
    const btnUpcoming = document.getElementById("btnUpcoming");
    const btnPast = document.getElementById("btnPast");

    const modalElement = document.getElementById("hangoutDetailsModal");
    const modalTitleEl = document.getElementById("hangoutDetailsTitle");
    const modalBodyEl = document.getElementById("hangoutDetailsBody");

    if (
        !form ||
        !nameInput ||
        !dateInput ||
        !startTimeInput ||
        !listEl ||
        !btnUpcoming ||
        !btnPast ||
        !modalElement ||
        !modalTitleEl ||
        !modalBodyEl
    ) {
        console.warn("Hangout page DOM not ready");
        return;
    }

    // Bootstrap modal instance (global from CDN)
    const detailsModal = new bootstrap.Modal(modalElement);

    let allHangouts = [];
    let currentFilter = "upcoming"; // 'upcoming' or 'past'

    // ---------- Date parsing that accepts multiple formats ----------
    function parseHangoutDate(dateVal, timeVal) {
        // Firestore Timestamp
        if (dateVal && typeof dateVal.toDate === "function") {
            const d = dateVal.toDate();
            if (timeVal) {
                const [hh, mm] = (timeVal || "0:0").split(":").map(Number);
                d.setHours(hh || 0, mm || 0, 0, 0);
            }
            return d;
        }

        // Already a Date object
        if (dateVal instanceof Date) return dateVal;

        // Strings
        if (typeof dateVal === "string") {
            let y, m, d;

            // yyyy-mm-dd
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                [y, m, d] = dateVal.split("-").map(Number);

                // mm/dd/yyyy
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateVal)) {
                const [mm, dd, yyyy] = dateVal.split("/").map(Number);
                y = yyyy; m = mm; d = dd;

                // Fallback to Date.parse for other valid strings (e.g., ISO)
            } else if (!Number.isNaN(Date.parse(dateVal))) {
                const parsed = new Date(dateVal);
                if (timeVal) {
                    const [hh, mm] = (timeVal || "0:0").split(":").map(Number);
                    parsed.setHours(hh || 0, mm || 0, 0, 0);
                }
                return parsed;
            } else {
                return null;
            }

            // Apply time if present
            let hh = 0, mm2 = 0;
            if (timeVal) {
                const parts = timeVal.split(":").map(Number);
                hh = parts[0] || 0;
                mm2 = parts[1] || 0;
            }
            return new Date(y, (m || 1) - 1, d || 1, hh, mm2);
        }

        return null;
    }

    function getHangoutDateTime(h) {
        return parseHangoutDate(h.date, h.startTime);
    }

    function isUpcoming(h) {
        const dt = getHangoutDateTime(h);
        if (!dt || Number.isNaN(dt.getTime())) return true; // unknown date → treat as upcoming
        return dt.getTime() >= Date.now();
    }

    function isPast(h) {
        const dt = getHangoutDateTime(h);
        if (!dt || Number.isNaN(dt.getTime())) return false;
        return dt.getTime() < Date.now();
    }
    // ----------------------------------------------------------------

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
                "list-group-item d-flex flex-column align-items-start list-group-item-action";
            li.style.cursor = "pointer";

            const title = h.title || "(untitled hangout)";
            const date = h.date || "";
            const startTime = h.startTime || "";
            const endTime = h.endTime || "";
            const location = h.location || "";
            const description = h.description || "";

            const mainLine = document.createElement("div");
            mainLine.className = "fw-semibold";

            const dateTimeParts = [];
            if (date) dateTimeParts.push(date);
            if (startTime) {
                dateTimeParts.push(endTime ? `${startTime}–${endTime}` : startTime);
            }

            const dateTimeText = dateTimeParts.length
                ? ` (${dateTimeParts.join(" · ")})`
                : "";

            mainLine.textContent = `${title}${dateTimeText}`;
            li.appendChild(mainLine);

            if (location) {
                const locLine = document.createElement("div");
                locLine.className = "text-muted small";
                locLine.textContent = `Location: ${location}`;
                li.appendChild(locLine);
            }

            if (description) {
                const descLine = document.createElement("div");
                descLine.className = "small mt-1 text-truncate";
                descLine.textContent = description;
                li.appendChild(descLine);
            }

            li.addEventListener("click", () => openDetailsModal(h));
            listEl.appendChild(li);
        });
    }

    function openDetailsModal(h) {
        const title = h.title || "(untitled hangout)";
        const date = h.date || "N/A";
        const startTime = h.startTime || "N/A";
        const endTime = h.endTime || "";
        const location = h.location || "N/A";
        const description = h.description || "";

        modalTitleEl.textContent = title;

        modalBodyEl.innerHTML = "";

        const dateP = document.createElement("p");
        dateP.innerHTML = `<strong>Date:</strong> ${date}`;

        const timeP = document.createElement("p");
        timeP.innerHTML = `<strong>Time:</strong> ${endTime ? `${startTime} – ${endTime}` : startTime
            }`;

        const locationP = document.createElement("p");
        locationP.innerHTML = `<strong>Location:</strong> ${location}`;

        const descriptionP = document.createElement("p");
        descriptionP.innerHTML = `<strong>Description:</strong><br>${description || "<span class='text-muted'>No description provided.</span>"
            }`;

        modalBodyEl.appendChild(dateP);
        modalBodyEl.appendChild(timeP);
        modalBodyEl.appendChild(locationP);
        modalBodyEl.appendChild(descriptionP);

        detailsModal.show();
    }

    function setFilter(filter) {
        currentFilter = filter;

        if (filter === "upcoming") {
            btnUpcoming.classList.add("active");
            btnUpcoming.classList.replace("btn-outline-secondary", "btn-outline-primary");

            btnPast.classList.remove("active");
            btnPast.classList.replace("btn-outline-primary", "btn-outline-secondary");
        } else {
            btnPast.classList.add("active");
            btnPast.classList.replace("btn-outline-secondary", "btn-outline-primary");

            btnUpcoming.classList.remove("active");
            btnUpcoming.classList.replace("btn-outline-primary", "btn-outline-secondary");
        }

        renderList();
    }

    // Filter button events
    btnUpcoming.addEventListener("click", () => setFilter("upcoming"));
    btnPast.addEventListener("click", () => setFilter("past"));

    // Auth + Firestore wiring
    onAuthReady((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        const uid = user.uid;
        const hangoutsCol = collection(db, "hangouts");
        const userHangoutsQuery = query(hangoutsCol, where("userId", "==", uid));

        // Live listener
        onSnapshot(
            userHangoutsQuery,
            (snapshot) => {
                allHangouts = [];
                snapshot.forEach((docSnap) => {
                    allHangouts.push({
                        id: docSnap.id,
                        ...docSnap.data(),
                    });
                });
                renderList();
            },
            (error) => {
                console.error("Error listening to hangouts:", error);
            }
        );

        // Create a new hangout
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = nameInput.value.trim();
            const rawDate = dateInput.value; // could be yyyy-mm-dd OR mm/dd/yyyy depending on locale/browser
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const location = locationInput.value.trim();
            const description = descriptionInput.value.trim();

            if (!title || !rawDate || !startTime) {
                alert("Please fill in hangout name, date, and start time.");
                return;
            }

            // Normalize date to yyyy-mm-dd when possible
            let normalizedDate = rawDate;
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                normalizedDate = rawDate;
            } else if (!Number.isNaN(Date.parse(rawDate))) {
                normalizedDate = new Date(rawDate).toISOString().slice(0, 10);
            }

            try {
                await addDoc(hangoutsCol, {
                    userId: uid,
                    title,
                    date: normalizedDate || rawDate,
                    startTime,
                    endTime: endTime || null,
                    location: location || null,
                    description: description || null,
                    status: "planned",
                    createdAt: serverTimestamp(),
                });

                form.reset();
                // list will auto-update via onSnapshot
            } catch (err) {
                console.error("Failed to create hangout:", err);
                alert(`Could not create hangout: ${err.code || err.message}`);
            }
        });
    });
});
