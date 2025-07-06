import { initFirebase } from './firebase.js';
import { setupAuthListeners, isDriver, showToast } from './auth.js';
import { setupMapListeners, loadGoogleMapsApi } from './maps.js';
import { setupPWA } from './pwa.js';
//import { initDriverFeature } from './bookings.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('driver-login-section');
    const dashboard = document.querySelector('.container-fluid.bg-light'); // main dashboard container

    // Hide dashboard by default, show login
    if (dashboard) dashboard.style.display = 'none';
    if (loginSection) loginSection.style.display = '';

    initFirebase(async (user) => {
        if (!user) {
            if (dashboard) dashboard.style.display = 'none';
            if (loginSection) loginSection.style.display = '';
            return;
        }
        // Check driver role
        const ok = await isDriver(user.uid);
        if (!ok) {
            showToast("Access denied: You are not registered as a driver.", "danger");
            if (window.firebaseAuth && window.firebaseAuth.signOut) {
                await window.firebaseAuth.signOut();
            }
            if (dashboard) dashboard.style.display = 'none';
            if (loginSection) loginSection.style.display = '';
            return;
        }
        // Show dashboard, hide login
        if (dashboard) dashboard.style.display = '';
        if (loginSection) loginSection.style.display = 'none';

        // Continue with dashboard setup
       //initDriverFeature();
        setupMapListeners(window.firebaseConfig.googleMapsApiKey);
        setupPWA();
        loadGoogleMapsApi(window.firebaseConfig.googleMapsApiKey)
            .then(() => console.log('Google Maps API loaded successfully'))
            .catch((error) => console.error('Error loading Google Maps API:', error));
    });

    setupAuthListeners();
});