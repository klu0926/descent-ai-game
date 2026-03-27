import { Passive } from "../../passive.js";

export class p_lasting_endurance extends Passive {
    constructor() {
        super({
            id: "lasting_endurance",
            name: "Lasting Endurance",
            desc: "Regenerate health during combat, increasing over time.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "survival", "healing", "regen"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "lasting_endurance",
            target: "player",
            turnOwner: "player",
            trigger: {
                event: "TURN_START"
            },
            modifiers: {
                scalingRegenPerTurnPerRank: 0.004,
                scalingRegenCap: 0.03
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_LASTING_ENDURANCE = new p_lasting_endurance();
