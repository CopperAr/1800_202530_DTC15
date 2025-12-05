# Hangout

## Overview

Hangout is a social web application that helps users discover hangout locations, manage their schedule, and connect with friends. Built with Firebase backend services, the app provides real-time data synchronization and secure user authentication.

Developed for the COMP 1800 course at BCIT, this project demonstrates User-Centred Design practices, agile project management, and modern web development technologies.

---

## Features

- **User Authentication**: Secure signup and login with Firebase Authentication
- **Main Dashboard**: Personalized homepage with quote of the day and friends overview
- **Friends System**:
  - Add friends using their email address
  - Send and receive friend requests
  - View and manage your friends list
  - Duplicate-proof friendship storage with canonical pairing
- **Schedule Management**: Create, view, and manage personal events with calendar integration
- **Hangout Discovery**: Browse curated hangout locations and trails
- **Profile Management**: View profile information and sign out functionality
- **Responsive Design**: Works seamlessly on desktop and mobile devices

---

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Framework**: Bootstrap 5 for responsive UI
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Firebase Authentication & Firestore Database
- **Hosting**: Firebase Hosting
- **Version Control**: Git & GitHub

---

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account with a configured project

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/CopperAr/1800_202530_DTC15.git
   cd 1800_202530_DTC15
   ```

2. **Install dependencies** (includes Firebase SDK):

   ```bash
   npm install
   ```

   This will install all required packages including:

   - `firebase` - Firebase SDK for authentication and Firestore
   - `bootstrap` - UI framework
   - `vite` - Build tool

3. **Configure Firebase**:

   - Update `src/firebaseConfig.js` with your Firebase project credentials
   - Set up Firestore security rules (see Firebase Setup section below)

4. **Run the development server**:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

---

## Firebase Setup

### Firestore Security Rules

To enable the friends feature and secure your database, configure these rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Friendships collection
    match /friendships/{friendshipId} {
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.fromUserId ||
         request.auth.uid == resource.data.toUserId);
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.fromUserId;
      allow update, delete: if request.auth != null &&
        (request.auth.uid == resource.data.fromUserId ||
         request.auth.uid == resource.data.toUserId);
    }

    // Events collection
    match /events/{eventId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.userId;
    }

    // Quotes collection (read-only for all authenticated users)
    match /quotes/{quoteId} {
      allow read: if request.auth != null;
    }
  }
}
```

### Required Firestore Collections

The app expects these collections in your Firestore database:

1. **users**: User profile data

   - `displayName` (string)
   - `email` (string)
   - `pronouns` (string)
   - `city` (string)

2. **friendships**: Friend relationships

   - `fromUserId` (string)
   - `toUserId` (string)
   - `pairKey` (string) - canonical key for duplicate prevention
   - `status` (string): "pending", "accepted", or "rejected"
   - `createdAt` (timestamp)
   - `updatedAt` (timestamp)

3. **events**: User calendar events

   - `userId` (string)
   - `title` (string)
   - `description` (string)
   - `startTime` (timestamp)
   - `endTime` (timestamp)

4. **hangouts**: User planned hangouts

   - `createdAt` (timestamp)
   - `date` (string)
   - `description` (string)
   - `startTime` (timestamp)
   - `endTime` (timestamp)
   - `location` (string)
   - `participants` (array)
   - `status` (string)
   - `title` (string)
   - `userID` (string)

5. **quotes** (optional): Daily motivational quotes
   - `text` (string)

---

## Usage Guide

### 1. Authentication

- Navigate to the landing page (`index.html`)
- Click "Sign Up" to create a new account or "Log In" with existing credentials
- All features require authentication

### 2. Main Dashboard

- After login, you'll see your personalized dashboard (`main.html`)
- View quote of the day
- See a preview of your friends (up to 5)
- Quick access to add friends or import contacts

### 3. Friends Feature

- Visit the Friends page from the navigation bar
- **Add a friend**: Enter their email address and click "Add Friend"
- **Manage requests**: Accept or reject incoming friend requests
- **View friends**: All accepted friendships appear in "My Friends" section
- The system automatically prevents duplicate friendships using canonical pairing

### 4. Schedule

- Access the Schedule page to view your calendar
- View your friends' calendars by toggling view
- Create new events with title, description, start and end times
- Edit or delete existing events

### 5. Hangouts

- View upcoming and previous hangouts
- Create a new hangout

### 6. Profile

- View your account information
- Update your name, pronouns, and/or city
- Copy your email to share with friends
- Sign out from your account

---

## Project Structure

```
1800_202530_DTC15/
├── src/
│   ├── components/
│   │   ├── site-navbar.js         # Reusable navigation bar web component
│   │   └── site-footer.js         # Reusable footer web component
│   ├── app.js                     # Main application entry point
│   ├── authentication.js          # Firebase auth helper functions
│   ├── firebaseConfig.js          # Firebase initialization
│   ├── friends.js                 # Friends feature logic (add, accept, display)
│   ├── hangout.js                 # Hangout discovery page logic
│   ├── loginSignup.js             # Login/signup page logic
│   ├── main.js                    # Dashboard logic and friends preview
│   ├── profile.js                 # Profile page and sign out logic
│   └── schedule.js                # Calendar and event management
├── styles/
│   └── style.css                  # Global styles and theme
├── images/                        # Static image assets
│   └── nav.jpg                    # Background image for headings
├── dist/                          # Production build output (To build: npm run build)
├── index.html                     # Landing page
├── login.html                     # Login/signup page
├── main.html                      # Main dashboard
├── friends.html                   # Friends management page
├── hangout.html                   # Hangout discovery page
├── profile.html                   # User profile page
├── schedule.html                  # Calendar page
├── package.json                   # Node dependencies
└── .gitignore                     # Lists files/folders not tracked by git
└── .firebaserc                    # Firebase server setup
└── firestore.indexes.json         # Firebase server setup
└── firestore.rules                # Firebase server setup
└── vite.config.js                 # For building dist folder
└── README.md                      # Project documentation
```

---

## Key Technical Implementations

### Friends System Architecture

The friends feature uses a **canonical pairKey** approach to prevent duplicate friendships:

1. When user A sends a request to user B, the system:

   - Sorts both user IDs alphabetically
   - Creates a unique `pairKey` (e.g., "uidA\_\_uidB")
   - Checks if a friendship with this `pairKey` already exists
   - Creates new document only if it doesn't exist

2. When displaying friends:

   - Two queries fetch friendships where user is sender OR receiver
   - Results are deduplicated using a Map keyed by friend's UID
   - Ensures each friend appears only once in the UI

3. Benefits:
   - No duplicate friendship documents in Firestore
   - Efficient querying and real-time updates
   - Consistent data structure regardless of who initiated the friendship

### Real-time Updates

The app uses Firestore `onSnapshot` listeners for:

- Friend requests (automatic UI updates when requests arrive)
- Friends list (live updates when friends are added/removed)
- Events/schedule (calendar updates in real-time)

---

## Known Limitations

- Friends cannot view each other's schedules (planned for future release)
- No notification system for friend requests yet
- Limited hangout location data (no live updates or weather integration)
- Accessibility features can be improved (ARIA labels, keyboard navigation)

---

## Future Enhancements

- **Friend Features**:
  - Friend search and suggestions
  - View friends' availability
  - Group chat and messaging
  - Notifications for friend requests and events
- **Schedule**:
  - Suggest overlapping free times for hangouts
  - Event reminders
- **Hangouts**:
  - Map view with location pins
  - User-submitted hangout locations
  - Reviews and ratings
- **General**:
  - Dark mode toggle
  - Push notifications
  - Multi-language support

---

## Contributors

- **Fara** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: I play guitar.
- **Gaocheng Chen** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: Loves solving Rubik's Cubes in under a minute.
- **David** – BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: I like playing video games and listening to music.

---

## Acknowledgments

- Firebase for backend infrastructure and real-time database
- Bootstrap team for responsive UI components
- Icons from [FontAwesome](https://fontawesome.com/)
- Images from [Unsplash](https://unsplash.com/)
- Code references from [MDN Web Docs](https://developer.mozilla.org/) and [Stack Overflow](https://stackoverflow.com/)

---

## Contact & Support

For questions or issues, please open an issue on the GitHub repository or contact the development team through BCIT CST channels.
