import { Passive } from "../../passive.js";

export class p_predators_recovery extends Passive {
    constructor() {
        super({
            id: "predators_recovery",
            name: "Predator's Recovery",
            desc: "When below 30% HP, gain increased lifesteal and higher potion drop chance.",
            kind: "skill",
            mode: "stats",
            effectTypes: ["stats", "survival", "lifesteal", "loot"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "predators_recovery",
            target: "player",
            modifiers: {
                thresholdHpRate: 0.3,
                lifestealBonusPerRank: 0.01,
                potionDropBonusPerRank: 0.02
            },
            meta: {
                maxRank: 5
            }
        });
    }
}

export const P_PREDATORS_RECOVERY = new p_predators_recovery();
