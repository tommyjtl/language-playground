/**
 * Python REPL - Pyodide-powered Python terminal using Web Worker
 */

const PythonREPL = {
    worker: null,
    term: null,
    isLoaded: false,
    currentPrompt: '>>> ',

    /**
     * Initialize Python REPL in a container
     * @param {HTMLElement} container - The container element
     * @returns {Promise} Resolves when REPL is ready
     */
    async init(container) {
        return new Promise((resolve, reject) => {
            // Create worker
            DebugLogger.updateWorkerStatus('Creating worker...');
            this.worker = new Worker('js/pyodide-worker.js', { type: 'module' });

            // Update loading message
            const loadingDiv = container.querySelector('.terminal-loading span');
            if (loadingDiv) {
                loadingDiv.textContent = 'Loading Python runtime...';
            }

            // Handle worker messages
            this.worker.onmessage = (e) => {
                const { type, message, banner, prompt, completions } = e.data;

                switch (type) {
                    case 'status':
                        if (loadingDiv) {
                            loadingDiv.textContent = message;
                        }
                        DebugLogger.updatePythonStatus(message);
                        break;

                    case 'ready':
                        this.isLoaded = true;
                        DebugLogger.updateWorkerStatus('Worker ready');
                        DebugLogger.updatePythonStatus('Ready');
                        this.initTerminal(container, banner);
                        resolve();
                        break;

                    case 'output':
                        if (this.term) {
                            this.term.echo(
                                message.replaceAll(']]', '&rsqb;&rsqb;').replaceAll('[[', '&lsqb;&lsqb;'),
                                { newline: true }
                            );
                        }
                        break;

                    case 'error':
                        if (this.term) {
                            this.term.error(message);
                        } else {
                            reject(new Error(message));
                        }
                        break;

                    case 'prompt':
                        if (this.term) {
                            this.currentPrompt = prompt;
                            this.term.set_prompt(prompt);
                        }
                        break;

                    case 'done':
                        if (this.term) {
                            this.term.resume();
                        }
                        break;

                    case 'interrupted':
                        if (this.term) {
                            this.term.echo('KeyboardInterrupt');
                            this.term.set_command('');
                            this.term.set_prompt('>>> ');
                            this.term.resume();
                        }
                        break;

                    case 'completions':
                        // Store completions for the terminal
                        if (this.term && this.term._completionCallback) {
                            this.term._completionCallback(completions);
                        }
                        break;
                }
            };

            this.worker.onerror = (error) => {
                reject(error);
            };

            // Start initialization
            this.worker.postMessage({ type: 'init' });
        });
    },

    /**
     * Initialize the terminal UI
     * @param {HTMLElement} container - The container element
     * @param {string} banner - The welcome banner
     */
    initTerminal(container, banner) {
        // Clear loading message
        container.innerHTML = '';

        // Create terminal
        const termContainer = document.createElement('div');
        termContainer.style.height = '100%';
        container.appendChild(termContainer);

        // Interpreter function - sends commands to worker
        const interpreter = (command) => {
            this.term.pause();
            this.worker.postMessage({
                type: 'execute',
                data: { command }
            });
        };

        // Initialize jQuery Terminal
        this.term = $(termContainer).terminal(interpreter, {
            greetings: banner,
            prompt: '>>> ',
            completionEscape: false,
            completion: (command, callback) => {
                // Store callback for later
                this.term._completionCallback = callback;
                this.worker.postMessage({
                    type: 'complete',
                    data: { command }
                });
            },
            keymap: {
                'CTRL+C': (event, original) => {
                    this.worker.postMessage({ type: 'interrupt' });
                },
                'TAB': (event, original) => {
                    const command = this.term.before_cursor();
                    if (command.trim() === '') {
                        this.term.insert('\t');
                        return false;
                    }
                    return original(event);
                }
            }
        });

        this.term.ready = Promise.resolve();
        this.term.ready = Promise.resolve();
    },

    /**
     * Cleanup resources
     */
    destroy() {
        DebugLogger.log('Destroying Python REPL...');
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            DebugLogger.updateWorkerStatus('Terminated');
        }
        if (this.term) {
            this.term.destroy();
            this.term = null;
        }
        this.isLoaded = false;
    }
};
