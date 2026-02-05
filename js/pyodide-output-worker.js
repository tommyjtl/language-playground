/**
 * Pyodide Output Worker
 * Runs full Python scripts and streams stdout/stderr
 */

let pyodide = null;
let runCode = null;

async function loadPyodideInstance() {
    const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

    try {
        self.postMessage({ type: 'status', message: 'Fetching pyodide.mjs...' });

        const { loadPyodide } = await import(indexURL + 'pyodide.mjs');

        self.postMessage({ type: 'status', message: 'Initializing Python runtime...' });

        pyodide = await loadPyodide({
            indexURL: indexURL,
            stdout: (text) => {
                if (text) {
                    self.postMessage({ type: 'stream', stream: 'stdout', text });
                }
            },
            stderr: (text) => {
                if (text) {
                    self.postMessage({ type: 'stream', stream: 'stderr', text });
                }
            }
        });

        pyodide.runPython(`
import builtins
import runpy
import sys
import traceback
from js import Object, postMessage


class JSStream:
    def __init__(self, stream):
        self.stream = stream

    def write(self, s):
        if s:
            msg = Object.new()
            msg.type = "stream"
            msg.stream = self.stream
            msg.text = s
            postMessage(msg)
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return False


def _run_code(code: str):
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    old_argv = sys.argv
    old_input = builtins.input
    exit_code = 0
    exc_text = ""

    def _no_input(*args, **kwargs):
        raise RuntimeError("input() is not supported yet.")

    try:
        sys.stdout = JSStream("stdout")
        sys.stderr = JSStream("stderr")
        sys.argv = ["code.py"]
        builtins.input = _no_input

        path = "/tmp/code.py"
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)

        try:
            runpy.run_path(path, run_name="__main__")
        except SystemExit as e:
            if isinstance(e.code, int):
                exit_code = e.code
            elif e.code in (None, 0):
                exit_code = 0
            else:
                exit_code = 1
            if e.code not in (None, 0):
                print(f"SystemExit: {e.code}", file=sys.stderr)
    except Exception:
        exc_text = traceback.format_exc()
        print(exc_text, file=sys.stderr, end="")
        exit_code = 1
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        sys.argv = old_argv
        builtins.input = old_input

    return exit_code, exc_text
        `);

        runCode = pyodide.globals.get('_run_code');

        self.postMessage({
            type: 'ready'
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message
        });
    }
}

self.onmessage = async function (e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            await loadPyodideInstance();
            break;

        case 'run':
            if (!pyodide || !runCode) {
                self.postMessage({
                    type: 'error',
                    message: 'Python runtime not initialized'
                });
                return;
            }

            try {
                const { code } = data;
                const result = runCode(code);
                const [exitCode, exception] = result.toJs();
                result.destroy();

                self.postMessage({
                    type: 'result',
                    exception: exception || '',
                    exitCode: Number.isFinite(exitCode) ? exitCode : 0
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    message: error.message
                });
            } finally {
                self.postMessage({ type: 'done' });
            }
            break;
    }
};
