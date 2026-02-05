/**
 * Pyodide Web Worker
 * Loads and runs Pyodide in a separate thread
 */

import { MessageType, StatusMessage, createStatusMessage, createReadyMessage, createErrorMessage, createDoneMessage } from './worker-messages.js';

let pyodide = null;
let pyconsole = null;
let awaitFut = null;
let reprShorten = null;

// Load Pyodide
async function loadPyodideInstance() {
    const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

    try {
        self.postMessage(createStatusMessage(StatusMessage.FETCHING_PYODIDE));

        const { loadPyodide } = await import(indexURL + 'pyodide.mjs');

        self.postMessage(createStatusMessage(StatusMessage.INITIALIZING));

        pyodide = await loadPyodide({
            indexURL: indexURL,
            stdin: () => {
                // We can't use prompt() in a worker, so we'll handle this differently
                return '';
            }
        });

        // Import console utilities
        const consoleModule = pyodide.pyimport('pyodide.console');
        reprShorten = consoleModule.repr_shorten;
        const BANNER = `Welcome to Pyodide ${pyodide.version} terminal emulator 🐍\n` +
            consoleModule.BANNER;
        pyconsole = consoleModule.PyodideConsole(pyodide.globals);

        // Setup await_fut helper
        const namespace = pyodide.globals.get('dict')();
        awaitFut = pyodide.runPython(`
import builtins
from pyodide.ffi import to_js

async def await_fut(fut):
    res = await fut
    if res is not None:
        builtins._ = res
    return to_js([res], depth=1)

await_fut
        `, { globals: namespace });
        namespace.destroy();

        self.postMessage(createReadyMessage({ banner: BANNER }));
    } catch (error) {
        self.postMessage(createErrorMessage(error.message));
    }
}

// Handle incoming messages
self.onmessage = async function (e) {
    const { type, data } = e.data;

    switch (type) {
        case MessageType.INIT:
            await loadPyodideInstance();
            break;

        case 'execute':
            if (!pyodide || !pyconsole) {
                self.postMessage(createErrorMessage('Pyodide not initialized'));
                return;
            }

            try {
                const { command } = data;
                const lines = command.split('\n');

                for (const line of lines) {
                    const escaped = line.replace(/\u00a0/g, ' ');
                    const fut = pyconsole.push(escaped);

                    self.postMessage({
                        type: MessageType.PROMPT,
                        prompt: fut.syntax_check === 'incomplete' ? '... ' : '>>> '
                    });

                    switch (fut.syntax_check) {
                        case 'syntax-error':
                            self.postMessage(createErrorMessage(fut.formatted_error.trimEnd()));
                            continue;

                        case 'incomplete':
                            continue;

                        case 'complete':
                            break;

                        default:
                            throw new Error(`Unexpected type ${fut.syntax_check}`);
                    }

                    const wrapped = awaitFut(fut);

                    try {
                        const [value] = await wrapped;
                        if (value !== undefined) {
                            const output = reprShorten.callKwargs(value, {
                                separator: '\n<long output truncated>\n',
                            });
                            self.postMessage({
                                type: MessageType.OUTPUT,
                                message: output
                            });
                        }
                        if (value && typeof value.destroy === 'function') {
                            value.destroy();
                        }
                    } catch (e) {
                        if (e.constructor.name === 'PythonError') {
                            const message = fut.formatted_error || e.message;
                            self.postMessage(createErrorMessage(message.trimEnd()));
                        } else {
                            throw e;
                        }
                    } finally {
                        fut.destroy();
                        wrapped.destroy();
                    }
                }

                self.postMessage(createDoneMessage());
            } catch (error) {
                self.postMessage(createErrorMessage(error.message));
            }
            break;

        case MessageType.COMPLETE:
            if (!pyodide || !pyconsole) {
                self.postMessage({
                    type: MessageType.COMPLETIONS,
                    completions: []
                });
                return;
            }

            try {
                const { command } = data;
                const completions = pyconsole.complete(command).toJs()[0];
                self.postMessage({
                    type: MessageType.COMPLETIONS,
                    completions: completions
                });
            } catch (error) {
                self.postMessage({
                    type: MessageType.COMPLETIONS,
                    completions: []
                });
            }
            break;

        case 'interrupt':
            if (pyconsole && pyconsole.buffer) {
                pyconsole.buffer.clear();
                self.postMessage({
                    type: MessageType.INTERRUPTED
                });
            }
            break;
    }
};
