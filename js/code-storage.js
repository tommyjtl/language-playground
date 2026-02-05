/**
 * CodeStorage - Simple localStorage wrapper for editor code
 */
class CodeStorage {
    constructor(key) {
        this.key = key;
        this.value = '';
    }

    load() {
        const stored = localStorage.getItem(this.key);
        if (stored === null) {
            return null;
        }
        this.value = stored;
        return stored;
    }

    save(value) {
        if (typeof value === 'string') {
            this.value = value;
        }
        localStorage.setItem(this.key, this.value);
        return this.value;
    }

    clear() {
        localStorage.removeItem(this.key);
        this.value = '';
    }

    has() {
        return localStorage.getItem(this.key) !== null;
    }
}

window.CodeStorage = CodeStorage;
