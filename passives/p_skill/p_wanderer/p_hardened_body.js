import { Passive } from "../../passive.js";

export class p_hardened_body extends Passive {
    constructor() {
        super({
            id: "hardened_body",
            name: "Hardened Body",
            desc: "Increases maximum HP by up to 10%.",
            kind: "skill",
            mode: "stats",
            effectTypes: ["stats", "survival", "hp"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "hardened_body",
            target: "player",
            modifiers: {
                hpMultiplierPerRank: 0.05
            },
            meta: {
                maxRank: 2
            }
        });
    }
}

export const P_HARDENED_BODY = new p_hardened_body();
