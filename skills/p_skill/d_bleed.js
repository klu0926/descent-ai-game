import { Skill } from "../skill.js";

export class d_bleed extends Skill {
    constructor() {
        super({
                  "id": "bleed",
                  "name": "bleed",
                  "desc": "bleed [VALUE] per turn",
                  "skillType": "debuff",
                  "kind": "skill",
                  "effectTypes": [
                            "generic"
                  ],
                  "durationTurns": 0,
                  "target": "self",
                  "section": 1,
                  "maxRank": 10,
                  "implemented": false,
                  "levelData": [],
                  "image": "resources/images/skill_icons/skill (17).png",
                  "trigger": {
                            "target": "self",
                            "autoApplied": false,
                            "event": "self:turn_start"
                  },
                  "effects": [
                            {
                                      "type": "reduce_hp",
                                      "onEvent": "self:turn_start",
                                      "value": "3",
                                      "valueType": "int",
                                      "chance": 100
                            }
                  ],
                  "scaling": [
                            {
                                      "rank": 2,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 1,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 3,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 2,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 4,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 3,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 5,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 4,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 6,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 5,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 7,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 6,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 8,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 7,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 9,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 8,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            },
                            {
                                      "rank": 10,
                                      "modifiers": {
                                                "effectMultiplier": 1,
                                                "effectFlatAdd": 9,
                                                "effectPercentAddRate": 0,
                                                "effectMultiplierInput": 1,
                                                "effectMultiplierInputType": "int"
                                      }
                            }
                  ],
                  "modifiers": {
                            "effectBaseMultiplier": 1
                  },
                  "meta": {
                            "maxRank": 10
                  }
        });
    }
}

export const D_BLEED = new d_bleed();
