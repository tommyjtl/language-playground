/**
 * TypeScript REPL Worker
 * Compiles and executes TypeScript snippets with persistent state.
 */

let tsCompiler = null;
let compilerOptions = null;
let buffer = '';
let busy = false;
let consolePatched = false;
const exportsCache = Object.create(null);

const DEFAULT_PROMPT = 'ts> ';
const CONTINUATION_PROMPT = '... ';

function postStatus(message) {
    self.postMessage({ type: 'status', message });
}

function postOutput(message) {
    self.postMessage({ type: 'output', message });
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
            self.postMessage({ type: 'output', message: text, stream });
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
    postStatus('Loading TypeScript compiler...');
    try {
        const compilerUrl = new URL('../vendor/ts-compiler/typescript.js', self.location.href).toString();
        importScripts(compilerUrl);
        tsCompiler = self.ts;
        if (!tsCompiler) {
            throw new Error('TypeScript compiler not found after loading script.');
        }
        postStatus('TypeScript compiler ready (local)');
    } catch (error) {
        throw new Error(
            `Failed to load local TypeScript compiler (js/vendor/ts-compiler/typescript.js). ${error && error.message ? error.message : String(error)}`
        );
    }
}

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

function isInputComplete(source) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inBlockComment = false;
    let inLineComment = false;
    let escaped = false;

    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];

        if (inLineComment) {
            if (char === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && next === '/') {
                inBlockComment = false;
                i += 1;
            }
            continue;
        }

        if (inSingle) {
            if (!escaped && char === '\\') {
                escaped = true;
                continue;
            }
            if (!escaped && char === '\'') {
                inSingle = false;
            }
            escaped = false;
            continue;
        }

        if (inDouble) {
            if (!escaped && char === '\\') {
                escaped = true;
                continue;
            }
            if (!escaped && char === '"') {
                inDouble = false;
            }
            escaped = false;
            continue;
        }

        if (inTemplate) {
            if (!escaped && char === '\\') {
                escaped = true;
                continue;
            }
            if (!escaped && char === '`') {
                inTemplate = false;
            }
            escaped = false;
            continue;
        }

        if (char === '/' && next === '/') {
            inLineComment = true;
            i += 1;
            continue;
        }

        if (char === '/' && next === '*') {
            inBlockComment = true;
            i += 1;
            continue;
        }

        if (char === '\'') {
            inSingle = true;
            continue;
        }

        if (char === '"') {
            inDouble = true;
            continue;
        }

        if (char === '`') {
            inTemplate = true;
            continue;
        }

        if (char === '{' || char === '(' || char === '[') {
            depth += 1;
            continue;
        }

        if (char === '}' || char === ')' || char === ']') {
            depth -= 1;
        }
    }

    return depth <= 0 && !inSingle && !inDouble && !inTemplate && !inBlockComment;
}

function isValidIdentifier(name) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function defineGlobal(name, value) {
    exportsCache[name] = value;
    self.__ts_repl_exports = exportsCache;
    if (isValidIdentifier(name)) {
        try {
            (0, eval)(`var ${name} = self.__ts_repl_exports[${JSON.stringify(name)}];`);
        } catch (error) {
            // Ignore failures for invalid identifiers or eval errors.
        }
    }
}

async function executeModule(js) {
    const blob = new Blob([js, '\n//# sourceURL=ts-repl-module.js'], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
        const namespace = await import(url);
        if (namespace && typeof namespace === 'object') {
            Object.keys(namespace).forEach((key) => {
                defineGlobal(key, namespace[key]);
            });
        }
    } finally {
        URL.revokeObjectURL(url);
    }
}

function executeScript(js) {
    return (0, eval)(`${js}\n//# sourceURL=ts-repl.js`);
}

async function executeSource(source, fileName) {
    const isModule = isExternalModuleSource(source, fileName);
    const result = compileSource(source, fileName);
    if (hasErrorDiagnostics(result.diagnostics)) {
        const errorText = formatDiagnostics(result.diagnostics, fileName);
        postError(errorText || 'TypeScript compile error');
        return;
    }

    if (isModule) {
        await executeModule(result.outputText);
    } else {
        const value = executeScript(result.outputText);
        if (value !== undefined) {
            postOutput(formatValue(value));
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
                await loadCompilerOptions();
                self.postMessage({ type: 'ready', prompt: DEFAULT_PROMPT });
            } catch (error) {
                postError(error && error.message ? error.message : String(error));
            }
            break;

        case 'execute': {
            if (busy) {
                return;
            }
            busy = true;
            try {
                const command = String(data && data.command ? data.command : '');
                buffer = buffer ? `${buffer}\n${command}` : command;
                if (!isInputComplete(buffer)) {
                    self.postMessage({ type: 'prompt', prompt: CONTINUATION_PROMPT });
                    return;
                }
                await executeSource(buffer, 'repl.ts');
                buffer = '';
                self.postMessage({ type: 'prompt', prompt: DEFAULT_PROMPT });
            } catch (error) {
                postError(error && error.message ? error.message : String(error));
                buffer = '';
                self.postMessage({ type: 'prompt', prompt: DEFAULT_PROMPT });
            } finally {
                busy = false;
                self.postMessage({ type: 'done' });
            }
            break;
        }

        case 'interrupt':
            buffer = '';
            self.postMessage({ type: 'prompt', prompt: DEFAULT_PROMPT });
            self.postMessage({ type: 'interrupted' });
            break;

        case 'complete':
            self.postMessage({ type: 'completions', completions: [] });
            break;

        default:
            break;
    }
};

// TODO: For richer diagnostics and type-checking, switch to tsCompiler.createProgram.
