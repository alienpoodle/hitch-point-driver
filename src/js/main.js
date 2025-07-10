// src/js/main.js

import { initFirebase } from './firebase.js';
import { setupAuthListeners, isDriver, showToast } from './auth.js';
import { loadGoogleMapsApi } from './maps.js'; // Assuming 'map.js' exports loadGoogleMapsApi
import { setupPWA } from './pwa.js';

// Import the new driver dashboard initializer
import { initDriverDashboard } from './driverDashboard.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Select the login section and the main dashboard container
    const loginSection = document.getElementById('driver-login-section');
    // Using a more general selector for the main dashboard wrapper.
    // Confirm '.container-fluid.p-0' matches your main dashboard div in HTML.
    const dashboard = document.querySelector('.container-fluid.p-0');

    // Initial state: hide dashboard, show login
    if (dashboard) dashboard.style.display = 'none';
    if (loginSection) loginSection.style.display = '';

    // Initialize Firebase and set up the authentication state observer
    // The callback function runs whenever the user's authentication state changes.
    initFirebase(async (user) => {
        if (!user) {
            // User is signed out or not logged in
            console.log('User signed out. Displaying login section.');
            if (dashboard) dashboard.style.display = 'none';
            if (loginSection) loginSection.style.display = '';
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
            if (window.firebaseAuth && window.firebaseAuth.signOut) {
                await window.firebaseAuth.signOut();
            }
            // Ensure login section is visible after denied access
            if (dashboard) dashboard.style.display = 'none';
            if (loginSection) loginSection.style.display = '';
            return;
        }

        // User is a valid driver: Show the dashboard and hide the login section
        console.log('Driver authenticated and authorized for UID:', user.uid);
        if (dashboard) dashboard.style.display = '';
        if (loginSection) loginSection.style.display = 'none';

        // Display driver's name in the header/dashboard (can be further updated by driverDashboard.js)
        const driverNameSpan = document.getElementById('driverName');
        if (driverNameSpan) {
            driverNameSpan.textContent = user.displayName || user.email || 'Driver';
        }

        // Load Google Maps API (it accesses window.firebaseConfig.googleMapsApiKey internally)
        try {
            await loadGoogleMapsApi(); // Call without arguments as per maps.js design
            console.log('Google Maps API loaded successfully for driver dashboard.');
        } catch (error) {
            console.error('Error loading Google Maps API:', error);
            showToast('Failed to load map features. Please refresh.', 'danger');
        }

        // Setup Progressive Web App features (e.g., service worker registration)
        setupPWA();

        // Initialize all driver dashboard specific functionalities
        // Pass the user ID so driverDashboard.js can fetch driver-specific data
        initDriverDashboard(user.uid);
    });

    // Setup general authentication listeners (e.g., Google Sign-In button, Logout button)
    // These are set up once, independent of the user's auth state, to handle initial interactions.
    setupAuthListeners();
});
