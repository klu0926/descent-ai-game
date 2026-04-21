import { Skill } from "../skill.js";

export class ActiveSkillRecord extends Skill {
    constructor(config = {}) {
        super(config);
        Object.assign(this, config);
        this.skillType = "active";
    }
}
