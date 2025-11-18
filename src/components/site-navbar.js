// Import specific functions from the Firebase Auth SDK
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";

class SiteNavbar extends HTMLElement {
  constructor() {
    super();
    this.renderNavbar();
    this.renderAuthControls();
    this.highlightActiveLink();
  }

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
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
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
    this.homeLink = this.querySelector("[data-nav-home]");
  }
  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    authControls.innerHTML = "";

    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.homeLink?.setAttribute("href", "main.html");
        authControls.innerHTML = "";
      } else {
        this.homeLink?.setAttribute("href", "index.html");

        const currentPage = window.location.pathname.split("/").pop();
        const shouldShowLoginBtn =
          currentPage !== "index.html" && currentPage !== "login.html";

        if (shouldShowLoginBtn) {
          const loginControl = `<a class="btn btn-outline-light" id="loginBtn" href="/login.html" style="min-width: 80px;">Log in</a>`;
          authControls.innerHTML = loginControl;
        }
      }
    });
  }

  highlightActiveLink() {
    const currentPage = window.location.pathname.split("/").pop();
    const links = this.querySelectorAll("a[href]");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && currentPage === href) {
        link.classList.add("active");
      }
    });
  }
}

customElements.define("site-navbar", SiteNavbar);
