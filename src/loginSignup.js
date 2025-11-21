// -------------------------------------------------------------
// src/loginSignup.js
// -------------------------------------------------------------
// Handles the login/signup form behaviour and redirects.
// Uses dynamic import for authentication to avoid failing when
// the page is served without a bundler.
// -------------------------------------------------------------


// --- Login and Signup Page ---
// Handles toggling between Login/Signup views and form submits
// using plain DOM APIs for simplicity and maintainability.


function initAuthUI() {
    // --- DOM Elements ---
    const alertEl = document.getElementById('authAlert');
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const toSignupBtn = document.getElementById('toSignup');
    const toLoginBtn = document.getElementById('toLogin');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const redirectUrl = 'main.html';

    // --- Helper Functions ---
    // Toggle element visibility
    function setVisible(el, visible) {
        el.classList.toggle('hidden', !visible);
    }

    // Check URL hash and show appropriate view
    function checkHashAndShowView() {
        const hash = window.location.hash;
        if (hash === '#signup') {
            setVisible(loginView, false);
            setVisible(signupView, true);
            signupView?.querySelector('input')?.focus();
        } else {
            setVisible(signupView, false);
            setVisible(loginView, true);
            loginView?.querySelector('input')?.focus();
        }
    }

    // Initialize view based on URL hash
    checkHashAndShowView();

    // Show error message with accessibility and auto-hide
    let errorTimeout;
    function showError(msg) {
        alertEl.textContent = msg || '';
        alertEl.classList.remove('hidden');
        clearTimeout(errorTimeout);
        errorTimeout = setTimeout(hideError, 5000);
    }

    // Hide error message
    function hideError() {
        alertEl.classList.add('hidden');
        alertEl.textContent = '';
        clearTimeout(errorTimeout);
    }

    // Enable/disable submit button for forms
    function setSubmitDisabled(form, disabled) {
        const submitBtn = form?.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = disabled;
    }

    // --- Event Listeners ---
    // Toggle buttons
    toSignupBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideError();
        window.location.hash = 'signup';
        setVisible(loginView, false);
        setVisible(signupView, true);
        signupView?.querySelector('input')?.focus();
    });

    toLoginBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideError();
        window.location.hash = '';
        setVisible(signupView, false);
        setVisible(loginView, true);
        loginView?.querySelector('input')?.focus();
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        hideError();
        checkHashAndShowView();
    });

    // Login form submit
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const email = document.querySelector('#loginEmail')?.value?.trim() ?? '';
        const password = document.querySelector('#loginPassword')?.value ?? '';
        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }
        setSubmitDisabled(loginForm, true);
        try {
            const { loginUser, authErrorMessage } = await import('/src/authentication.js');
            await loginUser(email, password);
            location.href = redirectUrl;
        } catch (err) {
            try {
              const { authErrorMessage } = await import('/src/authentication.js');
              showError(authErrorMessage(err));
            } catch (_) {
              showError('Login failed. Please try again.');
            }
            console.error(err);
        } finally {
            setSubmitDisabled(loginForm, false);
        }
    });

    // Signup form submit
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const name = document.querySelector("#signupName")?.value?.trim() ?? "";
        const email = document.querySelector('#signupEmail')?.value?.trim() ?? '';
        const password = document.querySelector('#signupPassword')?.value ?? '';
        const password2 = document.querySelector('#signupPasswordConfirm')?.value ?? '';
        if (!name || !email || !password || !password2) {
            showError('Please fill in email and both password fields.');
            return;
        }
        if (password !== password2) {
            showError('Passwords do not match.');
            return;
        }
        setSubmitDisabled(signupForm, true);
        try {
            const { signupUser, authErrorMessage } = await import('/src/authentication.js');
            // Name is optional; pass empty string to keep API consistent
            await signupUser(name, email, password);
            location.href = redirectUrl;
        } catch (err) {
            try {
              const { authErrorMessage } = await import('/src/authentication.js');
              showError(authErrorMessage(err));
            } catch (_) {
              showError('Sign up failed. Please try again.');
            }
            console.error(err);
        } finally {
            setSubmitDisabled(signupForm, false);
        }
    });
}

// --- Initialize UI on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', initAuthUI);
