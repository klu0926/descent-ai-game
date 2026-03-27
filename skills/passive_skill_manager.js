export function createPassiveSkillManager({
    eventBus,
    gameEvents,
    getActivePlayerClass,
    getSkillRank,
    runtimeContext
}) {
    const activeSkills = new Map();

    function getPassiveSkillNodes() {
        const activeClass = getActivePlayerClass();
        if (!activeClass || !activeClass.skillTree || !Array.isArray(activeClass.skillTree.nodes)) return [];
        return activeClass.skillTree.nodes.filter(skill => skill && skill.skillType === "passive");
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
                runtime: runtimeContext
            });
        }
        activeSkills.delete(skillId);
    }

    function activateSkill(skill, rank) {
        const unsubscribers = [];

        if (typeof skill.onActivate === "function") {
            skill.onActivate({
                rank,
                runtime: runtimeContext
            });
        }

        if (typeof skill.createEventHandlers === "function") {
            const handlers = skill.createEventHandlers({
                rank,
                runtime: {
                    ...runtimeContext,
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
            unsubscribers
        });
    }

    function sync() {
        const passiveNodes = getPassiveSkillNodes();
        const expected = new Map();

        passiveNodes.forEach(skill => {
            const rank = getSkillRank(skill.id);
            if (rank > 0) {
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
            runtimeContext.currentGameStats.effectState.player.activeSkills = activeList;
            runtimeContext.currentGameStats.effectState.player.activePassives = activeList;
        }
    }

    function getActiveSkills() {
        return Array.from(activeSkills.values()).map(entry => ({
            id: entry.skill.id,
            name: entry.skill.name,
            rank: entry.rank,
            effectTypes: Array.isArray(entry.skill.effectTypes) ? entry.skill.effectTypes : ["generic"]
        }));
    }

    function clear() {
        Array.from(activeSkills.keys()).forEach(skillId => deactivateSkill(skillId));
        if (runtimeContext.currentGameStats) {
            runtimeContext.currentGameStats.activePassiveSkills = [];
            if (!runtimeContext.currentGameStats.effectState) {
                runtimeContext.currentGameStats.effectState = {
                    player: { activeSkills: [], activeStatuses: [], activePassives: [] },
                    enemy: { activeSkills: [], activeStatuses: [], activePassives: [] }
                };
            }
            runtimeContext.currentGameStats.effectState.player.activeSkills = [];
            runtimeContext.currentGameStats.effectState.player.activePassives = [];
        }
    }

    return {
        sync,
        clear,
        getActiveSkills
    };
}
