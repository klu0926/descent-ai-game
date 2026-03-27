import { PassiveSkill } from "../../../passive_skill.js";

export class FlowingCounterSkill extends PassiveSkill {
    constructor() {
        super({
            id: "flowing_counter",
            name: "Flowing Counter",
            section: 2,
            maxRank: 3,
            implemented: true,
            effectTypes: ["counter", "survival"],
            desc: "Counter attacks deal more damage and restore a small amount of health.",
            levelData: [
            "Counter attacks deal +20% damage and restore 1% max HP.",
            "Counter attacks deal +40% damage and restore 2% max HP.",
            "Counter attacks deal +60% damage and restore 3% max HP.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/flowing_counter.png"
        });
    }
}

export const FLOWING_COUNTER_SKILL = new FlowingCounterSkill();




