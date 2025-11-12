# Hangout

## Overview

Hangout is a client-side JavaScript web application that helps users discover and explore social hangouts or hiking trails. The app displays a curated list of hangout locations, each with details such as name, location, difficulty, and image. Users can browse the list and mark their favorite spots for easy access later.

Developed for the COMP 1800 course, this project applies User-Centred Design practices and agile project management, and demonstrates integration with Firebase backend services for storing user favorites.

---

## Features

- Browse a list of curated hangouts and trails with images and details
- Mark and unmark locations as favorites
- View a personalized list of favorite hangouts
- **Friends System**: Add friends, send/accept friend requests, and view your friends list
- **Schedule Management**: Create and manage personal events with calendar integration
- **User Authentication**: Secure login and signup with Firebase Authentication
- Responsive design for desktop and mobile

---

## Technologies Used

Example:

- **Frontend**: HTML, CSS, JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Firebase for hosting
- **Database**: Firestore

---

## Usage

### Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm run dev
   ```

3. Open your browser and visit the URL shown in the terminal (usually `http://localhost:5173`).

### Using the Application

1. **Login/Signup**: Create an account or log in to access features
2. **Main Page**: Browse hangout locations and view your dashboard
3. **Friends**:
   - Visit the Friends page to manage your connections
   - Add friends using their User ID (get it from Profile page)
   - Accept or reject friend requests
   - View your friends list
4. **Schedule**: Create and manage your personal events with the calendar
5. **Profile**: View your User ID and manage your account settings

### Setting Up Friends Feature

**Important**: You must configure Firestore security rules for the friends feature to work.

---

## Project Structure

```
hangout/
├── images/                          # Image assets
├── src/
│   ├── components/
│   │   ├── site-navbar.js          # Navigation bar component
│   │   └── site-footer.js          # Footer component
│   ├── app.js                      # Main application logic
│   ├── authentication.js           # Firebase authentication functions
│   ├── firebaseConfig.js           # Firebase configuration
│   ├── friends.js                  # Friends feature logic ✨ NEW
│   ├── loginSignup.js              # Login/signup page logic
│   ├── main.js                     # Main page logic
│   ├── profile.js                  # Profile page logic
│   └── schedule.js                 # Schedule/calendar logic
├── styles/
│   └── style.css                   # Global styles
├── index.html                      # Landing page
├── login.html                      # Login/signup page
├── main.html                       # Main dashboard
├── friends.html                    # Friends management page ✨ NEW
├── profile.html                    # User profile page
├── schedule.html                   # Calendar/schedule page
├── package.json
├── package-lock.json
└── README.md
```

---

## Contributors

- **Fara** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: I play guitar.
- **Gaocheng Chen** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: Loves solving Rubik's Cubes in under a minute.
- **David** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: I like playing video games and listening to music.

---

## Acknowledgments

- Data and images are for demonstration purposes only.
- Code snippets were adapted from resources such as [Stack Overflow](https://stackoverflow.com/) and [MDN Web Docs](https://developer.mozilla.org/).
- Icons sourced from [FontAwesome](https://fontawesome.com/) and images from [Unsplash](https://unsplash.com/).

---

## Friends Feature

The friends system allows users to connect with each other:

- **Add Friends**: Send friend requests using User IDs
- **Manage Requests**: Accept or reject incoming friend requests
- **View Friends**: See all your accepted friends in one place
- **Real-time Updates**: Friend list updates automatically without refresh

### Setup

1. Configure Firestore security rules in Firebase Console
2. Get a friend's User ID from their profile page
3. Visit the Friends page and send a request
4. Your friend accepts the request

---

## Limitations and Future Work

### Limitations

- Limited details on each hangout spot (e.g., no live updates or weather info)
- Accessibility features can be further improved
- Friends cannot see each other's schedules yet

### Future Work

- Implement map view and route directions
- Add filtering and sorting options (e.g., by category, location)
- Introduce a dark mode for better usability in low-light conditions
- **Friend Features**:
  - View friends' availability and schedules
  - Suggest overlapping free times for hangouts
  - Friend search functionality
  - Friend grouping and categories
  - Notifications for friend requests

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
