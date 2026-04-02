import { Item } from "../item.js";

export class ConsumableItem extends Item {
    constructor({
        id,
        consumableType = "healing",
        image = "",
        temp_icon = "",
        icon = "",
        name = "",
        price = 0,
        healAmount = 0,
        healPercent = 0,
        effectMode = "once",
        effectTurns = 1,
        effectRounds = 1,
        stats = {},
        passives = [],
        storyDesc = "",
        functionDesc = "",
        desc = ""
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
            price,
            healAmount,
            healPercent,
            effectMode,
            effectTurns,
            effectRounds,
            stats,
            passives,
            storyDesc,
            functionDesc,
            desc
        });
    }
}
