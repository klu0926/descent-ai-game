import { Passive } from "../../passive.js";

export class p_fire_scroll extends Passive {
    constructor() {
        super({
            id: "fire_scroll",
            name: "Fire Scroll",
            desc: "Every 10 turns, deal fire damage. Rank 2 increases fire damage scaling.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "dot", "damage"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "fire_scroll",
            target: "enemy",
            turnOwner: "player",
            trigger: {
                event: "TURN_START",
                everyTurns: 10
            },
            modifiers: {
                damageScaleRank1: 0.45,
                damageScaleRank2: 0.9
            },
            meta: {
                maxRank: 2
            }
        });
    }
}

export const P_FIRE_SCROLL = new p_fire_scroll();
