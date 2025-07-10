import { initFirebase } from './firebase.js'; // This should include onAuthStateChanged listener
import { setupAuthListeners, isDriver, showToast } from './auth.js';
import { loadGoogleMapsApi } from './maps.js';
import { setupPWA } from './pwa.js';
import { initDriverDashboard } from './driverDashboard.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Select the login section and the main dashboard container
    const loginSection = document.getElementById('driver-login-section');
    const dashboardContainer = document.getElementById('dashboard-container'); // Use the new ID

    // Ensure elements exist before trying to manipulate them
    if (!loginSection || !dashboardContainer) {
        console.error("Critical DOM elements (login/dashboard containers) not found!");
        showToast("Application initialization failed: Missing UI elements.", "danger");
        return; // Stop execution if critical elements are missing
    }

    // Initialize Firebase and set up the authentication state observer
    // The callback function runs whenever the user's authentication state changes.
    // It should receive 'auth' from firebase.js, not window.firebaseAuth
    initFirebase(async (user) => { // Assuming initFirebase now passes the user object from onAuthStateChanged
        if (!user) {
            // User is signed out or not logged in
            console.log('User signed out. Displaying login section.');
            dashboardContainer.classList.add('d-none'); // Hide dashboard
            loginSection.classList.remove('d-none');   // Show login
            // Clear driver name or any user-specific display on logout
            const driverNameSpan = document.getElementById('driverName');
            if (driverNameSpan) driverNameSpan.textContent = 'Guest';
            return;
        }

        // User is signed in, now perform the driver role check
        console.log('User signed in. Checking driver role for UID:', user.uid);
        const isDriverUser = await isDriver(user.uid);

        if (!isDriverUser) {
            // User is signed in but not registered as a driver
            console.warn('Access denied: User is not registered as a driver.', user.uid);
            showToast("Access denied: You are not registered as a driver.", "danger");

            // Log out the unauthorized user to prevent access to driver-specific areas
            // Ensure you have auth imported and accessible here for signOut
            import { auth } from '../config.js'; // Assuming auth is exported from config.js
            if (auth && auth.signOut) {
                 await auth.signOut(); // Use the imported auth object
            } else {
                 console.error("Firebase auth object not found for signOut.");
            }

            // Ensure login section is visible after denied access
            dashboardContainer.classList.add('d-none');
            loginSection.classList.remove('d-none');
            return;
        }

        // User is a valid driver: Show the dashboard and hide the login section
        console.log('Driver authenticated and authorized for UID:', user.uid);
        dashboardContainer.classList.remove('d-none'); // Show dashboard
        loginSection.classList.add('d-none');         // Hide login

        // Display driver's name in the header/dashboard (can be further updated by driverDashboard.js)
        const driverNameSpan = document.getElementById('driverName');
        if (driverNameSpan) {
            driverNameSpan.textContent = user.displayName || user.email || 'Driver';
        }

        // Load Google Maps API (it accesses window.firebaseConfig.googleMapsApiKey internally)
        try {
            await loadGoogleMapsApi();
            console.log('Google Maps API loaded successfully for driver dashboard.');
        } catch (error) {
            console.error('Error loading Google Maps API:', error);
            showToast('Failed to load map features. Please refresh.', 'danger');
        }

        // Setup Progressive Web App features (e.g., service worker registration)
        setupPWA();

        // Initialize all driver dashboard specific functionalities
        initDriverDashboard(user.uid);
    });

    // Setup general authentication listeners (e.g., Google Sign-In button, Logout button)
    setupAuthListeners();
});
