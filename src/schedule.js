/*******************************************************
 *  Schedule Page Controller
 *  -----------------------------------------------------
 *  This file controls:
 *   - Rendering FullCalendar
 *   - Adding your own events
 *   - Showing hangouts on the calendar
 *   - Overlaying friends’ schedules
 *   - Saving and remembering event colors
 *   - Handling repeating events (weekly/monthly)
 *******************************************************/

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
    /*******************************************************
     * DOM Element References
     * Grab all required inputs and containers
     *******************************************************/
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



    /*******************************************************
     * Safety Check - If something is missing, exit
     *******************************************************/
    if (
        !calendarEl ||
        !form ||
        !titleInput ||
        !dateInput ||
        !startTimeInput ||
        !endTimeInput
    ) {
        console.warn("Schedule page DOM not fully loaded.");
        return;
    }



    /*******************************************************
     * Helper - Detect small mobile screens
     * Used to simplify the FullCalendar toolbar
     *******************************************************/
    function isMobile() {
        return window.matchMedia("(max-width: 576px)").matches;
    }



    /*******************************************************
     * Basic State
     *******************************************************/
    const defaultOwnColor = "#1447E6";      // Default color for user is Blue
    const defaultFriendColor = "#2AA63E";       // Default color for a friend is Green

    let currentUserId = null;       // Set after auth
    let eventsCol = null;       // "events" collection
    let friendListeners = new Map();        // Active Firestore listeners
    let friendLabelCache = new Map();       // Cache of names

    // Loaded from Firestore "users" document
    let currentUserSettings = {
        eventColor: defaultOwnColor,
        friendColors: {},
    };



    /*******************************************************
     * Color Logic - Returns correct color depending on owner
     *******************************************************/
    function getColorForOwner(ownerId) {
        if (!ownerId) return defaultOwnColor;

        // your own events
        if (ownerId === currentUserId) {
            return currentUserSettings.eventColor || defaultOwnColor;
        }

        // friends
        const map = currentUserSettings.friendColors || {};
        return map[ownerId] || defaultFriendColor;
    }



    /*******************************************************
     * FullCalendar Initialization
     *******************************************************/
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
        themeSystem: "bootstrap5",
        initialView: "dayGridMonth",
        height: "auto",
        expandRows: true,
        dayMaxEventRows: true,
        selectable: true,

        // Responsive toolbar
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


        /***************************************************
         * Date Click - Pre-fill the date for new event
         ***************************************************/
        dateClick: (info) => {
            dateInput.value = info.dateStr;
            titleInput.focus();
        },

        /***************************************************
         * Event Click - Open or delete events
         ***************************************************/
        eventClick: async (info) => {
            const event = info.event;
            const { ownerId, ownerName, seriesId, type, hangoutId } =
                event.extendedProps || {};


            /***********************************************
             * Hangout Events - Redirect instead of delete
             ***********************************************/
            if (type === "hangout") {
                const go = confirm(
                    `Open this hangout?\n\n"${event.title}"`
                );
                if (go) {
                    window.location.href = "hangout.html";
                }
                return;
            }

            /***********************************************
             * Friend Events - Read-only
             ***********************************************/
            if (ownerId && ownerId !== currentUserId) {
                alert(
                    `This event belongs to ${ownerName || "a friend"}.\nYou cannot delete it.`
                );
                return;
            }

            /***********************************************
             * Your Own Events - Ask before deleting
             ***********************************************/
            const startText = event.start
                ? event.start.toLocaleString()
                : "unknown";
            const endText = event.end ? event.end.toLocaleString() : "";

            const del = confirm(
                `Delete "${event.title}"?\nFrom: ${startText}` +
                (endText ? `\nTo: ${endText}` : "")
            );
            if (!del) return;

            try {
                /*******************************************
                 * Repeating Event - Delete entire series?
                 *******************************************/
                if (seriesId && eventsCol) {
                    const deleteSeries = confirm(
                        "This is part of a repeating series.\n\nOK = delete ALL events in series.\nCancel = delete only this one."
                    );

                    if (deleteSeries) {
                        const q = query(
                            eventsCol,
                            where("userId", "==", currentUserId),
                            where("seriesId", "==", seriesId)
                        );
                        const snap = await getDocs(q);
                        await Promise.all(
                            snap.docs.map((d) => deleteDoc(d.ref))
                        );
                        return;
                    }
                }

                /*******************************************
                 * Single Event Delete
                 *******************************************/
                await deleteDoc(doc(db, "events", event.id));
            } catch (err) {
                console.error("Delete failed:", err);
                alert("Could not delete event.");
            }
        },

        /***************************************************
         * Responsive Toolbar Update
         ***************************************************/
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



    /*******************************************************
     * Color Application - Re-apply colors to all events
     *******************************************************/
    function applyColorsToEvents() {
        calendar.getEvents().forEach((ev) => {
            const ownerId = ev.extendedProps?.ownerId;
            if (!ownerId) return;

            const color = getColorForOwner(ownerId);
            ev.setProp("backgroundColor", color);
            ev.setProp("borderColor", color);
        });
    }



    /*******************************************************
     * Date Utilities - Used for repeating events
     *******************************************************/
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



    /*******************************************************
     * User Label Lookup - Fetches display name once
     *******************************************************/
    async function labelForUser(uid) {
        if (friendLabelCache.has(uid)) return friendLabelCache.get(uid);

        let label = uid;        // fallback
        try {
            const u = await getDoc(doc(db, "users", uid));
            if (u.exists()) {
                const d = u.data();
                label = d.displayName || d.name || d.email || uid;
            }
        } catch (err) {
            console.error("Error loading user label:", err);
        }
        friendLabelCache.set(uid, label);
        return label;
    }



    /*******************************************************
     * Friend Event Layers - Add/remove events on calendar
     *******************************************************/
    function removeFriendEventsFromCalendar(friendId) {
        calendar.getEvents().forEach((ev) => {
            if (ev.extendedProps?.ownerId === friendId &&
                ev.extendedProps?.isFriend) {
                ev.remove();
            }
        });
    }



    /*******************************************************
     * Subscribe to a friend's events in real-time
     *******************************************************/
    function subscribeFriendEvents(friendId, friendName) {
        if (friendListeners.has(friendId)) return;      // already subscribed

        const q = query(
            collection(db, "events"),
            where("userId", "==", friendId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                // Remove old friend events
                removeFriendEventsFromCalendar(friendId);

                // Add updated friend events
                snapshot.forEach((docSnap) => {
                    const ev = docSnap.data();
                    calendar.addEvent({
                        id: `friend_${friendId}_${docSnap.id}`,
                        title: `${friendName}: ${ev.title}`,
                        start: ev.start,
                        end: ev.end || null,
                        allDay: false,
                        color: getColorForOwner(friendId),
                        extendedProps: {
                            ownerId: friendId,
                            ownerName: friendName,
                            isFriend: true,
                            seriesId: ev.seriesId || null,
                        },
                    });
                });

                applyColorsToEvents();
            },
            (err) => console.error("Friend events error:", err)
        );

        friendListeners.set(friendId, unsubscribe);
    }



    /*******************************************************
     * Stop listening to a friend's events
     *******************************************************/
    function unsubscribeFriendEvents(friendId) {
        const unsub = friendListeners.get(friendId);
        if (unsub) unsub();
        friendListeners.delete(friendId);

        removeFriendEventsFromCalendar(friendId);
    }



    /*******************************************************
     * Friend List UI - Creates toggle + color picker UI
     *******************************************************/
    function setupFriendSchedule(uid) {
        if (!friendsScheduleList) return;

        // Query all accepted friendships
        const friendshipsQuery = query(
            collection(db, "friendships"),
            or(
                and(where("fromUserId", "==", uid), where("status", "==", "accepted")),
                and(where("toUserId", "==", uid), where("status", "==", "accepted"))
            )
        );

        onSnapshot(
            friendshipsQuery,
            async (snapshot) => {
                friendsScheduleList.innerHTML = "";

                // Build a set of friend IDs
                const friendIds = new Map();
                snapshot.forEach((docSnap) => {
                    const d = docSnap.data();
                    const friendId = d.fromUserId === uid ? d.toUserId : d.fromUserId;
                    friendIds.set(friendId, true);
                });

                // Remove listeners for people not friends anymore
                for (const friendId of friendListeners.keys()) {
                    if (!friendIds.has(friendId)) {
                        unsubscribeFriendEvents(friendId);
                    }
                }

                // No friends?
                if (!friendIds.size) {
                    friendsScheduleList.innerHTML =
                        '<p class="text-muted small mb-0">You have no friends added yet.</p>';
                    return;
                }

                // Build UI for each friend
                for (const friendId of friendIds.keys()) {
                    const friendName = await labelForUser(friendId);

                    const savedColor =
                        currentUserSettings.friendColors?.[friendId] ||
                        defaultFriendColor;

                    const row = document.createElement("label");
                    row.className =
                        "list-group-item d-flex justify-content-between align-items-center";

                    row.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center w-100">
                            <div>
                                <strong>${friendName}</strong>
                                <br><small class="text-muted">${friendId}</small>
                            </div>

                            <div class="d-flex align-items-center gap-2">
                                <!-- Friend color picker -->
                                <input
                                    type="color"
                                    class="form-control form-control-color friend-color-picker"
                                    data-friend-id="${friendId}"
                                    value="${savedColor}"
                                >

                                <!-- Toggle switch -->
                                <div class="form-check form-switch m-0">
                                    <input
                                        class="form-check-input friend-toggle"
                                        type="checkbox"
                                        data-friend-id="${friendId}"
                                    >
                                </div>
                            </div>
                        </div>
                    `;

                    friendsScheduleList.appendChild(row);
                }


                /***************************************************
                 * Setup - Friend toggles (On/Off)
                 ***************************************************/
                friendsScheduleList.querySelectorAll(".friend-toggle").forEach((input) => {
                    const friendId = input.dataset.friendId;

                    // Show toggle state depending on active listeners
                    input.checked = friendListeners.has(friendId);

                    input.addEventListener("change", async () => {
                        const name = await labelForUser(friendId);
                        if (input.checked) subscribeFriendEvents(friendId, name);
                        else unsubscribeFriendEvents(friendId);
                    });
                });


                /***************************************************
                 * Setup - Friend color pickers
                 ***************************************************/
                friendsScheduleList.querySelectorAll(".friend-color-picker").forEach((input) => {
                    const friendId = input.dataset.friendId;

                    input.addEventListener("input", async () => {
                        const newColor = input.value;

                        // Update local settings
                        currentUserSettings.friendColors ??= {};
                        currentUserSettings.friendColors[friendId] = newColor;

                        applyColorsToEvents();

                        // Save to Firestore
                        try {
                            await updateDoc(doc(db, "users", currentUserId), {
                                [`friendColors.${friendId}`]: newColor,
                            });
                        } catch (err) {
                            console.error("Error saving friend color:", err);
                        }
                    });
                });
            },
            (err) => console.error("Friendships error:", err)
        );
    }



    /*******************************************************
     * Remove All Hangout Events From Calendar
     *******************************************************/
    function removeHangoutEventsFromCalendar() {
        calendar.getEvents().forEach((ev) => {
            if (ev.extendedProps?.type === "hangout") ev.remove();
        });
    }



    /*******************************************************
     * Authentication
     *******************************************************/
    onAuthReady((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUserId = user.uid;
        eventsCol = collection(db, "events");


        /***************************************************
         * Listen To User Settings (eventColor + friendColors)
         ***************************************************/
        const userDocRef = doc(db, "users", currentUserId);

        onSnapshot(
            userDocRef,
            (snap) => {
                if (!snap.exists()) return;

                const data = snap.data();

                currentUserSettings.eventColor =
                    data.eventColor || defaultOwnColor;

                currentUserSettings.friendColors =
                    data.friendColors || {};

                // Update the color input UI
                if (myEventColorInput) {
                    myEventColorInput.value = currentUserSettings.eventColor;
                }

                applyColorsToEvents();
            },
            (err) => console.error("Settings listener error:", err)
        );


        /***************************************************
         * Listen To Your Own Schedule Events
         ***************************************************/
        const userEventsQuery = query(eventsCol, where("userId", "==", currentUserId));

        onSnapshot(
            userEventsQuery,
            (snapshot) => {
                // Remove all your schedule events before adding updated ones
                calendar.getEvents().forEach((ev) => {
                    if (
                        ev.extendedProps?.ownerId === currentUserId &&
                        ev.extendedProps?.type !== "hangout"
                    ) {
                        ev.remove();
                    }
                });

                // Add new/updated events
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
                            type: "schedule",
                        },
                    });
                });

                applyColorsToEvents();
            },
            (err) => console.error("Own events listener error:", err)
        );


        /***************************************************
         * Listen To Your Hangouts And Add Them To Calendar
         ***************************************************/
        const hangoutsQuery = query(
            collection(db, "hangouts"),
            where("userId", "==", currentUserId)
        );

        onSnapshot(
            hangoutsQuery,
            (snapshot) => {
                removeHangoutEventsFromCalendar();

                snapshot.forEach((docSnap) => {
                    const d = docSnap.data();
                    if (!d.date) return;

                    const startISO = `${d.date}T${d.startTime || "00:00"}`;
                    const endISO = d.endTime ? `${d.date}T${d.endTime}` : null;

                    calendar.addEvent({
                        id: `hangout_${docSnap.id}`,
                        title: d.title || "Hangout",
                        start: startISO,
                        end: endISO,
                        allDay: false,
                        color: getColorForOwner(d.userId),
                        extendedProps: {
                            ownerId: d.userId,
                            ownerName: "You",
                            type: "hangout",
                            hangoutId: docSnap.id,
                        },
                    });
                });

                applyColorsToEvents();
            },
            (err) => console.error("Hangouts listener error:", err)
        );


        /***************************************************
         * Friend Schedule Overlay
         ***************************************************/
        setupFriendSchedule(currentUserId);


        /***************************************************
         * Own Event Color Picker - Save selection
         ***************************************************/
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
                    console.error("Failed to save own event color:", err);
                }
            });
        }


        /***************************************************
         * Event Creation Form - Create schedule events
         ***************************************************/
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const date = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            let repeatUnit = repeatUnitSelect?.value || "none";
            let repeatCountRaw = repeatCountInput?.value || "1";


            /***********************************************
             * Basic Validation
             ***********************************************/
            if (!title || !date || !startTime || !endTime) {
                alert("Please fill all required fields.");
                return;
            }

            let repeatCount = parseInt(repeatCountRaw, 10);
            if (isNaN(repeatCount) || repeatCount < 1) repeatCount = 1;
            if (repeatCount > 52) repeatCount = 52;


            /***********************************************
             * Repeating Event -> Assign seriesId
             ***********************************************/
            const needsSeries = repeatUnit !== "none" && repeatCount > 1;

            const seriesId =
                needsSeries && window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : needsSeries
                        ? `series_${currentUserId}_${Date.now()}`
                        : null;

            const writes = [];


            /***********************************************
             * Create Each Occurence
             ***********************************************/
            for (let i = 0; i < repeatCount; i++) {
                let occurrenceDate = date;

                if (repeatUnit === "week") {
                    occurrenceDate = addDays(date, i * 7);
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


            /***********************************************
             * Save And Reset Form
             ***********************************************/
            try {
                await Promise.all(writes);

                titleInput.value = "";
                startTimeInput.value = "";
                endTimeInput.value = "";

                if (repeatCountInput) repeatCountInput.value = "1";
                if (repeatUnitSelect) repeatUnitSelect.value = "none";

            } catch (err) {
                console.error("Failed to add event(s):", err);
                alert("Could not save events.");
            }
        });
    });
});
