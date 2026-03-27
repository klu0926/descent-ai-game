import { Passive } from "../../passive.js";

export class p_flowing_counter extends Passive {
    constructor() {
        super({
            id: "flowing_counter",
            name: "Flowing Counter",
            desc: "Counter attacks deal more damage and restore a small amount of health.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "counter", "survival"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "flowing_counter",
            target: "player",
            trigger: {
                event: "PLAYER_COUNTER"
            },
            modifiers: {
                counterDamagePerRank: 0.2,
                counterHealRatePerRank: 0.01
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_FLOWING_COUNTER = new p_flowing_counter();
