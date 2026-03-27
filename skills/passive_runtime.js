import { PassiveSkill } from "./passive_skill.js";

export const PASSIVES = [
    { id: "lifesteal", name: "Lifesteal", desc: "Heal for 20% of dealt damage." },
    { id: "dodge", name: "Dodge", desc: "15% absolute chance to dodge." },
    { id: "thorns", name: "Thorns", desc: "Reflect 30% of incoming damage." },
    { id: "regen", name: "Regeneration", desc: "Heal 5% Max HP every turn." },
    { id: "vampire", name: "Vampiric Touch", desc: "Heal for 40% of dealt damage." },
    { id: "evasion", name: "Evasion", desc: "30% absolute chance to dodge." },
    { id: "spikes", name: "Spiked Armor", desc: "Reflect 50% of incoming damage." },
    { id: "mend", name: "Mend", desc: "Heal 10% Max HP every turn." },
    { id: "frenzy", name: "Frenzy", desc: "Deal +50% Damage if HP is below 50%." },
    { id: "bulwark", name: "Bulwark", desc: "Take -30% Damage from all attacks." },
    { id: "first_strike", name: "First Strike", desc: "Deal +100% Damage on full HP." },
    { id: "lucky", name: "Lucky Strike", desc: "10% chance to deal massive critical damage." },
    { id: "poison", name: "Poison Touch", desc: "Deals extra 10 damage instantly on hit." },
    { id: "smite", name: "Smite", desc: "Deals extra 25 damage instantly on hit." },
    { id: "titan", name: "Titan", desc: "Increases your Base ATK by 25." },
    { id: "colossus", name: "Colossus", desc: "Increases your Base HP by 150." },
    { id: "iron_skin", name: "Iron Skin", desc: "Increases your Base DEF by 20." },
    { id: "berserk", name: "Berserk", desc: "Increases Crit Chance by +25%." },
    { id: "survival", name: "Survivalist", desc: "Heal 50 HP instantly if HP drops heavily." },
    { id: "counter", name: "Counter Attack", desc: "30% chance to retailiate when hit." },
    { id: "divine", name: "Divine Shield", desc: "25% chance to take 0 damage." },
    { id: "bloodthirst", name: "Bloodthirst", desc: "Heal 30% Max HP upon killing." },
    { id: "light", name: "Light Burst", desc: "Heal 5% HP on hit." },
    { id: "time", name: "Time Warp", desc: "10% chance to take two turns." },
    { id: "frost", name: "Frostbite", desc: "Reduce Enemy ATK passively." },
    { id: "fire", name: "Aura of Fire", desc: "Enemy takes 15 damage every turn." },
    { id: "earth", name: "Earth Shatter", desc: "Crits deal 250% damage." },
    { id: "wind", name: "Wind Walk", desc: "Dodge chance increases by +10%." },
    { id: "shadow", name: "Shadow Strike", desc: "Ignore enemy DEF completely." },
    { id: "holy", name: "Holy Light", desc: "Immune to critical hits." },
    { id: "dark", name: "Dark Harvest", desc: "Steal 1 Max HP per hit." },
    { id: "venom", name: "Venom", desc: "Enemies lose 5% HP per turn." },
    { id: "phantom", name: "Phantom", desc: "50% chance to dodge fatal blows." },
    { id: "blight", name: "Blight", desc: "Deal 3x damage to enemies below 20% HP." }
].map(skill => new PassiveSkill(skill));

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function countPassive(inventory, id) {
    return inventory.reduce(
        (count, item) => count + item.passives.filter(passive => passive.id === id).length,
        0
    );
}

export function hasPassive(inventory, id) {
    return countPassive(inventory, id) > 0;
}

export function getPassiveStatBonuses(inventory) {
    return {
        hp: countPassive(inventory, "colossus") * 150,
        atk: countPassive(inventory, "titan") * 25,
        def: countPassive(inventory, "iron_skin") * 20,
        crit: countPassive(inventory, "berserk") * 25
    };
}

export function getPlayerDamageReduction(inventory) {
    return clamp(countPassive(inventory, "bulwark") * 0.3, 0, 0.8);
}

export function getPlayerReflectRate(inventory) {
    return (countPassive(inventory, "thorns") * 0.3) + (countPassive(inventory, "spikes") * 0.5);
}

export function getPlayerRegenRate(inventory) {
    return (countPassive(inventory, "regen") * 0.05) + (countPassive(inventory, "mend") * 0.1);
}

export function getPlayerExtraDodgeChance(inventory) {
    return (countPassive(inventory, "dodge") * 0.15)
        + (countPassive(inventory, "evasion") * 0.3)
        + (countPassive(inventory, "wind") * 0.1);
}

export function getPlayerLifestealRate(inventory) {
    return (countPassive(inventory, "lifesteal") * 0.2)
        + (countPassive(inventory, "vampire") * 0.4);
}

export function getPlayerOnHitHealRate(inventory) {
    return countPassive(inventory, "light") * 0.05;
}

export function getPlayerFlatOnHitDamage(inventory) {
    return (countPassive(inventory, "poison") * 10) + (countPassive(inventory, "smite") * 25);
}

export function getPlayerCritMultiplier(inventory) {
    return hasPassive(inventory, "earth") ? 2.5 : 1.5;
}

export function getEnemyAtkModifier(inventory) {
    return clamp(1 - (countPassive(inventory, "frost") * 0.15), 0.3, 1);
}

export function getEnemyDisplayedAtk(inventory, enemy) {
    if (!enemy) return 0;
    return Math.max(1, Math.floor(enemy.atk * getEnemyAtkModifier(inventory)));
}

export function getEnemyTurnDots(inventory, enemy) {
    if (!enemy || enemy.hp <= 0) {
        return { totalDamage: 0, fireDamage: 0, venomDamage: 0 };
    }

    const fireDamage = countPassive(inventory, "fire") * 15;
    const venomRate = countPassive(inventory, "venom") * 0.05;
    const venomDamage = venomRate > 0 ? Math.max(1, Math.floor(enemy.maxHp * venomRate)) : 0;

    return {
        totalDamage: fireDamage + venomDamage,
        fireDamage,
        venomDamage
    };
}

export function getCounterChance(inventory) {
    return clamp(countPassive(inventory, "counter") * 0.3, 0, 0.9);
}

export function getDivineShieldChance(inventory) {
    return clamp(countPassive(inventory, "divine") * 0.25, 0, 0.9);
}

export function getTimeWarpChance(inventory) {
    return clamp(countPassive(inventory, "time") * 0.1, 0, 0.5);
}

export function getPhantomChance(inventory) {
    return clamp(countPassive(inventory, "phantom") * 0.5, 0, 0.95);
}

export function getLuckyStrikeChance(inventory) {
    return clamp(countPassive(inventory, "lucky") * 0.1, 0, 0.75);
}

export function shouldTriggerSurvivalist(inventory, battleState, previousHp, currentHp) {
    return countPassive(inventory, "survival") > 0
        && !battleState.survivalUsed
        && previousHp > 50
        && currentHp <= 50;
}

export function getDarkHarvestAmount(inventory, enemy) {
    const darkCount = countPassive(inventory, "dark");
    if (!enemy || darkCount <= 0) return 0;
    return Math.max(0, Math.min(darkCount, enemy.maxHp - 1));
}

export function getBloodthirstHealAmount(inventory, maxHp) {
    return Math.floor(maxHp * (countPassive(inventory, "bloodthirst") * 0.3));
}

