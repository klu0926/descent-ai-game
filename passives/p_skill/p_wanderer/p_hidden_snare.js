import { Passive } from "../../passive.js";

export class p_hidden_snare extends Passive {
    constructor() {
        super({
            id: "hidden_snare",
            name: "Hidden Snare",
            desc: "Every 5 successful attacks prepares a trap. Next enemy attack triggers it.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "trap", "damage"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "hidden_snare",
            target: "enemy",
            trigger: {
                event: "ENEMY_HIT",
                requiredHits: 5
            },
            modifiers: {
                trapScaleRank1: 0.35,
                trapScaleRank2: 0.7,
                trapScaleRank3: 1.05
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_HIDDEN_SNARE = new p_hidden_snare();
