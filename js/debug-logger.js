/**
 * Debug Logger - Tracks Web Worker and Python WASM lifecycle
 */

const DebugLogger = {
    replWorkerStatusEl: null,
    outputWorkerStatusEl: null,
    logEl: null,
    maxLogEntries: 50,
    debugWindow: null,

    /**
     * Initialize the debug logger
     */
    init() {
        this.createDebugWindow();
    },

    /**
     * Create the debug window using WindowManager
     */
    createDebugWindow() {
        this.debugWindow = WindowManager.createWindow({
            title: 'Debug Console',
            width: 400,
            height: 400,
            x: window.innerWidth - 400 - 16, // 16px from right (matching right-4)
            y: window.innerHeight - 400 - 16, // 16px from bottom (matching bottom-4)
            draggable: true,
            resizable: true,
            controls: false, // No close button for debug console
            onReady: (contentEl) => {
                // Remove loading indicator
                contentEl.innerHTML = '';

                // Build debug console content
                contentEl.innerHTML = `
                    <div class="bg-white flex-1 overflow-hidden p-3 text-xs flex flex-col h-full">
                        <!-- Web Worker Lifecycle Section -->
                        <div class="mb-2 flex-shrink-0 flex items-center gap-2">
                            <div class="font-semibold text-gray-700">Python REPL Worker:</div>
                            <div class="flex-1 border-b border-gray-200 mx-1"></div>
                            <div id="repl-worker-status" class="text-gray-600">Not initialized</div>
                        </div>

                        <!-- Output Worker Lifecycle Section -->
                        <div class="mb-2 flex-shrink-0 flex items-center gap-2">
                            <div class="font-semibold text-gray-700">Python Output Worker:</div>
                            <div class="flex-1 border-b border-gray-200 mx-1"></div>
                            <div id="output-worker-status" class="text-gray-600">Not initialized</div>
                        </div>

                        <!-- Event Log -->
                        <div class="flex-1 flex flex-col min-h-0">
                            <div class="font-semibold text-gray-700 mb-1.5 flex-shrink-0 flex items-center gap-2">
                                <div>Event Log:</div>
                                <div class="flex-1 border-b border-gray-200 ml-1"></div>
                            </div>
                            <div id="debug-log"
                                class="text-xs font-mono bg-gray-50 flex-1 mt-1 border-1 border-gray-200 rounded-sm p-2 text-gray-600 space-y-1 overflow-y-auto">
                                <div class="text-gray-400">Waiting for events...</div>
                            </div>
                        </div>
                    </div>
                `;

                // Now cache the element references
                this.replWorkerStatusEl = document.getElementById('repl-worker-status');
                this.outputWorkerStatusEl = document.getElementById('output-worker-status');
                this.logEl = document.getElementById('debug-log');

                this.log('Debug logger initialized');
            }
        });
    },

    /**
     * Update worker status
     * @param {string} status - Status message
     */
    updateReplWorkerStatus(status) {
        if (this.replWorkerStatusEl) {
            this.replWorkerStatusEl.textContent = status;
            this.log(`[REPL Worker] ${status}`);
        }
    },

    updateOutputWorkerStatus(status) {
        if (this.outputWorkerStatusEl) {
            this.outputWorkerStatusEl.textContent = status;
            this.log(`[Output Worker] ${status}`);
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
        if (this.replWorkerStatusEl) {
            this.replWorkerStatusEl.textContent = 'Not initialized';
        }
        if (this.outputWorkerStatusEl) {
            this.outputWorkerStatusEl.textContent = 'Not initialized';
        }
        if (this.logEl) {
            this.logEl.innerHTML = '<div class="text-gray-400">Waiting for events...</div>';
        }
    }
};
