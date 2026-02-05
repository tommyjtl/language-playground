/**
 * TypeScript REPL - Browser TypeScript terminal using Web Worker
 */

import DebugLogger from './debug-logger.js';

const TypeScriptREPL = {
    worker: null,
    term: null,
    isLoaded: false,
    currentPrompt: 'ts> ',

    /**
     * Initialize TypeScript REPL in a container
     * @param {HTMLElement} container - The container element
     * @returns {Promise} Resolves when REPL is ready
     */
    async init(container) {
        return new Promise((resolve, reject) => {
            DebugLogger.log('Initializing TypeScript REPL...');
            this.worker = new Worker('js/typescript-repl-worker.js');
            DebugLogger.updateTsReplWorkerStatus('Creating worker...');

            const loadingDiv = container.querySelector('.terminal-loading span');
            if (loadingDiv) {
                loadingDiv.textContent = 'Loading TS compiler...';
            }

            this.worker.onmessage = (event) => {
                const { type, message, prompt, completions } = event.data;

                switch (type) {
                    case 'status':
                        if (loadingDiv) {
                            loadingDiv.textContent = message;
                        }
                        DebugLogger.updateTsReplWorkerStatus(message);
                        break;

                    case 'ready':
                        this.isLoaded = true;
                        DebugLogger.updateTsReplWorkerStatus('Ready');
                        this.initTerminal(container, prompt || 'ts> ');
                        resolve();
                        break;

                    case 'output':
                        if (this.term) {
                            this.term.echo(
                                String(message).replaceAll(']]', '&rsqb;&rsqb;').replaceAll('[[', '&lsqb;&lsqb;'),
                                { newline: true }
                            );
                        }
                        break;

                    case 'error':
                        if (this.term) {
                            this.term.error(message);
                        } else {
                            DebugLogger.updateTsReplWorkerStatus(`Error: ${message}`);
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
                            this.term.echo('Interrupted');
                            this.term.set_command('');
                            this.term.set_prompt('ts> ');
                            this.term.resume();
                        }
                        break;

                    case 'completions':
                        if (this.term && this.term._completionCallback) {
                            this.term._completionCallback(completions || []);
                        }
                        break;

                    default:
                        break;
                }
            };

            this.worker.onerror = (error) => {
                DebugLogger.updateTsReplWorkerStatus(`Error: ${error.message}`);
                reject(error);
            };

            this.worker.postMessage({ type: 'init' });
        });
    },

    /**
     * Initialize the terminal UI
     * @param {HTMLElement} container - The container element
     * @param {string} prompt - Prompt string
     */
    initTerminal(container, prompt) {
        container.innerHTML = '';

        const termContainer = document.createElement('div');
        termContainer.style.height = '100%';
        container.appendChild(termContainer);

        const interpreter = (command) => {
            this.term.pause();
            this.worker.postMessage({
                type: 'execute',
                data: { command }
            });
        };

        this.term = $(termContainer).terminal(interpreter, {
            greetings: 'TypeScript REPL ready',
            prompt: prompt || 'ts> ',
            completionEscape: false,
            completion: (command, callback) => {
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
    },

    /**
     * Cleanup resources
     */
    destroy() {
        DebugLogger.log('Destroying TypeScript REPL...');
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            DebugLogger.updateTsReplWorkerStatus('Terminated');
        }
        if (this.term) {
            this.term.destroy();
            this.term = null;
        }
        this.isLoaded = false;
    }
};

export default TypeScriptREPL;
