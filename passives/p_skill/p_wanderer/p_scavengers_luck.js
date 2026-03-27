import { Passive } from "../../passive.js";

export class p_scavengers_luck extends Passive {
    constructor() {
        super({
            id: "scavengers_luck",
            name: "Scavenger's Luck",
            desc: "Killing enemies has up to 25% chance to drop a small potion that restores HP.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "loot", "potion"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "scavengers_luck",
            target: "player",
            trigger: {
                event: "BATTLE_WON",
                chancePerRank: 0.05
            },
            modifiers: {
                lowHpBonusThresholdRate: 0.3,
                lowHpChanceBonusPerPredatorsRecoveryRank: 0.02,
                chanceCap: 0.65
            },
            meta: {
                maxRank: 5
            }
        });
    }
}

export const P_SCAVENGERS_LUCK = new p_scavengers_luck();
