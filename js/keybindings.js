/**
 * KeyBindings - Lightweight keyboard shortcut manager
 */
class KeyBindings {
    constructor(target = window) {
        this.target = target;
        this.bindings = [];
        this._onKeyDown = this._onKeyDown.bind(this);
        this.target.addEventListener('keydown', this._onKeyDown, true);
    }

    add(binding) {
        const { combo, handler, preventDefault = true, when = null } = binding;
        const combos = Array.isArray(combo) ? combo : [combo];
        this.bindings.push({
            combos: combos.map(KeyBindings.normalizeCombo),
            handler,
            preventDefault,
            when
        });
    }

    removeAll() {
        this.bindings = [];
    }

    destroy() {
        this.removeAll();
        this.target.removeEventListener('keydown', this._onKeyDown, true);
    }

    _onKeyDown(event) {
        for (const binding of this.bindings) {
            if (typeof binding.when === 'function' && !binding.when(event)) {
                continue;
            }
            const isMatch = binding.combos.some((combo) => KeyBindings.matches(event, combo));
            if (isMatch) {
                if (binding.preventDefault) {
                    event.preventDefault();
                }
                binding.handler(event);
                break;
            }
        }
    }

    static normalizeCombo(combo) {
        const parts = String(combo)
            .split('+')
            .map((part) => part.trim().toLowerCase())
            .filter(Boolean);
        const normalized = {
            key: '',
            ctrl: false,
            meta: false,
            alt: false,
            shift: false
        };
        for (const part of parts) {
            if (part === 'ctrl' || part === 'control') {
                normalized.ctrl = true;
            } else if (part === 'cmd' || part === 'command' || part === 'meta') {
                normalized.meta = true;
            } else if (part === 'alt' || part === 'option') {
                normalized.alt = true;
            } else if (part === 'shift') {
                normalized.shift = true;
            } else {
                normalized.key = part;
            }
        }
        return normalized;
    }

    static matches(event, combo) {
        const key = String(event.key || '').toLowerCase();
        if (combo.key && combo.key !== key) {
            return false;
        }
        if (combo.ctrl !== event.ctrlKey) {
            return false;
        }
        if (combo.meta !== event.metaKey) {
            return false;
        }
        if (combo.alt !== event.altKey) {
            return false;
        }
        if (combo.shift !== event.shiftKey) {
            return false;
        }
        return true;
    }
}

export default KeyBindings;
