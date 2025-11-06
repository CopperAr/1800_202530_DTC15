
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";

document.addEventListener("DOMContentLoaded", () => {
    const calendarEl = document.getElementById("calendar");
    const form = document.getElementById("eventForm");
    const titleInput = document.getElementById("eventTitle");
    const dateInput = document.getElementById("eventDate");
    const startTimeInput = document.getElementById("eventStartTime");
    const endTimeInput = document.getElementById("eventEndTime");     

    if (!calendarEl ||
        !form ||
        !titleInput ||
        !dateInput ||
        !startTimeInput ||
        !endTimeInput
    ) {
        console.warn("Schedule page DOM not ready");
        return;
    }

    // create the calendar instance
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
            const event = info.event;
            const startText = event.start
                ? event.start.toLocaleString()
                : "unknown start";
            const endText = event.end ? event.end.toLocaleString() : "";

            const ok = confirm(
                `Delete event "${event.title}"\n` +
                `From: ${startText}` +
                (endText ? `\nTo:   ${endText}` : "") +
                " ?"
            );
            if (!ok) return;

            try {
                await deleteDoc(doc(db, "events", event.id));
                // onSnapshot will re-sync the calendar
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
                        start: data.start,
                        end: data.end || null,
                        allDay: false,
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
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            if (!title || !date || !startTime || !endTime) {
                alert("Please enter a title, date, start time, and end time.");
                return;
            }

            const startISO = `${date}T${startTime}`;
            const endISO = `${date}T${endTime}`;

            try {
                await addDoc(eventsCol, {
                    userId: uid,
                    title: title,
                    start: startISO,
                    end: endISO,
                });

                // clear title, keep date to add multiple on same day
                titleInput.value = "";
                startTimeInput.value = "";
                endTimeInput.value = "";
                
            } catch (err) {
                console.error("Failed to add event:", err);
                alert("Could not save event. Please try again.");
            }
        });
    });
});
