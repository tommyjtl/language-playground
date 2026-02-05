/**
 * Main Application Entry Point
 */

const App = {
    DESKTOP_MIN_WIDTH: 1024,
    pythonWindowOpen: false,
    editorWindowOpen: false,

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

        openPythonBtn.addEventListener('click', () => {
            this.openPythonWindow();
        });

        openEditorBtn.addEventListener('click', () => {
            this.openEditorWindow();
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
    }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
