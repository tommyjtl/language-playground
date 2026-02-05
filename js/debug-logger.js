/**
 * Debug Logger - Tracks Web Worker and Python WASM lifecycle
 */

const DebugLogger = {
    workerStatusEl: null,
    pythonStatusEl: null,
    logEl: null,
    maxLogEntries: 50,

    /**
     * Initialize the debug logger
     */
    init() {
        this.workerStatusEl = document.getElementById('worker-status');
        this.pythonStatusEl = document.getElementById('python-status');
        this.logEl = document.getElementById('debug-log');
    },

    /**
     * Update worker status
     * @param {string} status - Status message
     */
    updateWorkerStatus(status) {
        if (this.workerStatusEl) {
            this.workerStatusEl.textContent = status;
            this.log(`[Worker] ${status}`);
        }
    },

    /**
     * Update Python WASM status
     * @param {string} status - Status message
     */
    updatePythonStatus(status) {
        if (this.pythonStatusEl) {
            this.pythonStatusEl.textContent = status;
            this.log(`[Python] ${status}`);
        }
    },

    /**
     * Log a debug message
     * @param {string} message - Message to log
     */
    log(message) {
        if (!this.logEl) return;

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const entry = document.createElement('div');
        entry.className = 'text-gray-700';
        entry.textContent = `${timestamp} ${message}`;

        // Clear "Waiting for events..." if it's the first log
        if (this.logEl.querySelector('.text-gray-400')) {
            this.logEl.innerHTML = '';
        }

        this.logEl.appendChild(entry);

        // Limit log entries
        while (this.logEl.children.length > this.maxLogEntries) {
            this.logEl.removeChild(this.logEl.firstChild);
        }

        // Auto-scroll to bottom
        this.logEl.scrollTop = this.logEl.scrollHeight;
    },

    /**
     * Clear all logs and reset status
     */
    clear() {
        if (this.workerStatusEl) {
            this.workerStatusEl.textContent = 'Not initialized';
        }
        if (this.pythonStatusEl) {
            this.pythonStatusEl.textContent = 'Not initialized';
        }
        if (this.logEl) {
            this.logEl.innerHTML = '<div class="text-gray-400">Waiting for events...</div>';
        }
    }
};
