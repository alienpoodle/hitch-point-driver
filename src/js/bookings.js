import { auth, db } from './firebase.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    orderBy
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
            window.location.href = '/login.html';
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
            // Initialize settings form with current driver data
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
        // Listen for ride requests assigned to this driver and status 'pending'
        const q = query(
            collection(db, "bookings"),
            where("driverId", "==", driverId),
            where("status", "==", "pending"),
            orderBy("pickupTime", "asc")
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
            collection(db, "bookings"),
            where("driverId", "==", driverId),
            where("status", "in", ["completed", "cancelled"]),
            orderBy("pickupTime", "desc")
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
            collection(db, "bookings"),
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
                    <h3 class="card-title">Active Ride: ${activeRide.userName}</h3>
                    <p class="card-text"><strong>Origin:</strong> ${activeRide.origin}</p>
                    ${activeRide.pickupPoints && activeRide.pickupPoints.length > 0 ?
                        `<p class="card-text"><strong>Pickup Points:</strong> ${activeRide.pickupPoints.join(', ')}</p>` : ''}
                    <p class="card-text"><strong>Final Destination:</strong> ${activeRide.finalDestination}</p>
                    <p class="card-text"><strong>Pickup Time:</strong> ${new Date(activeRide.pickupTime).toLocaleString()}</p>
                    <p class="card-text"><strong>Fare:</strong> $${activeRide.fare.toFixed(2)}</p>
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
                <td data-label="User">${request.userName}</td>
                <td data-label="Pickup Time">${new Date(request.pickupTime).toLocaleString()}</td>
                <td data-label="Origin">${request.origin}</td>
                <td data-label="Pickup Points">${request.pickupPoints && request.pickupPoints.length > 0 ? request.pickupPoints.join('<br>') : 'N/A'}</td>
                <td data-label="Final Destination">${request.finalDestination}</td>
                <td data-label="Fare">$${request.fare.toFixed(2)}</td>
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
                <td data-label="User">${ride.userName}</td>
                <td data-label="Origin">${ride.origin}</td>
                <td data-label="Pickup Points">${ride.pickupPoints && ride.pickupPoints.length > 0 ? ride.pickupPoints.join('<br>') : 'N/A'}</td>
                <td data-label="Final Destination">${ride.finalDestination}</td>
                <td data-label="Time">${ride.time ? ride.time : (ride.pickupTime ? new Date(ride.pickupTime).toLocaleString() : '')}</td>
                <td data-label="Fare">$${ride.fare.toFixed(2)}</td>
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
            alert('You already have an active ride. Please complete it first.');
            return;
        }
        const bookingRef = doc(db, "bookings", id);
        await updateDoc(bookingRef, {
            status: "accepted"
        });
        // UI will update via onSnapshot
        // Optionally, switch to Current Rides tab
        const currentRidesTab = document.querySelector('button[data-bs-target="#current-rides"]');
        if (currentRidesTab) {
            const bsTab = new bootstrap.Tab(currentRidesTab);
            bsTab.show();
        }
    }

    async function handleRejectRide(id) {
        const bookingRef = doc(db, "bookings", id);
        await updateDoc(bookingRef, {
            status: "cancelled"
        });
        // UI will update via onSnapshot
    }

    async function handleStartRide(event) {
        const rideId = event.target.dataset.id;
        if (activeRide && activeRide.id === rideId) {
            const bookingRef = doc(db, "bookings", rideId);
            await updateDoc(bookingRef, {
                status: "in_progress"
            });
            // UI will update via onSnapshot
        }
    }

    async function handleCompleteRide(event) {
        const rideId = event.target.dataset.id;
        if (activeRide && activeRide.id === rideId) {
            const bookingRef = doc(db, "bookings", rideId);
            await updateDoc(bookingRef, {
                status: "completed",
                time: new Date().toISOString()
            });
            // UI will update via onSnapshot
            // Optionally, switch to Ride History tab
            const rideHistoryTab = document.querySelector('button[data-bs-target="#ride-history"]');
            if (rideHistoryTab) {
                const bsTab = new bootstrap.Tab(rideHistoryTab);
                bsTab.show();
            }
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
        alert('Account settings saved!');
        driverNameSpan.textContent = currentDriver.name || "Driver";
    });
});