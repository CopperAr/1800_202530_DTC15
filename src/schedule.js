
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";

document.addEventListener("DOMContentLoaded", () => {
    const calendarEl = document.getElementById("calendar");
    const form = document.getElementById("eventForm");
    const titleInput = document.getElementById("eventTitle");
    const dateInput = document.getElementById("eventDate");

    if (!calendarEl || !form || !titleInput || !dateInput) {
        console.warn("Schedule page DOM not ready");
        return;
    }

    // create the calendar instance (no events yet)
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        height: "auto",
        selectable: true,
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
        },

        dateClick: (info) => {
            // click on a day fills the form date
            dateInput.value = info.dateStr;
            titleInput.focus();
        },

        eventClick: async (info) => {
            // click on an event prompts delete
            const event = info.event;
            const ok = confirm(
                `Delete event "${event.title}" on ${event.start.toDateString()}?`
            );
            if (!ok) return;

            // we stored the Firestore doc id in event.id
            try {
                await deleteDoc(doc(db, "events", event.id));
                // no need to remove from calendar manually:
                // onSnapshot will fire and refresh events
            } catch (err) {
                console.error("Failed to delete event:", err);
                alert("Could not delete event. Please try again.");
            }
        },
    });

    calendar.render();

    // authorization + Firestore wiring
    onAuthReady((user) => {
        if (!user) {
            // not logged in → send them to login page
            window.location.href = "login.html";
            return;
        }

        const uid = user.uid;
        const eventsCol = collection(db, "events");
        const userEventsQuery = query(eventsCol, where("userId", "==", uid));

        // live listener: whenever this user's events change, update calendar
        onSnapshot(
            userEventsQuery,
            (snapshot) => {
                // clear existing events
                calendar.getEvents().forEach((e) => e.remove());

                // add all events from Firestore
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    calendar.addEvent({
                        id: docSnap.id, // store Firestore doc id so we can delete later
                        title: data.title,
                        start: data.start, // "YYYY-MM-DD"
                        allDay: true,
                    });
                });
            },
            (error) => {
                console.error("Error listening to events:", error);
            }
        );

        // handle "Add Event" form submit -> write to Firestore
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            const date = dateInput.value;

            if (!title || !date) {
                alert("Please enter both a title and a date.");
                return;
            }

            try {
                await addDoc(eventsCol, {
                    userId: uid,
                    title: title,
                    start: date,
                });

                // clear title, keep date to add multiple on same day
                titleInput.value = "";
            } catch (err) {
                console.error("Failed to add event:", err);
                alert("Could not save event. Please try again.");
            }
        });
    });
});
