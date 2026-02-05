/**
 * Main Application Entry Point
 */

import DebugLogger from './debug-logger.js';
import WindowManager from './window-manager.js';
import PythonREPL from './python-repl.js';
import TypeScriptREPL from './typescript-repl.js';
import PythonEditor from './python-editor.js';
import TypeScriptEditor from './typescript-editor.js';
import PythonOutput from './python-output.js';
import TypeScriptOutput from './typescript-output.js';

const App = {
    DESKTOP_MIN_WIDTH: 640,
    pythonWindowOpen: false,
    editorWindowOpen: false,
    tsReplWindowOpen: false,
    tsEditorWindowOpen: false,

    /**
     * Initialize the application
     */
    init() {
        DebugLogger.init();
        DebugLogger.log('Application initialized');

        this.checkDesktop();
        this.setupEventListeners();

        // Re-check on resize
        window.addEventListener('resize', () => this.checkDesktop());
    },

    /**
     * Check if the current device/screen is desktop-sized
     */
    checkDesktop() {
        const overlay = document.getElementById('desktop-only-overlay');
        const isDesktop = window.innerWidth >= this.DESKTOP_MIN_WIDTH;

        // Also check for touch-only devices (optional additional check)
        const isTouchOnly = 'ontouchstart' in window &&
            navigator.maxTouchPoints > 0 &&
            !window.matchMedia('(pointer: fine)').matches;

        if (!isDesktop || isTouchOnly) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const openPythonBtn = document.getElementById('open-python-btn');
        const openEditorBtn = document.getElementById('open-editor-btn');
        const openTsReplBtn = document.getElementById('open-ts-repl-btn');
        const openTsEditorBtn = document.getElementById('open-ts-editor-btn');

        openPythonBtn.addEventListener('click', () => {
            this.openPythonWindow();
        });

        openEditorBtn.addEventListener('click', () => {
            this.openEditorWindow();
        });

        openTsReplBtn.addEventListener('click', () => {
            this.openTypeScriptReplWindow();
        });

        openTsEditorBtn.addEventListener('click', () => {
            this.openTypeScriptEditorWindow();
        });
    },

    /**
     * Open a Python terminal window
     */
    openPythonWindow() {
        // Only allow one window for now
        if (this.pythonWindowOpen) {
            return;
        }

        this.pythonWindowOpen = true;
        DebugLogger.log('Opening Python window...');

        // Update button state
        const btn = document.getElementById('open-python-btn');
        btn.disabled = true;

        // Create window
        WindowManager.createWindow({
            title: 'Python Console',
            width: 700,
            height: 450,
            onClose: () => {
                this.pythonWindowOpen = false;
                DebugLogger.log('Python window closed');
                PythonREPL.destroy();

                // Re-enable button
                btn.disabled = false;
            },
            onReady: async (container) => {
                // Use setTimeout to ensure the window is rendered and interactive first
                setTimeout(async () => {
                    await PythonREPL.init(container);
                }, 0);
            }
        });
    },

    /**
     * Open a Python editor window
     */
    openEditorWindow() {
        if (this.editorWindowOpen) {
            return;
        }

        this.editorWindowOpen = true;
        DebugLogger.log('Opening Editor window...');

        const btn = document.getElementById('open-editor-btn');
        btn.disabled = true;

        WindowManager.createWindow({
            title: 'Python Editor',
            width: 800,
            height: 500,
            onClose: () => {
                this.editorWindowOpen = false;
                DebugLogger.log('Editor window closed');
                PythonEditor.destroy();
                btn.disabled = false;
            },
            onReady: async (container) => {
                setTimeout(() => {
                    const defaultEditorText = `# Write Python here
`;
                    PythonEditor.init(container, {
                        initialText: defaultEditorText,
                        storageKey: 'pythonEditorCode',
                        onRun: async () => {
                            await PythonOutput.run(PythonEditor.getValue());
                        }
                    });
                }, 0);
            }
        });
    },

    /**
     * Open a TypeScript REPL window
     */
    openTypeScriptReplWindow() {
        if (this.tsReplWindowOpen) {
            return;
        }

        this.tsReplWindowOpen = true;
        DebugLogger.log('Opening TypeScript REPL window...');

        const btn = document.getElementById('open-ts-repl-btn');
        btn.disabled = true;

        WindowManager.createWindow({
            title: 'TypeScript Console',
            width: 700,
            height: 450,
            onClose: () => {
                this.tsReplWindowOpen = false;
                DebugLogger.log('TypeScript REPL window closed');
                TypeScriptREPL.destroy();
                btn.disabled = false;
            },
            onReady: async (container) => {
                setTimeout(async () => {
                    try {
                        await TypeScriptREPL.init(container);
                    } catch (error) {
                        const message = error && error.message ? error.message : 'Failed to start TypeScript REPL';
                        container.innerHTML = `<div class="terminal-loading"><span>${message}</span></div>`;
                        DebugLogger.log(`TypeScript REPL init failed: ${message}`);
                        btn.disabled = false;
                        this.tsReplWindowOpen = false;
                    }
                }, 0);
            }
        });
    },

    /**
     * Open a TypeScript editor window
     */
    openTypeScriptEditorWindow() {
        if (this.tsEditorWindowOpen) {
            return;
        }

        this.tsEditorWindowOpen = true;
        DebugLogger.log('Opening TypeScript Editor window...');

        const btn = document.getElementById('open-ts-editor-btn');
        btn.disabled = true;

        WindowManager.createWindow({
            title: 'TypeScript Editor',
            width: 800,
            height: 500,
            onClose: () => {
                this.tsEditorWindowOpen = false;
                DebugLogger.log('TypeScript Editor window closed');
                TypeScriptEditor.destroy();
                btn.disabled = false;
            },
            onReady: async (container) => {
                setTimeout(() => {
                    const defaultEditorText = `// Write TypeScript here\n`;
                    TypeScriptEditor.init(container, {
                        initialText: defaultEditorText,
                        storageKey: 'typescriptEditorCode',
                        onRun: async () => {
                            await TypeScriptOutput.run(TypeScriptEditor.getValue());
                        }
                    });
                }, 0);
            }
        });
    }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
