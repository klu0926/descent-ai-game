import { Passive } from "../../passive.js";

export class p_reactive_strike extends Passive {
    constructor() {
        super({
            id: "reactive_strike",
            name: "Reactive Strike",
            desc: "After dodging, gain up to 30% chance to perform a counter attack.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "counter", "dodge"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "reactive_strike",
            target: "enemy",
            trigger: {
                event: "PLAYER_DODGE",
                chancePerRank: 0.1
            },
            modifiers: {
                counterBaseScale: 0.5
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_REACTIVE_STRIKE = new p_reactive_strike();
