import { Item } from "../item.js";

const DEFAULT_CONSUMABLE_USE_EVENTS = Object.freeze(["combat:heal_item_used"]);

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
        itemUseEventTriggers = [],
        storyDesc = "",
        functionDesc = "",
        desc = ""
    }) {
        const mergedUseEvents = Array.from(new Set([
            ...DEFAULT_CONSUMABLE_USE_EVENTS,
            ...(Array.isArray(itemUseEventTriggers) ? itemUseEventTriggers : [])
        ]));

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
            itemUseEventTriggers: mergedUseEvents,
            storyDesc,
            functionDesc,
            desc
        });
    }
}
