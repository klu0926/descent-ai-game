import { PassiveSkill } from "../../../passive_skill.js";

export class RelentlessCounterSkill extends PassiveSkill {
    constructor() {
        super({
            id: "relentless_counter",
            name: "Relentless Counter",
            section: 3,
            maxRank: 1,
            implemented: true,
            effectTypes: ["counter"],
            desc: "Counter attacks always trigger after a successful dodge with a short cooldown.",
            levelData: [
            "After a dodge, counter attacks always trigger (with cooldown).",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/relentless_counter.png"
        });
    }
}

export const RELENTLESS_COUNTER_SKILL = new RelentlessCounterSkill();




