export function createPassiveEventHandler({ skill, eventName, rank, runtime }) {
    return payload => {
        if (!skill || typeof skill.executeCallback !== "function") return;
        const battleState = runtime && runtime.currentGameStats ? runtime.currentGameStats.battleState : null;
        const activeTurnOwner = battleState ? battleState.turnOwner : null;
        // Optional owner-based gating for future player/enemy-specific skill callbacks.
        if (skill.turnOwner && activeTurnOwner && skill.turnOwner !== activeTurnOwner) return;

        skill.executeCallback({
            eventName,
            payload,
            rank,
            runtime
        });
    };
}
