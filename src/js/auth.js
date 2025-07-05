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
    toast.className = `toast align-items-center text-bg-${type === "success" ? "success" : "danger"} border-0 show mb-2`;
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

// Check if the user is a driver
export async function isDriver(uid) {
    const driverRef = doc(db, "drivers", uid);
    const driverSnap = await getDoc(driverRef);
    return driverSnap.exists() && driverSnap.data().role === "driver";
}

export function setupAuthListeners() {
    const googleLoginBtn = document.getElementById('google-login-btn');
    const errorDiv = document.getElementById('login-error');
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', async () => {
        if (errorDiv) errorDiv.classList.add('d-none');
        try {
            await googleLogin();
            showToast("Successfully logged in!", "success");
        } catch (error) {
            showToast("Could not sign in with Google. Please try again.", "danger");
            if (errorDiv) {
                errorDiv.textContent = "Login failed. Please try again.";
                errorDiv.classList.remove('d-none');
            }
        }
    });

    const navbarLogout = document.getElementById('navbar-logout');
    if (navbarLogout) navbarLogout.addEventListener('click', async () => {
        try {
            await googleLogout();
            showToast("Successfully logged out!", "success");
        } catch (error) {
            showToast("Could not log out. Please try again.", "danger");
        }
    });
}