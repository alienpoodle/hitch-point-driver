import { auth, db } from '../firebase.js'; // Import Firebase auth and db instances
import { showToast, showLoadingOverlay, hideLoadingOverlay } from './ui-utils.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const driverLoginForm = document.getElementById('driver-login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const googleLoginBtn = document.getElementById('google-login-btn');
const loginErrorDiv = document.getElementById('login-error');

const logoutBtn = document.getElementById('logoutBtn'); // Used here for its event listener

/**
 * Checks if the current user UID corresponds to an existing driver in Firestore.
 * @param {string} uid - The Firebase Auth UID of the user.
 * @returns {Promise<boolean>} True if the user is a driver, false otherwise.
 */
export async function isDriver(uid) {
    if (!uid) return false;
    try {
        const driverRef = doc(db, "drivers", uid);
        const driverSnap = await getDoc(driverRef);
        return driverSnap.exists();
    } catch (error) {
        console.error("Error checking driver status:", error);
        showToast("Error checking driver status.", "danger");
        return false;
    }
}


/**
 * Sets up all authentication-related event listeners (login forms, Google login, logout).
 */
export function setupAuthListeners() {
    if (driverLoginForm) {
        driverLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;

            showLoadingOverlay("Logging in...");
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('Logged in successfully!', 'success');
                loginErrorDiv.classList.add('d-none'); // Hide any previous errors
                // UI will be handled by onAuthStateChanged in main.js
            } catch (error) {
                console.error("Email/Password login error:", error);
                loginErrorDiv.textContent = error.message;
                loginErrorDiv.classList.remove('d-none');
                showToast(`Login failed: ${error.message}`, 'danger');
            } finally {
                hideLoadingOverlay();
            }
        });
    }

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            showLoadingOverlay("Signing in with Google...");
            try {
                await signInWithPopup(auth, provider);
                showToast('Signed in with Google successfully!', 'success');
                loginErrorDiv.classList.add('d-none'); // Hide any previous errors
                // UI will be handled by onAuthStateChanged in main.js
            } catch (error) {
                console.error("Google login error:", error);
                loginErrorDiv.textContent = error.message;
                loginErrorDiv.classList.remove('d-none');
                showToast(`Google sign-in failed: ${error.message}`, 'danger');
            } finally {
                hideLoadingOverlay();
            }
        });
    }

    // Logout button listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showLoadingOverlay("Logging out...");
            try {
                await signOut(auth); // Use Firebase's signOut function
                showToast('Logged out successfully!', 'info');
                // main.js's initFirebase onAuthStateChanged will handle subsequent redirection/UI changes
            } catch (error) {
                console.error("Error signing out:", error);
                showToast('Logout failed. Please try again.', 'danger');
            } finally {
                hideLoadingOverlay();
            }
        });
    }
}
