import { CombatManager } from "../core/combatManager.js";

function wrapAsync(fn, before, after) {
    if (typeof fn !== "function") return fn;
    return async function wrapped(...args) {
        if (typeof before === "function") before(...args);
        try {
            return await fn(...args);
        } finally {
            if (typeof after === "function") after(...args);
        }
    };
}

export function createLegacyCombatAdapter({ legacySystem, manager = new CombatManager() }) {
    if (!legacySystem || typeof legacySystem !== "object") {
        return { manager };
    }

    const adapted = { ...legacySystem, manager };

    if (typeof legacySystem.startBattleLoop === "function") {
        adapted.startBattleLoop = (...args) => {
            manager.startCombat({ round: 1, activeTeam: "player" });
            return legacySystem.startBattleLoop(...args);
        };
    }

    adapted.playerAttacks = wrapAsync(
        legacySystem.playerAttacks,
        () => manager.startTurn({ activeTeam: "player" }),
        () => manager.endTurn()
    );

    adapted.enemyAttacks = wrapAsync(
        legacySystem.enemyAttacks,
        () => manager.startTurn({ activeTeam: "enemy" }),
        () => manager.endTurn()
    );

    if (typeof legacySystem.handleWin === "function") {
        adapted.handleWin = (...args) => {
            manager.endCombat({ winnerId: "player", reason: "victory" });
            return legacySystem.handleWin(...args);
        };
    }

    if (typeof legacySystem.handleLoss === "function") {
        adapted.handleLoss = (...args) => {
            manager.endCombat({ winnerId: "enemy", reason: "defeat" });
            return legacySystem.handleLoss(...args);
        };
    }

    return adapted;
}

