import { PassiveSkill } from "../../../passive_skill.js";

function ghostWalkerCallback({ runtime }) {
    const battleState = runtime && runtime.currentGameStats ? runtime.currentGameStats.battleState : null;
    if (!battleState) return;
    battleState.skillTreeDodgeBuffTurns = Math.max(battleState.skillTreeDodgeBuffTurns, 2);
}

export class GhostWalkerSkill extends PassiveSkill {
    constructor() {
        super({
            id: "ghost_walker",
            name: "Ghost Walker",
            section: 4,
            maxRank: 3,
            implemented: true,
            effectTypes: ["dodge"],
            desc: "After dodging, become harder to hit for a short duration.",
            levelData: [
            "After dodging, gain +3 dodge for 2 turns.",
            "After dodging, gain +6 dodge for 2 turns.",
            "After dodging, gain +9 dodge for 2 turns.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/ghost_walker.png",
            listenEvents: ["PLAYER_DODGE"],
            callbackFunc: ghostWalkerCallback
        });
    }
}

export const GHOST_WALKER_SKILL = new GhostWalkerSkill();




