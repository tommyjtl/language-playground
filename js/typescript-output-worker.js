/**
 * TypeScript Output Worker
 * Compiles and runs TypeScript scripts, streaming console output.
 */

let tsCompiler = null;
let compilerOptions = null;
let isReady = false;
let consolePatched = false;
let pendingTasks = 0;
let idleResolve = null;
let idlePromise = null;
let idleTimer = null;
let originalTimers = null;
const activeTimeouts = new Set();
const activeIntervals = new Set();

function postStatus(message) {
    self.postMessage({ type: 'status', message });
}

function postError(message) {
    self.postMessage({ type: 'error', message });
}

function patchConsole() {
    if (consolePatched) {
        return;
    }
    consolePatched = true;
    const original = self.console;
    const emit = (stream, args) => {
        const text = formatArgs(args);
        if (text) {
            self.postMessage({ type: 'stream', stream, text: text + '\n' });
        }
    };
    self.console = {
        ...original,
        log: (...args) => emit('stdout', args),
        info: (...args) => emit('stdout', args),
        warn: (...args) => emit('stderr', args),
        error: (...args) => emit('stderr', args)
    };
}

function wrapTimers() {
    if (originalTimers) {
        return;
    }
    originalTimers = {
        setTimeout: self.setTimeout.bind(self),
        clearTimeout: self.clearTimeout.bind(self),
        setInterval: self.setInterval.bind(self),
        clearInterval: self.clearInterval.bind(self)
    };

    self.setTimeout = (handler, timeout, ...args) => {
        const id = originalTimers.setTimeout(() => {
            const wasActive = activeTimeouts.has(id);
            if (wasActive) {
                activeTimeouts.delete(id);
            }
            try {
                if (typeof handler === 'function') {
                    handler(...args);
                } else {
                    (0, eval)(String(handler));
                }
            } finally {
                if (wasActive) {
                    updatePending(-1);
                }
            }
        }, timeout);
        activeTimeouts.add(id);
        updatePending(1);
        return id;
    };

    self.clearTimeout = (id) => {
        if (activeTimeouts.has(id)) {
            activeTimeouts.delete(id);
            updatePending(-1);
        }
        return originalTimers.clearTimeout(id);
    };

    self.setInterval = (handler, timeout, ...args) => {
        const id = originalTimers.setInterval(() => {
            if (typeof handler === 'function') {
                handler(...args);
            } else {
                (0, eval)(String(handler));
            }
        }, timeout);
        activeIntervals.add(id);
        updatePending(1);
        return id;
    };

    self.clearInterval = (id) => {
        if (activeIntervals.has(id)) {
            activeIntervals.delete(id);
            updatePending(-1);
        }
        return originalTimers.clearInterval(id);
    };
}

function updatePending(delta) {
    pendingTasks = Math.max(0, pendingTasks + delta);
    if (pendingTasks === 0) {
        scheduleIdleResolve();
    } else if (idleTimer && originalTimers) {
        originalTimers.clearTimeout(idleTimer);
        idleTimer = null;
    }
}

function scheduleIdleResolve() {
    if (!idleResolve || !originalTimers) {
        return;
    }
    if (idleTimer) {
        originalTimers.clearTimeout(idleTimer);
    }
    idleTimer = originalTimers.setTimeout(() => {
        if (pendingTasks === 0 && idleResolve) {
            const resolve = idleResolve;
            idleResolve = null;
            idlePromise = null;
            idleTimer = null;
            resolve();
        }
    }, 50);
}

function waitForIdle() {
    if (!idlePromise) {
        idlePromise = new Promise((resolve) => {
            idleResolve = resolve;
            if (pendingTasks === 0) {
                scheduleIdleResolve();
            }
        });
    }
    return idlePromise;
}

function resetPendingTasks() {
    if (!originalTimers) {
        return;
    }
    for (const id of activeTimeouts) {
        originalTimers.clearTimeout(id);
    }
    for (const id of activeIntervals) {
        originalTimers.clearInterval(id);
    }
    activeTimeouts.clear();
    activeIntervals.clear();
    pendingTasks = 0;
    if (idleTimer) {
        originalTimers.clearTimeout(idleTimer);
        idleTimer = null;
    }
    idleResolve = null;
    idlePromise = null;
}

function formatArgs(args) {
    return args.map(formatValue).join(' ');
}

function formatValue(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return String(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
}

function loadTypeScript() {
    if (tsCompiler) {
        return;
    }
    postStatus('Loading TS compiler...');
    try {
        importScripts('vendor/typescript.js');
        tsCompiler = self.ts;
        if (!tsCompiler) {
            throw new Error('TypeScript compiler not found after loading script.');
        }
        postStatus('TypeScript compiler ready (local)');
    } catch (error) {
        throw new Error(
            `Failed to load local TypeScript compiler (js/vendor/typescript.js). ${error && error.message ? error.message : String(error)
            }`
        );
    }
}

const TS_COMPILER_CONFIG = {
    target: 'ES2024',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2024', 'DOM', 'DOM.Iterable'],
    esModuleInterop: true,
    isolatedModules: true,
    useDefineForClassFields: true,
    strict: false,
    allowJs: true,
    checkJs: false
};

function getDefaultCompilerOptions() {
    const target = tsCompiler.ScriptTarget.ES2024
        || tsCompiler.ScriptTarget.ES2023
        || tsCompiler.ScriptTarget.ES2022;
    const moduleKind = tsCompiler.ModuleKind.ESNext
        || tsCompiler.ModuleKind.ES2020
        || tsCompiler.ModuleKind.ES2015;
    const moduleResolution = tsCompiler.ModuleResolutionKind.Bundler
        || tsCompiler.ModuleResolutionKind.NodeNext
        || tsCompiler.ModuleResolutionKind.Node16
        || tsCompiler.ModuleResolutionKind.NodeJs;

    return {
        target,
        module: moduleKind,
        moduleResolution,
        esModuleInterop: true,
        isolatedModules: true,
        useDefineForClassFields: true,
        alwaysStrict: false
    };
}

function getCompilerOptions() {
    return compilerOptions || getDefaultCompilerOptions();
}

async function loadCompilerOptions() {
    compilerOptions = getDefaultCompilerOptions();
}

function compileSource(source, fileName) {
    return tsCompiler.transpileModule(source, {
        compilerOptions: getCompilerOptions(),
        reportDiagnostics: true,
        fileName
    });
}

function formatDiagnostics(diagnostics, fileName) {
    if (!diagnostics || !diagnostics.length) {
        return '';
    }
    return diagnostics.map((diagnostic) => {
        const message = tsCompiler.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        if (diagnostic.file && typeof diagnostic.start === 'number') {
            const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            return `${diagnostic.file.fileName || fileName} (${position.line + 1},${position.character + 1}): ${message}`;
        }
        return message;
    }).join('\n');
}

function hasErrorDiagnostics(diagnostics) {
    return (diagnostics || []).some((diagnostic) => diagnostic.category === tsCompiler.DiagnosticCategory.Error);
}

function isExternalModuleSource(source, fileName) {
    const sourceFile = tsCompiler.createSourceFile(fileName, source, tsCompiler.ScriptTarget.Latest, true, tsCompiler.ScriptKind.TS);
    return tsCompiler.isExternalModule(sourceFile);
}

async function executeModule(js) {
    const blob = new Blob([js, '\n//# sourceURL=ts-output-module.js'], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
        await import(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

function executeScript(js) {
    (0, eval)(`${js}\n//# sourceURL=ts-output.js`);
}

async function runSource(source) {
    const fileName = 'output.ts';
    const isModule = isExternalModuleSource(source, fileName);
    const result = compileSource(source, fileName);
    if (hasErrorDiagnostics(result.diagnostics)) {
        const errorText = formatDiagnostics(result.diagnostics, fileName);
        throw new Error(errorText || 'TypeScript compile error');
    }

    if (isModule) {
        await executeModule(result.outputText);
    } else {
        const value = executeScript(result.outputText);
        if (value && typeof value.then === 'function') {
            await value;
        }
    }
}

self.onmessage = async function (event) {
    const { type, data } = event.data;

    switch (type) {
        case 'init':
            try {
                loadTypeScript();
                patchConsole();
                wrapTimers();
                await loadCompilerOptions();
                isReady = true;
                self.postMessage({ type: 'ready' });
            } catch (error) {
                postError(error && error.message ? error.message : String(error));
            }
            break;

        case 'run':
            if (!isReady) {
                postError('TypeScript runtime not initialized');
                return;
            }
            try {
                resetPendingTasks();
                const code = String(data && data.code ? data.code : '');
                await runSource(code);
                await waitForIdle();
                self.postMessage({ type: 'result', exception: '', exitCode: 0 });
            } catch (error) {
                postError(error && error.message ? error.message : String(error));
            } finally {
                self.postMessage({ type: 'done' });
            }
            break;

        default:
            break;
    }
};

// TODO: For richer diagnostics and type-checking, switch to tsCompiler.createProgram.
