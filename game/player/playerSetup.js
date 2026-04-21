import { CONSUMABLES } from "../../items/consumable/consumable.js";
import { GEARS } from "../../items/gears/gears.js";

export function createEmptyGearSlots(gearSlotOrder) {
    return gearSlotOrder.reduce((slots, key) => {
        slots[key] = null;
        return slots;
    }, {});
}

function instantiateById(id) {
    const itemId = String(id || "").trim();
    if (!itemId) return null;
    const consumableTemplate = CONSUMABLES[itemId];
    if (consumableTemplate && typeof consumableTemplate === "object" && consumableTemplate.constructor) {
        return new consumableTemplate.constructor();
    }
    const gearTemplate = GEARS[itemId];
    if (gearTemplate && typeof gearTemplate === "object" && gearTemplate.constructor) {
        return new gearTemplate.constructor();
    }
    return null;
}

function resolveGearSlotCandidates(slotType) {
    const normalized = String(slotType || "").trim().toLowerCase();
    if (normalized === "weapon" || normalized === "weapon_1" || normalized === "weapon_2") {
        return ["weapon_1", "weapon_2"];
    }
    if (normalized === "relic" || normalized === "relic_1" || normalized === "relic_2") {
        return ["relic_1", "relic_2"];
    }
    if (normalized) return [normalized];
    return [];
}

function placeStartingGear(gearSlots, gearItem) {
    if (!gearItem || !gearSlots || typeof gearSlots !== "object") return;
    const candidates = resolveGearSlotCandidates(gearItem.slotType);
    for (const slotKey of candidates) {
        if (!Object.prototype.hasOwnProperty.call(gearSlots, slotKey)) continue;
        if (!gearSlots[slotKey]) {
            gearSlots[slotKey] = gearItem;
            return;
        }
    }
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
    createInitialCheatOverrides,
    createEmptyGearSlots,
    ensureActiveClassSkillRanks,
    recalculateStats,
    updatePlayerUI,
    renderEquipment,
    updateSkillTreeButton,
    renderSkillTree,
    setAvatarToAttack
}) {
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
    playerInfo.consumables = [];
    playerInfo.gearSlots = createEmptyGearSlots();
    playerInfo.essence = 0;
    const activeClass = currentGameStats.selectedClassId && classes[currentGameStats.selectedClassId]
        ? classes[currentGameStats.selectedClassId]
        : (classes.wanderer || null);
    const classInventoryIds = Array.isArray(activeClass && activeClass.inventory) ? activeClass.inventory : [];
    classInventoryIds.forEach(itemId => {
        const instance = instantiateById(itemId);
        if (!instance) return;
        playerInfo.inventory.push(instance);
        if (instance.rewardType === "consumable") {
            playerInfo.consumables.push(instance);
            return;
        }
        if (instance.rewardType === "gear") {
            placeStartingGear(playerInfo.gearSlots, instance);
        }
    });
    recalculateStats();
    playerInfo.hp = playerInfo.maxHp;
    updatePlayerUI();
    renderEquipment();
    updateSkillTreeButton();
    renderSkillTree();
    setAvatarToAttack();
}
