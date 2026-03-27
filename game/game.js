import { createEnemy } from "./enemyGenerator.js";
import { generateLootOptions } from "./itemGenerator.js";
import { getExpNeeded, checkLevelUp, getPlayerExpPercent } from "./levelSystem.js";
import {
    applySkillTreeAttackHealing as applySkillTreeAttackHealingFromModule,
    getSkillTreeRegenRate as getSkillTreeRegenRateFromModule,
    getSkillTreeStatBonuses as getSkillTreeStatBonusesFromModule,
    onPlayerSuccessfulHit as onPlayerSuccessfulHitFromModule
} from "./combat/skillCombatSystem.js";
import { createCombatSystem } from "./combat/combatSetup.js";
import {
    createEmptyGearSlots as createEmptyGearSlotsFromPlayerModule,
    createStarterHelmet as createStarterHelmetFromPlayerModule,
    getPlayerAvatarSrc as getPlayerAvatarSrcFromPlayerModule,
    resetPlayerState as resetPlayerStateFromPlayerModule,
    setPlayerAvatarTemporary as setPlayerAvatarTemporaryFromPlayerModule
} from "./player/playerSetup.js";
import { consumeInventoryItem as consumeInventoryItemFromModule } from "./inventory/inventorySystem.js";
import {
    leaveLootSelection as leaveLootSelectionFromModule,
    presentLootSelection as presentLootSelectionFromModule,
    presentScavengerPotionReward as presentScavengerPotionRewardFromModule,
    selectLoot as selectLootFromModule
} from "./loot/lootSystem.js";
import {
    applyClassLevelUpGrowth as applyClassLevelUpGrowthFromModule,
    getClassDefaultStats as getClassDefaultStatsFromModule,
    getClassLevelUpGrowth as getClassLevelUpGrowthFromModule,
    recalculateStats as recalculateStatsFromModule,
    tryDodge as tryDodgeFromModule
} from "./playerSystem.js";
import {
    formatStats as formatStatsFromModule,
    getPassiveShortLabel as getPassiveShortLabelFromModule,
    getRewardStatsText as getRewardStatsTextFromModule
} from "./rewardSystem.js";
import {
    rollChance as rollChanceFromModule,
    rollDamage as rollDamageFromModule
} from "./randomSystem.js";
import { CURRENT_GAME_STATS, createInitialCheatOverrides } from "./current_game_stats.js";
import { CLASSES } from "../entity/player_class/player_class.js";
import { createSmallPotion } from "../items/consumable/consumable.js";
import { createAudioSystem } from "../audio/audioSystem.js";
import { GAME_EVENTS, createEventBus } from "../event/eventBus.js";
import { GearItem } from "../items/item.js";
import {
    applyEnemySize as applyEnemySizeFromUI,
    clearEnemyDisplay as clearEnemyDisplayFromUI,
    clearScreenSpaceEffects as clearScreenSpaceEffectsFromUI,
    createUIRefs,
    floatText as floatTextFromUI,
    hideInfoTooltip as hideInfoTooltipFromUI,
    isAnyFullscreenOverlayVisible as isAnyFullscreenOverlayVisibleFromUI,
    mountFullscreenOverlaysToBody as mountFullscreenOverlaysToBodyFromUI,
    renderEquipment as renderEquipmentFromUI,
    resetEqReadoutBackground as resetEqReadoutBackgroundFromUI,
    setPauseState as setPauseStateFromUI,
    showEnemyDisplay as showEnemyDisplayFromUI,
    showEnemyInfo as showEnemyInfoFromUI,
    showHitCut as showHitCutFromUI,
    showInfoTooltip as showInfoTooltipFromUI,
    showItemInfo as showItemInfoFromUI,
    showPassiveInfo as showPassiveInfoFromUI,
    startAvatarBlurPulses as startAvatarBlurPulsesFromUI,
    triggerAnimation as triggerAnimationFromUI,
    triggerCritFlash as triggerCritFlashFromUI,
    triggerDodgeAnimation as triggerDodgeAnimationFromUI,
    triggerScreenShake as triggerScreenShakeFromUI,
    updateEnemyUI as updateEnemyUIFromUI,
    updateExpUI as updateExpUIFromUI,
    updatePlayerUI as updatePlayerUIFromUI,
    bindCombatStatTooltips as bindCombatStatTooltipsFromUI
} from "../UI/gameUI.js";
import {
    hideSkillTooltip as hideSkillTooltipFromSkillTreeUI,
    renderSkillTree as renderSkillTreeFromUI,
    showSkillTooltip as showSkillTooltipFromSkillTreeUI,
    updateSkillTreeButton as updateSkillTreeButtonFromUI
} from "../UI/skillTreeUI.js";
import { renderClassSelection } from "../UI/classSelectionUI.js";
import { createCheatPanelController } from "../UI/cheatPanelController.js";
import { bindUIControls } from "../UI/uiControlBindings.js";
import {
    closeSkillTreePanel as closeSkillTreePanelFromUI,
    openSkillTreePanel as openSkillTreePanelFromUI
} from "../UI/panelControllers.js";
import {
    countPassive as countPassiveFromModule,
    getBloodthirstHealAmount as getBloodthirstHealAmountFromModule,
    getCounterChance as getCounterChanceFromModule,
    getDarkHarvestAmount as getDarkHarvestAmountFromModule,
    getDivineShieldChance as getDivineShieldChanceFromModule,
    getEnemyDisplayedAtk as getEnemyDisplayedAtkFromModule,
    getEnemyTurnDots as getEnemyTurnDotsFromModule,
    getLuckyStrikeChance as getLuckyStrikeChanceFromModule,
    getPassiveStatBonuses as getPassiveStatBonusesFromModule,
    getPhantomChance as getPhantomChanceFromModule,
    getPlayerCritMultiplier as getPlayerCritMultiplierFromModule,
    getPlayerDamageReduction as getPlayerDamageReductionFromModule,
    getPlayerExtraDodgeChance as getPlayerExtraDodgeChanceFromModule,
    getPlayerFlatOnHitDamage as getPlayerFlatOnHitDamageFromModule,
    getPlayerLifestealRate as getPlayerLifestealRateFromModule,
    getPlayerOnHitHealRate as getPlayerOnHitHealRateFromModule,
    getPlayerReflectRate as getPlayerReflectRateFromModule,
    getPlayerRegenRate as getPlayerRegenRateFromModule,
    getTimeWarpChance as getTimeWarpChanceFromModule,
    hasPassive as hasPassiveFromModule,
    shouldTriggerSurvivalist as shouldTriggerSurvivalistFromModule
} from "../skills/passive_runtime.js";
import { createPassiveSkillManager } from "../skills/passive_skill_manager.js";
import { ENEMY_SIZE_TO_PX } from "../entity/enemy_class/enemy_type_data.js";

const currentGameStats = CURRENT_GAME_STATS;
const playerInfo = currentGameStats.playerInfo;
const CONSUMABLE_SLOT_COUNT = 8;
const GEAR_SLOT_ORDER = [
    "helmet",
    "body",
    "shoes",
    "hands",
    "weapon_1",
    "weapon_2",
    "relic_1",
    "relic_2"
];
const GEAR_SLOT_LABELS = {
    helmet: "Helmet",
    body: "Body",
    shoes: "Shoes",
    hands: "Hands",
    weapon_1: "Weapon 1",
    weapon_2: "Weapon 2",
    relic_1: "Relic 1",
    relic_2: "Relic 2"
};
const audioSystem = createAudioSystem();
const gameEventBus = createEventBus();
const HIT_CUT_SRC = "resources/images/effects/cut.png";
const FIRE_EFFECT_SRC = "resources/images/effects/fire.png";

function initAudio() {
    audioSystem.init();
}

function playSound(type) {
    audioSystem.play(type);
}

const uiRefs = createUIRefs();
const {
    uiPlayerHpBar,
    uiPlayerHpText,
    uiPlayerAtk,
    uiPlayerDef,
    uiPlayerCrit,
    uiPlayerDodge,
    uiPlayerAim,
    uiPlayerAvatar,
    uiSkillsReadout,
    uiEnemyName,
    uiEnemyHpBar,
    uiEnemyHpText,
    uiEnemyAtk,
    uiEnemyDef,
    uiEnemyCrit,
    uiEnemyDodge,
    uiEnemyAim,
    uiEnemyAvatar,
    uiEnemyInfo,
    uiEnemyHpContainer,
    uiEnemyStatsPanel,
    uiLevelDisplay,
    uiTurnDisplay,
    overlay,
    modalBtn,
    lootOverlay,
    lootOptionsContainer,
    lootLeaveBtn,
    tutorialOverlay,
    pauseOverlay,
    startJourneyBtn,
    eqReadout,
    infoTooltip,
    bgMusic,
    musicBtn,
    pauseBtn,
    skillTreeBtn,
    cheatBtn,
    pauseResumeBtn,
    editorPageBtn,
    uiPlayerExpBar,
    uiPlayerExpText,
    uiPlayerName,
    levelupOverlay,
    levelupDesc,
    levelupCloseBtn,
    skillTreeOverlay,
    skillTreeSections,
    skillTreeStatus,
    skillTreeCloseBtn,
    skillTreePortrait,
    skillTreeTooltip,
    cheatOverlay,
    cheatCloseBtn,
    cheatSaveBtn,
    cheatResetBtn,
    cheatHpInput,
    cheatMaxHpInput,
    cheatAtkInput,
    cheatDefInput,
    cheatCritInput,
    cheatDodgeInput,
    cheatAimInput,
    cheatGodModeInput,
    cheatReverseSkillInput,
    classOverlay,
    classOptions,
    confirmClassBtn
} = uiRefs;

const DEFAULT_READOUT_HTML = "";

const FALLBACK_SKILL_TREE = { maxLevel: 20, sections: [], nodes: [] };

function getActivePlayerClass() {
    if (currentGameStats.selectedClassId && CLASSES[currentGameStats.selectedClassId]) {
        return CLASSES[currentGameStats.selectedClassId];
    }
    return CLASSES.wanderer || null;
}

function getActiveSkillTreeConfig() {
    const activeClass = getActivePlayerClass();
    if (activeClass && activeClass.skillTree) return activeClass.skillTree;
    return FALLBACK_SKILL_TREE;
}

function getMaxPlayerLevel() {
    return getActiveSkillTreeConfig().maxLevel || 20;
}

function getSkillTreeSections() {
    return getActiveSkillTreeConfig().sections || [];
}

function getSkillTreeNodes() {
    return getActiveSkillTreeConfig().nodes || [];
}

function getSkillTreeById() {
    return new Map(getSkillTreeNodes().map(node => [node.id, node]));
}

function getActiveClassId() {
    const activeClass = getActivePlayerClass();
    return activeClass && activeClass.id ? activeClass.id : "wanderer";
}

function ensureActiveClassSkillRanks() {
    if (!playerInfo.skillTreeRanks || typeof playerInfo.skillTreeRanks !== "object") {
        playerInfo.skillTreeRanks = {};
    }
    const classId = getActiveClassId();
    if (!playerInfo.skillTreeRanks[classId] || typeof playerInfo.skillTreeRanks[classId] !== "object") {
        playerInfo.skillTreeRanks[classId] = {};
    }
    return playerInfo.skillTreeRanks[classId];
}

function getSkillRank(id) {
    const classRanks = ensureActiveClassSkillRanks();
    return classRanks[id] || 0;
}

function getSkillTurnOwner(skillId) {
    const node = getSkillTreeById().get(skillId);
    return node && node.turnOwner ? node.turnOwner : "player";
}

function canTriggerTurnSkill(skillId) {
    const owner = currentGameStats.battleState && currentGameStats.battleState.turnOwner
        ? currentGameStats.battleState.turnOwner
        : "player";
    return getSkillTurnOwner(skillId) === owner;
}

const passiveSkillManager = createPassiveSkillManager({
    eventBus: gameEventBus,
    gameEvents: GAME_EVENTS,
    getActivePlayerClass,
    getSkillRank,
    runtimeContext: {
        currentGameStats,
        playerInfo,
        getSkillRank,
        createSmallPotion,
        floatText
    }
});

function getTotalSkillSpent() {
    return getSkillTreeNodes().reduce((sum, node) => sum + getSkillRank(node.id), 0);
}

function getSectionPointRequirement(sectionId) {
    const section = getSkillTreeSections().find(entry => entry.id === sectionId);
    if (!section) return Number.MAX_SAFE_INTEGER;
    return section.requiredTreePoints || 0;
}

function isSectionUnlocked(sectionId) {
    return getTotalSkillSpent() >= getSectionPointRequirement(sectionId);
}

function canSpendSkillPoint(node) {
    if (!node) return false;
    if (playerInfo.skillPoints <= 0) return false;
    if (!isSectionUnlocked(node.section)) return false;
    if (getSkillRank(node.id) >= node.maxRank) return false;
    return true;
}

function updateSkillTreeButton() {
    updateSkillTreeButtonFromUI(skillTreeBtn, playerInfo.skillPoints);
}

function renderSkillTree() {
    renderSkillTreeFromUI({
        skillTreeSectionsElement: skillTreeSections,
        skillTreeStatusElement: skillTreeStatus,
        skillTreePortraitElement: skillTreePortrait,
        playerInfo,
        maxPlayerLevel: getMaxPlayerLevel(),
        skillTreeSections: getSkillTreeSections(),
        skillTreeNodes: getSkillTreeNodes(),
        getSkillRank,
        canSpendSkillPoint,
        isSectionUnlocked,
        getSectionPointRequirement,
        getTotalSkillSpent,
        playerClass: getActivePlayerClass()
    });
}

function spendSkillPoint(skillId) {
    const node = getSkillTreeById().get(skillId);
    if (!canSpendSkillPoint(node)) return false;

    const classRanks = ensureActiveClassSkillRanks();
    classRanks[skillId] = getSkillRank(skillId) + 1;
    playerInfo.skillPoints -= 1;
    if (playerInfo.lvl < getMaxPlayerLevel()) {
        playerInfo.lvl += 1;
        playerInfo.maxExp = getExpNeeded(playerInfo.lvl);
    }
    passiveSkillManager.sync();
    recalculateStats();
    updatePlayerUI();
    updateExpUI();
    updateSkillTreeButton();
    renderSkillTree();
    playSound("pick");
    return true;
}

function reverseSkillPoint(skillId) {
    if (!currentGameStats.cheatOverrides.allowReverseSkillPoint) return false;
    const node = getSkillTreeById().get(skillId);
    if (!node) return false;

    const classRanks = ensureActiveClassSkillRanks();
    const currentRank = getSkillRank(skillId);
    if (currentRank <= 0) return false;

    classRanks[skillId] = currentRank - 1;
    playerInfo.skillPoints += 1;

    if (playerInfo.lvl > 1) {
        playerInfo.lvl -= 1;
        playerInfo.maxExp = getExpNeeded(playerInfo.lvl);
        playerInfo.exp = Math.min(playerInfo.exp, playerInfo.maxExp);
    }

    passiveSkillManager.sync();
    recalculateStats();
    updatePlayerUI();
    updateExpUI();
    updateSkillTreeButton();
    renderSkillTree();
    playSound("pick");
    return true;
}

function gainSkillPoints(amount) {
    if (amount <= 0) return;
    playerInfo.skillPoints += amount;
    updateSkillTreeButton();
    renderSkillTree();
}

function openSkillTree() {
    openSkillTreePanelFromUI({
        skillTreeOverlay,
        classOverlay,
        currentGameStats,
        clearScreenSpaceEffects,
        setPauseState,
        pauseOverlay,
        renderSkillTree
    });
}

function closeSkillTree() {
    closeSkillTreePanelFromUI({
        skillTreeOverlay,
        skillTreeTooltip,
        currentGameStats,
        setPauseState,
        pauseOverlay
    });
}

function getClassDefaultStats() {
    return getClassDefaultStatsFromModule(currentGameStats.selectedClassId, CLASSES);
}

function getClassLevelUpGrowth() {
    return getClassLevelUpGrowthFromModule(currentGameStats.selectedClassId, CLASSES);
}

function applyClassLevelUpGrowth(levelsGained) {
    applyClassLevelUpGrowthFromModule(playerInfo, levelsGained, getClassLevelUpGrowth());
}

const {
    openCheatPanel,
    closeCheatPanel,
    saveCheatStats,
    resetCheatToClassDefault
} = createCheatPanelController({
    cheatOverlay,
    classOverlay,
    pauseOverlay,
    currentGameStats,
    playerInfo,
    cheatInputs: {
        cheatHpInput,
        cheatMaxHpInput,
        cheatAtkInput,
        cheatDefInput,
        cheatCritInput,
        cheatDodgeInput,
        cheatAimInput,
        cheatGodModeInput,
        cheatReverseSkillInput
    },
    clearScreenSpaceEffects,
    setPauseState,
    recalculateStats,
    updatePlayerUI,
    updateExpUI,
    floatText,
    getClassDefaultStats,
    getClassLevelUpGrowth,
    createInitialCheatOverrides
});

function showSkillTooltip(target, x, y) {
    showSkillTooltipFromSkillTreeUI({
        skillTreeTooltip,
        skillTreeById: getSkillTreeById(),
        getSkillRank,
        isSectionUnlocked,
        canSpendSkillPoint,
        target,
        x,
        y
    });
}

function hideSkillTooltip() {
    hideSkillTooltipFromSkillTreeUI(skillTreeTooltip);
}

const volumeStates = [
    { vol: 0.6, icon: "\u{1F50A}" },
    { vol: 0.3, icon: "\u{1F509}" },
    { vol: 0.1, icon: "\u{1F508}" },
    { vol: 0.0, icon: "\u{1F507}" }
];
audioSystem.setVolume(volumeStates[currentGameStats.volIndex].vol);

function floatText(target, msg, type = "info") {
    floatTextFromUI(target, msg, type);
}

function setPauseState(paused) {
    setPauseStateFromUI({
        paused,
        currentGameStats,
        pauseBtn,
        pauseOverlay,
        skillTreeOverlay
    });
}

function isAnyFullscreenOverlayVisible() {
    const overlays = [overlay, lootOverlay, pauseOverlay, tutorialOverlay, classOverlay, levelupOverlay, cheatOverlay, skillTreeOverlay];
    return isAnyFullscreenOverlayVisibleFromUI(overlays);
}

function clearScreenSpaceEffects() {
    clearScreenSpaceEffectsFromUI();
}

function startAvatarBlurPulses() {
    startAvatarBlurPulsesFromUI({
        currentGameStats,
        uiPlayerAvatar,
        uiEnemyAvatar
    });
}

function mountFullscreenOverlaysToBody() {
    const overlays = [overlay, lootOverlay, tutorialOverlay, pauseOverlay, levelupOverlay, classOverlay, cheatOverlay, skillTreeOverlay];
    mountFullscreenOverlaysToBodyFromUI(overlays);
}

function triggerScreenShake() {
    triggerScreenShakeFromUI(isAnyFullscreenOverlayVisible());
}

function triggerCritFlash() {
    triggerCritFlashFromUI();
}

function hasPassive(id) {
    return hasPassiveFromModule(getEquippedItems(), id);
}

function countPassive(id) {
    return countPassiveFromModule(getEquippedItems(), id);
}

function rollChance(chance) {
    return rollChanceFromModule(chance);
}

function createEmptyGearSlots() {
    return createEmptyGearSlotsFromPlayerModule(GEAR_SLOT_ORDER);
}

function getEquippedItems() {
    return GEAR_SLOT_ORDER
        .map(slotKey => playerInfo.gearSlots[slotKey])
        .filter(Boolean);
}

function ensureEffectState() {
    if (!currentGameStats.effectState) {
        currentGameStats.effectState = {
            player: { activeSkills: [], activeStatuses: [], activePassives: [] },
            enemy: { activeSkills: [], activeStatuses: [], activePassives: [] }
        };
    }
    if (!currentGameStats.effectState.player) {
        currentGameStats.effectState.player = { activeSkills: [], activeStatuses: [], activePassives: [] };
    }
    if (!currentGameStats.effectState.enemy) {
        currentGameStats.effectState.enemy = { activeSkills: [], activeStatuses: [], activePassives: [] };
    }
    if (!Array.isArray(currentGameStats.effectState.player.activeSkills)) currentGameStats.effectState.player.activeSkills = [];
    if (!Array.isArray(currentGameStats.effectState.player.activeStatuses)) currentGameStats.effectState.player.activeStatuses = [];
    if (!Array.isArray(currentGameStats.effectState.player.activePassives)) currentGameStats.effectState.player.activePassives = [];
    if (!Array.isArray(currentGameStats.effectState.enemy.activeSkills)) currentGameStats.effectState.enemy.activeSkills = [];
    if (!Array.isArray(currentGameStats.effectState.enemy.activeStatuses)) currentGameStats.effectState.enemy.activeStatuses = [];
    if (!Array.isArray(currentGameStats.effectState.enemy.activePassives)) currentGameStats.effectState.enemy.activePassives = [];
    return currentGameStats.effectState;
}

function normalizeEffectTypes(effectTypes, effectType) {
    const normalized = Array.isArray(effectTypes)
        ? effectTypes.filter(type => typeof type === "string" && type.trim().length > 0)
        : [];
    if (normalized.length > 0) return normalized;
    if (typeof effectType === "string" && effectType.trim().length > 0) return [effectType];
    return ["generic"];
}

function normalizeStatusEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    return {
        id: entry.id || "",
        name: entry.name || "",
        desc: entry.desc || "",
        note: entry.note || "",
        kind: entry.kind || "neutral",
        modifiers: entry.modifiers && typeof entry.modifiers === "object" ? entry.modifiers : {},
        effectTypes: normalizeEffectTypes(entry.effectTypes, entry.effectType)
    };
}

function normalizeSkillEntry(entry) {
    if (!entry) return null;
    if (typeof entry === "string") {
        return {
            id: entry,
            name: entry,
            rank: 1,
            effectTypes: ["generic"]
        };
    }
    if (typeof entry !== "object") return null;
    return {
        id: entry.id || "",
        name: entry.name || entry.id || "",
        rank: Number.isFinite(entry.rank) ? entry.rank : 1,
        effectTypes: normalizeEffectTypes(entry.effectTypes, entry.effectType)
    };
}

function readEntityStatuses(entity) {
    if (!entity || typeof entity !== "object") return [];
    const candidates = [entity.activeStatuses, entity.statuses, entity.statusEffects];
    const source = candidates.find(candidate => Array.isArray(candidate));
    if (!source) return [];
    return source.map(normalizeStatusEntry).filter(Boolean);
}

function readEnemyActiveSkills(enemy) {
    if (!enemy || typeof enemy !== "object") return [];
    const candidates = [enemy.activeSkills, enemy.skills];
    const source = candidates.find(candidate => Array.isArray(candidate));
    if (!source) return [];
    return source.map(normalizeSkillEntry).filter(Boolean);
}

function syncEffectState() {
    const effectState = ensureEffectState();
    effectState.player.activeSkills = passiveSkillManager.getActiveSkills();
    effectState.player.activeStatuses = readEntityStatuses(playerInfo);
    effectState.player.activePassives = [...effectState.player.activeSkills, ...effectState.player.activeStatuses];
    effectState.enemy.activeSkills = readEnemyActiveSkills(currentGameStats.currentEnemy);
    effectState.enemy.activeStatuses = readEntityStatuses(currentGameStats.currentEnemy);
    effectState.enemy.activePassives = [...effectState.enemy.activeSkills, ...effectState.enemy.activeStatuses];
}

function getActivePlayerSkills() {
    syncEffectState();
    const state = ensureEffectState();
    if (!state || !state.player || !Array.isArray(state.player.activeSkills)) return [];
    return state.player.activeSkills;
}

function getActivePlayerStatuses() {
    syncEffectState();
    const state = ensureEffectState();
    if (!state || !state.player || !Array.isArray(state.player.activeStatuses)) return [];
    return state.player.activeStatuses;
}

function getActivePlayerPassives() {
    syncEffectState();
    const state = ensureEffectState();
    if (!state || !state.player || !Array.isArray(state.player.activePassives)) return [];
    return state.player.activePassives;
}

function getNextOpenGearSlot() {
    for (const slotKey of GEAR_SLOT_ORDER) {
        if (!playerInfo.gearSlots[slotKey]) return slotKey;
    }
    return null;
}

function createStarterHelmet() {
    return createStarterHelmetFromPlayerModule(GearItem);
}

function popPassive(name, target = "player") {
    floatText(target, `${name}!`, "info");
}

function getPlayerDamageReduction() {
    return getPlayerDamageReductionFromModule(getEquippedItems());
}

function getPlayerReflectRate() {
    return getPlayerReflectRateFromModule(getEquippedItems());
}

function getPlayerRegenRate() {
    return getPlayerRegenRateFromModule(getEquippedItems());
}

function getPlayerExtraDodgeChance() {
    return getPlayerExtraDodgeChanceFromModule(getEquippedItems());
}

function getPlayerLifestealRate() {
    return getPlayerLifestealRateFromModule(getEquippedItems());
}

function getPlayerOnHitHealRate() {
    return getPlayerOnHitHealRateFromModule(getEquippedItems());
}

function getPlayerFlatOnHitDamage() {
    return getPlayerFlatOnHitDamageFromModule(getEquippedItems());
}

function getPlayerCritMultiplier() {
    return getPlayerCritMultiplierFromModule(getEquippedItems());
}

function getEnemyDisplayedAtk() {
    return getEnemyDisplayedAtkFromModule(getEquippedItems(), currentGameStats.currentEnemy);
}

function getEnemyTurnDots() {
    return getEnemyTurnDotsFromModule(getEquippedItems(), currentGameStats.currentEnemy);
}

function getCounterChance() {
    return getCounterChanceFromModule(getEquippedItems());
}

function getDivineShieldChance() {
    return getDivineShieldChanceFromModule(getEquippedItems());
}

function getTimeWarpChance() {
    return getTimeWarpChanceFromModule(getEquippedItems());
}

function getPhantomChance() {
    return getPhantomChanceFromModule(getEquippedItems());
}

function getLuckyStrikeChance() {
    return getLuckyStrikeChanceFromModule(getEquippedItems());
}

function updateExpUI() {
    updateExpUIFromUI({
        uiPlayerExpBar,
        uiPlayerExpText,
        uiPlayerName,
        playerInfo,
        currentGameStats,
        classes: CLASSES,
        getPlayerExpPercent
    });
}

function resetPlayer() {
    resetPlayerStateFromPlayerModule({
        playerInfo,
        currentGameStats,
        classes: CLASSES,
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
        setAvatarToAttack: () => {
            uiPlayerAvatar.src = getPlayerAvatarSrc("attack");
        }
    });
    passiveSkillManager.sync();
}

function getPlayerAvatarSrc(state = "attack") {
    return getPlayerAvatarSrcFromPlayerModule({
        classes: CLASSES,
        selectedClassId: currentGameStats.selectedClassId,
        state
    });
}

function setPlayerAvatarTemporary(state, duration) {
    setPlayerAvatarTemporaryFromPlayerModule({
        uiPlayerAvatar,
        getPlayerAvatarSrc,
        state,
        duration
    });
}

function initGame() {
    mountFullscreenOverlaysToBody();
    startAvatarBlurPulses();
    bindCombatStatTooltipsFromUI({
        uiPlayerAtk,
        uiPlayerDef,
        uiPlayerCrit,
        uiPlayerDodge,
        uiPlayerAim,
        uiEnemyAtk,
        uiEnemyDef,
        uiEnemyCrit,
        uiEnemyDodge,
        uiEnemyAim,
        getPlayerStats: () => playerInfo,
        getEnemyStats: () => currentGameStats.currentEnemy,
        showTooltip: showInfoTooltip,
        hideTooltip: hideInfoTooltip
    });
    floatText("system", "The Journey Begins!", "system");
    setPauseState(false);
    clearScreenSpaceEffects();
    resetPlayer();
    tutorialOverlay.classList.remove("hidden");

}

function onStartJourney() {
    tutorialOverlay.classList.add("hidden");
    initAudio();
    if (bgMusic) {
        bgMusic.volume = volumeStates[currentGameStats.volIndex].vol;
        audioSystem.setVolume(volumeStates[currentGameStats.volIndex].vol);
        bgMusic.play().catch(err => console.log("Audio play failed:", err));
    }
    playSound("pick");
    currentGameStats.hasActiveClassSelection = false;
    showClassSelection();
}

function showClassSelection() {
    if (currentGameStats.hasActiveClassSelection) return;
    clearScreenSpaceEffects();
    renderClassSelection({
        classOverlay,
        classOptions,
        confirmClassBtn,
        classes: CLASSES,
        currentGameStats,
        playPickSound: () => playSound("pick"),
        onClassSelected: () => {
            resetPlayer();
        },
        onConfirmSelection: () => {
            startLevel(1);
        }
    });
}

function formatStats(stats) {
    return formatStatsFromModule(stats);
}

function getRewardStatsText(item) {
    return getRewardStatsTextFromModule(item);
}

function consumeInventoryItem(index) {
    return consumeInventoryItemFromModule({
        playerInfo,
        currentGameStats,
        getSkillRank,
        getActivePlayerPassives,
        getActivePlayerSkills,
        getActivePlayerStatuses,
        renderEquipment,
        updatePlayerUI,
        resetEqReadoutBackground,
        playSound,
        floatText
    }, index);
}

function getPassiveShortLabel(name) {
    return getPassiveShortLabelFromModule(name);
}

function recalculateStats() {
    recalculateStatsFromModule({
        playerInfo,
        equippedItems: getEquippedItems(),
        passiveBonuses: getPassiveStatBonusesFromModule(getEquippedItems()),
        skillBonuses: getSkillTreeStatBonuses(),
        cheatOverrides: currentGameStats.cheatOverrides
    });
}

function tryDodge(attackerAim, defenderDodge) {
    return tryDodgeFromModule(attackerAim, defenderDodge);
}

function getSkillTreeStatBonuses() {
    return getSkillTreeStatBonusesFromModule({
        getSkillRank,
        battleState: currentGameStats.battleState
    });
}

function getSkillTreeRegenRate() {
    return getSkillTreeRegenRateFromModule({
        getSkillRank,
        battleState: currentGameStats.battleState,
        canTriggerTurnSkill
    });
}

function applyPotionDropOnKill() {
    // Event-driven skills handle battle-win loot effects via the passive skill manager.
}

function presentScavengerPotionReward() {
    return presentScavengerPotionRewardFromModule({
        currentGameStats,
        lootOptionsContainer,
        lootOverlay,
        clearScreenSpaceEffects,
        selectLoot
    });
}

function applyEnemySize(size) {
    applyEnemySizeFromUI({
        uiEnemyAvatar,
        enemySizeToPx: ENEMY_SIZE_TO_PX,
        size
    });
}

function clearEnemyDisplay() {
    clearEnemyDisplayFromUI({
        uiEnemyName,
        uiEnemyAvatar,
        uiEnemyHpBar,
        uiEnemyHpText,
        uiEnemyAtk,
        uiEnemyDef,
        uiEnemyCrit,
        uiEnemyDodge,
        uiEnemyAim,
        uiEnemyHpContainer,
        uiEnemyStatsPanel,
        eqReadout,
        defaultReadoutHtml: DEFAULT_READOUT_HTML,
        resetEqReadoutBackground
    });
}

function showEnemyDisplay() {
    showEnemyDisplayFromUI({
        uiEnemyName,
        uiEnemyHpContainer,
        uiEnemyStatsPanel,
        uiEnemyAvatar,
        uiEnemyInfo
    });
}

function updatePlayerUI() {
    updatePlayerUIFromUI({
        uiPlayerAtk,
        uiPlayerDef,
        uiPlayerCrit,
        uiPlayerDodge,
        uiPlayerAim,
        uiPlayerHpBar,
        uiPlayerHpText,
        playerInfo
    });
}

function updateEnemyUI() {
    updateEnemyUIFromUI({
        uiEnemyAtk,
        uiEnemyDef,
        uiEnemyCrit,
        uiEnemyDodge,
        uiEnemyAim,
        uiEnemyHpBar,
        uiEnemyHpText,
        currentEnemy: currentGameStats.currentEnemy,
        getEnemyDisplayedAtk
    });
}

function showHitCut(target) {
    showHitCutFromUI({
        target,
        uiPlayerAvatar,
        uiEnemyAvatar,
        hitCutSrc: HIT_CUT_SRC
    });
}

function showFireEffect(target) {
    showHitCutFromUI({
        target,
        uiPlayerAvatar,
        uiEnemyAvatar,
        hitCutSrc: HIT_CUT_SRC,
        effectSrc: FIRE_EFFECT_SRC
    });
}

function triggerAnimation(element, animClass) {
    return triggerAnimationFromUI({
        element,
        currentGameStats,
        animClass
    });
}

function triggerDodgeAnimation(target) {
    return triggerDodgeAnimationFromUI({
        target,
        uiPlayerAvatar,
        uiEnemyAvatar,
        currentGameStats,
        playSound
    });
}

function rollDamage(maxVal) {
    return rollDamageFromModule(maxVal);
}

const combatBindings = createCombatSystem({
    currentGameStats,
    playerInfo,
    gameEventBus,
    GAME_EVENTS,
    getMaxPlayerLevel,
    lootOverlay,
    eqReadout,
    overlay,
    uiLevelDisplay,
    uiEnemyName,
    uiEnemyAvatar,
    uiPlayerAvatar,
    uiTurnDisplay,
    createEnemy,
    showEnemyDisplay,
    applyEnemySize,
    updateEnemyUI,
    updatePlayerUI,
    clearEnemyDisplay,
    setPauseState,
    clearScreenSpaceEffects,
    triggerAnimation,
    triggerDodgeAnimation,
    triggerCritFlash,
    triggerScreenShake,
    showHitCut,
    showFireEffect,
    setPlayerAvatarTemporary,
    playSound,
    floatText,
    rollDamage,
    rollChance,
    tryDodge,
    recalculateStats,
    updateExpUI,
    checkLevelUp,
    applyClassLevelUpGrowth,
    gainSkillPoints,
    presentScavengerPotionReward,
    applyPotionDropOnKill,
    getSkillTreeRegenRate,
    getSkillRank,
    canTriggerTurnSkill,
    getEnemyTurnDots,
    getEnemyDisplayedAtk,
    getLuckyStrikeChance,
    getTimeWarpChance,
    getDivineShieldChance,
    getPlayerDamageReduction,
    getPhantomChance,
    getPlayerReflectRate,
    getCounterChance,
    getPlayerExtraDodgeChance,
    getPlayerCritMultiplier,
    getDarkHarvestAmount: enemy => getDarkHarvestAmountFromModule(getEquippedItems(), enemy),
    getPlayerFlatOnHitDamage,
    getPlayerLifestealRate,
    getPlayerOnHitHealRate,
    getPlayerRegenRate,
    getBloodthirstHealAmount: () => getBloodthirstHealAmountFromModule(getEquippedItems(), playerInfo.maxHp),
    shouldTriggerSurvivalist: (previousHp, currentHp) => shouldTriggerSurvivalistFromModule(getEquippedItems(), currentGameStats.battleState, previousHp, currentHp),
    hasPassive,
    countPassive,
    popPassive,
    syncEffectState,
    onPlayerSuccessfulHit: () => onPlayerSuccessfulHitFromModule({
        battleState: currentGameStats.battleState,
        getSkillRank,
        floatText
    }),
    applySkillTreeAttackHealing: baseDamage => applySkillTreeAttackHealingFromModule({
        baseDamage,
        getSkillRank,
        playerInfo,
        floatText,
        playSound
    })
});

const {
    startLevel,
    advanceToNextRound
} = combatBindings;

function presentLootSelection() {
    presentLootSelectionFromModule({
        currentGameStats,
        lootOptionsContainer,
        lootOverlay,
        clearScreenSpaceEffects,
        generateLootOptions,
        getRewardStatsText,
        selectLoot
    });
}

function leaveLootSelection() {
    leaveLootSelectionFromModule({
        currentGameStats,
        lootOptionsContainer,
        lootOverlay,
        advanceToNextRound
    });
}

function selectLoot(item) {
    selectLootFromModule({
        playerInfo,
        consumableSlotCount: CONSUMABLE_SLOT_COUNT,
        lootOptionsContainer,
        lootOverlay,
        getNextOpenGearSlot,
        recalculateStats,
        updatePlayerUI,
        renderEquipment,
        floatText,
        playSound,
        advanceToNextRound
    }, item);
}

function renderEquipment() {
    renderEquipmentFromUI({
        playerInfo,
        gearSlotOrder: GEAR_SLOT_ORDER,
        gearSlotLabels: GEAR_SLOT_LABELS,
        consumableSlotCount: CONSUMABLE_SLOT_COUNT,
        uiSkillsReadout,
        getPassiveShortLabel,
        playSound,
        consumeInventoryItem,
        showInfoTooltipFn: showInfoTooltip,
        hideInfoTooltipFn: hideInfoTooltip,
        showItemInfoFn: showItemInfo,
        showPassiveInfoFn: showPassiveInfo
    });
}

function resetEqReadoutBackground() {
    resetEqReadoutBackgroundFromUI(eqReadout);
}

function showInfoTooltip(html, x, y, side = "right", vertical = "below", isStatTip = false) {
    const isCompactContent = typeof html === "string" && html.includes("stat-tip-text");
    if (infoTooltip) infoTooltip.classList.toggle("info-tooltip-compact", Boolean(isStatTip || isCompactContent));
    showInfoTooltipFromUI({ infoTooltip, html, x, y, side, vertical });
}

function hideInfoTooltip() {
    if (infoTooltip) infoTooltip.classList.remove("info-tooltip-compact");
    hideInfoTooltipFromUI(infoTooltip);
}

function openEditorPage() {
    const editorWindow = window.open("http://127.0.0.1:8787/enemy.html", "_blank", "noopener,noreferrer");
    if (!editorWindow) {
        floatText("system", "Editor popup blocked", "info");
    }
}

function showEnemyInfo() {
    return showEnemyInfoFromUI(currentGameStats.currentEnemy);
}

function showPassiveInfo(passive) {
    showPassiveInfoFromUI({
        passive,
        eqReadout
    });
}

function showItemInfo(item, isConsumable = false, gearSlotKey = "") {
    let consumableEffectNotes = [];
    if (isConsumable && item && typeof item.resolveConsumableEffects === "function") {
        const resolved = item.resolveConsumableEffects({
            getSkillRank,
            activePassives: getActivePlayerPassives(),
            activeSkills: getActivePlayerSkills(),
            activeStatuses: getActivePlayerStatuses()
        });
        consumableEffectNotes = Array.isArray(resolved.notes) ? resolved.notes : [];
    }

    return showItemInfoFromUI({
        item,
        isConsumable,
        gearSlotKey,
        gearSlotLabels: GEAR_SLOT_LABELS,
        formatStats,
        consumableEffectNotes
    });
}

bindUIControls({
    levelupCloseBtn,
    onLevelupClose: () => {
        levelupOverlay.classList.add("hidden");
        currentGameStats.isPaused = false;
        advanceToNextRound();
    },
    modalBtn,
    onModalConfirm: () => {
        overlay.classList.add("hidden");
        initAudio();
        if (bgMusic && bgMusic.paused) bgMusic.play().catch(() => { });
        playSound("pick");
        currentGameStats.hasActiveClassSelection = false;
        showClassSelection();
    },
    musicBtn,
    bgMusic,
    getVolumeState: () => volumeStates[currentGameStats.volIndex],
    setNextVolume: () => {
        currentGameStats.volIndex = (currentGameStats.volIndex + 1) % volumeStates.length;
        return volumeStates[currentGameStats.volIndex];
    },
    setAudioVolume: volume => audioSystem.setVolume(volume),
    pauseBtn,
    pauseResumeBtn,
    classOverlay,
    getIsPaused: () => currentGameStats.isPaused,
    setPauseState,
    skillTreeBtn,
    openSkillTree,
    cheatBtn,
    openCheatPanel,
    skillTreeCloseBtn,
    skillTreeOverlay,
    closeSkillTree,
    cheatCloseBtn,
    cheatSaveBtn,
    saveCheatStats,
    cheatResetBtn,
    resetCheatToClassDefault,
    cheatOverlay,
    closeCheatPanel,
    skillTreeSections,
    spendSkillPoint,
    reverseSkillPoint,
    showSkillTooltip,
    hideSkillTooltip,
    lootLeaveBtn,
    playSound,
    leaveLootSelection,
    uiEnemyAvatar,
    showEnemyInfo,
    showInfoTooltip,
    hideInfoTooltip,
    startJourneyBtn,
    onStartJourney,
    editorPageBtn,
    onOpenEditorPage: openEditorPage
});

window.addEventListener("DOMContentLoaded", initGame);











