export const GAME_EVENTS = Object.freeze({
    LOOP_STARTED: "game:loop_started",
    LOOP_STOPPED: "game:loop_stopped",
    LOOP_SKIPPED: "game:loop_skipped",
    TURN_TICK: "game:turn_tick",
    PLAYER_HIT: "combat:player_hit",
    PLAYER_DODGE: "combat:player_dodge",
    PLAYER_BLOCK: "combat:player_block",
    ENEMY_HIT: "combat:enemy_hit",
    ENEMY_DODGE: "combat:enemy_dodge",
    ENEMY_BLOCK: "combat:enemy_block",
    LEVEL_STARTED: "game:level_started",
    BATTLE_WON: "game:battle_won",
    BATTLE_LOST: "game:battle_lost"
});

export function createEventBus() {
    const listeners = new Map();

    function on(eventName, handler) {
        if (!listeners.has(eventName)) {
            listeners.set(eventName, new Set());
        }
        listeners.get(eventName).add(handler);

        return () => off(eventName, handler);
    }

    function once(eventName, handler) {
        const unsubscribe = on(eventName, payload => {
            unsubscribe();
            handler(payload);
        });

        return unsubscribe;
    }

    function off(eventName, handler) {
        const handlers = listeners.get(eventName);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) {
            listeners.delete(eventName);
        }
    }

    function emit(eventName, payload) {
        const handlers = listeners.get(eventName);
        if (!handlers || handlers.size === 0) return;

        for (const handler of handlers) {
            handler(payload);
        }
    }

    return {
        on,
        once,
        off,
        emit
    };
}
