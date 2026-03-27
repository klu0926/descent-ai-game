import { PassiveSkill } from "../../../passive_skill.js";

function opportunisticTrapCallback({ rank, runtime }) {
    if (rank < 2) return;
    const battleState = runtime && runtime.currentGameStats ? runtime.currentGameStats.battleState : null;
    if (!battleState) return;
    if (!battleState.trapReady) return;
    battleState.trapCritArmed = true;
}

export class OpportunisticTrapSkill extends PassiveSkill {
    constructor() {
        super({
            id: "opportunistic_trap",
            name: "Opportunistic Trap",
            section: 3,
            maxRank: 2,
            implemented: true,
            effectTypes: ["trap"],
            desc: "Trap damage increased by 20%/40%. Rank 2 lets dodge-triggered traps crit.",
            levelData: [
            "Trap damage increased by 20%.",
            "Trap damage increased by 40%, and dodge-triggered traps can crit.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/opportunistic_trap.png",
            listenEvents: ["PLAYER_DODGE"],
            callbackFunc: opportunisticTrapCallback
        });
    }
}

export const OPPORTUNISTIC_TRAP_SKILL = new OpportunisticTrapSkill();




