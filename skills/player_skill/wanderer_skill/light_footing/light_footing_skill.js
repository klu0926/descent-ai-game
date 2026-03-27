import { PassiveSkill } from "../../../passive_skill.js";

export class LightFootingSkill extends PassiveSkill {
    constructor() {
        super({
            id: "light_footing",
            name: "Light Footing",
            section: 1,
            maxRank: 5,
            implemented: true,
            effectTypes: ["dodge"],
            desc: "Increases dodge chance by up to 10%.",
            levelData: [
            "Increases dodge chance by 2%.",
            "Increases dodge chance by 4%.",
            "Increases dodge chance by 6%.",
            "Increases dodge chance by 8%.",
            "Increases dodge chance by 10%.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/light_footing.png"
        });
    }
}

export const LIGHT_FOOTING_SKILL = new LightFootingSkill();




