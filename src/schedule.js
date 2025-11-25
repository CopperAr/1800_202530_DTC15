import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    deleteDoc,
    getDocs,
    getDoc,
    updateDoc,
    or,
    and,
} from "firebase/firestore";

document.addEventListener("DOMContentLoaded", () => {
    const calendarEl = document.getElementById("calendar");
    const form = document.getElementById("eventForm");
    const titleInput = document.getElementById("eventTitle");
    const dateInput = document.getElementById("eventDate");
    const startTimeInput = document.getElementById("eventStartTime");
    const endTimeInput = document.getElementById("eventEndTime");
    const repeatCountInput = document.getElementById("repeatCount");
    const repeatUnitSelect = document.getElementById("repeatUnit");
    const friendsScheduleList = document.getElementById("friendsScheduleList");
    const myEventColorInput = document.getElementById("myEventColor");

    if (
        !calendarEl ||
        !form ||
        !titleInput ||
        !dateInput ||
        !startTimeInput ||
        !endTimeInput
    ) {
        console.warn("Schedule page DOM not ready");
        return;
    }

    function isMobile() {
        return window.matchMedia("(max-width: 576px)").matches;
    }

    const defaultOwnColor = "#0d6efd";
    const defaultFriendColor = "#6c757d";

    let currentUserId = null;
    let eventsCol = null;
    let currentUserSettings = {
        eventColor: defaultOwnColor,
        friendColors: {},
    };
    let friendListeners = new Map();
    let friendLabelCache = new Map();

    function getColorForOwner(ownerId) {
        if (!ownerId) return defaultOwnColor;
        if (ownerId === currentUserId) {
            return currentUserSettings.eventColor || defaultOwnColor;
        }
        const map = currentUserSettings.friendColors || {};
        return map[ownerId] || defaultFriendColor;
    }

    const calendar = new window.FullCalendar.Calendar(calendarEl, {
        themeSystem: "bootstrap5",
        initialView: "dayGridMonth",
        height: "auto",
        expandRows: true,
        dayMaxEventRows: true,
        selectable: true,
        headerToolbar: isMobile()
            ? { left: "prev,next today", center: "title", right: "" }
            : {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
            },
        buttonText: {
            today: "today",
            month: "month",
            week: "week",
            day: "day",
        },

        dateClick: (info) => {
            dateInput.value = info.dateStr;
            titleInput.focus();
        },

        eventClick: async (info) => {
            const event = info.event;
            const { ownerId, ownerName, seriesId } = event.extendedProps || {};

            // Friends' events are read-only
            if (ownerId && ownerId !== currentUserId) {
                alert(
                    `This event belongs to ${ownerName || "a friend"} and can't be deleted from your calendar.`
                );
                return;
            }

            const startText = event.start
                ? event.start.toLocaleString()
                : "unknown start";
            const endText = event.end ? event.end.toLocaleString() : "";

            const deleteThis = confirm(
                `Delete event "${event.title}"\n` +
                `From: ${startText}` +
                (endText ? `\nTo:   ${endText}` : "") +
                " ?"
            );
            if (!deleteThis) return;

            try {
                // Handle "delete whole series" if repeating
                if (seriesId && eventsCol) {
                    const deleteSeries = confirm(
                        "This event is part of a repeating series.\n\n" +
                        "Click OK to delete ALL occurrences in the series.\n" +
                        "Click Cancel to delete only this one."
                    );
                    if (deleteSeries) {
                        const seriesQuery = query(
                            eventsCol,
                            where("userId", "==", currentUserId),
                            where("seriesId", "==", seriesId)
                        );
                        const snap = await getDocs(seriesQuery);
                        await Promise.all(
                            snap.docs.map((docSnap) => deleteDoc(docSnap.ref))
                        );
                        return;
                    }
                }

                // Delete single occurrence
                await deleteDoc(doc(db, "events", event.id));
            } catch (err) {
                console.error("Failed to delete event:", err);
                alert("Could not delete event. Please try again.");
            }
        },

        windowResize: () => {
            calendar.setOption(
                "headerToolbar",
                isMobile()
                    ? { left: "prev,next today", center: "title", right: "" }
                    : {
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }
            );
        },
    });

    calendar.render();

    // --- Recolor existing events when settings change ---
    function applyColorsToEvents() {
        calendar.getEvents().forEach((ev) => {
            const ownerId = ev.extendedProps && ev.extendedProps.ownerId;
            if (!ownerId) return;
            const color = getColorForOwner(ownerId);
            if (color) {
                ev.setProp("backgroundColor", color);
                ev.setProp("borderColor", color);
            }
        });
    }

    // --- Helpers for repeating events ---
    function addDays(dateStr, days) {
        const d = new Date(dateStr + "T00:00");
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }

    function addMonths(dateStr, months) {
        const d = new Date(dateStr + "T00:00");
        d.setMonth(d.getMonth() + months);
        return d.toISOString().slice(0, 10);
    }

    // --- Friend label / schedule helpers ---
    async function labelForUser(uid) {
        if (friendLabelCache.has(uid)) return friendLabelCache.get(uid);
        let label = uid;
        try {
            const u = await getDoc(doc(db, "users", uid));
            if (u.exists()) {
                const d = u.data();
                label = d.displayName || d.name || d.email || uid;
            }
        } catch (err) {
            console.error("Failed to get user label", err);
        }
        friendLabelCache.set(uid, label);
        return label;
    }

    function removeFriendEventsFromCalendar(friendId) {
        calendar.getEvents().forEach((ev) => {
            if (ev.extendedProps && ev.extendedProps.ownerId === friendId) {
                ev.remove();
            }
        });
    }

    function subscribeFriendEvents(friendId, friendName) {
        if (friendListeners.has(friendId)) return;

        const q = query(collection(db, "events"), where("userId", "==", friendId));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                // Clear existing events for this friend
                removeFriendEventsFromCalendar(friendId);

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    calendar.addEvent({
                        id: `friend_${friendId}_${docSnap.id}`,
                        title: `${friendName}: ${data.title}`,
                        start: data.start,
                        end: data.end || null,
                        allDay: false,
                        color: getColorForOwner(friendId),
                        extendedProps: {
                            ownerId: data.userId,
                            ownerName: friendName,
                            isFriend: true,
                            seriesId: data.seriesId || null,
                        },
                    });
                });

                applyColorsToEvents();
            },
            (error) => {
                console.error("Error listening to friend's events:", error);
            }
        );

        friendListeners.set(friendId, unsubscribe);
    }

    function unsubscribeFriendEvents(friendId) {
        const unsub = friendListeners.get(friendId);
        if (unsub) {
            unsub();
            friendListeners.delete(friendId);
        }
        removeFriendEventsFromCalendar(friendId);
    }

    function setupFriendSchedule(uid) {
        if (!friendsScheduleList) return;

        const friendshipsQuery = query(
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
            friendshipsQuery,
            async (snapshot) => {
                friendsScheduleList.innerHTML = "";
                const friendMap = new Map();

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const friendId =
                        data.fromUserId === uid ? data.toUserId : data.fromUserId;
                    friendMap.set(friendId, true);
                });

                // Stop listening for friends that are no longer in the list
                for (const friendId of Array.from(friendListeners.keys())) {
                    if (!friendMap.has(friendId)) {
                        unsubscribeFriendEvents(friendId);
                    }
                }

                if (!friendMap.size) {
                    friendsScheduleList.innerHTML =
                        '<p class="text-muted small mb-0">No friends yet. Add some to see their availability.</p>';
                    return;
                }

                // Rebuild the UI
                for (const friendId of friendMap.keys()) {
                    const friendName = await labelForUser(friendId);
                    const friendColor =
                        (currentUserSettings.friendColors || {})[friendId] ||
                        defaultFriendColor;

                    const item = document.createElement("label");
                    item.className =
                        "list-group-item d-flex justify-content-between align-items-center";

                    item.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center w-100">
                            <div>
                                <strong>${friendName}</strong>
                                <br><small class="text-muted">${friendId}</small>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <input type="color" class="form-control form-control-color friend-color-picker" data-friend-id="${friendId}" value="${friendColor}" title="Choose color for ${friendName}'s events">
                                    <div class="form-check form-switch m-0">
                                        <input class="form-check-input friend-toggle" type="checkbox" data-friend-id="${friendId}">
                                    </div>
                            </div>
                        </div>
                    `;

                    friendsScheduleList.appendChild(item);
                }

                // Toggle listeners
                friendsScheduleList
                    .querySelectorAll(".friend-toggle")
                    .forEach((input) => {
                        const friendId = input.dataset.friendId;
                        input.checked = friendListeners.has(friendId);

                        input.addEventListener("change", async () => {
                            const label = await labelForUser(friendId);
                            if (input.checked) {
                                subscribeFriendEvents(friendId, label);
                            } else {
                                unsubscribeFriendEvents(friendId);
                            }
                        });
                    });

                // Color pickers for each friend
                friendsScheduleList
                    .querySelectorAll(".friend-color-picker")
                    .forEach((input) => {
                        const friendId = input.dataset.friendId;
                        input.addEventListener("input", async () => {
                            const newColor = input.value;
                            if (!currentUserSettings.friendColors) {
                                currentUserSettings.friendColors = {};
                            }
                            currentUserSettings.friendColors[friendId] = newColor;
                            applyColorsToEvents();

                            try {
                                await updateDoc(doc(db, "users", currentUserId), {
                                    [`friendColors.${friendId}`]: newColor,
                                });
                            } catch (err) {
                                console.error("Failed to save friend color", err);
                            }
                        });
                    });
            },
            (error) => {
                console.error("Error listening to friendships:", error);
            }
        );
    }

    // --- Auth + Firestore wiring ---
    onAuthReady((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUserId = user.uid;
        eventsCol = collection(db, "events");

        // Listen for changes to *your* settings (eventColor + friendColors)
        const userDocRef = doc(db, "users", currentUserId);
        onSnapshot(
            userDocRef,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    currentUserSettings.eventColor =
                        data.eventColor || currentUserSettings.eventColor || defaultOwnColor;
                    currentUserSettings.friendColors =
                        data.friendColors || currentUserSettings.friendColors || {};

                    if (myEventColorInput) {
                        myEventColorInput.value = currentUserSettings.eventColor;
                    }

                    if (friendsScheduleList) {
                        friendsScheduleList
                            .querySelectorAll(".friend-color-picker")
                            .forEach((input) => {
                                const friendId = input.dataset.friendId;
                                const map = currentUserSettings.friendColors || {};
                                if (map[friendId]) {
                                    input.value = map[friendId];
                                }
                            });
                    }

                    applyColorsToEvents();
                }
            },
            (error) => {
                console.error("Error listening to user settings:", error);
            }
        );

        // Listen for *your* own events
        const userEventsQuery = query(
            eventsCol,
            where("userId", "==", currentUserId)
        );

        onSnapshot(
            userEventsQuery,
            (snapshot) => {
                // Remove your existing events from calendar
                calendar.getEvents().forEach((e) => {
                    if (e.extendedProps && e.extendedProps.ownerId === currentUserId) {
                        e.remove();
                    }
                });

                // Add them back with correct color
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    calendar.addEvent({
                        id: docSnap.id,
                        title: data.title,
                        start: data.start,
                        end: data.end || null,
                        allDay: false,
                        color: getColorForOwner(data.userId),
                        extendedProps: {
                            ownerId: data.userId,
                            ownerName: "You",
                            isFriend: false,
                            seriesId: data.seriesId || null,
                        },
                    });
                });

                applyColorsToEvents();
            },
            (error) => {
                console.error("Error listening to events:", error);
            }
        );

        // Friend overlay setup
        setupFriendSchedule(currentUserId);

        // Handle own event color picker
        if (myEventColorInput) {
            myEventColorInput.addEventListener("input", async () => {
                const newColor = myEventColorInput.value || defaultOwnColor;
                currentUserSettings.eventColor = newColor;
                applyColorsToEvents();
                try {
                    await updateDoc(doc(db, "users", currentUserId), {
                        eventColor: newColor,
                    });
                } catch (err) {
                    console.error("Failed to save own event color", err);
                }
            });
        }

        // Add Event form submit
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            const date = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const repeatUnit = repeatUnitSelect?.value || "none";
            const repeatCountRaw = repeatCountInput?.value || "1";

            if (!title || !date || !startTime || !endTime) {
                alert("Please enter a title, date, start time, and end time.");
                return;
            }

            let repeatCount = parseInt(repeatCountRaw, 10);
            if (Number.isNaN(repeatCount) || repeatCount < 1) repeatCount = 1;
            if (repeatCount > 52) repeatCount = 52;

            const needsSeries = repeatUnit !== "none" && repeatCount > 1;
            const seriesId =
                needsSeries && window.crypto && window.crypto.randomUUID
                    ? window.crypto.randomUUID()
                    : needsSeries
                        ? `series_${currentUserId}_${Date.now()}`
                        : null;

            const writes = [];

            for (let i = 0; i < repeatCount; i += 1) {
                let occurrenceDate = date;
                if (repeatUnit === "week") {
                    occurrenceDate = addDays(date, 7 * i);
                } else if (repeatUnit === "month") {
                    occurrenceDate = addMonths(date, i);
                }

                const startISO = `${occurrenceDate}T${startTime}`;
                const endISO = `${occurrenceDate}T${endTime}`;

                writes.push(
                    addDoc(eventsCol, {
                        userId: currentUserId,
                        title,
                        start: startISO,
                        end: endISO,
                        seriesId,
                    })
                );
            }

            try {
                await Promise.all(writes);

                // reset form (keep date)
                titleInput.value = "";
                startTimeInput.value = "";
                endTimeInput.value = "";
                if (repeatCountInput) repeatCountInput.value = "1";
                if (repeatUnitSelect) repeatUnitSelect.value = "none";
            } catch (err) {
                console.error("Failed to add event(s):", err);
                alert("Could not save event(s). Please try again.");
            }
        });
    });
});
