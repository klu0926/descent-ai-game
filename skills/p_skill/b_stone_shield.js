import { Skill } from "../skill.js";

export class b_stone_shield extends Skill {
    constructor() {
        super({
                  "id": "stone_shield",
                  "name": "stone shield",
                  "desc": "def +[VALUE]",
                  "skillType": "buff",
                  "kind": "skill",
                  "effectTypes": [
                            "generic"
                  ],
                  "durationTurns": 0,
                  "target": "self",
                  "section": 1,
                  "maxRank": 1,
                  "implemented": false,
                  "levelData": [],
                  "image": "resources/images/skill_icons/skill (89).png",
                  "trigger": {
                            "target": "self",
                            "autoApplied": true
                  },
                  "effects": [
                            {
                                      "type": "add_defence",
                                      "value": "3",
                                      "valueType": "int",
                                      "chance": 100
                            }
                  ],
                  "modifiers": {
                            "effectBaseMultiplier": 1
                  },
                  "meta": {
                            "maxRank": 1
                  }
        });
    }
}

export const B_STONE_SHIELD = new b_stone_shield();
