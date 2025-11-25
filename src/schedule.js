// -------------------------------------------------------------
// src/schedule.js
// -------------------------------------------------------------
// Calendar/schedule management page for the Hang Out app.
// Uses FullCalendar library to display and manage personal events.
// Features:
// - Interactive calendar with month/week/day views
// - Add events with title, date, and time
// - Click events to delete them
// - Real-time sync with Firestore
// - Responsive design for mobile and desktop
// -------------------------------------------------------------

import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";

// -------------------------------------------------------------
// Page Initialization
// -------------------------------------------------------------
// Sets up the calendar and event form when DOM is ready.
// -------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    // Get references to calendar and form elements
    const calendarEl = document.getElementById("calendar");
    const form = document.getElementById("eventForm");
    const titleInput = document.getElementById("eventTitle");
    const dateInput = document.getElementById("eventDate");
    const startTimeInput = document.getElementById("eventStartTime");
    const endTimeInput = document.getElementById("eventEndTime");     

    // Validate that all required elements exist
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

    

    // -------------------------------------------------------------
    // Responsive Helper Functions
    // -------------------------------------------------------------
    // Detects screen size to adjust calendar layout
    // -------------------------------------------------------------
    
    // Check if viewport is mobile-sized
    function isMobile() {
        return window.matchMedia("(max-width: 576px)").matches;
    }

    // -------------------------------------------------------------
    // FullCalendar Configuration
    // -------------------------------------------------------------
    // Initializes the calendar with responsive settings and event handlers.
    // Uses Bootstrap 5 theme for consistent styling.
    // -------------------------------------------------------------
    
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
        // Use Bootstrap 5 theme for consistent styling
        themeSystem: 'bootstrap5',

        // Calendar layout settings
        initialView: isMobile() ? 'dayGridMonth' : 'dayGridMonth',
        height: 'auto',          // Auto-adjust height
        expandRows: true,        // Expand rows to fill space
        dayMaxEventRows: true,   // Limit events per day
        selectable: true,        // Allow date selection

        // Responsive toolbar: simplified on mobile
        headerToolbar: isMobile()
            ? { left: 'prev,next today', center: 'title', right: '' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },

        // Button labels
        buttonText: { today: 'today', month: 'month', week: 'week', day: 'day' },

        // -------------------------------------------------------------
        // Event: dateClick
        // -------------------------------------------------------------
        // When user clicks a date, populate the form with that date
        // -------------------------------------------------------------
        dateClick: (info) => {
            // Fill the date input with clicked date
            dateInput.value = info.dateStr;
            // Focus on title input for quick entry
            titleInput.focus();
        },

        // -------------------------------------------------------------
        // Event: eventClick
        // -------------------------------------------------------------
        // When user clicks an event, show confirmation to delete it
        // -------------------------------------------------------------
        eventClick: async (info) => {
            const event = info.event;
            const startText = event.start ? event.start.toLocaleString() : "unknown start";
            const endText = event.end ? event.end.toLocaleString() : "";

            // Confirm deletion with user
            const ok = confirm(
                `Delete event "${event.title}"\n` +
                `From: ${startText}` +
                (endText ? `\nTo:   ${endText}` : "") +
                " ?"
            );
            if (!ok) return;

            try {
                // Delete from Firestore (onSnapshot will update calendar)
                await deleteDoc(doc(db, "events", event.id));
            } catch (err) {
                console.error("Failed to delete event:", err);
                alert("Could not delete event. Please try again.");
            }
        },

        // -------------------------------------------------------------
        // Event: windowResize
        // -------------------------------------------------------------
        // Adjust toolbar when window is resized
        // -------------------------------------------------------------
        windowResize: () => {
            calendar.setOption(
                'headerToolbar',
                isMobile()
                    ? { left: 'prev,next today', center: 'title', right: '' }
                    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
            );
        },
    });

    // Render the calendar
    calendar.render();


    // -------------------------------------------------------------
    // Firebase Authentication and Firestore Integration
    // -------------------------------------------------------------
    // Waits for user authentication, then sets up real-time
    // event synchronization and form submission handler.
    // -------------------------------------------------------------
    
    onAuthReady((user) => {
        if (!user) {
            // Not logged in, redirect to login page
            window.location.href = "login.html";
            return;
        }

        const uid = user.uid;
        const eventsCol = collection(db, "events");
        // Query only this user's events
        const userEventsQuery = query(eventsCol, where("userId", "==", uid));

        // -------------------------------------------------------------
        // Real-time Event Listener
        // -------------------------------------------------------------
        // Syncs calendar with Firestore whenever events change
        // -------------------------------------------------------------
        
        onSnapshot(
            userEventsQuery,
            (snapshot) => {
                // Clear all existing events from calendar
                calendar.getEvents().forEach((e) => e.remove());

                // Add all events from Firestore to calendar
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    calendar.addEvent({
                        id: docSnap.id, // Store Firestore doc ID for deletion
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

        // -------------------------------------------------------------
        // Event Form Submission Handler
        // -------------------------------------------------------------
        // Adds new events to Firestore when form is submitted
        // -------------------------------------------------------------
        
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Get form values
            const title = titleInput.value.trim();
            const date = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            // Validate required fields
            if (!title || !date || !startTime || !endTime) {
                alert("Please enter a title, date, start time, and end time.");
                return;
            }

            // Combine date and time into ISO format for FullCalendar
            const startISO = `${date}T${startTime}`;
            const endISO = `${date}T${endTime}`;

            try {
                // Save event to Firestore
                await addDoc(eventsCol, {
                    userId: uid,
                    title: title,
                    start: startISO,
                    end: endISO,
                });

                // Clear title and times, keep date for adding multiple events
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
