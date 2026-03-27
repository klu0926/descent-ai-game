export const THIEF_CLASS = {
    id: "thief",
    name: "Thief",
    portrait: "entity/player_class/thief/thief_images/portrait.png",
    sprites: {
        attack: "entity/player_class/thief/thief_images/attack.png",
        block: "entity/player_class/thief/thief_images/block.png"
    },
    description: "Quick and deadly. High dodge and critical strike chances.",
    locked: true,
    baseStats: {
        hp: 80,
        atk: 12,
        def: 3,
        crit: 10,
        dodge: 15,
        aim: 5
    },
    levelUpGrowth: {
        hp: 7,
        atk: 2,
        def: 0,
        crit: 1,
        dodge: 1,
        aim: 1
    },
    passiveSkills: [],
    skillTree: {
        maxLevel: 20,
        sections: [],
        nodes: []
    }
};

