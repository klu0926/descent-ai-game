import { Passive } from "../../passive.js";

export class p_relentless_counter extends Passive {
    constructor() {
        super({
            id: "relentless_counter",
            name: "Relentless Counter",
            desc: "Counter attacks always trigger after a successful dodge with a short cooldown.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "counter", "dodge"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "relentless_counter",
            target: "enemy",
            trigger: {
                event: "PLAYER_DODGE",
                guaranteed: true
            },
            modifiers: {
                cooldownTurns: 2
            },
            meta: {
                maxRank: 1
            }
        });
    }
}

export const P_RELENTLESS_COUNTER = new p_relentless_counter();
