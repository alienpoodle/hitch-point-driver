import { auth, db } from './firebase.js';
import { isDriver, showToast } from './auth.js';
import {
    doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    const driverNameSpan = document.getElementById('driverName');
    const logoutBtn = document.getElementById('logoutBtn');

    const currentRideDisplay = document.getElementById('currentRideDisplay');
    const pendingRequestsTableBody = document.querySelector('#pendingRequestsTable tbody');
    const noPendingRequestsMessage = document.getElementById('noPendingRequests');
    const rideHistoryTableBody = document.querySelector('#rideHistoryTable tbody');
    const noRideHistoryMessage = document.getElementById('noRideHistory');
    const settingsForm = document.getElementById('settingsForm');

    let currentDriver = null;
    let pendingRequests = [];
    let rideHistory = [];
    let activeRide = null;
    let driverId = null;

    // --- Firebase Integration ---

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = '/index.html';
            return;
        }
        
        driverId = user.uid; // Set driverId early for potential use

        // Enforce driver role
        // This 'role' field is typically stored in a 'users' or 'drivers' collection.
        // Your `isDriver` function likely checks a field like 'role: "driver"' for the user's UID.
        const driverOk = await isDriver(user.uid);
        if (!driverOk) {
            showToast("Access denied: You are not registered as a driver.", "danger");
            await auth.signOut();
            window.location.href = '/index.html';
            return;
        }
        
        await loadDriverProfile(driverId);
        listenPendingRequests(driverId);
        listenRideHistory(driverId);
        listenActiveRide(driverId);
    });

    async function loadDriverProfile(driverId) {
        const driverRef = doc(db, "drivers", driverId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
            currentDriver = driverSnap.data();
            driverNameSpan.textContent = currentDriver.name || "Driver";
            if (settingsForm) {
                document.getElementById('vehicleModel').value = currentDriver.vehicleModel || '';
                document.getElementById('licensePlate').value = currentDriver.licensePlate || '';
                // You might also have a 'driverName' input if the driver can change their displayed name
                // document.getElementById('driverNameInput').value = currentDriver.name || '';
            }
        } else {
            // If driver profile doesn't exist, create a basic one
            // Use currentUser.displayName for initial name if available from Firebase Auth
            currentDriver = {
                name: auth.currentUser.displayName || "Driver", // Fallback to "Driver" if no display name
                vehicleModel: "",
                licensePlate: ""
            };
            await setDoc(driverRef, currentDriver, { merge: true });
            driverNameSpan.textContent = currentDriver.name;
            // Also populate settings form if it exists
            if (settingsForm) {
                document.getElementById('vehicleModel').value = currentDriver.vehicleModel;
                document.getElementById('licensePlate').value = currentDriver.licensePlate;
            }
        }
    }

    function listenPendingRequests(driverId) {
        // Listen for ride requests assigned to this driver and status 'booked'
        const q = query(
            collection(db, "rides"),
            where("driverId", "==", driverId), // This 'driverId' field must exist in your 'rides' documents for assignment
            where("status", "==", "booked"),
            orderBy("rideDateTime", "asc")
        );
        onSnapshot(q, (snapshot) => {
            pendingRequests = [];
            snapshot.forEach(doc => {
                let data = doc.data();
                data.id = doc.id; // Store Firestore document ID as 'id' property
                pendingRequests.push(data);
            });
            renderPendingRequests();
        });
    }

    function listenRideHistory(driverId) {
        // Listen for completed/cancelled rides for this driver
        const q = query(
            collection(db, "rides"),
            where("driverId", "==", driverId), // This 'driverId' field must exist in your 'rides' documents
            where("status", "in", ["completed", "cancelled"]),
            orderBy("rideDateTime", "desc")
        );
        onSnapshot(q, (snapshot) => {
            rideHistory = [];
            snapshot.forEach(doc => {
                let data = doc.data();
                data.id = doc.id;
                rideHistory.push(data);
            });
            renderRideHistory();
        });
    }

    function listenActiveRide(driverId) {
        // Listen for accepted/in_progress ride for this driver
        const q = query(
            collection(db, "rides"),
            where("driverId", "==", driverId), // This 'driverId' field must exist in your 'rides' documents
            where("status", "in", ["accepted", "in_progress"])
        );
        onSnapshot(q, (snapshot) => {
            activeRide = null; // Reset active ride
            if (!snapshot.empty) { // Only process if there's at least one active ride
                // Assuming only one active ride at a time, take the first one
                const doc = snapshot.docs[0]; 
                let data = doc.data();
                data.id = doc.id;
                activeRide = data;
            }
            renderCurrentRide();
        });
    }

    // --- Rendering Functions ---

    function renderCurrentRide() {
        if (activeRide) {
            // Using || for userName fallback to userId as per your structure
            // If you have a 'userName' field in 'rides' or 'users' collection, use that.
            // Otherwise, userId is the unique identifier.
            const passengerIdentifier = activeRide.userName || activeRide.userId; 
            const pickupTime = activeRide.rideDateTime ? new Date(activeRide.rideDateTime).toLocaleString() : 'N/A';
            const fareDisplay = activeRide.fareUSD ? `$${parseFloat(activeRide.fareUSD).toFixed(2)}` : '$0.00'; // Ensure 2 decimal places

            currentRideDisplay.innerHTML = `
                <div class="card-body">
                    <h3 class="card-title">Active Ride: ${passengerIdentifier}</h3>
                    <p class="card-text"><strong>Origin:</strong> ${activeRide.origin}</p>
                    <p class="card-text"><strong>Final Destination:</strong> ${activeRide.destination}</p>
                    <p class="card-text"><strong>Pickup Time:</strong> ${pickupTime}</p>
                    <p class="card-text"><strong>Fare:</strong> ${fareDisplay}</p>
                    <p class="card-text"><strong>Status:</strong> <span class="badge ${activeRide.status === 'accepted' ? 'bg-primary' : 'bg-warning'}">${activeRide.status.toUpperCase().replace('_', ' ')}</span></p>
                    
                    ${activeRide.bags > 0 ? `<p class="card-text"><strong>Bags:</strong> ${activeRide.bags}</p>` : ''}
                    ${activeRide.persons > 0 ? `<p class="card-text"><strong>Passengers:</strong> ${activeRide.persons}</p>` : ''}
                    ${activeRide.distance ? `<p class="card-text"><strong>Distance:</strong> ${activeRide.distance}</p>` : ''}
                    ${activeRide.duration ? `<p class="card-text"><strong>Duration:</strong> ${activeRide.duration}</p>` : ''}
                    ${activeRide.afterHours ? `<p class="card-text text-danger"><strong>After Hours Ride</strong></p>` : ''}
                    ${activeRide.roundTrip ? `<p class="card-text text-info"><strong>Round Trip</strong></p>` : ''}

                    <div class="mt-3">
                        ${activeRide.status === 'accepted' ? `<button class="btn btn-success me-2" data-id="${activeRide.id}">Start Ride</button>` : ''}
                        ${activeRide.status === 'in_progress' ? `<button class="btn btn-primary" data-id="${activeRide.id}">Complete Ride</button>` : ''}
                    </div>
                </div>
            `;
            const startBtn = currentRideDisplay.querySelector('.btn-success');
            if (startBtn) startBtn.addEventListener('click', handleStartRide);
            const completeBtn = currentRideDisplay.querySelector('.btn-primary');
            if (completeBtn) completeBtn.addEventListener('click', handleCompleteRide);

        } else {
            currentRideDisplay.innerHTML = `<div class="card-body"><p class="card-text text-muted">No active ride.</p></div>`;
        }
    }

    function renderPendingRequests() {
        pendingRequestsTableBody.innerHTML = '';
        if (pendingRequests.length === 0) {
            noPendingRequestsMessage.classList.remove('d-none');
            return;
        }
        noPendingRequestsMessage.classList.add('d-none');

        pendingRequests.forEach(request => {
            const passengerIdentifier = request.userName || request.userId;
            const pickupTime = request.rideDateTime ? new Date(request.rideDateTime).toLocaleString() : 'N/A';
            const fareDisplay = request.fareUSD ? `$${parseFloat(request.fareUSD).toFixed(2)}` : '$0.00';

            const row = pendingRequestsTableBody.insertRow();
            row.innerHTML = `
                <td data-label="Request ID">${request.id}</td>
                <td data-label="User">${passengerIdentifier}</td>
                <td data-label="Pickup Time">${pickupTime}</td>
                <td data-label="Origin">${request.origin}</td>
                <td data-label="Final Destination">${request.destination}</td>
                <td data-label="Fare">${fareDisplay}</td>
                <td data-label="Distance">${request.distance || 'N/A'}</td>
                <td data-label="Duration">${request.duration || 'N/A'}</td>
                <td data-label="Passengers">${request.persons || 1}</td>
                <td data-label="Bags">${request.bags || 0}</td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-success me-1" data-id="${request.id}">Accept</button>
                    <button class="btn btn-sm btn-danger" data-id="${request.id}">Reject</button>
                </td>
            `;
        });

        document.querySelectorAll('#pendingRequestsTable .btn-success').forEach(button => {
            button.onclick = (e) => handleAcceptRide(e.target.dataset.id);
        });
        document.querySelectorAll('#pendingRequestsTable .btn-danger').forEach(button => {
            button.onclick = (e) => handleRejectRide(e.target.dataset.id);
        });
    }

    function renderRideHistory() {
        rideHistoryTableBody.innerHTML = '';
        if (rideHistory.length === 0) {
            noRideHistoryMessage.classList.remove('d-none');
            return;
        }
        noRideHistoryMessage.classList.add('d-none');

        rideHistory.forEach(ride => {
            const statusClass = ride.status === 'completed' ? 'bg-success' : 'bg-danger';
            const passengerIdentifier = ride.userName || ride.userId;
            const rideTime = ride.rideDateTime ? new Date(ride.rideDateTime).toLocaleString() : 'N/A';
            const fareDisplay = ride.fareUSD ? `$${parseFloat(ride.fareUSD).toFixed(2)}` : '$0.00';

            const row = rideHistoryTableBody.insertRow();
            row.innerHTML = `
                <td data-label="Ride ID">${ride.id}</td>
                <td data-label="User">${passengerIdentifier}</td>
                <td data-label="Origin">${ride.origin}</td>
                <td data-label="Final Destination">${ride.destination}</td>
                <td data-label="Time">${rideTime}</td>
                <td data-label="Fare">${fareDisplay}</td>
                <td data-label="Status"><span class="badge ${statusClass}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}</span></td>
                <td data-label="Distance">${ride.distance || 'N/A'}</td>
                <td data-label="Duration">${ride.duration || 'N/A'}</td>
            `;
        });
    }

    // --- Event Handlers ---

    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        window.location.reload(); // Or redirect to a login page
    });

    // --- Ride Action Handlers (Firestore Updates) ---

    async function handleAcceptRide(id) {
        if (activeRide) {
            showToast('You already have an active ride. Please complete it first.', 'danger');
            return;
        }
        const rideRef = doc(db, "rides", id);
        await updateDoc(rideRef, {
            status: "accepted"
        });
        // Assuming 'bootstrap' is globally available or imported if using modules
        const currentRidesTab = document.querySelector('button[data-bs-target="#current-rides"]');
        if (currentRidesTab) {
            if (typeof bootstrap !== 'undefined' && bootstrap.Tab) { // Check if Bootstrap Tab is loaded
                const bsTab = new bootstrap.Tab(currentRidesTab);
                bsTab.show();
            } else {
                console.warn("Bootstrap Tab functionality not found. Cannot switch tabs.");
            }
        }
        showToast('Ride accepted!', 'success');
    }

    async function handleRejectRide(id) {
        const rideRef = doc(db, "rides", id);
        await updateDoc(rideRef, {
            status: "cancelled"
        });
        showToast('Ride rejected.', 'success');
    }

    async function handleStartRide(event) {
        const rideId = event.target.dataset.id;
        if (activeRide && activeRide.id === rideId) {
            const rideRef = doc(db, "rides", rideId);
            await updateDoc(rideRef, {
                status: "in_progress"
            });
            showToast('Ride started!', 'success');
        }
    }

    async function handleCompleteRide(event) {
        const rideId = event.target.dataset.id;
        if (activeRide && activeRide.id === rideId) {
            const rideRef = doc(db, "rides", rideId);
            await updateDoc(rideRef, {
                status: "completed",
                // Use a proper Firestore Timestamp if possible, or ISO string
                // time: firebase.firestore.FieldValue.serverTimestamp() // Requires firebase SDK
                completedAt: new Date().toISOString() // Using an ISO string for consistency with rideDateTime
            });
            const rideHistoryTab = document.querySelector('button[data-bs-target="#ride-history"]');
            if (rideHistoryTab) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    const bsTab = new bootstrap.Tab(rideHistoryTab);
                    bsTab.show();
                } else {
                    console.warn("Bootstrap Tab functionality not found. Cannot switch tabs.");
                }
            }
            showToast('Ride completed!', 'success');
        }
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vehicleModel = document.getElementById('vehicleModel').value;
        const licensePlate = document.getElementById('licensePlate').value;

        // Optionally, if the driver name is editable on the settings form:
        // const driverNameInput = document.getElementById('driverNameInput');
        // if (driverNameInput) {
        //     currentDriver.name = driverNameInput.value;
        // }

        currentDriver.vehicleModel = vehicleModel;
        currentDriver.licensePlate = licensePlate;
        
        await setDoc(doc(db, "drivers", driverId), {
            ...currentDriver // Spread existing currentDriver to preserve 'name' if not updated
        }, { merge: true }); // Use merge: true to avoid overwriting the entire document

        showToast('Account settings saved!', 'success');
        driverNameSpan.textContent = currentDriver.name || "Driver"; // Update display with new name if applicable
    });
});