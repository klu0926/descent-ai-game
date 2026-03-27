import { PassiveSkill } from "../../../passive_skill.js";

function hiddenSnareCallback({ payload, runtime }) {
    if (!payload || payload.source !== "basic_attack" || !payload.damage || payload.damage <= 0) return;
    const battleState = runtime && runtime.currentGameStats ? runtime.currentGameStats.battleState : null;
    if (!battleState || battleState.trapReady) return;

    battleState.attackHitsForTrap += 1;
    if (battleState.attackHitsForTrap >= 5) {
        battleState.attackHitsForTrap = 0;
        battleState.trapReady = true;
        if (runtime && typeof runtime.floatText === "function") {
            runtime.floatText("player", "Trap ready", "info");
        }
    }
}

export class HiddenSnareSkill extends PassiveSkill {
    constructor() {
        super({
            id: "hidden_snare",
            name: "Hidden Snare",
            section: 2,
            maxRank: 3,
            implemented: true,
            effectTypes: ["trap"],
            desc: "Every 5 successful attacks prepares a trap. Next enemy attack triggers it.",
            levelData: [
            "Trap deals about 35% ATK damage.",
            "Trap deals about 70% ATK damage.",
            "Trap deals about 105% ATK damage.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/hidden_snare.png",
            listenEvents: ["ENEMY_HIT"],
            callbackFunc: hiddenSnareCallback
        });
    }
}

export const HIDDEN_SNARE_SKILL = new HiddenSnareSkill();




