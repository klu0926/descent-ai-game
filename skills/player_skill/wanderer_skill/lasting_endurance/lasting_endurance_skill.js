import { PassiveSkill } from "../../../passive_skill.js";

export class LastingEnduranceSkill extends PassiveSkill {
    constructor() {
        super({
            id: "lasting_endurance",
            name: "Lasting Endurance",
            section: 4,
            maxRank: 3,
            implemented: true,
            effectTypes: ["survival"],
            turnOwner: "player",
            desc: "Regenerate health during combat, increasing over time.",
            levelData: [
            "Gain scaling combat regen over time.",
            "Gain stronger scaling combat regen over time.",
            "Gain maximum scaling combat regen over time.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/lasting_endurance.png"
        });
    }
}

export const LASTING_ENDURANCE_SKILL = new LastingEnduranceSkill();




