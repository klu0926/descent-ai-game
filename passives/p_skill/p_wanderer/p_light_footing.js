import { Passive } from "../../passive.js";

export class p_light_footing extends Passive {
    constructor() {
        super({
            id: "light_footing",
            name: "Light Footing",
            desc: "Increases dodge chance by up to 10%.",
            kind: "skill",
            mode: "stats",
            effectTypes: ["stats", "dodge", "survival"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "light_footing",
            target: "player",
            modifiers: {
                dodgeFlatPerRank: 2
            },
            meta: {
                maxRank: 5
            }
        });
    }
}

export const P_LIGHT_FOOTING = new p_light_footing();
