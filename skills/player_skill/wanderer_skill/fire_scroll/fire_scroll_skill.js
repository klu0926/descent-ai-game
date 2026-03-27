import { PassiveSkill } from "../../../passive_skill.js";

export class FireScrollSkill extends PassiveSkill {
    constructor() {
        super({
            id: "fire_scroll",
            name: "Fire Scroll",
            section: 1,
            maxRank: 2,
            implemented: true,
            effectTypes: ["dot"],
            turnOwner: "player",
            desc: "Every 10 turns, deal fire damage. Rank 2 increases fire damage scaling.",
            levelData: [
            "Every 10 turns, deal fire damage (about 45% ATK scaling).",
            "Every 10 turns, deal stronger fire damage (about 90% ATK scaling).",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/fire_scroll.png"
        });
    }
}

export const FIRE_SCROLL_SKILL = new FireScrollSkill();




