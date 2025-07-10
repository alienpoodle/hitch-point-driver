import { googleLogin, googleLogout, db } from './firebase.js';
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
    // Adjust type to ensure Bootstrap classes are correct (success, danger, info, warning)
    let bsTypeClass = "success"; // Default
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
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

/**
 * Checks if a user has the 'driver' role in the Firestore 'users' collection.
 * @param {string} uid - The Firebase User ID.
 * @returns {Promise<boolean>} - True if the user is a driver, false otherwise.
 */
export async function isDriver(uid) {
    if (!uid) {
        console.warn("isDriver called with null UID.");
        return false;
    }
    const userRef = doc(db, "users", uid);
    try {
        const userSnap = await getDoc(userRef);
        return userSnap.exists() && userSnap.data().role === "driver";
    } catch (error) {
        console.error("Error checking driver role for UID:", uid, error);
        // It's safer to return false on error to prevent unauthorized access
        return false;
    }
}

/**
 * Sets up event listeners for authentication-related buttons (login, logout).
 */
export function setupAuthListeners() {
    const googleLoginBtn = document.getElementById('google-login-btn');
    const errorDiv = document.getElementById('login-error');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            if (errorDiv) errorDiv.classList.add('d-none'); //
