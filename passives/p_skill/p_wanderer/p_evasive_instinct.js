import { Passive } from "../../passive.js";

export class p_evasive_instinct extends Passive {
    constructor() {
        super({
            id: "evasive_instinct",
            name: "Evasive Instinct",
            desc: "After dodging, gain a temporary increase in dodge chance.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "dodge", "survival"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "evasive_instinct",
            target: "player",
            trigger: {
                event: "PLAYER_DODGE"
            },
            modifiers: {
                dodgeBuffTurns: 2,
                dodgeFlatPerRank: 4
            },
            meta: {
                maxRank: 2
            }
        });
    }
}

export const P_EVASIVE_INSTINCT = new p_evasive_instinct();
