/**
 * Window Manager - Handles window creation, dragging, and resizing
 */

const WindowManager = {
    activeWindow: null,
    windowCount: 0,

    /**
     * Create a new window
     * @param {Object} options - Window options
     * @returns {HTMLElement} The created window element
     */
    createWindow(options = {}) {
        const {
            title = 'Window',
            width = 700,
            height = 450,
            x = null,
            y = null,
            draggable = true,
            resizable = true,
            controls = true,
            onClose = null,
            onReady = null
        } = options;

        // Calculate center position if not provided
        const posX = x !== null ? x : (window.innerWidth - width) / 4;
        const posY = y !== null ? y : (window.innerHeight - height) / 4;

        // Create window element
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${++this.windowCount}`;
        windowEl.style.width = `${width}px`;
        windowEl.style.height = `${height}px`;
        windowEl.style.left = `${posX}px`;
        windowEl.style.top = `${posY}px`;
        windowEl.style.zIndex = 1000 + this.windowCount;

        // Build window HTML with conditional controls and resize handles
        const controlsHTML = controls ? `
        <div class="window-controls">
          <button class="window-btn-close group relative flex items-center justify-center w-3 h-3 rounded-full bg-red-500 hover:bg-red-500 active:bg-red-700 border-0 cursor-pointer transition-colors" title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="opacity-0 group-hover:opacity-100 text-white transition-opacity"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        ` : '';

        const resizeHandlesHTML = resizable ? `
      <div class="resize-handle resize-handle-e"></div>
      <div class="resize-handle resize-handle-s"></div>
      <div class="resize-handle resize-handle-se"></div>
        ` : '';

        windowEl.innerHTML = `
      <div class="window-titlebar" ${!draggable ? 'style="cursor: default;"' : ''}>
        ${controlsHTML}
        <span class="window-title">${title}</span>
      </div>
      <div class="window-content">
        <div class="terminal-loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
      ${resizeHandlesHTML}
    `;

        // Add to container
        document.getElementById('window-container').appendChild(windowEl);

        windowEl.addEventListener('mousedown', () => {
            this.activeWindow = windowEl;
            windowEl.style.zIndex = 1000 + (++this.windowCount);
        });

        // Setup event listeners
        this.setupDragging(windowEl);
        this.setupResizing(windowEl);
        this.setupClose(windowEl, onClose);

        this.activeWindow = windowEl;

        if (onReady) {
            onReady(windowEl.querySelector('.window-content'));
        }

        return windowEl;
    },

    /**
     * Setup dragging functionality
     * @param {HTMLElement} windowEl - The window element
     */
    setupDragging(windowEl) {
        const titlebar = windowEl.querySelector('.window-titlebar');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-btn')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = windowEl.offsetLeft;
            startTop = windowEl.offsetTop;

            windowEl.style.zIndex = 1000 + (++this.windowCount);
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // Keep window within viewport bounds
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowEl.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - windowEl.offsetHeight));

            windowEl.style.left = `${newLeft}px`;
            windowEl.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    },

    /**
     * Setup resizing functionality
     * @param {HTMLElement} windowEl - The window element
     */
    setupResizing(windowEl) {
        const minWidth = 400;
        const minHeight = 300;

        const handles = windowEl.querySelectorAll('.resize-handle');
        let isResizing = false;
        let currentHandle = null;
        let startX, startY, startWidth, startHeight;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentHandle = handle;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = windowEl.offsetWidth;
                startHeight = windowEl.offsetHeight;

                document.body.style.userSelect = 'none';
                e.stopPropagation();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (currentHandle.classList.contains('resize-handle-e') ||
                currentHandle.classList.contains('resize-handle-se')) {
                const newWidth = Math.max(minWidth, startWidth + dx);
                windowEl.style.width = `${newWidth}px`;
            }

            if (currentHandle.classList.contains('resize-handle-s') ||
                currentHandle.classList.contains('resize-handle-se')) {
                const newHeight = Math.max(minHeight, startHeight + dy);
                windowEl.style.height = `${newHeight}px`;
            }

            // Trigger resize event for terminal to adjust
            window.dispatchEvent(new Event('resize'));
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            currentHandle = null;
            document.body.style.userSelect = '';
        });
    },

    /**
     * Setup close button functionality
     * @param {HTMLElement} windowEl - The window element
     * @param {Function} onClose - Callback when window is closed
     */
    setupClose(windowEl, onClose) {
        const closeBtn = windowEl.querySelector('.window-btn-close');

        if (!closeBtn) return; // No close button exists

        closeBtn.addEventListener('click', () => {
            if (onClose) {
                onClose();
            }
            windowEl.remove();
            this.activeWindow = null;
        });
    },

    /**
     * Close all windows
     */
    closeAll() {
        const container = document.getElementById('window-container');
        container.innerHTML = '';
        this.activeWindow = null;
    }
};
