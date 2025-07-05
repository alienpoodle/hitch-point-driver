import { initFirebase } from './firebase.js';
import { setupAuthListeners } from './auth.js';
import { setupMapListeners, loadGoogleMapsApi } from './maps.js';
import { setupPWA } from './pwa.js';
import { initDriverFeature } from './bookings.js';


document.addEventListener('DOMContentLoaded', async () => {
    showLoadingOverlay();
    initFirebase((user) => {
    // Show/hide UI based on user state
    const loggedOutView = document.getElementById('logged-out-view');
    const rideRequestSection = document.getElementById('ride-request-section');
    const mainNavbar = document.getElementById('main-navbar');
    const profileView = document.getElementById('profile-view');
    const driverRequestsSection = document.getElementById('driver-requests-section');
    const rideHistoryModal = document.getElementById('ride-history-modal');
    const quoteDisplayModal = document.getElementById('quote-display-modal');
    const mapModal = document.getElementById('map-modal');
    const driverRouteModal = document.getElementById('driver-route-modal');

    if (user) {
        if (loggedOutView) loggedOutView.classList.add('hidden');
        if (rideRequestSection) rideRequestSection.classList.remove('hidden');
        if (mainNavbar) mainNavbar.classList.remove('hidden');
        const userEmailElem = document.getElementById('user-email');
        if (userEmailElem) userEmailElem.textContent = user.email || "N/A";
        const userIdElem = document.getElementById('user-id');
        if (userIdElem) userIdElem.textContent = user.uid;
    } else {
        if (loggedOutView) loggedOutView.classList.remove('hidden');
        if (rideRequestSection) rideRequestSection.classList.add('hidden');
        if (mainNavbar) mainNavbar.classList.add('hidden');
        if (profileView) profileView.classList.add('hidden');
        if (driverRequestsSection) driverRequestsSection.classList.add('hidden');
        if (rideHistoryModal) rideHistoryModal.classList.add('hidden');
        if (quoteDisplayModal) quoteDisplayModal.classList.add('hidden');
        if (mapModal) mapModal.classList.add('hidden');
        if (driverRouteModal) driverRouteModal.classList.add('hidden');
    }

    initDriverFeature();
});

    // Load Google Maps API
    setupAuthListeners();
    setupMapListeners(window.firebaseConfig.googleMapsApiKey);
    
    setupPWA();

    loadGoogleMapsApi(window.firebaseConfig.googleMapsApiKey)
        .then(() => {
            console.log('Google Maps API loaded successfully');
        })
        .catch((error) => {
            console.error('Error loading Google Maps API:', error);
        });
});
