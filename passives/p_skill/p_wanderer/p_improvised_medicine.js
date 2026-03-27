import { Passive } from "../../passive.js";

export class p_improvised_medicine extends Passive {
    constructor() {
        super({
            id: "improvised_medicine",
            name: "Improvised Medicine",
            desc: "Potions heal more and may grant a temporary buff.",
            kind: "skill",
            mode: "potion",
            effectTypes: ["potion", "action", "consumable", "healing"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "improvised_medicine",
            target: "player",
            modifiers: {
                potionHealBonusPerRank: [0.1, 0.2, 0.3],
                rank3AtkBuffChance: 0.5,
                rank3AtkBuffTurns: 3
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_IMPROVISED_MEDICINE = new p_improvised_medicine();
