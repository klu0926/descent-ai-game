export class CombatEventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(eventName, handler) {
        if (!eventName || typeof handler !== "function") return () => {};
        if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
        const handlers = this.listeners.get(eventName);
        handlers.add(handler);
        return () => this.off(eventName, handler);
    }

    once(eventName, handler) {
        const unsubscribe = this.on(eventName, payload => {
            unsubscribe();
            handler(payload);
        });
        return unsubscribe;
    }

    off(eventName, handler) {
        const handlers = this.listeners.get(eventName);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) this.listeners.delete(eventName);
    }

    emit(eventName, payload) {
        const handlers = this.listeners.get(eventName);
        if (!handlers || handlers.size === 0) return;
        Array.from(handlers).forEach(handler => handler(payload));
    }
}

