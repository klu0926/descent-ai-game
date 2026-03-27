import { Item } from "../item.js";

export class ConsumableItem extends Item {
    constructor({
        id,
        consumableType = "healing",
        image = "",
        temp_icon = "",
        icon = "",
        name = "",
        displayName = "",
        rarity = "common",
        healPercent = 0,
        stats = {},
        passives = [],
        storyDesc = "",
        functionDesc = ""
    }) {
        super({
            id,
            rewardType: "consumable",
            consumableType,
            type: "consumable",
            typeTag: "consumable",
            image,
            temp_icon,
            icon,
            name,
            displayName,
            rarity,
            healPercent,
            stats,
            passives,
            storyDesc,
            functionDesc
        });
    }
}
