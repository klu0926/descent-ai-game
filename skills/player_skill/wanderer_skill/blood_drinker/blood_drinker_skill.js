import { PassiveSkill } from "../../../passive_skill.js";

export class BloodDrinkerSkill extends PassiveSkill {
    constructor() {
        super({
            id: "blood_drinker",
            name: "Blood Drinker",
            section: 3,
            maxRank: 5,
            implemented: true,
            effectTypes: ["lifesteal"],
            desc: "Attacks have up to 15% chance to restore a portion of damage dealt as health.",
            levelData: [
            "Attacks have 7% chance to lifesteal 4% of damage dealt.",
            "Attacks have 9% chance to lifesteal 5% of damage dealt.",
            "Attacks have 11% chance to lifesteal 6% of damage dealt.",
            "Attacks have 13% chance to lifesteal 7% of damage dealt.",
            "Attacks have 15% chance to lifesteal 8% of damage dealt.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/blood_drinker.png"
        });
    }
}

export const BLOOD_DRINKER_SKILL = new BloodDrinkerSkill();




