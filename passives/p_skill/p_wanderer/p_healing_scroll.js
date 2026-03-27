import { Passive } from "../../passive.js";

export class p_healing_scroll extends Passive {
    constructor() {
        super({
            id: "healing_scroll",
            name: "Healing Scroll",
            desc: "Every 15 turns restore 25% max HP. Rank 2 also grants a short regen effect.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "potion", "consumable", "survival", "healing"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "healing_scroll",
            target: "player",
            turnOwner: "player",
            trigger: {
                event: "TURN_START",
                everyTurns: 15
            },
            modifiers: {
                healPercentMaxHp: 0.25,
                regenTurnsAtRank2: 3,
                regenRateAtRank2: 0.03
            },
            meta: {
                maxRank: 2
            }
        });
    }
}

export const P_HEALING_SCROLL = new p_healing_scroll();
