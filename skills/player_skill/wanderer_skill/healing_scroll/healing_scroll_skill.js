import { PassiveSkill } from "../../../passive_skill.js";

export class HealingScrollSkill extends PassiveSkill {
    constructor() {
        super({
            id: "healing_scroll",
            name: "Healing Scroll",
            section: 2,
            maxRank: 2,
            implemented: true,
            effectTypes: ["consumable", "survival"],
            turnOwner: "player",
            desc: "Every 15 turns restore 25% max HP. Rank 2 also grants a short regen effect.",
            levelData: [
            "Every 15 turns, restore 25% max HP.",
            "Every 15 turns, restore 25% max HP and gain 3 turns of 3% regen.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/healing_scroll.png"
        });
    }
}

export const HEALING_SCROLL_SKILL = new HealingScrollSkill();




