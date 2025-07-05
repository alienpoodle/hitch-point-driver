import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithCustomToken,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
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

const firebaseConfig = window.firebaseConfig || {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

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
                    role: "passenger",
                    firstName,
                    lastName
                });
            }
        } else {
            currentUserId = null;
            currentUserEmail = null;
        }
        if (onUserChanged) onUserChanged(user);
    });

    if (initialAuthToken) {
        await signInWithCustomToken(auth, initialAuthToken);
    }
}

export async function googleLogin() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

export async function googleLogout() {
    await signOut(auth);
}