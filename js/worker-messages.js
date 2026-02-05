/**
 * Worker Message Types and Constants
 * Shared constants for all web workers
 */

// Message Types
export const MessageType = {
    // Initialization
    INIT: 'init',
    STATUS: 'status',
    READY: 'ready',

    // Execution
    RUN: 'run',
    OUTPUT: 'output',
    STREAM: 'stream',
    RESULT: 'result',
    DONE: 'done',

    // Error handling
    ERROR: 'error',

    // REPL specific
    PROMPT: 'prompt',
    COMPLETIONS: 'completions',
    INTERRUPTED: 'interrupted',
    COMPLETE: 'complete'
};

// Status Messages
export const StatusMessage = {
    FETCHING_PYODIDE: 'Fetching pyodide.mjs...',
    INITIALIZING: 'Initializing...',
    LOADING_RUNTIME: 'Loading Python runtime...',
    READY: 'Ready',
    CREATING_WORKER: 'Creating worker...',
    NOT_INITIALIZED: 'Python runtime not initialized'
};

// Stream Types
export const StreamType = {
    STDOUT: 'stdout',
    STDERR: 'stderr'
};

// Helper function to create a status message
export function createStatusMessage(message) {
    return { type: MessageType.STATUS, message };
}

// Helper function to create an error message
export function createErrorMessage(message) {
    return { type: MessageType.ERROR, message };
}

// Helper function to create a ready message
export function createReadyMessage(data = {}) {
    return { type: MessageType.READY, ...data };
}

// Helper function to create a stream message
export function createStreamMessage(stream, text) {
    return { type: MessageType.STREAM, stream, text };
}

// Helper function to create a result message
export function createResultMessage(data) {
    return { type: MessageType.RESULT, ...data };
}

// Helper function to create a done message
export function createDoneMessage() {
    return { type: MessageType.DONE };
}

// Worker Status Type to CSS Class Mapping
export const WorkerStatusClass = {
    READY: 'status-ready',
    INITIALIZING: 'status-initializing',
    LOADING: 'status-loading',
    ERROR: 'status-error',
    NOT_INITIALIZED: 'status-not-initialized'
};

// Map status messages to CSS classes
export function getStatusClass(statusMessage) {
    if (statusMessage === StatusMessage.READY) {
        return WorkerStatusClass.READY;
    }
    if (statusMessage === StatusMessage.INITIALIZING ||
        statusMessage === StatusMessage.CREATING_WORKER) {
        return WorkerStatusClass.INITIALIZING;
    }
    if (statusMessage === StatusMessage.FETCHING_PYODIDE ||
        statusMessage === StatusMessage.LOADING_RUNTIME) {
        return WorkerStatusClass.LOADING;
    }
    if (statusMessage === StatusMessage.NOT_INITIALIZED) {
        return WorkerStatusClass.NOT_INITIALIZED;
    }
    // Check for error-like patterns
    if (statusMessage && statusMessage.toLowerCase().includes('error')) {
        return WorkerStatusClass.ERROR;
    }
    return WorkerStatusClass.NOT_INITIALIZED;
}
