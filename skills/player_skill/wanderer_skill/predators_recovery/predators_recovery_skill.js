import { PassiveSkill } from "../../../passive_skill.js";

export class PredatorsRecoverySkill extends PassiveSkill {
    constructor() {
        super({
            id: "predators_recovery",
            name: "Predator's Recovery",
            section: 3,
            maxRank: 5,
            implemented: true,
            effectTypes: ["survival", "lifesteal", "loot"],
            desc: "When below 30% HP, gain increased lifesteal and higher potion drop chance.",
            levelData: [
            "Below 30% HP: +1% lifesteal and +2% potion drop chance.",
            "Below 30% HP: +2% lifesteal and +4% potion drop chance.",
            "Below 30% HP: +3% lifesteal and +6% potion drop chance.",
            "Below 30% HP: +4% lifesteal and +8% potion drop chance.",
            "Below 30% HP: +5% lifesteal and +10% potion drop chance.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/predators_recovery.png"
        });
    }
}

export const PREDATORS_RECOVERY_SKILL = new PredatorsRecoverySkill();




