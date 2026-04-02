function toNonNegativeInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
}

function toFraction(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
}

function normalizeStats(stats) {
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) return {};
    const out = {};
    Object.entries(stats).forEach(([key, value]) => {
        const statKey = String(key || "").trim();
        if (!statKey) return;
        const statValue = Number(value);
        if (!Number.isFinite(statValue)) return;
        out[statKey] = Math.floor(statValue);
    });
    return out;
}

function normalizePassives(passives) {
    return Array.isArray(passives) ? passives : [];
}

function normalizeEffectMode(mode, fallback = "once") {
    const normalized = String(mode || fallback || "once").trim().toLowerCase();
    return normalized === "turn" || normalized === "round" || normalized === "once"
        ? normalized
        : "once";
}

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
        const normalizedStoryDesc = String(storyDesc || desc || "");

        this.id = String(id || "");
        this.rewardType = String(rewardType || "");
        this.consumableType = String(consumableType || "");
        this.type = String(type || "item");
        this.typeTag = String(typeTag || this.type);
        this.image = String(image || "");
        this.temp_icon = String(temp_icon || icon || "");
        // Backward compatibility for older UI paths that still read item.icon.
        this.icon = this.temp_icon;
        this.name = String(name || "");
        this.price = toNonNegativeInt(price, 0);
        this.healAmount = toNonNegativeInt(healAmount, 0);
        this.healPercent = toFraction(healPercent, 0);
        this.effectMode = normalizeEffectMode(effectMode, "once");
        this.effectTurns = Math.max(1, toNonNegativeInt(effectTurns, 1));
        this.effectRounds = Math.max(1, toNonNegativeInt(effectRounds, 1));
        this.stats = normalizeStats(stats);
        this.passives = normalizePassives(passives);
        this.storyDesc = normalizedStoryDesc;
        this.desc = normalizedStoryDesc;
        this.functionDesc = String(functionDesc || "");
    }

    resolveConsumableEffects(context = {}) {
        void context;
        return {
            healMultiplier: 1,
            notes: [],
            meta: {}
        };
    }

    getResolvedHealAmount(maxHp = 0, multiplier = 1) {
        const safeMultiplier = Number.isFinite(Number(multiplier)) ? Number(multiplier) : 1;
        const flatHeal = toNonNegativeInt(this.healAmount, 0);
        if (flatHeal > 0) {
            return Math.max(1, Math.floor(flatHeal * safeMultiplier));
        }

        const safeMaxHp = Math.max(0, Math.floor(Number(maxHp) || 0));
        const percentHeal = toFraction(this.healPercent, 0);
        if (safeMaxHp > 0 && percentHeal > 0) {
            return Math.max(1, Math.floor(safeMaxHp * percentHeal * safeMultiplier));
        }
        return 0;
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
        gearType,
        image = "",
        temp_icon = "",
        icon,
        desc,
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
            stats,
            passives,
            storyDesc: desc,
            desc
        });

        this.gearType = gearType;
    }
}

export class HealingRewardItem extends Item {
    constructor({
        id,
        name = "Healing Potion",
        image = "",
        temp_icon = "\uD83E\uDDEA",
        icon = "\uD83E\uDDEA",
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
            healAmount: 0,
            healPercent,
            effectMode: "once",
            effectTurns: 1,
            effectRounds: 1,
            stats: {},
            passives: [],
            storyDesc: desc,
            desc
        });
    }
}
