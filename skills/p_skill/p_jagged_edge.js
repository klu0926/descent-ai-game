import { Skill } from "../skill.js";

export class p_jagged_edge extends Skill {
    constructor() {
        super({
                  "id": "jagged_edge",
                  "name": "Jagged Edge",
                  "desc": "[CHANCE] chance to bleed",
                  "skillType": "passive",
                  "kind": "skill",
                  "effectTypes": [
                            "generic"
                  ],
                  "durationTurns": 0,
                  "target": "enemy",
                  "section": 1,
                  "maxRank": 1,
                  "implemented": false,
                  "levelData": [],
                  "image": "resources/images/skill_icons/skill (32).png",
                  "trigger": {
                            "event": "opponent:hit",
                            "target": "opponent",
                            "autoApplied": false
                  },
                  "effects": [
                            {
                                      "type": "set_flag",
                                      "onEvent": "opponent:hit",
                                      "flagKey": "bleed",
                                      "chance": 50
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

export const P_JAGGED_EDGE = new p_jagged_edge();
