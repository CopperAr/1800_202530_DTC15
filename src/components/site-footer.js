// -------------------------------------------------------------
// src/components/site-footer.js
// -------------------------------------------------------------
// Custom web component for the site footer.
// Provides a reusable footer element that can be included
// on any page using <site-footer></site-footer>.
// -------------------------------------------------------------

// -------------------------------------------------------------
// SiteFooter Class
// -------------------------------------------------------------
// Defines a custom HTML element that displays the site footer.
// Uses the Web Components API to create a reusable component.
// -------------------------------------------------------------
class SiteFooter extends HTMLElement {
    // Called when the element is added to the DOM
    connectedCallback() {
        // Inject footer HTML into the element
        this.innerHTML = `
            <!-- Footer: single source of truth -->
            <footer class="py-3 my-4 border-top text-center">
                <p class="mb-0 text-muted">&copy; 2025 BCIT COMP1800</p>
            </footer>
        `;
    }
}

// Register the custom element so it can be used in HTML
customElements.define('site-footer', SiteFooter);