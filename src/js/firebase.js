// src/js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithCustomToken,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    signInWithEmailAndPassword // <--- ADD THIS IMPORT
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Export these variables so they can be imported by other modules (e.g., main.js, driverDashboard.js)
export let app, auth, db;
export let currentUserId = null; // These can be useful global trackers
export let currentUserEmail = null; // but make sure they are updated consistently.

const firebaseConfig = window.firebaseConfig || {}; // Assumes firebaseConfig is set in config.js or globally
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

/**
 * Initializes Firebase application, authentication, and Firestore.
 * Sets up an authentication state observer that calls a provided callback.
 * @param {function(firebase.User|null): Promise<void>} onUserChanged -
 * A callback function that is invoked when the user's authentication state changes.
 * Receives the Firebase User object (if logged in) or null (if logged out).
 */
export async function initFirebase(onUserChanged) {
    // Only initialize Firebase app, auth, and db once
    if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }

    // Set up the authentication state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            currentUserEmail = user.email || "N/A";

            // Check if user profile exists in Firestore. If not, create a basic one.
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                let firstName = "";
                let lastName = "";
                if (user.displayName) {
                    const parts = user.displayName.split(" ");
                    firstName = parts[0] || "";
                    lastName = parts.slice(1).join(" ") || "";
                }
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    role: "passenger", // Default role for new users
                    firstName,
                    lastName
                });
                console.log("New user profile created in Firestore for UID:", user.uid);
            }
        } else {
            // User is logged out
            currentUserId = null;
            currentUserEmail = null;
        }
        // Call the provided callback function with the current user state
        if (onUserChanged) onUserChanged(user);
    });

    // Handle custom token login if an initial token is provided
    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } catch (error) {
            console.error("Error signing in with custom token:", error);
        }
    }
}

// Export specific authentication functions for direct use in other modules
export async function googleLogin() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider); // Return the promise for handling in main.js
}

export async function userLogout() { // Renamed from googleLogout for clarity, as it signs out any user
    return signOut(auth); // Return the promise
}

export { signInWithEmailAndPassword }; // <--- EXPORT THIS FOR USE IN MAIN.JS
