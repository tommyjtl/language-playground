/**
 * Python Editor - ACE editor embedded in window
 */

import CodeStorage from './code-storage.js';
import KeyBindings from './keybindings.js';
import DebugLogger from './debug-logger.js';

const PythonEditor = {
    editor: null,
    _onResize: null,
    _onChange: null,
    runBtn: null,
    saveBtn: null,
    statusEl: null,
    storage: null,
    saveToLocal: false,
    keyBindings: null,

    /**
     * Initialize editor in a container
     * @param {HTMLElement} container - The container element
     * @param {Object} options - Editor options
     */
    init(container, options = {}) {
        const {
            initialText = '',
            onRun = null,
            storageKey = 'pythonEditorCode'
        } = options;

        if (typeof ace === 'undefined') {
            container.innerHTML = '<div class="terminal-loading"><span>ACE editor failed to load.</span></div>';
            DebugLogger.log('ACE editor script not available');
            return;
        }

        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'editor-wrapper';

        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';

        const runBtn = document.createElement('button');
        runBtn.className = 'editor-run-btn';
        runBtn.textContent = 'Run';
        runBtn.disabled = !onRun;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'editor-save-btn';
        saveBtn.textContent = 'Save';

        const statusEl = document.createElement('div');
        statusEl.className = 'editor-status';
        statusEl.textContent = '';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'editor-toolbar-left';
        leftGroup.appendChild(runBtn);
        leftGroup.appendChild(saveBtn);

        toolbar.appendChild(leftGroup);
        toolbar.appendChild(statusEl);

        const editorEl = document.createElement('div');
        editorEl.className = 'editor-host';
        editorEl.id = `ace-editor-${Date.now()}`;

        wrapper.appendChild(toolbar);
        wrapper.appendChild(editorEl);
        container.appendChild(wrapper);

        this.editor = ace.edit(editorEl, {
            theme: 'ace/theme/monokai',
            mode: 'ace/mode/python',
            showPrintMargin: false,
            wrap: true
        });
        // Disable Ace's default Ctrl/Cmd+L "goto line" prompt.
        this.editor.commands.removeCommand('gotoline');

        this.storage = new CodeStorage(storageKey);

        let startingText = initialText;
        if (this.storage) {
            const stored = this.storage.load();
            if (stored !== null) {
                startingText = stored;
            }
        }

        this.editor.session.setValue(startingText);
        this.editor.setOptions({
            fontSize: '13px',
            tabSize: 4,
            useSoftTabs: true
        });

        this._onChange = () => {
            if (this.saveToLocal) {
                this.saveToStorage();
            }
        };
        this.editor.session.on('change', this._onChange);

        this.runBtn = runBtn;
        this.saveBtn = saveBtn;
        this.statusEl = statusEl;
        this.setStatus(onRun ? 'Ready' : 'Not ready');

        this.keyBindings = new KeyBindings(window);
        this.keyBindings.add({
            combo: ['Command+S', 'Ctrl+S'],
            handler: () => this.toggleSaveToLocal(),
            when: () => this.editor && this.editor.isFocused()
        });
        this.keyBindings.add({
            combo: ['Command+R', 'Ctrl+R'],
            handler: () => {
                if (onRun && !runBtn.disabled) {
                    runBtn.click();
                }
            },
            when: () => this.editor && this.editor.isFocused()
        });

        saveBtn.addEventListener('click', () => {
            this.toggleSaveToLocal();
        });

        runBtn.addEventListener('click', async () => {
            if (!onRun || runBtn.disabled) {
                return;
            }

            try {
                runBtn.disabled = true;
                runBtn.textContent = 'Running...';
                this.setStatus('Running...');
                const result = onRun();
                if (result && typeof result.then === 'function') {
                    await result;
                }
            } catch (error) {
                DebugLogger.log(`Editor run interrupted: ${error.message}`);
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = 'Run';
                this.setStatus('Ready');
            }
        });

        this._onResize = () => {
            if (this.editor) {
                this.editor.resize();
            }
        };
        window.addEventListener('resize', this._onResize);
    },

    /**
     * Get the current editor contents
     * @returns {string}
     */
    getValue() {
        if (!this.editor) {
            return '';
        }
        return this.editor.getValue();
    },


    /**
     * Toggle auto-save to localStorage
     */
    toggleSaveToLocal() {
        this.saveToLocal = !this.saveToLocal;
        if (this.saveToLocal) {
            this.saveToStorage();
        }
    },

    /**
     * Persist editor contents to localStorage
     */
    saveToStorage() {
        if (!this.storage || !this.editor) {
            return;
        }
        this.storage.save(this.editor.getValue());
    },

    /**
     * Set editor status text
     * @param {string} status
     */
    setStatus(status) {
        if (this.statusEl) {
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
        }
    },

    /**
     * Cleanup resources
     */
    destroy() {
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this.editor && this._onChange) {
            if (typeof this.editor.session.off === 'function') {
                this.editor.session.off('change', this._onChange);
            } else if (typeof this.editor.session.removeListener === 'function') {
                this.editor.session.removeListener('change', this._onChange);
            }
            this._onChange = null;
        }
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
        this.runBtn = null;
        this.saveBtn = null;
        this.statusEl = null;
        this.storage = null;
        this.saveToLocal = false;
        if (this.keyBindings) {
            this.keyBindings.destroy();
            this.keyBindings = null;
        }
    }
};

export default PythonEditor;
