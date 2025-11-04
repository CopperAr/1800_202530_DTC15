
// import { onAuthReady } from "/src/authentication.js";

document.addEventListener("DOMContentLoaded", () => {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;

    // FullCalendar is attached to window from the CDN script
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        height: "auto",
        selectable: true,
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
        },

        // when user clicks a day on the calendar, pre-fill the form date
        dateClick: (info) => {
            const dateInput = document.getElementById("eventDate");
            if (dateInput) {
                dateInput.value = info.dateStr; // yyyy-mm-dd
                dateInput.focus();
            }
        },

        // when user clicks an event, ask if they want to remove it
        eventClick: (info) => {
            const shouldDelete = confirm(
                `Delete event "${info.event.title}" on ${info.event.start.toDateString()}?`
            );
            if (shouldDelete) {
                info.event.remove();
            }
        },

        // some sample events so it's not empty
        events: [
            {
                title: "Study group",
                start: new Date().toISOString().slice(0, 10),
            },
            {
                title: "Hangout with friends",
                start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .slice(0, 10),
            },
        ],
    });

    calendar.render();

    // handle the "Add Event" form
    const form = document.getElementById("eventForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const titleInput = document.getElementById("eventTitle");
            const dateInput = document.getElementById("eventDate");

            const title = titleInput?.value.trim();
            const date = dateInput?.value;

            if (!title || !date) {
                alert("Please enter both a title and a date.");
                return;
            }

            // add to calendar
            calendar.addEvent({
                title: title,
                start: date,
                allDay: true,
            });

            titleInput.value = "";
        });
    }
});
