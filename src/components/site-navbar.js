// -------------------------------------------------------------
// src/components/site-navbar.js
// -------------------------------------------------------------
// Custom web component for the site navigation bar.
// Provides a responsive navigation menu that adapts based on
// user authentication state and highlights the active page.
// -------------------------------------------------------------

// Import specific functions from the Firebase Auth SDK
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";

// -------------------------------------------------------------
// SiteNavbar Class
// -------------------------------------------------------------
// Defines a custom HTML element for the navigation bar.
// Automatically renders navbar, handles auth state, and
// highlights the current page.
// -------------------------------------------------------------
class SiteNavbar extends HTMLElement {
  // Constructor runs when the element is created
  constructor() {
    super();
    this.renderNavbar();        // Build the navbar HTML
    this.renderAuthControls();  // Add login/logout buttons
    this.highlightActiveLink(); // Highlight current page
  }

  // -------------------------------------------------------------
  // renderNavbar()
  // -------------------------------------------------------------
  // Builds the navigation bar HTML structure with SVG icons
  // and navigation links for all main pages.
  // -------------------------------------------------------------
  renderNavbar() {
    this.innerHTML = `
      <div class="top-nav">
        <div class="nav-links">
          <a href="index.html" data-nav-home>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span class="nav-text">Home</span>
          </a>
          <a href="friends.html" data-nav-friends>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="nav-text">Friends</span>
          </a>
          <a href="hangout.html" data-nav-hangouts>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span class="nav-text">Hangouts</span>
          </a>
          <a href="schedule.html" data-nav-schedule>
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="nav-text">Schedule</span>
          </a>
          <a href="profile.html" data-nav-profile class="nav-avatar">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span class="nav-text">Profile</span>
          </a>
        </div>
      <div id="authControls" class="nav-auth"></div>
      </div>
    `;
    // Store reference to home link for later modification
    this.homeLink = this.querySelector("[data-nav-home]");
  }
  
  // -------------------------------------------------------------
  // renderAuthControls()
  // -------------------------------------------------------------
  // Dynamically renders login/logout buttons based on auth state.
  // - Logged in: No auth controls shown
  // - Logged out: Shows "Log in" button (except on login pages)
  // Also updates home link destination based on auth state.
  // -------------------------------------------------------------
  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    authControls.innerHTML = "";

    // Listen for authentication state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in
        // Change home link to main dashboard
        this.homeLink?.setAttribute("href", "main.html");
        // No auth controls needed when logged in
        authControls.innerHTML = "";
      } else {
        // User is logged out
        // Change home link to landing page
        this.homeLink?.setAttribute("href", "index.html");

        // Determine current page to avoid showing login button on login pages
        const currentPage = window.location.pathname.split("/").pop();
        const shouldShowLoginBtn =
          currentPage !== "index.html" && currentPage !== "login.html";

        // Show login button if not on login/index pages
        if (shouldShowLoginBtn) {
          const loginControl = `<a class="btn btn-outline-light" id="loginBtn" href="/login.html" style="min-width: 80px;">Log in</a>`;
          authControls.innerHTML = loginControl;
        }
      }
    });
  }

  // -------------------------------------------------------------
  // highlightActiveLink()
  // -------------------------------------------------------------
  // Adds 'active' class to the navigation link that matches
  // the current page, providing visual feedback to users.
  // -------------------------------------------------------------
  highlightActiveLink() {
    // Get current page filename from URL
    const currentPage = window.location.pathname.split("/").pop();
    const links = this.querySelectorAll("a[href]");
    
    // Check each link and add 'active' class if it matches current page
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && currentPage === href) {
        link.classList.add("active");
      }
    });
  }
}

// Register the custom element so it can be used in HTML as <site-navbar>
customElements.define("site-navbar", SiteNavbar);
