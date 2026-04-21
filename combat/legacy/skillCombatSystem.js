export function getSkillTreeStatBonuses({ getSkillRank, battleState }) {
    const hpMultiplier = getSkillRank("hardened_body") * 0.05;
    const dodgeFlat = getSkillRank("light_footing") * 2;
    const dodgeBuff = battleState.skillTreeDodgeBuffTurns > 0
        ? (getSkillRank("evasive_instinct") * 4) + (getSkillRank("ghost_walker") * 3)
        : 0;
    return {
        hpMultiplier,
        dodgeFlat: dodgeFlat + dodgeBuff
    };
}

export function getSkillTreeRegenRate({ getSkillRank, battleState, canTriggerTurnSkill }) {
    const canTrigger = typeof canTriggerTurnSkill === "function"
        ? canTriggerTurnSkill
        : skillId => {
            void skillId;
            return true;
        };
    let bonusRate = 0;
    if (canTrigger("healing_scroll") && battleState.healingScrollRegenTurns > 0 && getSkillRank("healing_scroll") >= 2) {
        bonusRate += 0.03;
    }
    const enduranceRank = getSkillRank("lasting_endurance");
    if (canTrigger("lasting_endurance") && enduranceRank > 0) {
        bonusRate += Math.min(0.03, enduranceRank * 0.004 * battleState.turnCount);
    }
    return bonusRate;
}

export function getPotionDropChance({ getSkillRank, playerInfo }) {
    let chance = getSkillRank("scavengers_luck") * 0.05;
    if (playerInfo.hp <= Math.floor(playerInfo.maxHp * 0.3)) {
        chance += getSkillRank("predators_recovery") * 0.02;
    }
    return Math.min(0.65, chance);
}

export function createScavengerPotionReward(createSmallPotion) {
    return createSmallPotion();
}

export function onPlayerSuccessfulHit({ battleState, getSkillRank, floatText }) {
    // Hidden Snare trigger logic is now handled by skill callback via event listeners.
    void battleState;
    void getSkillRank;
    void floatText;
}

export function applySkillTreeAttackHealing({
    baseDamage,
    getSkillRank,
    playerInfo,
    floatText,
    playSound,
    randomFn = Math.random
}) {
    const bloodRank = getSkillRank("blood_drinker");
    if (bloodRank <= 0 || baseDamage <= 0) return;
    const lowHp = playerInfo.hp <= Math.floor(playerInfo.maxHp * 0.3);
    const chance = bloodRank * 0.03;
    const extraChance = lowHp ? getSkillRank("predators_recovery") * 0.02 : 0;
    if (randomFn() >= (chance + extraChance)) return;

    const healRate = 0.03 + bloodRank * 0.01 + (lowHp ? getSkillRank("predators_recovery") * 0.01 : 0);
    const heal = Math.max(1, Math.floor(baseDamage * healRate));
    playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
    floatText("player", `+${heal} HP`, "heal");
    playSound("heal");
}
