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
        // Enforce driver role
        const driverOk = await isDriver(user.uid);
        if (!driverOk) {
            showToast("Access denied: You are not registered as a driver.", "danger");
            await auth.signOut();
            window.location.href = '/index.html';
            return;
        }
        driverId = user.uid;
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
            }
        } else {
            // If driver profile doesn't exist, create a basic one
            currentDriver = {
                name: auth.currentUser.displayName || "Driver",
                vehicleModel: "",
                licensePlate: ""
            };
            await setDoc(driverRef, currentDriver, { merge: true });
            driverNameSpan.textContent = currentDriver.name;
        }
    }

    function listenPendingRequests(driverId) {
        // Listen for ride requests assigned to this driver and status 'booked'
        const q = query(
            collection(db, "rides"),
            where("driverId", "==", driverId),
            where("status", "==", "booked"),
            orderBy("rideDateTime", "asc")
        );
        onSnapshot(q, (snapshot) => {
            pendingRequests = [];
            snapshot.forEach(doc => {
                let data = doc.data();
                data.id = doc.id;
                pendingRequests.push(data);
            });
            renderPendingRequests();
        });
    }

    function listenRideHistory(driverId) {
        // Listen for completed/cancelled rides for this driver
        const q = query(
            collection(db, "rides"),
            where("driverId", "==", driverId),
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
            where("driverId", "==", driverId),
            where("status", "in", ["accepted", "in_progress"])
        );
        onSnapshot(q, (snapshot) => {
            activeRide = null;
            snapshot.forEach(doc => {
                let data = doc.data();
                data.id = doc.id;
                activeRide = data;
            });
            renderCurrentRide();
        });
    }

    // --- Rendering Functions ---

    function renderCurrentRide() {
        if (activeRide) {
            currentRideDisplay.innerHTML = `
                <div class="card-body">
                    <h3 class="card-title">Active Ride: ${activeRide.userName || activeRide.userId}</h3>
                    <p class="card-text"><strong>Origin:</strong> ${activeRide.origin}</p>
                    <p class="card-text"><strong>Final Destination:</strong> ${activeRide.destination}</p>
                    <p class="card-text"><strong>Pickup Time:</strong> ${activeRide.rideDateTime ? new Date(activeRide.rideDateTime).toLocaleString() : ''}</p>
                    <p class="card-text"><strong>Fare:</strong> $${activeRide.fareUSD || '0.00'}</p>
                    <p class="card-text"><strong>Status:</strong> <span class="badge ${activeRide.status === 'accepted' ? 'bg-primary' : 'bg-warning'}">${activeRide.status.toUpperCase().replace('_', ' ')}</span></p>
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
            const row = pendingRequestsTableBody.insertRow();
            row.innerHTML = `
                <td data-label="Request ID">${request.id}</td>
                <td data-label="User">${request.userName || request.userId}</td>
                <td data-label="Pickup Time">${request.rideDateTime ? new Date(request.rideDateTime).toLocaleString() : ''}</td>
                <td data-label="Origin">${request.origin}</td>
                <td data-label="Final Destination">${request.destination}</td>
                <td data-label="Fare">$${request.fareUSD || '0.00'}</td>
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
            const row = rideHistoryTableBody.insertRow();
            row.innerHTML = `
                <td data-label="Ride ID">${ride.id}</td>
                <td data-label="User">${ride.userName || ride.userId}</td>
                <td data-label="Origin">${ride.origin}</td>
                <td data-label="Final Destination">${ride.destination}</td>
                <td data-label="Time">${ride.rideDateTime ? new Date(ride.rideDateTime).toLocaleString() : ''}</td>
                <td data-label="Fare">$${ride.fareUSD || '0.00'}</td>
                <td data-label="Status"><span class="badge ${statusClass}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}</span></td>
            `;
        });
    }

    // --- Event Handlers ---

    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        window.location.reload();
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
        const currentRidesTab = document.querySelector('button[data-bs-target="#current-rides"]');
        if (currentRidesTab) {
            const bsTab = new bootstrap.Tab(currentRidesTab);
            bsTab.show();
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
                time: new Date().toISOString()
            });
            const rideHistoryTab = document.querySelector('button[data-bs-target="#ride-history"]');
            if (rideHistoryTab) {
                const bsTab = new bootstrap.Tab(rideHistoryTab);
                bsTab.show();
            }
            showToast('Ride completed!', 'success');
        }
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vehicleModel = document.getElementById('vehicleModel').value;
        const licensePlate = document.getElementById('licensePlate').value;

        currentDriver.vehicleModel = vehicleModel;
        currentDriver.licensePlate = licensePlate;
        await setDoc(doc(db, "drivers", driverId), {
            ...currentDriver
        }, { merge: true });
        showToast('Account settings saved!', 'success');
        driverNameSpan.textContent = currentDriver.name || "Driver";
    });
});