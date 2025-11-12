// Import specific functions from the Firebase Auth SDK
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

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
        <a class="nav-avatar" href="profile.html" aria-label="Profile">
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="4" fill="currentColor"></circle>
            <path
              fill="currentColor"
              d="M4 20c0-3.31 2.69-6 6-6h4c3.31 0 6 2.69 6 6v1H4z"
            ></path>
          </svg>
        </a>
        <div class="nav-links">
          <a href="main.html" data-nav-home>Home</a>
          <a href="#">Friends</a>
          <a href="hangout.html" data-nav-hangouts>Hangouts</a>
          <a href="schedule.html" data-nav-schedule>Schedule</a>
        </div>
        <div id="authControls" class="nav-auth"></div>
      </div>
    `;
    this.homeLink = this.querySelector("[data-nav-home]");
  }
  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return; // Guard if container is missing

    authControls.innerHTML = "";

    onAuthStateChanged(auth, (user) => {
      let updatedAuthControl;
      if (user) {
        this.homeLink?.setAttribute("href", "main.html");
        updatedAuthControl = `<button class="btn btn-outline-light" id="signOutBtn" type="button" style="min-width: 80px;">Log out</button>`;
        authControls.innerHTML = updatedAuthControl;
        const signOutBtn = authControls.querySelector("#signOutBtn");
        signOutBtn?.addEventListener("click", logoutUser);
      } else {
        this.homeLink?.setAttribute("href", "index.html");
        updatedAuthControl = `<a class="btn btn-outline-light" id="loginBtn" href="/login.html" style="min-width: 80px;">Log in</a>`;
        authControls.innerHTML = updatedAuthControl;
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
