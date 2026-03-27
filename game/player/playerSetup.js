export function createEmptyGearSlots(gearSlotOrder) {
    return gearSlotOrder.reduce((slots, key) => {
        slots[key] = null;
        return slots;
    }, {});
}

export function createStarterHelmet(GearItem) {
    return new GearItem({
        id: "starter_helmet",
        name: "Starter Helmet",
        displayName: "Starter Helmet",
        gearType: "armor",
        rarity: "common",
        icon: "🪖",
        stats: { def: 2 },
        passives: [],
        desc: "A basic helmet issued at the start of your journey."
    });
}

export function getPlayerAvatarSrc({ classes, selectedClassId, state = "attack" }) {
    const activeClass = selectedClassId && classes[selectedClassId] ? classes[selectedClassId] : null;
    if (activeClass && activeClass.sprites && activeClass.sprites[state]) {
        return activeClass.sprites[state];
    }

    const wandererClass = classes.wanderer;
    if (wandererClass && wandererClass.sprites && wandererClass.sprites[state]) {
        return wandererClass.sprites[state];
    }

    return `entity/player_class/wanderer/wanderer_images/${state}.png`;
}

export function setPlayerAvatarTemporary({ uiPlayerAvatar, getPlayerAvatarSrc, state, duration }) {
    if (!uiPlayerAvatar) return;
    uiPlayerAvatar.src = getPlayerAvatarSrc(state);
    setTimeout(() => {
        uiPlayerAvatar.src = getPlayerAvatarSrc("attack");
    }, duration);
}

export function resetPlayerState({
    playerInfo,
    currentGameStats,
    classes,
    getExpNeeded,
    createInitialCheatOverrides,
    createSmallPotion,
    createEmptyGearSlots,
    createStarterHelmet,
    ensureActiveClassSkillRanks,
    recalculateStats,
    updatePlayerUI,
    updateExpUI,
    renderEquipment,
    updateSkillTreeButton,
    renderSkillTree,
    setAvatarToAttack
}) {
    playerInfo.lvl = 1;
    playerInfo.exp = 0;
    playerInfo.maxExp = getExpNeeded(1);
    playerInfo.skillPoints = 20;
    playerInfo.skillTreeRanks = {};
    ensureActiveClassSkillRanks();
    currentGameStats.cheatOverrides = createInitialCheatOverrides();

    if (currentGameStats.selectedClassId && classes[currentGameStats.selectedClassId]) {
        const cls = classes[currentGameStats.selectedClassId];
        playerInfo.baseHp = cls.baseStats.hp;
        playerInfo.baseAtk = cls.baseStats.atk;
        playerInfo.baseDef = cls.baseStats.def;
        playerInfo.baseCrit = cls.baseStats.crit;
        playerInfo.baseDodge = cls.baseStats.dodge;
        playerInfo.baseAim = cls.baseStats.aim;
    } else {
        playerInfo.baseHp = 100;
        playerInfo.baseAtk = 10;
        playerInfo.baseDef = 5;
        playerInfo.baseCrit = 0;
        playerInfo.baseDodge = 5;
        playerInfo.baseAim = 0;
    }

    playerInfo.inventory = [];
    playerInfo.consumables = [createSmallPotion()];
    playerInfo.gearSlots = createEmptyGearSlots();
    playerInfo.gearSlots.helmet = createStarterHelmet();
    recalculateStats();
    playerInfo.hp = playerInfo.maxHp;
    updatePlayerUI();
    updateExpUI();
    renderEquipment();
    updateSkillTreeButton();
    renderSkillTree();
    setAvatarToAttack();
}
