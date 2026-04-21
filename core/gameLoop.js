import { GAME_EVENTS } from "./eventBus.js";

export function createGameLoop({
    eventBus,
    onTick,
    getIsPaused,
    getIsAnimating,
    intervalMs = 1000
}) {
    let intervalId = null;

    function tick() {
        if (getIsPaused()) {
            eventBus.emit(GAME_EVENTS.LOOP_SKIPPED, { reason: "paused" });
            return;
        }

        if (getIsAnimating()) {
            eventBus.emit(GAME_EVENTS.LOOP_SKIPPED, { reason: "animating" });
            return;
        }

        eventBus.emit(GAME_EVENTS.TURN_TICK, { timestamp: Date.now() });
        onTick();
    }

    function start() {
        stop();
        intervalId = setInterval(tick, intervalMs);
        eventBus.emit(GAME_EVENTS.LOOP_STARTED, { intervalMs });
    }

    function stop() {
        if (!intervalId) return;
        clearInterval(intervalId);
        intervalId = null;
        eventBus.emit(GAME_EVENTS.LOOP_STOPPED, null);
    }

    function isRunning() {
        return intervalId !== null;
    }

    return {
        start,
        stop,
        tick,
        isRunning
    };
}

export function createBattleGameLoop({
    eventBus,
    getIsPaused,
    getIsAnimating,
    applySkillTreeTurnEffects,
    recalculateStats,
    updatePlayerUI,
    getRegenRate,
    getIsPlayerTurn,
    canApplyRegen,
    applyRegen,
    applyEnemyTurnDots,
    onEnemyDefeatedByDots,
    playerAttacks,
    enemyAttacks,
    intervalMs = 1000
}) {
    function runTurn() {
        if (applySkillTreeTurnEffects()) return;

        recalculateStats();
        updatePlayerUI();

        const regenRate = getRegenRate();
        if (getIsPlayerTurn() && regenRate > 0 && canApplyRegen()) {
            applyRegen(regenRate);
            updatePlayerUI();
        }

        if (applyEnemyTurnDots()) {
            onEnemyDefeatedByDots();
            return;
        }

        if (getIsPlayerTurn()) playerAttacks();
        else enemyAttacks();
    }

    return createGameLoop({
        eventBus,
        onTick: runTurn,
        getIsPaused,
        getIsAnimating,
        intervalMs
    });
}
