import { PassiveSkill } from "../../../passive_skill.js";

function evasiveInstinctCallback({ runtime }) {
    const battleState = runtime && runtime.currentGameStats ? runtime.currentGameStats.battleState : null;
    if (!battleState) return;
    battleState.skillTreeDodgeBuffTurns = Math.max(battleState.skillTreeDodgeBuffTurns, 2);
}

export class EvasiveInstinctSkill extends PassiveSkill {
    constructor() {
        super({
            id: "evasive_instinct",
            name: "Evasive Instinct",
            section: 2,
            maxRank: 2,
            implemented: true,
            effectTypes: ["dodge"],
            desc: "After dodging, gain a temporary increase in dodge chance.",
            levelData: [
            "After dodging, gain +4 dodge for 2 turns.",
            "After dodging, gain +8 dodge for 2 turns.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/evasive_instinct.png",
            listenEvents: ["PLAYER_DODGE"],
            callbackFunc: evasiveInstinctCallback
        });
    }
}

export const EVASIVE_INSTINCT_SKILL = new EvasiveInstinctSkill();




