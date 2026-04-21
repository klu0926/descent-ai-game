import { tickAppliedStatusSkills } from "./skill.js";

export function createPassiveSkillManager({
    eventBus,
    gameEvents,
    getActivePlayerClass,
    getSkillRank,
    runtimeContext
}) {
    const activeSkills = new Map();
    const durationExpiredSkillIds = new Set();
    const runtimeWithOwner = {
        ...runtimeContext,
        skillOwner: "player"
    };

    function getPassiveSkillNodes() {
        const activeClass = getActivePlayerClass();
        if (!activeClass || !activeClass.skillTree || !Array.isArray(activeClass.skillTree.nodes)) return [];
        return activeClass.skillTree.nodes.filter(skill => {
            const type = String(skill && skill.skillType || "").trim().toLowerCase();
            return type === "passive" || type === "buff" || type === "debuff";
        });
    }

    function deactivateSkill(skillId) {
        const active = activeSkills.get(skillId);
        if (!active) return;
        active.unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === "function") unsubscribe();
        });
        if (typeof active.skill.onDeactivate === "function") {
            active.skill.onDeactivate({
                rank: active.rank,
                runtime: runtimeWithOwner
            });
        }
        activeSkills.delete(skillId);
    }

    function activateSkill(skill, rank) {
        const unsubscribers = [];
        const durationTurns = Math.max(0, Math.floor(Number(skill && skill.durationTurns) || 0));
        const battleState = runtimeContext && runtimeContext.currentGameStats
            ? runtimeContext.currentGameStats.battleState
            : null;
        const activationPlayerTurnCount = Math.max(0, Math.floor(Number(battleState && battleState.playerTurnCount) || 0));
        const expiresAfterPlayerTurn = durationTurns > 0 ? activationPlayerTurnCount + durationTurns : 0;

        if (typeof skill.onActivate === "function") {
            skill.onActivate({
                rank,
                runtime: runtimeWithOwner
            });
        }

        if (typeof skill.createEventHandlers === "function") {
            const handlers = skill.createEventHandlers({
                rank,
                runtime: {
                    ...runtimeWithOwner,
                    GAME_EVENTS: gameEvents
                }
            }) || {};

            Object.entries(handlers).forEach(([eventName, handler]) => {
                if (!eventName || typeof handler !== "function") return;
                unsubscribers.push(eventBus.on(eventName, payload => {
                    handler(payload);
                }));
            });
        }

        activeSkills.set(skill.id, {
            skill,
            rank,
            unsubscribers,
            durationTurns,
            activationPlayerTurnCount,
            expiresAfterPlayerTurn
        });
    }

    function handleTurnStarted(payload = {}) {
        tickAppliedStatusSkills({ runtime: runtimeWithOwner, payload });
        const owner = String(payload.turnOwner || "").trim().toLowerCase();
        if (owner !== "player") return;
        const playerTurnCount = Math.max(0, Math.floor(Number(payload.playerTurnCount) || 0));
        const expiredSkillIds = [];
        activeSkills.forEach((active, skillId) => {
            const expiresAfter = Math.max(0, Math.floor(Number(active && active.expiresAfterPlayerTurn) || 0));
            if (expiresAfter > 0 && playerTurnCount > expiresAfter) {
                expiredSkillIds.push(skillId);
            }
        });
        expiredSkillIds.forEach(skillId => {
            durationExpiredSkillIds.add(skillId);
            deactivateSkill(skillId);
        });
    }

    function sync() {
        const passiveNodes = getPassiveSkillNodes();
        const expected = new Map();
        const activeClass = getActivePlayerClass();
        const battleState = runtimeContext && runtimeContext.currentGameStats
            ? runtimeContext.currentGameStats.battleState
            : null;
        const playerTurnCount = Math.max(0, Math.floor(Number(battleState && battleState.playerTurnCount) || 0));
        const enemyTurnCount = Math.max(0, Math.floor(Number(battleState && battleState.enemyTurnCount) || 0));
        if (playerTurnCount === 0 && enemyTurnCount === 0 && durationExpiredSkillIds.size > 0) {
            durationExpiredSkillIds.clear();
        }
        const classPassiveIds = new Set(
            Array.isArray(activeClass && activeClass.passiveSkills)
                ? activeClass.passiveSkills.map(id => String(id || "").trim()).filter(Boolean)
                : []
        );

        passiveNodes.forEach(skill => {
            const treeRank = Number(getSkillRank(skill.id)) || 0;
            const classRank = classPassiveIds.has(skill.id) ? 1 : 0;
            const rank = Math.max(treeRank, classRank);
            if (rank > 0 && !durationExpiredSkillIds.has(skill.id)) {
                expected.set(skill.id, {
                    skill,
                    rank
                });
            }
        });

        Array.from(activeSkills.keys()).forEach(skillId => {
            if (!expected.has(skillId)) deactivateSkill(skillId);
        });

        expected.forEach(({ skill, rank }, skillId) => {
            const active = activeSkills.get(skillId);
            if (!active) {
                activateSkill(skill, rank);
                return;
            }
            if (active.rank !== rank) {
                deactivateSkill(skillId);
                activateSkill(skill, rank);
            }
        });

        if (runtimeContext.currentGameStats) {
            const activeList = getActiveSkills();
            runtimeContext.currentGameStats.activePassiveSkills = activeList;
            if (!runtimeContext.currentGameStats.effectState) {
                runtimeContext.currentGameStats.effectState = {
                    player: { activeSkills: [], activeStatuses: [], activePassives: [] },
                    enemy: { activeSkills: [], activeStatuses: [], activePassives: [] }
                };
            }
            if (!runtimeContext.currentGameStats.effectState.player) {
                runtimeContext.currentGameStats.effectState.player = { activeSkills: [], activeStatuses: [], activePassives: [] };
            }
            if (!runtimeContext.currentGameStats.effectState.enemy) {
                runtimeContext.currentGameStats.effectState.enemy = { activeSkills: [], activeStatuses: [], activePassives: [] };
            }
            runtimeContext.currentGameStats.effectState.player.activeSkills = activeList;
            runtimeContext.currentGameStats.effectState.player.activePassives = activeList;
        }
    }

    function getActiveSkills() {
        return Array.from(activeSkills.values()).map(entry => ({
            id: entry.skill.id,
            name: entry.skill.name,
            desc: typeof entry.skill.formatDescription === "function"
                ? String(entry.skill.formatDescription(entry.rank) || "")
                : String(entry.skill.desc || ""),
            image: String(entry.skill.image || ""),
            kind: String(entry.skill.skillType || "").trim().toLowerCase(),
            rank: entry.rank,
            effectTypes: Array.isArray(entry.skill.effectTypes) ? entry.skill.effectTypes : ["generic"]
        }));
    }

    function clear() {
        durationExpiredSkillIds.clear();
        Array.from(activeSkills.keys()).forEach(skillId => deactivateSkill(skillId));
        if (runtimeContext.currentGameStats) {
            runtimeContext.currentGameStats.activePassiveSkills = [];
            if (!runtimeContext.currentGameStats.effectState) {
                runtimeContext.currentGameStats.effectState = {
                    player: { activeSkills: [], activeStatuses: [], activePassives: [] },
                    enemy: { activeSkills: [], activeStatuses: [], activePassives: [] }
                };
            }
            if (!runtimeContext.currentGameStats.effectState.player) {
                runtimeContext.currentGameStats.effectState.player = { activeSkills: [], activeStatuses: [], activePassives: [] };
            }
            if (!runtimeContext.currentGameStats.effectState.enemy) {
                runtimeContext.currentGameStats.effectState.enemy = { activeSkills: [], activeStatuses: [], activePassives: [] };
            }
            runtimeContext.currentGameStats.effectState.player.activeSkills = [];
            runtimeContext.currentGameStats.effectState.player.activePassives = [];
        }
    }

    return {
        sync,
        handleTurnStarted,
        clear,
        getActiveSkills
    };
}
