import { auth, db } from './firebase.js'; // Import Firebase auth and db instances
import { showToast } from './ui.js'; 
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements (will be accessed once initDriverDashboard is called) ---
// These are not globally defined at the top-level to ensure they are available
// only after the DOM is fully loaded and the driver dashboard is initialized.
let driverNameSpan;
let logoutBtn; // Though main.js setupAuthListeners usually handles this
let currentRideDisplay;
let pendingRequestsTableBody;
let noPendingRequestsMessage;
let rideHistoryTableBody;
let noRideHistoryMessage;
let settingsForm;

// --- Internal State Variables for the Dashboard ---
let currentDriverProfile = null; // Stores the current driver's profile data
let activeRide = null; // Stores the currently active ride object
let driverUid = null; // Stores the authenticated driver's UID

// New caches for ride history to combine results from multiple queries
let assignedRidesCache = [];
let rejectedRidesCache = [];


/**
 * Initializes the driver dashboard functionalities:
 * Fetches DOM elements, loads driver profile, sets up real-time listeners for rides,
 * and attaches event handlers for dashboard interactions.
 * This function is called by main.js after successful driver authentication.
 * @param {string} userUid - The Firebase Auth UID of the currently authenticated driver.
 */
export async function initDriverDashboard(userUid) {
    driverUid = userUid; // Set the driver's UID for use throughout this module

    // Get DOM elements. Ensure these IDs match your driver dashboard HTML.
    driverNameSpan = document.getElementById('driverName');
    logoutBtn = document.getElementById('logoutBtn');
    currentRideDisplay = document.getElementById('currentRideDisplay');
    pendingRequestsTableBody = document.querySelector('#pendingRequestsTable tbody');
    noPendingRequestsMessage = document.getElementById('noPendingRequests');
    rideHistoryTableBody = document.querySelector('#rideHistoryTable tbody');
    noRideHistoryMessage = document.getElementById('noRideHistory');
    settingsForm = document.getElementById('settingsForm');

    console.log('Initializing driver dashboard for UID:', driverUid);

    // --- Core Initialization Calls ---
    await loadDriverProfile(driverUid); // Load the driver's profile from Firestore
    listenPendingRequests(); // Set up real-time listener for new/pending ride requests
    listenRideHistory(); // Set up real-time listener for past rides
    listenActiveRide(); // Set up real-time listener for the driver's current active ride

    // --- Event Listeners ---
    // The logout button's primary handling is in auth.js, but this can be a backup
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.signOut();
            // main.js's initFirebase onAuthStateChanged will handle subsequent redirection
            showToast('Logged out successfully!', 'info');
        });
    }

    // Attach submit listener for the settings form
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmit);
    }
}

// --- Firebase Data Management Functions ---

/**
 * Loads the driver's profile from the 'drivers' collection or creates a new one if it doesn't exist.
 * @param {string} driverId - The UID of the driver.
 */
async function loadDriverProfile(driverId) {
    const driverRef = doc(db, "drivers", driverId);
    try {
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
            currentDriverProfile = driverSnap.data();
            console.log('Driver profile loaded:', currentDriverProfile);
            // Update the displayed driver name and settings form fields
            if (driverNameSpan) driverNameSpan.textContent = currentDriverProfile.name || "Driver";
            if (settingsForm) {
                document.getElementById('vehicleModel').value = currentDriverProfile.vehicleModel || '';
                document.getElementById('licensePlate').value = currentDriverProfile.licensePlate || '';
            }
        } else {
            // If no driver profile exists, create a basic one
            currentDriverProfile = {
                name: auth.currentUser.displayName || "Driver", // Use Auth display name as fallback
                email: auth.currentUser.email || "",
                vehicleModel: "",
                licensePlate: "",
                createdAt: new Date().toISOString() // Timestamp for creation
            };
            await setDoc(driverRef, currentDriverProfile); // Create the document
            console.log('New driver profile created:', currentDriverProfile);
            if (driverNameSpan) driverNameSpan.textContent = currentDriverProfile.name;
            if (settingsForm) {
                document.getElementById('vehicleModel').value = currentDriverProfile.vehicleModel;
                document.getElementById('licensePlate').value = currentDriverProfile.licensePlate;
            }
            showToast('Driver profile created. Please update your vehicle details.', 'info');
        }
    } catch (error) {
        console.error("Error loading/creating driver profile:", error);
        showToast("Failed to load driver profile. Please refresh.", "danger");
    }
}

/**
 * Sets up a real-time listener for ride requests available for any driver to accept.
 * This assumes 'status: "pending"' and 'driverId: null' for unassigned requests.
 */
function listenPendingRequests() {
    // Query for rides that are 'pending' (requested by passenger) and not yet assigned to a driver
    const q = query(
        collection(db, "rides"),
        where("status", "==", "pending"), // Corrected: Use "pending" as per rider app's creation status
        where("driverId", "==", null), // Crucial: filtering for unassigned rides
        orderBy("rideDateTime", "asc"), // Order by pickup time
        limit(20) // Limit the number of pending requests displayed for performance
    );

    onSnapshot(q, (snapshot) => {
        let pendingRequests = []; // Temporary array to hold current pending requests
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id; // Store Firestore document ID for actions
            pendingRequests.push(data);
        });
        console.log('Pending requests updated:', pendingRequests.length);
        renderPendingRequests(pendingRequests); // Render them to the UI
    }, (error) => {
        console.error("Error listening to pending requests:", error);
        showToast("Error loading pending requests.", "danger");
    });
}

/**
 * Sets up real-time listeners for the current driver's ride history (completed, cancelled, or rejected by them).
 * This now uses two queries to correctly capture both assigned and rejected rides.
 */
function listenRideHistory() {
    // 1. Query for rides where the current driver was assigned and completed/cancelled
    const assignedHistoryQuery = query(
        collection(db, "rides"),
        where("driverId", "==", driverUid),
        where("status", "in", ["completed", "cancelled"]), // Only statuses where driverId is set
        orderBy("rideDateTime", "desc"), // Order by most recent assigned rides first
        limit(50) // Limit the number of history items
    );

    // 2. Query for rides where the current driver explicitly rejected a pending ride
    const rejectedHistoryQuery = query(
        collection(db, "rides"),
        where("rejectedBy", "==", driverUid), // Query by the 'rejectedBy' field (the driver's UID)
        where("status", "==", "rejected_by_driver"), // Specific status for rejections
        orderBy("rejectedAt", "desc"), // Order by rejection time (assuming 'rejectedAt' is set)
        limit(50)
    );

    // Listener for assigned history
    onSnapshot(assignedHistoryQuery, (snapshot) => {
        assignedRidesCache = []; // Clear old cache before populating
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;
            assignedRidesCache.push(data);
        });
        console.log('Assigned ride history updated:', assignedRidesCache.length);
        renderCombinedRideHistory(); // Call the helper to combine and render
    }, (error) => {
        console.error("Error listening to assigned ride history:", error);
        showToast("Error loading assigned ride history.", "danger");
    });

    // Listener for rejected history
    onSnapshot(rejectedHistoryQuery, (snapshot) => {
        rejectedRidesCache = []; // Clear old cache before populating
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;
            rejectedRidesCache.push(data);
        });
        console.log('Rejected ride history updated:', rejectedRidesCache.length);
        renderCombinedRideHistory(); // Call the helper to combine and render
    }, (error) => {
        console.error("Error listening to rejected ride history:", error);
        showToast("Error loading rejected ride history.", "danger");
    });
}

/**
 * Helper function to combine results from assignedRidesCache and rejectedRidesCache,
 * then sort and render them. This is called whenever either history cache updates.
 */
function renderCombinedRideHistory() {
    // Combine arrays
    const combinedHistory = [...assignedRidesCache, ...rejectedRidesCache];

    // Deduplicate any possible overlaps (unlikely with current distinct queries but good practice)
    const uniqueHistory = combinedHistory.filter((value, index, self) =>
        self.findIndex(item => item.id === value.id) === index
    );

    // Sort by a relevant date (e.g., rideDateTime, completedAt, or rejectedAt)
    // Most recent rides first
    uniqueHistory.sort((a, b) => {
        const dateA = new Date(a.rideDateTime || a.completedAt || a.rejectedAt);
        const dateB = new Date(b.rideDateTime || b.completedAt || b.rejectedAt);
        return dateB - dateA;
    });

    renderRideHistory(uniqueHistory); // Call your existing rendering function with the combined, sorted data
}


/**
 * Sets up a real-time listener for the current driver's active ride (accepted or in progress).
 */
function listenActiveRide() {
    // Query for rides that belong to the current driver and are in 'accepted' or 'in_progress' state
    const q = query(
        collection(db, "rides"),
        where("driverId", "==", driverUid),
        where("status", "in", ["accepted", "in_progress"]),
        limit(1) // Assuming a driver can only have one active ride at a time
    );
    onSnapshot(q, (snapshot) => {
        activeRide = null; // Reset active ride status
        if (!snapshot.empty) {
            const doc = snapshot.docs[0]; // Get the first (and hopefully only) active ride
            let data = doc.data();
            data.id = doc.id;
            activeRide = data;
            console.log('Active ride updated:', activeRide);
        } else {
            console.log('No active ride found for driver.');
        }
        renderCurrentRide(); // Re-render the current ride display section
    }, (error) => {
        console.error("Error listening to active ride:", error);
        showToast("Error loading current ride status.", "danger");
    });
}

// --- Rendering Functions ---

/**
 * Renders the active ride details to the UI.
 */
function renderCurrentRide() {
    if (activeRide && currentRideDisplay) {
        const passengerIdentifier = activeRide.userName || activeRide.userId;
        const pickupTime = activeRide.rideDateTime ? new Date(activeRide.rideDateTime).toLocaleString() : 'N/A';
        const fareDisplay = activeRide.fareUSD ? `$${parseFloat(activeRide.fareUSD).toFixed(2)}` : '$0.00';

        let pickupPointsHtml = '';
        if (activeRide.pickupPoints && activeRide.pickupPoints.length > 0) {
            // Display pickup points, joining them with a comma
            pickupPointsHtml = `<p class="card-text"><strong>Pickup Points:</strong> ${activeRide.pickupPoints.join(', ')}</p>`;
        }

        currentRideDisplay.innerHTML = `
            <div class="card-body">
                <h3 class="card-title">Active Ride: ${passengerIdentifier}</h3>
                <p class="card-text"><strong>Origin:</strong> ${activeRide.origin}</p>
                ${pickupPointsHtml}
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
                    ${activeRide.status === 'in_progress' ? `<button class="btn btn-warning ms-2" data-id="${activeRide.id}">Update Status</button>` : ''}
                    <button class="btn btn-info ms-2" data-id="${activeRide.id}">View Map</button>
                </div>
            </div>
        `;
        // Attach event listeners to dynamically created buttons
        currentRideDisplay.querySelector('.btn-success')?.addEventListener('click', handleStartRide);
        currentRideDisplay.querySelector('.btn-primary')?.addEventListener('click', handleCompleteRide);
        currentRideDisplay.querySelector('.btn-warning')?.addEventListener('click', handleUpdateRideStatus);
        currentRideDisplay.querySelector('.btn-info')?.addEventListener('click', handleViewRideMap);

    } else if (currentRideDisplay) {
        currentRideDisplay.innerHTML = `<div class="card-body"><p class="card-text text-muted">No active ride.</p></div>`;
    }
}

/**
 * Renders the list of pending ride requests to the UI table.
 * @param {Array<Object>} requests - An array of pending ride request objects.
 */
function renderPendingRequests(requests) {
    if (!pendingRequestsTableBody || !noPendingRequestsMessage) return;

    pendingRequestsTableBody.innerHTML = '';
    if (requests.length === 0) {
        noPendingRequestsMessage.classList.remove('d-none');
        return;
    }
    noPendingRequestsMessage.classList.add('d-none');

    const rowsHtml = requests.map(request => {
        const passengerIdentifier = request.userName || request.userId;
        const pickupTime = request.rideDateTime ? new Date(request.rideDateTime).toLocaleString() : 'N/A';
        const fareDisplay = request.fareUSD ? `$${parseFloat(request.fareUSD).toFixed(2)}` : '$0.00';
        const pickupPointsDisplay = request.pickupPoints && request.pickupPoints.length > 0
            ? request.pickupPoints.join(', ') : 'N/A';

        return `
            <tr>
                <td data-label="Request ID">${request.id}</td>
                <td data-label="User">${passengerIdentifier}</td>
                <td data-label="Pickup Time">${pickupTime}</td>
                <td data-label="Origin">${request.origin}</td>
                <td data-label="Pickup Points">${pickupPointsDisplay}</td>
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
            </tr>
        `;
    }).join('');

    pendingRequestsTableBody.innerHTML = rowsHtml;

    // Attach event listeners to the new buttons
    document.querySelectorAll('#pendingRequestsTable .btn-success').forEach(button => {
        button.onclick = (e) => handleAcceptRide(e.target.dataset.id);
    });
    document.querySelectorAll('#pendingRequestsTable .btn-danger').forEach(button => {
        button.onclick = (e) => handleRejectRide(e.target.dataset.id);
    });
}

/**
 * Renders the list of past rides (history) to the UI table.
 * @param {Array<Object>} history - An array of past ride objects.
 */
function renderRideHistory(history) {
    if (!rideHistoryTableBody || !noRideHistoryMessage) return; // Ensure elements exist

    rideHistoryTableBody.innerHTML = ''; // Clear previous entries
    if (history.length === 0) {
        noRideHistoryMessage.classList.remove('d-none'); // Show "No ride history" message
        return;
    }
    noRideHistoryMessage.classList.add('d-none'); // Hide the message

    const rowsHtml = history.map(ride => {
        const statusClass = ride.status === 'completed' ? 'bg-success' : 'bg-danger'; // Simple class for display
        const passengerIdentifier = ride.userName || ride.userId;
        const rideTime = ride.rideDateTime ? new Date(ride.rideDateTime).toLocaleString() : (ride.rejectedAt ? new Date(ride.rejectedAt).toLocaleString() : 'N/A');
        const fareDisplay = ride.fareUSD ? `$${parseFloat(ride.fareUSD).toFixed(2)}` : '$0.00';
        const pickupPointsDisplay = ride.pickupPoints && ride.pickupPoints.length > 0
            ? ride.pickupPoints.join(', ') : 'N/A'; // Display pickup points

        return `
            <tr>
                <td data-label="Ride ID">${ride.id}</td>
                <td data-label="User">${passengerIdentifier}</td>
                <td data-label="Origin">${ride.origin}</td>
                <td data-label="Pickup Points">${pickupPointsDisplay}</td>
                <td data-label="Final Destination">${ride.destination}</td>
                <td data-label="Time">${rideTime}</td>
                <td data-label="Fare">${fareDisplay}</td>
                <td data-label="Status"><span class="badge ${statusClass}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1).replace('_', ' ')}</span></td>
                <td data-label="Distance">${ride.distance || 'N/A'}</td>
                <td data-label="Duration">${ride.duration || 'N/A'}</td>
                <td><button class="btn btn-sm btn-info" data-id="${ride.id}">View Details</button></td>
            </tr>
        `;
    }).join('');

    rideHistoryTableBody.innerHTML = rowsHtml;

    document.querySelectorAll('#rideHistoryTable .btn-info').forEach(button => {
        button.onclick = (e) => handleViewRideDetails(e.target.dataset.id);
    });
}

// --- Ride Action Handlers (Firestore Updates) ---

/**
 * Handles accepting a pending ride request.
 * Updates ride status, assigns driver details, and switches to the active ride tab.
 * @param {string} id - The ID of the ride document.
*/
async function handleAcceptRide(id) {
    if (activeRide) {
        showToast('You already have an active ride. Please complete it first.', 'danger');
        return;
    }
    if (!currentDriverProfile) {
        showToast('Driver profile not loaded. Cannot accept ride.', 'danger');
        return;
    }

    const rideRef = doc(db, "rides", id);
    try {
        await updateDoc(rideRef, {
            status: "accepted", // Change status to accepted
            driverId: driverUid, // Assign the current driver's UID
            driverName: currentDriverProfile.name, // Assign driver's name
            driverVehicleModel: currentDriverProfile.vehicleModel, // Assign driver's vehicle
            driverLicensePlate: currentDriverProfile.licensePlate, // Assign driver's license plate
            acceptedAt: new Date().toISOString() // Timestamp of acceptance
        });
        showToast('Ride accepted! Switching to current ride.', 'success');

        // Programmatically switch to the 'Current Rides' tab for better UX
        const currentRidesTabBtn = document.querySelector('button[data-bs-target="#current-rides"]');
        if (currentRidesTabBtn && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            const bsTab = new bootstrap.Tab(currentRidesTabBtn);
            bsTab.show();
        } else {
            console.warn("Bootstrap Tab functionality not found or tab button missing. Cannot switch tabs automatically.");
        }
    } catch (error) {
        console.error("Error accepting ride:", error);
        showToast('Failed to accept ride. Please try again.', 'danger');
    }
}

/**
 * Handles rejecting a pending ride request.
 * Updates ride status to 'rejected_by_driver'.
 * @param {string} id - The ID of the ride document.
 */
async function handleRejectRide(id) {
    const rideRef = doc(db, "rides", id);
    try {
        await updateDoc(rideRef, {
            status: "rejected_by_driver", // A specific status for driver rejection
            rejectedBy: driverUid, // Record which driver rejected it
            rejectedAt: new Date().toISOString()
        });
        showToast('Ride rejected.', 'info');
    } catch (error) {
        console.error("Error rejecting ride:", error);
        showToast('Failed to reject ride. Please try again.', 'danger');
    }
}

/**
 * Handles starting an accepted ride.
 * Updates ride status to 'in_progress'.
 * @param {Event} event - The click event from the "Start Ride" button.
 */
async function handleStartRide(event) {
    const rideId = event.target.dataset.id;
    // Ensure the clicked ride is the active one and in the 'accepted' state
    if (activeRide && activeRide.id === rideId && activeRide.status === 'accepted') {
        const rideRef = doc(db, "rides", rideId);
        try {
            await updateDoc(rideRef, {
                status: "in_progress",
                startedAt: new Date().toISOString() // Timestamp when ride starts
            });
            showToast('Ride started!', 'success');
        } catch (error) {
            console.error("Error starting ride:", error);
            showToast('Failed to start ride. Please try again.', 'danger');
        }
    } else {
        showToast('Cannot start ride. It might not be in the "accepted" state or not the current active ride.', 'warning');
    }
}

/**
 * Handles completing an in-progress ride.
 * Updates ride status to 'completed' and switches to ride history tab.
 * @param {Event} event - The click event from the "Complete Ride" button.
 */
async function handleCompleteRide(event) {
    const rideId = event.target.dataset.id;
    // Ensure the clicked ride is the active one and in the 'in_progress' state
    if (activeRide && activeRide.id === rideId && activeRide.status === 'in_progress') {
        const rideRef = doc(db, "rides", rideId);
        try {
            await updateDoc(rideRef, {
                status: "completed",
                completedAt: new Date().toISOString() // Timestamp when ride completes
            });
            showToast('Ride completed! Added to history.', 'success');

            // Programmatically switch to the 'Ride History' tab
            const rideHistoryTabBtn = document.querySelector('button[data-bs-target="#ride-history"]');
            if (rideHistoryTabBtn && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                const bsTab = new bootstrap.Tab(rideHistoryTabBtn);
                bsTab.show();
            } else {
                console.warn("Bootstrap Tab functionality not found or tab button missing. Cannot switch tabs automatically.");
            }
        } catch (error) {
            console.error("Error completing ride:", error);
            showToast('Failed to complete ride. Please try again.', 'danger');
        }
    } else {
        showToast('Cannot complete ride. It might not be in the "in progress" state or not the current active ride.', 'warning');
    }
}

/**
 * Placeholder for updating ride status (e.g., "Arrived at pickup").
 * This would typically involve a modal or more complex UI.
 * @param {Event} event - The click event from the "Update Status" button.
 */
async function handleUpdateRideStatus(event) {
    const rideId = event.target.dataset.id;
    showToast('Update Status functionality coming soon!', 'info');
    console.log("Update Status clicked for ride:", rideId);
    // You could implement a modal here to let the driver select a new status
    // For example: await updateDoc(doc(db, "rides", rideId), { status: "arrived_at_pickup" });
}

/**
 * Placeholder for viewing ride details on a map.
 * @param {Event} event - The click event from the "View Map" button.
 */
async function handleViewRideMap(event) {
    const rideId = event.target.dataset.id;
    showToast('Loading map for ride ' + rideId + '...', 'info');
    console.log("View Map clicked for ride:", rideId);
    // This would involve rendering a Google Map dynamically with the ride's origin,
    // destination, and possibly pickup points highlighted.
    // Example: Pass activeRide data to a map utility function.
}

/**
 * Placeholder for viewing full ride details from history.
 * @param {string} id - The ID of the ride document.
 */
async function handleViewRideDetails(id) {
    showToast('Loading ride details for ' + id + '...', 'info');
    console.log("View Details clicked for ride:", id);
    // You could fetch the specific ride document and display its full details in a modal.
}


// --- Settings Form Handler ---

/**
 * Handles the submission of the driver's settings form.
 * Updates vehicle model and license plate in the driver's profile.
 * @param {Event} e - The form submission event.
 */
async function handleSettingsSubmit(e) {
    e.preventDefault(); // Prevent default form submission behavior

    if (!currentDriverProfile || !driverUid) {
        showToast('Driver profile not loaded. Please try again.', 'danger');
        return;
    }

    // Get values from the form inputs
    const vehicleModel = document.getElementById('vehicleModel')?.value;
    const licensePlate = document.getElementById('licensePlate')?.value;

    try {
        // Update the driver's document in Firestore
        await updateDoc(doc(db, "drivers", driverUid), {
            vehicleModel: vehicleModel || '', // Ensure it's not undefined if field is missing
            licensePlate: licensePlate || '', // Ensure it's not undefined if field is missing
            lastUpdatedAt: new Date().toISOString() // Add a timestamp for the last update
        });

        // Update the local driver profile object to reflect changes immediately
        currentDriverProfile.vehicleModel = vehicleModel || '';
        currentDriverProfile.licensePlate = licensePlate || '';

        showToast('Account settings saved!', 'success');
        console.log('Driver settings updated:', currentDriverProfile);
    } catch (error) {
        console.error("Error saving settings:", error);
        showToast('Failed to save settings. Please try again.', 'danger');
    }
}
