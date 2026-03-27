import { Passive } from "../../passive.js";

export class p_blood_drinker extends Passive {
    constructor() {
        super({
            id: "blood_drinker",
            name: "Blood Drinker",
            desc: "Attacks have up to 15% chance to restore a portion of damage dealt as health.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "lifesteal", "survival"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "blood_drinker",
            target: "player",
            trigger: {
                event: "ENEMY_HIT",
                chancePerRank: 0.03
            },
            modifiers: {
                lifestealHealRateBase: 0.03,
                lifestealHealRatePerRank: 0.01
            },
            meta: {
                maxRank: 5
            }
        });
    }
}

export const P_BLOOD_DRINKER = new p_blood_drinker();
