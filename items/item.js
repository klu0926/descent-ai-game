export class Item {
    constructor({
        id,
        rewardType,
        consumableType = "",
        type = "item",
        typeTag = "",
        image = "",
        temp_icon = "",
        icon = "", // Backward compatibility alias for temp_icon.
        name = "",
        displayName = "",
        rarity = "common",
        healPercent = 0,
        stats = {},
        passives = [],
        storyDesc = "",
        functionDesc = ""
    }) {
        this.id = id;
        this.rewardType = rewardType;
        this.consumableType = consumableType;
        this.type = type;
        this.typeTag = typeTag || type;
        this.image = image;
        this.temp_icon = temp_icon || icon || "";
        // Backward compatibility for older UI paths that still read item.icon.
        this.icon = this.temp_icon;
        this.name = name;
        this.displayName = displayName || name;
        this.rarity = rarity;
        this.healPercent = healPercent;
        this.stats = stats;
        this.passives = passives;
        this.storyDesc = storyDesc;
        this.functionDesc = functionDesc;
    }

    resolveConsumableEffects(context = {}) {
        void context;
        return {
            healMultiplier: 1,
            notes: [],
            meta: {}
        };
    }
}

export function hasPassiveTag(entry, tag) {
    if (!entry || !Array.isArray(entry.effectTypes)) return false;
    if (entry.effectTypes.includes(tag)) return true;
    // Backward compatibility during migration.
    if (tag === "potion" && entry.effectTypes.includes("consumable")) return true;
    return false;
}

export function getItemImage(item) {
    return item && typeof item.image === "string" ? item.image : "";
}

export function getItemTempIcon(item) {
    if (!item) return "";
    if (typeof item.temp_icon === "string" && item.temp_icon) return item.temp_icon;
    if (typeof item.icon === "string" && item.icon) return item.icon;
    return "";
}

export class GearItem extends Item {
    constructor({
        id,
        name,
        displayName,
        gearType,
        image = "",
        temp_icon = "",
        icon,
        desc,
        rarity = "common",
        stats = {},
        passives = []
    }) {
        super({
            id,
            rewardType: "gear",
            type: gearType,
            typeTag: "gear",
            image,
            temp_icon,
            icon,
            name,
            displayName,
            rarity,
            stats,
            passives,
            storyDesc: desc
        });

        this.gearType = gearType;
        this.desc = desc;
    }
}

export class HealingRewardItem extends Item {
    constructor({
        id,
        name = "Healing Potion",
        displayName = "Healing Potion",
        image = "",
        temp_icon = "\uD83E\uDDEA",
        icon = "\uD83E\uDDEA",
        rarity = "uncommon",
        healPercent = 0.5,
        desc = ""
    }) {
        super({
            id,
            rewardType: "healing",
            consumableType: "healing",
            type: "consumable",
            typeTag: "consumable",
            image,
            temp_icon,
            icon,
            name,
            displayName,
            rarity,
            healPercent,
            stats: {},
            passives: [],
            storyDesc: desc
        });

        this.desc = desc;
    }
}
