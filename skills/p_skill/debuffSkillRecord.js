import { PassiveSkillRecord } from "./passiveSkillRecord.js";

export class DebuffSkillRecord extends PassiveSkillRecord {
    constructor(config = {}) {
        super(config);
        this.skillType = "debuff";
    }
}

