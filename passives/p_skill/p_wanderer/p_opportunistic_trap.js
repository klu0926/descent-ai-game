import { Passive } from "../../passive.js";

export class p_opportunistic_trap extends Passive {
    constructor() {
        super({
            id: "opportunistic_trap",
            name: "Opportunistic Trap",
            desc: "Trap damage increased by 20%/40%. Rank 2 lets dodge-triggered traps crit.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "trap", "damage"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "opportunistic_trap",
            target: "enemy",
            trigger: {
                event: "PLAYER_DODGE"
            },
            modifiers: {
                trapDamageBonusPerRank: 0.2,
                rank2ArmsTrapCrit: true
            },
            meta: {
                maxRank: 2
            }
        });
    }
}

export const P_OPPORTUNISTIC_TRAP = new p_opportunistic_trap();
