export const DESERTER_CLASS = {
    id: "deserter",
    name: "Deserter",
    portrait: "entity/player_class/deserter/deserter_images/portrait.png",
    sprites: {
        attack: "entity/player_class/deserter/deserter_images/attack.png",
        block: "entity/player_class/deserter/deserter_images/block.png"
    },
    description: "A former soldier who abandoned their post. High defense but slow.",
    locked: true,
    baseStats: {
        hp: 120,
        atk: 8,
        def: 10,
        crit: 0,
        dodge: 2,
        aim: 0
    },
    passiveSkills: [],
    skillTree: {
        maxLevel: 20,
        sections: [],
        nodes: []
    }
};

