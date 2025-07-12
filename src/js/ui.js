/**
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'danger', 'warning', 'info' (corresponds to Bootstrap background colors)
 * @param {number} duration - How long the toast stays visible in milliseconds. Default is 3500ms.
 */
export function showToast(message, type = "info", duration = 3500) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found with ID "toast-container". Cannot display toast.');
        return;
    }

    const toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center text-white bg-${type} border-0`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    toastElement.setAttribute('data-bs-delay', duration.toString());

    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastElement);

    // Initialize and show Bootstrap toast
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const bsToast = new bootstrap.Toast(toastElement);
        bsToast.show();
    } else {
        console.warn('Bootstrap Toast component not found. Toast may not function as expected.');
        toastElement.style.opacity = '1';
        setTimeout(() => {
            toastElement.style.opacity = '0';
            setTimeout(() => toastElement.remove(), 600); // Allow fade out before removing
        }, duration);
    }

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Shows a global loading overlay with a message.
 * Assumes an HTML structure for the loading overlay exists, e.g., `<div id="loading-overlay" class="loading-overlay">...</div>`.
 * @param {string} message - The message to display in the overlay.
 */
export function showLoadingOverlay(message = "Loading...") {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        // If the overlay doesn't exist, create a basic one dynamically
        // It's generally better to have it in HTML and just toggle visibility
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay'; // For CSS styling
        overlay.innerHTML = `
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3" id="loadingMessage">${message}</p>
        `;
        document.body.appendChild(overlay);
        // Add basic inline styles if no CSS is provided for .loading-overlay
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-size: 1.5rem;
            transition: opacity 0.3s ease-in-out;
            opacity: 0;
            pointer-events: none; /* Allows clicks through when hidden */
        `;
    }

    const loadingMessageElement = document.getElementById('loadingMessage');
    if (loadingMessageElement) {
        loadingMessageElement.textContent = message;
    }

    overlay.classList.add('show'); 
    overlay.style.opacity = '1'; 
    overlay.style.pointerEvents = 'auto';
}

/**
 * Hides the global loading overlay.
 */
export function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.style.opacity = '0'; 
        overlay.style.pointerEvents = 'none';
    }
}

/**
 * Opens a Bootstrap modal by its ID.
 * Requires Bootstrap's JavaScript bundle to be loaded.
 * @param {string} modalId - The ID of the modal HTML element.
 */
export function openModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const bsModal = new bootstrap.Modal(modalElement);
        bsModal.show();
    } else if (modalElement) {
        // Fallback for custom CSS-only modal if Bootstrap JS is not available
        modalElement.classList.add('show');
        modalElement.style.display = 'block'; // Ensure it's visible
        modalElement.setAttribute('aria-modal', 'true');
        modalElement.setAttribute('role', 'dialog');
        modalElement.focus();
    } else {
        console.warn(`Modal with ID "${modalId}" not found. Cannot open modal.`);
    }
}

/**
 * Closes a Bootstrap modal by its ID.
 * Requires Bootstrap's JavaScript bundle to be loaded.
 * @param {string} modalId - The ID of the modal HTML element.
 */
export function closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal.getInstance(modalElement)) {
        bootstrap.Modal.getInstance(modalElement).hide();
    } else if (modalElement) {
        // Fallback for custom CSS-only modal if Bootstrap JS is not available
        modalElement.classList.remove('show');
        modalElement.style.display = 'none'; // Ensure it's hidden
        modalElement.removeAttribute('aria-modal');
        modalElement.removeAttribute('role');
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not a Bootstrap modal instance. Cannot close modal.`);
    }
}

/**
 * Custom confirm modal using Bootstrap styling.
 * Creates and displays a simple "Yes/No" confirmation dialog.
 * @param {string} message - The confirmation message to display.
 * @returns {Promise<boolean>} A promise that resolves to `true` if "Yes" is clicked, `false` if "No" or Escape key.
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        // Remove any existing confirm modal to prevent duplicates
        let existing = document.getElementById('confirm-modal');
        if (existing) existing.remove();

        // Modal overlay (using Bootstrap-like structure for better integration)
        const overlay = document.createElement('div');
        overlay.id = 'confirm-modal';
        overlay.className = 'modal fade show d-block'; // Bootstrap classes to make it appear like an active modal
        overlay.setAttribute('tabindex', '-1');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.backgroundColor = 'rgba(30,41,59,0.18)'; // Custom overlay background for consistency
        overlay.style.display = 'block'; // Override Bootstrap's 'display: none' for 'fade' state

        // Modal dialog for centering
        const modalDialog = document.createElement('div');
        modalDialog.className = 'modal-dialog modal-dialog-centered';
        modalDialog.setAttribute('role', 'document');

        // Modal content card
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.borderRadius = '12px';
        modalContent.style.boxShadow = '0 2px 16px rgba(30,41,59,0.12)';
        modalContent.style.maxWidth = '350px';
        modalContent.style.width = '90vw';
        modalContent.style.margin = 'auto'; 
        modalContent.style.padding = '2em 1.5em 1.5em 1.5em';
        modalContent.style.textAlign = 'center';

        // Message body
        const msg = document.createElement('div');
        msg.className = 'modal-body'; // Bootstrap class
        msg.style.marginBottom = '1.5em';
        msg.style.fontSize = '1.1em';
        msg.style.color = '#17446b';
        msg.textContent = message;

        // Buttons wrapper (using Bootstrap footer for consistent padding/alignment)
        const btnWrap = document.createElement('div');
        btnWrap.className = 'modal-footer justify-content-center border-0 pt-0'; // Bootstrap class for footer
        btnWrap.style.gap = '1em'; // Custom gap between buttons

        const yesBtn = document.createElement('button');
        yesBtn.className = 'btn btn-primary'; // Bootstrap button class
        yesBtn.textContent = 'Yes';
        yesBtn.style.minWidth = '80px'; // Your custom min-width

        const noBtn = document.createElement('button');
        noBtn.className = 'btn btn-secondary'; // Bootstrap button class
        noBtn.textContent = 'No';
        noBtn.style.minWidth = '80px'; // Your custom min-width

        btnWrap.appendChild(yesBtn);
        btnWrap.appendChild(noBtn);

        modalContent.appendChild(msg);
        modalContent.appendChild(btnWrap);
        modalDialog.appendChild(modalContent);
        overlay.appendChild(modalDialog);
        document.body.appendChild(overlay);

        // Focus for accessibility
        yesBtn.focus();

        // Event handlers for buttons
        yesBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };
        noBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };

        // ESC key to close and resolve as false
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                resolve(false);
            }
        });
    });
}
