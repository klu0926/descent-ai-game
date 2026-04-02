import { PASSIVES } from "../skills/passive_runtime.js";
import { GearItem, HealingRewardItem } from "../items/item.js";

const WEAPON_TYPES = [
    { name: "Sword", stat: "atk", val: 8, icon: "⚔️" },
    { name: "Dagger", stat: "atk", val: 5, icon: "🗡️" },
    { name: "Bow", stat: "atk", val: 6, icon: "🏹" },
    { name: "Staff", stat: "atk", val: 10, icon: "🦯" }
];

const ARMOR_TYPES = [
    { name: "Plate Mail", stat: "def", val: 10, icon: "🦺" },
    { name: "Leather", stat: "def", val: 4, icon: "🧥" },
    { name: "Helmet", stat: "def", val: 5, icon: "🪖" },
    { name: "Boots", stat: "def", val: 3, icon: "👢" }
];

const ACCESSORY_TYPES = [
    { name: "Ring", stat: "hp", val: 15, icon: "💍" },
    { name: "Amulet", stat: "atk", val: 4, icon: "📿" },
    { name: "Charm", stat: "def", val: 3, icon: "🔮" },
    { name: "Crystal", stat: "hp", val: 25, icon: "💎" }
];

const RARITIES = [
    { id: "common", name: "Common", weight: 50, extraStats: 0, passiveChance: 0 },
    { id: "uncommon", name: "Uncommon", weight: 30, extraStats: 1, passiveChance: 0 },
    { id: "rare", name: "Rare", weight: 15, extraStats: 2, passiveChance: 0.4 },
    { id: "epic", name: "Epic", weight: 4, extraStats: 2, passiveChance: 0.8 },
    { id: "legendary", name: "Legendary", weight: 1, extraStats: 3, passiveChance: 1.0 }
];

const PREFIXES = ["Flaming", "Frozen", "Cursed", "Blessed", "Ancient", "Rusty", "Shining", "Shadow", "Divine"];
const SUFFIXES = ["of the Bear", "of Speed", "of the Eagle", "of Doom", "of Light", "of Darkness", "of Fire", "of Ice", "of the Dragon"];

export const ITEM_GENERATOR_CONFIG = {
    categories: [
        { itemType: "weapon", pool: WEAPON_TYPES },
        { itemType: "armor", pool: ARMOR_TYPES },
        { itemType: "accessory", pool: ACCESSORY_TYPES }
    ],
    specialRewards: {
        healingPotion: {
            enabled: true,
            chance: 0.5,
            healPercent: 0.5,
            rarity: "uncommon",
            image: "items/consumable/small_potion/small_potion.png",
            temp_icon: "ðŸ§ª"
        }
    },
    levelScaling: {
        mainStatPerLevel: 0.3,
        extraStatMin: 2,
        extraStatMax: 6,
        critExtraStatMin: 1,
        critExtraStatMax: 2,
        finesseExtraStatMin: 1,
        finesseExtraStatMax: 3
    },
    statCaps: {
        critPerItemMax: 5
    },
    rarityBonusByLevel: [
        { minLevel: 1, bonusWeights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 } },
        { minLevel: 5, bonusWeights: { common: -8, uncommon: 3, rare: 3, epic: 1, legendary: 1 } },
        { minLevel: 10, bonusWeights: { common: -15, uncommon: 4, rare: 6, epic: 3, legendary: 2 } },
        { minLevel: 15, bonusWeights: { common: -22, uncommon: 4, rare: 8, epic: 6, legendary: 4 } },
        { minLevel: 20, bonusWeights: { common: -30, uncommon: 3, rare: 10, epic: 9, legendary: 8 } }
    ]
};

function getLevelMainMultiplier(level) {
    return 1 + (level * ITEM_GENERATOR_CONFIG.levelScaling.mainStatPerLevel);
}

function getRarityTableForLevel(level) {
    const appliedBonus = ITEM_GENERATOR_CONFIG.rarityBonusByLevel.reduce(
        (activeBonus, entry) => (level >= entry.minLevel ? entry.bonusWeights : activeBonus),
        ITEM_GENERATOR_CONFIG.rarityBonusByLevel[0].bonusWeights
    );

    return RARITIES.map(rarity => ({
        ...rarity,
        effectiveWeight: Math.max(0, rarity.weight + (appliedBonus[rarity.id] || 0))
    }));
}

function rollRarity(level) {
    const rarityTable = getRarityTableForLevel(level);
    const totalWeight = rarityTable.reduce((sum, rarity) => sum + rarity.effectiveWeight, 0);
    let rand = Math.random() * totalWeight;

    for (const rarity of rarityTable) {
        if (rand < rarity.effectiveWeight) {
            return rarity;
        }
        rand -= rarity.effectiveWeight;
    }

    return rarityTable[0];
}

function applyBaseStats(item, base, mainMultiplier) {
    if (item.type === "weapon") {
        item.stats.atk = Math.floor(base.val * mainMultiplier);
        return;
    }

    if (item.type === "armor") {
        item.stats.def = Math.floor(base.val * mainMultiplier);
        item.stats.hp = Math.floor(base.val * 2 * mainMultiplier);
        return;
    }

    item.stats[base.stat] = Math.floor(base.val * mainMultiplier);
}

function addExtraStats(item, rarity, mainMultiplier) {
    const statPool = ["atk", "def", "hp", "crit", "dodge", "aim"];

    for (let i = 0; i < rarity.extraStats; i++) {
        const extraStat = statPool[Math.floor(Math.random() * statPool.length)];
        let extraVal = 0;

        if (extraStat === "crit") {
            const { critExtraStatMin, critExtraStatMax } = ITEM_GENERATOR_CONFIG.levelScaling;
            extraVal = Math.floor(Math.random() * (critExtraStatMax - critExtraStatMin + 1)) + critExtraStatMin;
        } else if (extraStat === "dodge" || extraStat === "aim") {
            const { finesseExtraStatMin, finesseExtraStatMax } = ITEM_GENERATOR_CONFIG.levelScaling;
            extraVal = Math.floor(Math.random() * (finesseExtraStatMax - finesseExtraStatMin + 1)) + finesseExtraStatMin;
        } else {
            const { extraStatMin, extraStatMax } = ITEM_GENERATOR_CONFIG.levelScaling;
            extraVal = Math.floor((Math.random() * (extraStatMax - extraStatMin) + extraStatMin) * mainMultiplier);
        }

        item.stats[extraStat] = (item.stats[extraStat] || 0) + extraVal;
    }
}

function maybeAddPassive(item, rarity) {
    if (Math.random() < rarity.passiveChance) {
        item.passives.push(PASSIVES[Math.floor(Math.random() * PASSIVES.length)]);
    }
}

function enforceStatCaps(item) {
    const maxCrit = ITEM_GENERATOR_CONFIG.statCaps.critPerItemMax;
    if (item.stats.crit) {
        item.stats.crit = Math.min(maxCrit, item.stats.crit);
    }
}

function createSingleItem(categoryConfig, level, index) {
    const base = categoryConfig.pool[Math.floor(Math.random() * categoryConfig.pool.length)];
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const rarity = rollRarity(level);
    const mainMultiplier = getLevelMainMultiplier(level);

    const item = new GearItem({
        id: Date.now() + index,
        name: `${prefix} ${base.name} ${suffix}`,
        displayName: `${rarity.name} ${prefix} ${base.name} ${suffix}`,
        gearType: categoryConfig.itemType,
        image: base.image || "",
        temp_icon: base.temp_icon || base.icon,
        desc: `A unique ${base.name.toLowerCase()} found on the battlefield. Whispers of its ${prefix.toLowerCase()} origins echo faintly.`,
        rarity: rarity.id,
        stats: {},
        passives: []
    });

    applyBaseStats(item, base, mainMultiplier);
    addExtraStats(item, rarity, mainMultiplier);
    enforceStatCaps(item);
    maybeAddPassive(item, rarity);

    return item;
}

function createHealingPotionReward(index) {
    const potionConfig = ITEM_GENERATOR_CONFIG.specialRewards.healingPotion;

    return new HealingRewardItem({
        id: `healing-potion-${Date.now()}-${index}`,
        name: "Healing Potion",
        displayName: "Healing Potion",
        image: potionConfig.image || "",
        temp_icon: potionConfig.temp_icon || potionConfig.icon,
        desc: `Restore ${Math.floor(potionConfig.healPercent * 100)}% of your max HP. This reward does not add an item to your inventory.`,
        rarity: potionConfig.rarity,
        healPercent: potionConfig.healPercent
    });
}

export function generateLootOptions(level) {
    const options = ITEM_GENERATOR_CONFIG.categories.map((categoryConfig, index) =>
        createSingleItem(categoryConfig, level, index)
    );

    const potionConfig = ITEM_GENERATOR_CONFIG.specialRewards.healingPotion;
    if (potionConfig.enabled && Math.random() < potionConfig.chance) {
        const replaceIndex = Math.floor(Math.random() * options.length);
        options[replaceIndex] = createHealingPotionReward(replaceIndex);
    }

    return options;
}



