import { PassiveSkill } from "../../../passive_skill.js";

export class HardenedBodySkill extends PassiveSkill {
    constructor() {
        super({
            id: "hardened_body",
            name: "Hardened Body",
            section: 1,
            maxRank: 2,
            implemented: true,
            effectTypes: ["survival"],
            desc: "Increases maximum HP by up to 10%.",
            levelData: [
            "Increases maximum HP by 5%.",
            "Increases maximum HP by 10%.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/hardened_body.png"
        });
    }
}

export const HARDENED_BODY_SKILL = new HardenedBodySkill();




