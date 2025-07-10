// IMPORTANT: Updated imports to include signInWithEmailAndPassword and use userLogout
import { googleLogin, userLogout, signInWithEmailAndPassword, db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Bootstrap 5 toast helper
export function showToast(message, type = "success") {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '1rem';
        toastContainer.style.right = '1rem';
        toastContainer.style.zIndex = 1080;
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    let bsTypeClass = "success";
    if (type === "danger" || type === "info" || type === "warning") {
        bsTypeClass = type;
    }
    toast.className = `toast align-items-center text-bg-${bsTypeClass} border-0 show mb-2`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    toastContainer.appendChild(toast);
    // Ensure `bootstrap` object is available from Bootstrap's JS bundle
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

/**
 * Checks if a user has a document in the 'drivers' collection, indicating a driver role.
 * IMPORTANT: This aligns with your updated Firebase Security Rules.
 * @param {string} uid - The Firebase User ID.
 * @returns {Promise<boolean>} - True if the user is a driver (has a document in 'drivers' collection), false otherwise.
 */
export async function isDriver(uid) {
    if (!uid) {
        console.warn("isDriver called with null UID.");
        return false;
    }
    const driverRef = doc(db, "drivers", uid);
    try {
        const driverSnap = await getDoc(driverRef);
        return driverSnap.exists(); // User is a driver if a document exists in the 'drivers' collection
    } catch (error) {
        console.error("Error checking driver role for UID:", uid, error);
        return false;
    }
}

/**
 * Sets up event listeners for authentication-related buttons and forms.
 */
export function setupAuthListeners() {
    const googleLoginBtn = document.getElementById('google-login-btn');
    const driverLoginForm = document.getElementById('driver-login-form'); // IMPORTANT: Reference the new login form
    const loginErrorDiv = document.getElementById('login-error');

    // --- Google Login Button Listener ---
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            if (loginErrorDiv) loginErrorDiv.classList.add('d-none');
            try {
                await googleLogin();
                showToast("Successfully logged in with Google!", "success");
            } catch (error) {
                console.error("Google login error:", error);
                showToast("Could not sign in with Google. Please try again.", "danger");
                if (loginErrorDiv) {
                    let errorMessage = "Login failed. Please try again.";
                    if (error.code === 'auth/popup-closed-by-user') {
                        errorMessage = "Login cancelled: Popup closed.";
                    } else if (error.code === 'auth/cancelled-popup-request') {
                        errorMessage = "Login cancelled: Already processing a login request.";
                    }
                    loginErrorDiv.textContent = errorMessage;
                    loginErrorDiv.classList.remove('d-none');
                }
            }
        });
    }

    // --- Email/Password Login Form Listener (NEW) ---
    if (driverLoginForm) {
        driverLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission

            const emailInput = driverLoginForm.querySelector('#login-email');
            const passwordInput = driverLoginForm.querySelector('#login-password');

            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';

            if (!email || !password) {
                showToast("Please enter both email and password.", "warning");
                if (loginErrorDiv) {
                    loginErrorDiv.textContent = "Please enter both email and password.";
                    loginErrorDiv.classList.remove('d-none');
                }
                return;
            }

            if (loginErrorDiv) loginErrorDiv.classList.add('d-none');

            try {
                // IMPORTANT: Call the imported signInWithEmailAndPassword function
                await signInWithEmailAndPassword(email, password);
                showToast("Successfully logged in!", "success");
            } catch (error) {
                console.error("Email/Password Login Error:", error);
                showToast("Login failed. Check your credentials.", "danger");
                if (loginErrorDiv) {
                    let errorMessage = "Login failed: Invalid email or password.";
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        errorMessage = "Invalid email or password.";
                    } else if (error.code === 'auth/invalid-email') {
                        errorMessage = "Invalid email format.";
                    }
                    loginErrorDiv.textContent = errorMessage;
                    loginErrorDiv.classList.remove('d-none');
                }
            }
        });
    }

    // --- Logout Button Listener ---
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await userLogout(); // IMPORTANT: Call userLogout (renamed from googleLogout)
                showToast("Successfully logged out!", "success");
            } catch (error) {
                console.error("Logout error:", error);
                showToast("Could not log out. Please try again.", "danger");
            }
        });
    }
}
