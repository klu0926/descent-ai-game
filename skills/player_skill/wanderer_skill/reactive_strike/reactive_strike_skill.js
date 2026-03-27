import { PassiveSkill } from "../../../passive_skill.js";

export class ReactiveStrikeSkill extends PassiveSkill {
    constructor() {
        super({
            id: "reactive_strike",
            name: "Reactive Strike",
            section: 1,
            maxRank: 3,
            implemented: true,
            effectTypes: ["counter"],
            desc: "After dodging, gain up to 30% chance to perform a counter attack.",
            levelData: [
            "After dodging, gain 10% chance to perform a counter attack.",
            "After dodging, gain 20% chance to perform a counter attack.",
            "After dodging, gain 30% chance to perform a counter attack.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/reactive_strike.png"
        });
    }
}

export const REACTIVE_STRIKE_SKILL = new ReactiveStrikeSkill();




