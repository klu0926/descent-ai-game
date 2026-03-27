import { PassiveSkill } from "../../../passive_skill.js";

export class ImprovisedMedicineSkill extends PassiveSkill {
    constructor() {
        super({
            id: "improvised_medicine",
            name: "Improvised Medicine",
            section: 2,
            maxRank: 3,
            implemented: true,
            effectTypes: ["action", "potion", "consumable"],
            desc: "Potions heal more and may grant a temporary buff.",
            levelData: [
            "Potions heal 10% more.",
            "Potions heal 20% more.",
            "Potions heal 30% more and may grant a temporary ATK buff.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/improvised_medicine.png"
        });
    }
}

export const IMPROVISED_MEDICINE_SKILL = new ImprovisedMedicineSkill();




