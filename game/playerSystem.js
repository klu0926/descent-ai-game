export function getClassDefaultStats(selectedClassId, classes) {
    if (selectedClassId && classes[selectedClassId]) {
        return classes[selectedClassId].baseStats;
    }
    return {
        hp: 100,
        atk: 10,
        def: 5,
        crit: 0,
        dodge: 5,
        aim: 0
    };
}

export function getClassLevelUpGrowth(selectedClassId, classes) {
    const activeClass = selectedClassId && classes[selectedClassId] ? classes[selectedClassId] : classes.wanderer;
    const growth = activeClass && activeClass.levelUpGrowth ? activeClass.levelUpGrowth : null;
    return {
        hp: growth ? (growth.hp || 0) : 10,
        atk: growth ? (growth.atk || 0) : 1,
        def: growth ? (growth.def || 0) : 1,
        crit: growth ? (growth.crit || 0) : 0,
        dodge: growth ? (growth.dodge || 0) : 0,
        aim: growth ? (growth.aim || 0) : 0
    };
}

export function applyClassLevelUpGrowth(playerInfo, levelsGained, growth) {
    if (levelsGained <= 0) return;
    const hpGain = growth.hp * levelsGained;
    playerInfo.baseHp += hpGain;
    playerInfo.hp += hpGain;
    playerInfo.baseAtk += growth.atk * levelsGained;
    playerInfo.baseDef += growth.def * levelsGained;
    playerInfo.baseCrit += growth.crit * levelsGained;
    playerInfo.baseDodge += growth.dodge * levelsGained;
    playerInfo.baseAim += growth.aim * levelsGained;
}

export function toNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
}

export function recalculateStats({
    playerInfo,
    equippedItems,
    passiveBonuses,
    skillBonuses,
    cheatOverrides
}) {
    let bonusHp = 0;
    let bonusAtk = 0;
    let bonusDef = 0;
    let bonusCrit = 0;
    let bonusDodge = 0;
    let bonusAim = 0;

    for (const item of equippedItems) {
        bonusHp += (item.stats.hp || 0);
        bonusAtk += (item.stats.atk || 0);
        bonusDef += (item.stats.def || 0);
        bonusCrit += (item.stats.crit || 0);
        bonusDodge += (item.stats.dodge || 0);
        bonusAim += (item.stats.aim || 0);
    }

    const baseHpTotal = playerInfo.baseHp + passiveBonuses.hp + bonusHp;
    playerInfo.maxHp = Math.floor(baseHpTotal * (1 + skillBonuses.hpMultiplier));
    playerInfo.atk = playerInfo.baseAtk + passiveBonuses.atk + bonusAtk;
    playerInfo.def = playerInfo.baseDef + passiveBonuses.def + bonusDef;
    playerInfo.crit = playerInfo.baseCrit + passiveBonuses.crit + bonusCrit;
    playerInfo.dodge = playerInfo.baseDodge + bonusDodge + skillBonuses.dodgeFlat;
    playerInfo.aim = playerInfo.baseAim + bonusAim;

    if (Number.isFinite(cheatOverrides.maxHp)) playerInfo.maxHp = Math.max(1, cheatOverrides.maxHp);
    if (Number.isFinite(cheatOverrides.atk)) playerInfo.atk = Math.max(0, cheatOverrides.atk);
    if (Number.isFinite(cheatOverrides.def)) playerInfo.def = Math.max(0, cheatOverrides.def);
    if (Number.isFinite(cheatOverrides.crit)) playerInfo.crit = Math.max(0, cheatOverrides.crit);
    if (Number.isFinite(cheatOverrides.dodge)) playerInfo.dodge = Math.max(0, cheatOverrides.dodge);
    if (Number.isFinite(cheatOverrides.aim)) playerInfo.aim = Math.max(0, cheatOverrides.aim);

    if (playerInfo.hp > playerInfo.maxHp) playerInfo.hp = playerInfo.maxHp;
}

export function getDodgeChance(attackerAim, defenderDodge) {
    return Math.max(0, defenderDodge - attackerAim) / 100;
}

export function tryDodge(attackerAim, defenderDodge, randomFn = Math.random) {
    return randomFn() < getDodgeChance(attackerAim, defenderDodge);
}
