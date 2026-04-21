import { PassiveSkillRecord } from "./passiveSkillRecord.js";

export class BuffSkillRecord extends PassiveSkillRecord {
    constructor(config = {}) {
        super(config);
        this.skillType = "buff";
    }
}

