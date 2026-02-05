/**
 * Python Output - Runs full scripts via Web Worker and displays output
 */

const PythonOutput = {
    worker: null,
    isReady: false,
    isRunning: false,
    outputWindow: null,
    outputEl: null,
    statusEl: null,
    clearBtn: null,
    currentStatus: 'Idle',
    _onStatus: null,
    _runResolve: null,
    _runReject: null,
    _runPromise: null,
    _needsInit: true,
    debugStream: false,
    keyBindings: null,

    /**
     * Initialize output worker
     * @param {Object} options - Init options
     * @param {Function} options.onStatus - Callback for status updates
     */
    init(options = {}) {
        const { onStatus } = options;
        if (typeof onStatus === 'function') {
            this._onStatus = onStatus;
        }

        this._needsInit = false;
        this.setStatus('Starting...');
        DebugLogger.updateOutputWorkerStatus('Creating worker...');
        return new Promise((resolve, reject) => {
            this.worker = new Worker('js/pyodide-output-worker.js', { type: 'module' });

            this.worker.onmessage = (e) => {
                const { type, message, exception, exitCode, stream, text } = e.data;

                switch (type) {
                    case 'status':
                        if (this._onStatus) {
                            this._onStatus(message);
                        }
                        DebugLogger.updateOutputWorkerStatus(message);
                        break;

                    case 'ready':
                        this.isReady = true;
                        this._needsInit = false;
                        this.setStatus('Ready');
                        DebugLogger.updateOutputWorkerStatus('Ready');
                        resolve();
                        break;

                    case 'result':
                        this.ensureWindow();
                        if (exception) {
                            this.append(exception, 'exception');
                        }

                        this.append(`Process exited with code ${exitCode}`, 'exit');
                        break;
                    case 'stream':
                        this.ensureWindow();
                        this.appendStream(text || '', stream === 'stderr' ? 'stderr' : 'stdout');
                        break;

                    case 'error':
                        this.ensureWindow();
                        this.clear();
                        this.append(message, 'exception');
                        this.append('Process exited with code 1', 'exit');
                        if (this.isRunning && this._runReject) {
                            this._runReject(new Error(message));
                            this._runResolve = null;
                            this._runReject = null;
                        }
                        this._runPromise = null;
                        this.setStatus(`Error: ${message}`);
                        DebugLogger.updateOutputWorkerStatus(`Error: ${message}`);
                        break;

                    case 'done':
                        this.isRunning = false;
                        this.setStatus('Idle');
                        if (this._runResolve) {
                            this._runResolve();
                            this._runResolve = null;
                            this._runReject = null;
                        }
                        this._runPromise = null;
                        break;
                }
            };

            this.worker.onerror = (error) => {
                this.setStatus(`Error: ${error.message}`);
                DebugLogger.updateOutputWorkerStatus(`Error: ${error.message}`);
                reject(error);
            };

            this.worker.postMessage({ type: 'init' });
        });
    },

    /**
     * Run a full Python script
     * @param {string} code - Python source code
     */
    async run(code) {
        if (this._needsInit || !this.worker) {
            await this.init();
        }
        if (this.isRunning) {
            return this._runPromise || Promise.resolve();
        }

        this.isRunning = true;
        this.ensureWindow();
        this.clear();
        this.setStatus('Running...');

        this._runPromise = new Promise((resolve, reject) => {
            this._runResolve = resolve;
            this._runReject = reject;
            this.worker.postMessage({
                type: 'run',
                data: { code }
            });
        });
        return this._runPromise;
    },

    /**
     * Create or focus the output window
     */
    ensureWindow() {
        if (this.outputWindow) {
            return;
        }

        this.outputWindow = WindowManager.createWindow({
            title: 'Python Output',
            width: 700,
            height: 360,
            onClose: () => {
                this.outputWindow = null;
                this.outputEl = null;
                this.statusEl = null;
                this.terminate();
            },
            onReady: (container) => {
                container.innerHTML = '';

                const wrapper = document.createElement('div');
                wrapper.className = 'output-wrapper';

                const toolbar = document.createElement('div');
                toolbar.className = 'output-toolbar';

                const status = document.createElement('div');
                status.className = 'output-status';
                status.textContent = '';

                const leftGroup = document.createElement('div');
                leftGroup.className = 'output-toolbar-left';

                const clearBtn = document.createElement('button');
                clearBtn.className = 'output-clear-btn';
                clearBtn.textContent = 'Clear';
                clearBtn.addEventListener('click', () => this.clear());

                leftGroup.appendChild(clearBtn);
                toolbar.appendChild(leftGroup);
                toolbar.appendChild(status);

                const output = document.createElement('div');
                output.className = 'output-log';

                wrapper.appendChild(toolbar);
                wrapper.appendChild(output);
                container.appendChild(wrapper);

                this.outputEl = output;
                this.statusEl = status;
                this.clearBtn = clearBtn;
                this.setStatus(this.currentStatus || 'Idle');

                if (typeof KeyBindings !== 'undefined' && !this.keyBindings) {
                    this.keyBindings = new KeyBindings(window);
                    this.keyBindings.add({
                        combo: ['Command+K', 'Ctrl+K'],
                        handler: () => this.clear(),
                        when: () => WindowManager.activeWindow === this.outputWindow
                    });
                }
            }
        });
    },

    /**
     * Append output text
     * @param {string} text - Output text
     * @param {string} type - Output type
     */
    append(text, type) {
        if (!this.outputEl) {
            return;
        }

        const line = document.createElement('div');
        line.className = `output-line output-${type}`;
        line.textContent = text;
        this.outputEl.appendChild(line);
        this.outputEl.scrollTop = this.outputEl.scrollHeight;
    },

    /**
     * Append streaming output text
     * @param {string} text - Output text
     * @param {string} type - Output type
     */
    appendStream(text, type) {
        if (!this.outputEl || !text) {
            return;
        }

        const normalized = text.replace(/\r/g, '');
        const last = this.outputEl.lastElementChild;
        if (last && last.classList.contains(`output-${type}`) && last.classList.contains('output-chunk')) {
            last.textContent += normalized;
        } else {
            const chunk = document.createElement('span');
            chunk.className = `output-chunk output-${type}`;
            chunk.textContent = normalized;
            this.outputEl.appendChild(chunk);
        }

        if (this.debugStream) {
            DebugLogger.log(`[Output:${type}] ${JSON.stringify(normalized)}`);
        }
        this.outputEl.scrollTop = this.outputEl.scrollHeight;
    },

    /**
     * Clear output
     */
    clear() {
        if (this.outputEl) {
            this.outputEl.innerHTML = '';
        }
    },

    /**
     * Set status text
     * @param {string} status
     */
    setStatus(status) {
        this.currentStatus = status;
        if (!this.statusEl) {
            return;
        }
        this.statusEl.textContent = status;
        this.statusEl.classList.remove('status-ready', 'status-running', 'status-not-ready');
        const normalized = String(status).toLowerCase();
        if (normalized.includes('running')) {
            this.statusEl.classList.add('status-running');
        } else if (normalized.includes('not ready') || normalized.includes('error')) {
            this.statusEl.classList.add('status-not-ready');
        } else if (normalized.includes('ready') || normalized.includes('idle')) {
            this.statusEl.classList.add('status-ready');
        }
    },

    /**
     * Terminate the worker and reset state
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.isRunning) {
            const terminationError = new Error('Python run terminated');
            if (this._runReject) {
                this._runReject(terminationError);
            } else if (this._runResolve) {
                this._runResolve();
            }
        }
        this.isReady = false;
        this.isRunning = false;
        this._needsInit = true;
        this._runResolve = null;
        this._runReject = null;
        this._runPromise = null;
        this.setStatus('Idle');
        DebugLogger.updateOutputWorkerStatus('Terminated');
        if (this.keyBindings) {
            this.keyBindings.destroy();
            this.keyBindings = null;
        }
        this.clearBtn = null;
    }
};
