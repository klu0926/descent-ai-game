import {
    BLOOD_DRINKER_SKILL,
    EVASIVE_INSTINCT_SKILL,
    FIRE_SCROLL_SKILL,
    FLOWING_COUNTER_SKILL,
    GHOST_WALKER_SKILL,
    HARDENED_BODY_SKILL,
    HEALING_SCROLL_SKILL,
    HIDDEN_SNARE_SKILL,
    IMPROVISED_MEDICINE_SKILL,
    LASTING_ENDURANCE_SKILL,
    LIGHT_FOOTING_SKILL,
    OPPORTUNISTIC_TRAP_SKILL,
    PREDATORS_RECOVERY_SKILL,
    REACTIVE_STRIKE_SKILL,
    RELENTLESS_COUNTER_SKILL,
    SCAVENGERS_LUCK_SKILL
} from "../../../skills/player_skill/wanderer_skill/index.js";

const WANDERER_SKILLS = Object.freeze({
    scavengers_luck: SCAVENGERS_LUCK_SKILL,
    light_footing: LIGHT_FOOTING_SKILL,
    reactive_strike: REACTIVE_STRIKE_SKILL,
    hardened_body: HARDENED_BODY_SKILL,
    fire_scroll: FIRE_SCROLL_SKILL,
    flowing_counter: FLOWING_COUNTER_SKILL,
    evasive_instinct: EVASIVE_INSTINCT_SKILL,
    improvised_medicine: IMPROVISED_MEDICINE_SKILL,
    hidden_snare: HIDDEN_SNARE_SKILL,
    healing_scroll: HEALING_SCROLL_SKILL,
    blood_drinker: BLOOD_DRINKER_SKILL,
    relentless_counter: RELENTLESS_COUNTER_SKILL,
    predators_recovery: PREDATORS_RECOVERY_SKILL,
    opportunistic_trap: OPPORTUNISTIC_TRAP_SKILL,
    ghost_walker: GHOST_WALKER_SKILL,
    lasting_endurance: LASTING_ENDURANCE_SKILL
});

const WANDERER_SECTIONS = [
    {
        id: 1,
        name: "Survival Instincts",
        pointCap: 10,
        requiredTreePoints: 0,
        pointsToNext: 5,
        skills: [
            WANDERER_SKILLS.scavengers_luck,
            WANDERER_SKILLS.light_footing,
            WANDERER_SKILLS.reactive_strike,
            WANDERER_SKILLS.hardened_body,
            WANDERER_SKILLS.fire_scroll
        ]
    },
    {
        id: 2,
        name: "Adaptive Combat",
        pointCap: 10,
        requiredTreePoints: 5,
        pointsToNext: 5,
        skills: [
            WANDERER_SKILLS.flowing_counter,
            WANDERER_SKILLS.evasive_instinct,
            WANDERER_SKILLS.improvised_medicine,
            WANDERER_SKILLS.hidden_snare,
            WANDERER_SKILLS.healing_scroll
        ]
    },
    {
        id: 3,
        name: "Master of Survival",
        pointCap: 10,
        requiredTreePoints: 10,
        pointsToNext: 5,
        skills: [
            WANDERER_SKILLS.blood_drinker,
            WANDERER_SKILLS.relentless_counter,
            WANDERER_SKILLS.predators_recovery,
            WANDERER_SKILLS.opportunistic_trap
        ]
    },
    {
        id: 4,
        name: "Late Mastery",
        pointCap: 10,
        requiredTreePoints: 15,
        pointsToNext: 0,
        skills: [
            WANDERER_SKILLS.ghost_walker,
            WANDERER_SKILLS.lasting_endurance
        ]
    }
];

class WandererClass {
    constructor({ skills, sections }) {
        this.id = "wanderer";
        this.name = "Wanderer";
        this.portrait = "entity/player_class/wanderer/wanderer_images/portrait.png";
        this.skillCardPortrait = "entity/player_class/wanderer/wanderer_images/portrait.png";
        this.sprites = {
        "attack": "entity/player_class/wanderer/wanderer_images/attack.png",
        "block": "entity/player_class/wanderer/wanderer_images/block.png"
};
        this.description = "A hardened survivor who uses agility and instinct to outlast danger with <span class='class-keyword'>dodge</span>, <span class='class-keyword'>traps</span>, and <span class='class-keyword'>potions</span>, then strikes back with precision.";
        this.locked = false;
        this.gold = 0;
        this.inventory = [
        "small_potion",
        "body_rug"
];
        this.baseStats = {
        "hp": 100,
        "atk": 10,
        "def": 5,
        "crit": 0,
        "dodge": 5,
        "aim": 0
};
        this.levelUpGrowth = {
        "hp": 10,
        "atk": 1,
        "def": 1,
        "crit": 0,
        "dodge": 1,
        "aim": 0
};

        this.skills = skills;
        this.sections = sections;
        this.passiveSkills = [];
        this.skillTree = {
            maxLevel: 20,
            sections: sections.map(({ skills: linkedSkills, ...meta }) => meta),
            nodes: sections.flatMap(section => section.skills)
        };
    }
}

export const WANDERER_CLASS = new WandererClass({
    skills: WANDERER_SKILLS,
    sections: WANDERER_SECTIONS
});

