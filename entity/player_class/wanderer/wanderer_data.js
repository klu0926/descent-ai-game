import { WANDERER_SKILL_TREE } from "./wanderer_skill_tree.js";

class WandererClass {
    constructor({ skillTree }) {
        this.id = "wanderer";
        this.name = "Wanderer";
        this.portrait = "entity/player_class/wanderer/wanderer_images/portrait.png";
        this.skillCardPortrait = "entity/player_class/wanderer/wanderer_images/portrait.png";
        this.sprites = {
        "attack": "entity/player_class/wanderer/wanderer_images/attack.png",
        "block": "entity/player_class/wanderer/wanderer_images/block.png"
};
        this.description = "A hardened survivor who uses agility and instinct to outlast danger with dodge, traps, and potions, then strikes back with precision.";
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

        const nodes = typeof skillTree.getNodes === "function" ? skillTree.getNodes() : [];
        this.skills = Object.freeze(
            nodes.reduce((result, node) => {
                if (node && node.id) result[node.id] = node;
                return result;
            }, {})
        );
        this.passiveSkills = [
        "stone_shield",
        "jagged_edge"
];
        this.skillTree = skillTree;
    }
}

export const WANDERER_CLASS = new WandererClass({
    skillTree: WANDERER_SKILL_TREE
});

