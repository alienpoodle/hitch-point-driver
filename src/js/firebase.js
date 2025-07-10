import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithCustomToken,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    signInWithEmailAndPassword // IMPORTANT: Added this import
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let app, auth, db;
export let currentUserId = null;
export let currentUserEmail = null;

// Ensure window.firebaseConfig is correctly defined in your config.js or globally
const firebaseConfig = window.firebaseConfig || {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

/**
 * Initializes Firebase application, authentication, and Firestore.
 * Sets up an authentication state observer that calls a provided callback.
 * @param {function(firebase.User|null): Promise<void>} onUserChanged -
 * A callback function that is invoked when the user's authentication state changes.
 * Receives the Firebase User object (if logged in) or null (if logged out).
 */
export async function initFirebase(onUserChanged) {
    if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            currentUserEmail = user.email || "N/A";
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                // Try to extract first and last name from displayName
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
            currentUserId = null;
            currentUserEmail = null;
        }
        // Call the provided callback function with the current user state
        if (onUserChanged) onUserChanged(user);
    });

    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } catch (error) {
            console.error("Error signing in with custom token:", error);
        }
    }
}

export async function googleLogin() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider); // IMPORTANT: Return the promise
}

export async function userLogout() { // IMPORTANT: Renamed from googleLogout
    return signOut(auth); // IMPORTANT: Return the promise
}

export { signInWithEmailAndPassword }; // IMPORTANT: Export signInWithEmailAndPassword
