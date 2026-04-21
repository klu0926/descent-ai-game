import { createEnemy, createEnemyFromId } from "./enemyGenerator.js";
import { generateLootOptions } from "./itemGenerator.js";
import {
    applySkillTreeAttackHealing as applySkillTreeAttackHealingFromModule,
    getSkillTreeRegenRate as getSkillTreeRegenRateFromModule,
    getSkillTreeStatBonuses as getSkillTreeStatBonusesFromModule,
    onPlayerSuccessfulHit as onPlayerSuccessfulHitFromModule
} from "../combat/legacy/skillCombatSystem.js";
import { createCombatSystem } from "../combat/legacy/combatSetup.js";
import {
    createEmptyGearSlots as createEmptyGearSlotsFromPlayerModule,
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
    getClassDefaultStats as getClassDefaultStatsFromModule,
    recalculateStats as recalculateStatsFromModule,
    tryDodge as tryDodgeFromModule
} from "./playerSystem.js";
import {
    formatStats as formatStatsFromModule,
    getRewardStatsText as getRewardStatsTextFromModule
} from "./rewardSystem.js";
import {
    rollChance as rollChanceFromModule,
    rollDamage as rollDamageFromModule
} from "../core/randomSystem.js";
import { CURRENT_GAME_STATS, createInitialCheatOverrides } from "../core/gameState.js";
import { CLASSES } from "../content/classes/index.js";
import { SkillTree } from "../entity/player_class/skillTree.js";
import { createSmallPotion } from "../items/consumable/consumable.js";
import { createAudioSystem } from "../resources/audio/audioSystem.js";
import { GAME_EVENTS, createEventBus } from "../core/eventBus.js";
import { GearItem } from "../items/item.js";
import {
    applyEnemySize as applyEnemySizeFromUI,
    clearEnemyDisplay as clearEnemyDisplayFromUI,
    clearScreenSpaceEffects as clearScreenSpaceEffectsFromUI,
    createUIRefs,
    floatText as floatTextFromUI,
    isAnyFullscreenOverlayVisible as isAnyFullscreenOverlayVisibleFromUI,
    mountFullscreenOverlaysToBody as mountFullscreenOverlaysToBodyFromUI,
    renderCombatSkillReadouts as renderCombatSkillReadoutsFromUI,
    renderEquipment as renderEquipmentFromUI,
    resetEqReadoutBackground as resetEqReadoutBackgroundFromUI,
    setPauseState as setPauseStateFromUI,
    setBattleArenaBackground as setBattleArenaBackgroundFromUI,
    setArenaLevelWarning as setArenaLevelWarningFromUI,
    showEnemyDisplay as showEnemyDisplayFromUI,
    showEnemyInfo as showEnemyInfoFromUI,
    showHitCut as showHitCutFromUI,
    startAvatarBlurPulses as startAvatarBlurPulsesFromUI,
    triggerAnimation as triggerAnimationFromUI,
    triggerCritFlash as triggerCritFlashFromUI,
    triggerDodgeAnimation as triggerDodgeAnimationFromUI,
    triggerScreenShake as triggerScreenShakeFromUI,
    updateEnemyUI as updateEnemyUIFromUI,
    updatePlayerNameUI as updatePlayerNameUIFromUI,
    updatePlayerUI as updatePlayerUIFromUI,
    bindCombatStatTooltips as bindCombatStatTooltipsFromUI
} from "../UI/gameUI.js";
import {
    hideInfoTooltip as hideInfoTooltipFromUI,
    showInfoTooltip as showInfoTooltipFromUI,
    showItemInfo as showItemInfoFromUI
} from "../UI/components/inventoryTooltips/inventoryTooltips.js";
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
import { ENEMY_SIZE_TO_PX } from "../content/enemies/enemyTypeData.js";
import { DEFAULT_LEVEL_ID, getLevelById } from "../content/levels/level.js";

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
const INTRO_MUSIC_SRC = "resources/audio/music/joelfazhari-stalking-my-next-victim.mp3";
const BATTLE_MUSIC_SRC = "resources/audio/music/stereo_color-battle-drum-493709.mp3";

function toPositiveInt(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.trunc(parsed));
}

function getResolvedLevelAndRound(levelId, roundNumber) {
    const requestedLevelId = toPositiveInt(levelId, DEFAULT_LEVEL_ID);
    const requestedRound = toPositiveInt(roundNumber, 1);
    const levelData = getLevelById(requestedLevelId) || getLevelById(DEFAULT_LEVEL_ID);
    if (!levelData) {
        return {
            levelData: null,
            roundData: null,
            resolvedLevelId: requestedLevelId,
            resolvedRound: requestedRound,
            missingLevelObject: true
        };
    }
    const scenes = Array.isArray(levelData.scenes)
        ? levelData.scenes
        : (Array.isArray(levelData.rounds) ? levelData.rounds : []);
    if (scenes.length <= 0) {
        return {
            levelData,
            roundData: null,
            resolvedLevelId: levelData.id,
            resolvedRound: requestedRound,
            missingLevelObject: true
        };
    }
    const requestedIndex = requestedRound - 1;
    const requestedRoundData = scenes[requestedIndex] && typeof scenes[requestedIndex] === "object"
        ? scenes[requestedIndex]
        : null;
    let fallbackRoundIndex = -1;
    for (let index = scenes.length - 1; index >= 0; index -= 1) {
        const candidate = scenes[index];
        if (candidate && typeof candidate === "object") {
            fallbackRoundIndex = index;
            break;
        }
    }
    const fallbackRoundData = fallbackRoundIndex >= 0 ? scenes[fallbackRoundIndex] : null;
    const roundData = requestedRoundData || fallbackRoundData || null;
    const resolvedRound = requestedRoundData
        ? requestedRound
        : (fallbackRoundIndex >= 0 ? fallbackRoundIndex + 1 : requestedRound);
    const missingLevelObject = !requestedRoundData;
    return {
        levelData,
        roundData,
        resolvedLevelId: levelData.id,
        resolvedRound,
        missingLevelObject
    };
}

function getRoundEnemyId(levelId, roundNumber) {
    const { roundData } = getResolvedLevelAndRound(levelId, roundNumber);
    const enemyId = roundData && typeof roundData.enemy === "string" ? roundData.enemy.trim() : "";
    return enemyId || null;
}

function getRoundType(levelId, roundNumber) {
    const { roundData } = getResolvedLevelAndRound(levelId, roundNumber);
    const rawType = String(roundData && roundData.type || "fight").trim().toLowerCase();
    if (rawType === "cutscene" || rawType === "vendor" || rawType === "fight") return rawType;
    if (rawType === "event") return "cutscene";
    return "fight";
}

function getRoundCutsceneVideo(levelId, roundNumber) {
    const { roundData } = getResolvedLevelAndRound(levelId, roundNumber);
    const videoPath = roundData && typeof roundData.cutsceneVideo === "string" ? roundData.cutsceneVideo.trim() : "";
    return videoPath || null;
}

function getRoundBackgroundPath(levelId, roundNumber) {
    const { roundData } = getResolvedLevelAndRound(levelId, roundNumber);
    const backgroundPath = roundData && typeof roundData.background === "string" ? roundData.background.trim() : "";
    return backgroundPath || null;
}

function getRoundLevelObjectWarning(levelId, roundNumber) {
    const { missingLevelObject } = getResolvedLevelAndRound(levelId, roundNumber);
    return missingLevelObject ? "missing level object." : "";
}

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
    uiEnemySkillsReadout,
    uiEnemyName,
    uiEnemyHpBar,
    uiEnemyHpText,
    uiEnemyAtk,
    uiEnemyDef,
    uiEnemyCrit,
    uiEnemyDodge,
    uiEnemyAim,
    uiEnemyAvatar,
    uiEnemyCard,
    uiEnemyInfo,
    uiEnemyHpContainer,
    uiEnemyStatsPanel,
    uiLevelDisplay,
    uiTurnDisplay,
    uiArenaLevelWarning,
    overallBlackFadeOverlay,
    roundStartBtn,
    roundTransitionOverlay,
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
    uiPlayerName,
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
    confirmClassBtn,
    introCinematicOverlay,
    introCinematicVideo
} = uiRefs;

const DEFAULT_READOUT_HTML = "";

const FALLBACK_SKILL_TREE = new SkillTree({ maxLevel: 20, sections: [], nodes: [] });

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

function getSkillTreeSections() {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.getSections === "function") return skillTree.getSections();
    return skillTree.sections || [];
}

function getSkillTreeNodes() {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.getNodes === "function") return skillTree.getNodes();
    return skillTree.nodes || [];
}

function getSkillTreeById() {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.getNodeById === "function") {
        return new Map(getSkillTreeNodes().map(node => [node.id, skillTree.getNodeById(node.id)]));
    }
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
        floatText,
        eventBus: gameEventBus,
        GAME_EVENTS,
        getSkillById: skillId => getSkillTreeById().get(String(skillId || "").trim()) || null,
        syncEffectState: () => syncEffectState()
    }
});

function getTotalSkillSpent() {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.getTotalSkillSpent === "function") {
        return skillTree.getTotalSkillSpent(getSkillRank);
    }
    return getSkillTreeNodes().reduce((sum, node) => sum + getSkillRank(node.id), 0);
}

function getSectionPointRequirement(sectionId) {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.getSectionPointRequirement === "function") {
        return skillTree.getSectionPointRequirement(sectionId);
    }
    const section = getSkillTreeSections().find(entry => entry.id === sectionId);
    if (!section) return Number.MAX_SAFE_INTEGER;
    return section.requiredTreePoints || 0;
}

function isSectionUnlocked(sectionId) {
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.isSectionUnlocked === "function") {
        return skillTree.isSectionUnlocked(sectionId, getSkillRank);
    }
    return getTotalSkillSpent() >= getSectionPointRequirement(sectionId);
}

function canSpendSkillPoint(node) {
    if (!node) return false;
    const skillTree = getActiveSkillTreeConfig();
    if (typeof skillTree.canSpendSkillPoint === "function") {
        return skillTree.canSpendSkillPoint({
            skillId: node.id,
            playerInfo,
            getSkillRank
        });
    }
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
    const skillTree = getActiveSkillTreeConfig();
    const spent = typeof skillTree.spendSkillPoint === "function"
        ? skillTree.spendSkillPoint({
            skillId,
            playerInfo,
            classRanks,
            getSkillRank
        })
        : (() => {
            classRanks[skillId] = getSkillRank(skillId) + 1;
            playerInfo.skillPoints -= 1;
            return true;
        })();
    if (!spent) return false;

    passiveSkillManager.sync();
    syncEffectState();
    recalculateStats();
    updatePlayerUI();
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

    passiveSkillManager.sync();
    syncEffectState();
    recalculateStats();
    updatePlayerUI();
    updateSkillTreeButton();
    renderSkillTree();
    playSound("pick");
    return true;
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
    floatText,
    getClassDefaultStats,
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

function getIntroVideoVolume(masterVolume) {
    const base = Number.isFinite(Number(masterVolume)) ? Number(masterVolume) : 0.6;
    return Math.min(1, Math.max(0, base * 2));
}

function applyMasterVolume(volume) {
    const numericVolume = Number.isFinite(Number(volume)) ? Number(volume) : 0.6;
    audioSystem.setVolume(numericVolume);
    if (bgMusic) bgMusic.volume = numericVolume;
    if (introCinematicVideo) introCinematicVideo.volume = getIntroVideoVolume(numericVolume);
}

function setBgMusicTrack(trackSrc, { restart = false, play = true } = {}) {
    if (!bgMusic || !trackSrc) return;
    const sourceElement = bgMusic.querySelector("source");
    const currentSrc = sourceElement ? sourceElement.getAttribute("src") : (bgMusic.getAttribute("src") || "");
    const isSameTrack = currentSrc === trackSrc;

    if (!isSameTrack || restart) {
        if (sourceElement) {
            sourceElement.setAttribute("src", trackSrc);
        } else {
            bgMusic.setAttribute("src", trackSrc);
        }
        bgMusic.load();
    }

    applyMasterVolume(volumeStates[currentGameStats.volIndex].vol);
    if (play) {
        bgMusic.play().catch(err => console.log("Audio play failed:", err));
    }
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
    const overlays = [overlay, lootOverlay, pauseOverlay, tutorialOverlay, classOverlay, cheatOverlay, skillTreeOverlay, introCinematicOverlay];
    return isAnyFullscreenOverlayVisibleFromUI(overlays);
}

function clearScreenSpaceEffects() {
    clearScreenSpaceEffectsFromUI();
}

function setBattleArenaBackground(imagePath) {
    setBattleArenaBackgroundFromUI(imagePath);
}

function setArenaLevelWarning(message) {
    setArenaLevelWarningFromUI({
        element: uiArenaLevelWarning,
        message
    });
}

function startAvatarBlurPulses() {
    startAvatarBlurPulsesFromUI({
        currentGameStats,
        uiPlayerAvatar,
        uiEnemyAvatar
    });
}

function mountFullscreenOverlaysToBody() {
    const overlays = [overlay, lootOverlay, tutorialOverlay, pauseOverlay, classOverlay, cheatOverlay, skillTreeOverlay, introCinematicOverlay];
    mountFullscreenOverlaysToBodyFromUI(overlays);
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function consumeCutsceneTransitionSkip() {
    const shouldSkip = Boolean(currentGameStats.skipNextCutsceneTransition);
    currentGameStats.skipNextCutsceneTransition = false;
    return shouldSkip;
}

async function playIntroGateOpeningSequence(videoSrc = "") {
    if (!introCinematicOverlay || !introCinematicVideo) {
        await waitMs(300);
        return;
    }

    currentGameStats.isCutsceneEventActive = true;
    currentGameStats.skipCutsceneRequested = false;

    introCinematicOverlay.classList.remove("hidden");
    introCinematicOverlay.classList.remove("intro-cinematic-show-black", "intro-cinematic-fadeout", "intro-cinematic-show-video");
    void introCinematicOverlay.offsetWidth;
    introCinematicOverlay.classList.add("intro-cinematic-show-video");

    let videoEnded = false;
    const markEnded = () => {
        videoEnded = true;
        introCinematicVideo.pause();
    };
    introCinematicVideo.addEventListener("ended", markEnded, { once: true });
    introCinematicVideo.controls = false;
    introCinematicVideo.playbackRate = 0.85;
    introCinematicVideo.currentTime = 0;
    if (videoSrc) introCinematicVideo.src = videoSrc;
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(err => console.log("Audio play failed:", err));
    }

    try {
        await introCinematicVideo.play();
    } catch (_) {
        videoEnded = true;
    }

    const blackLeadMs = 850;
    const currentPlaybackRate = Number.isFinite(introCinematicVideo.playbackRate) && introCinematicVideo.playbackRate > 0
        ? introCinematicVideo.playbackRate
        : 1;
    const maxVideoMs = Number.isFinite(introCinematicVideo.duration) && introCinematicVideo.duration > 0
        ? Math.ceil((introCinematicVideo.duration / currentPlaybackRate) * 1000) + 650
        : 8500;
    const startedAt = Date.now();
    while (!videoEnded && (Date.now() - startedAt) < maxVideoMs) {
        if (currentGameStats.skipCutsceneRequested) break;
        const hasDuration = Number.isFinite(introCinematicVideo.duration) && introCinematicVideo.duration > 0;
        if (hasDuration) {
            const remainingMs = ((introCinematicVideo.duration - introCinematicVideo.currentTime) / currentPlaybackRate) * 1000;
            if (remainingMs <= blackLeadMs) break;
        }
        await waitMs(50);
    }

    introCinematicOverlay.classList.add("intro-cinematic-show-black");
    if (currentGameStats.skipCutsceneRequested) {
        await waitMs(40);
    } else {
        await waitMs(blackLeadMs);
    }

    introCinematicVideo.pause();
    videoEnded = true;
    introCinematicOverlay.classList.add("intro-cinematic-fadeout");
    if (currentGameStats.skipCutsceneRequested) {
        await waitMs(100);
    } else {
        await waitMs(720);
    }

    introCinematicVideo.pause();
    introCinematicVideo.currentTime = 0;
    introCinematicOverlay.classList.add("hidden");
    introCinematicOverlay.classList.remove("intro-cinematic-show-video", "intro-cinematic-show-black", "intro-cinematic-fadeout");
    currentGameStats.isCutsceneEventActive = false;
    currentGameStats.skipCutsceneRequested = false;
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
        image: String(entry.image || "").trim(),
        rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : 1,
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
            desc: "",
            rank: 1,
            effectTypes: ["generic"]
        };
    }
    if (typeof entry !== "object") return null;
    return {
        id: entry.id || "",
        name: entry.name || entry.id || "",
        desc: entry.desc || "",
        rank: Number.isFinite(entry.rank) ? entry.rank : 1,
        kind: String(entry.kind || entry.skillType || "").trim().toLowerCase(),
        effectTypes: normalizeEffectTypes(entry.effectTypes, entry.effectType)
    };
}

function isPassiveLikeEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    const kind = String(entry.kind || "").trim().toLowerCase();
    if (!kind) return true;
    return kind === "passive" || kind === "buff" || kind === "debuff";
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
    effectState.player.activePassives = [
        ...effectState.player.activeSkills.filter(isPassiveLikeEntry),
        ...effectState.player.activeStatuses
    ];
    effectState.enemy.activeSkills = readEnemyActiveSkills(currentGameStats.currentEnemy);
    effectState.enemy.activeStatuses = readEntityStatuses(currentGameStats.currentEnemy);
    effectState.enemy.activePassives = [
        ...effectState.enemy.activeSkills.filter(isPassiveLikeEntry),
        ...effectState.enemy.activeStatuses
    ];
    renderCombatSkillReadoutsFromUI({
        playerContainer: uiSkillsReadout,
        enemyContainer: uiEnemySkillsReadout,
        playerSkills: effectState.player.activePassives,
        enemySkills: effectState.enemy.activePassives
    });
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

function normalizeSlotFamily(slotKey = "") {
    if (slotKey === "weapon_1" || slotKey === "weapon_2") return "weapon";
    if (slotKey === "relic_1" || slotKey === "relic_2") return "relic";
    return slotKey;
}

function getPreferredSlotFamiliesForItem(item) {
    const gearType = item && typeof item.gearType === "string" ? item.gearType.trim().toLowerCase() : "";
    const slotType = item && typeof item.slotType === "string" ? item.slotType.trim().toLowerCase() : "";
    const allowedSlots = item && Array.isArray(item.allowedSlots) ? item.allowedSlots : [];

    if (allowedSlots.length > 0) {
        return [...new Set(allowedSlots.map(slot => normalizeSlotFamily(String(slot).trim().toLowerCase())))];
    }

    if (slotType) return [normalizeSlotFamily(slotType)];
    if (gearType === "weapon") return ["weapon"];
    if (gearType === "accessory" || gearType === "relic") return ["relic"];
    return [];
}

function getNextOpenGearSlot(item = null) {
    const preferredFamilies = getPreferredSlotFamiliesForItem(item);
    if (preferredFamilies.length > 0) {
        for (const family of preferredFamilies) {
            for (const slotKey of GEAR_SLOT_ORDER) {
                if (normalizeSlotFamily(slotKey) !== family) continue;
                if (!playerInfo.gearSlots[slotKey]) return slotKey;
            }
        }
        return null;
    }

    for (const slotKey of GEAR_SLOT_ORDER) {
        if (!playerInfo.gearSlots[slotKey]) return slotKey;
    }
    return null;
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

function updatePlayerName() {
    updatePlayerNameUIFromUI({
        uiPlayerName,
        currentGameStats,
        classes: CLASSES
    });
}

function resetPlayer() {
    resetPlayerStateFromPlayerModule({
        playerInfo,
        currentGameStats,
        classes: CLASSES,
        createInitialCheatOverrides,
        createEmptyGearSlots,
        ensureActiveClassSkillRanks,
        recalculateStats,
        updatePlayerUI,
        updatePlayerName,
        renderEquipment,
        updateSkillTreeButton,
        renderSkillTree,
        setAvatarToAttack: () => {
            uiPlayerAvatar.src = getPlayerAvatarSrc("attack");
        }
    });
    passiveSkillManager.sync();
    syncEffectState();
    updatePlayerName();
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
    if (overallBlackFadeOverlay) {
        overallBlackFadeOverlay.classList.remove("hidden");
        overallBlackFadeOverlay.classList.add("is-active");
    }
    if (roundTransitionOverlay) {
        roundTransitionOverlay.classList.add("is-active");
    }
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
    setBgMusicTrack(INTRO_MUSIC_SRC, { restart: true, play: true });
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
        onConfirmSelection: async () => {
            setBgMusicTrack(BATTLE_MUSIC_SRC, { restart: true, play: true });
            await startLevel(1);
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
        floatText,
        gameEventBus,
        GAME_EVENTS
    }, index);
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
        uiEnemySkillsReadout,
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
    levelManager: currentGameStats.levelManager,
    playerInfo,
    gameEventBus,
    GAME_EVENTS,
    lootOverlay,
    eqReadout,
    overlay,
    uiLevelDisplay,
    uiEnemyName,
    uiEnemyAvatar,
    uiEnemyCard,
    uiPlayerAvatar,
    uiTurnDisplay,
    roundStartBtn,
    roundTransitionOverlay,
    overallBlackFadeOverlay,
    createEnemyFromId,
    createEnemy,
    getRoundEnemyId,
    getRoundType,
    getRoundCutsceneVideo,
    getRoundBackgroundPath,
    getRoundLevelObjectWarning,
    playRoundCutscene: videoSrc => playIntroGateOpeningSequence(videoSrc),
    consumeCutsceneTransitionSkip,
    setBattleArenaBackground,
    setArenaLevelWarning,
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
    presentScavengerPotionReward,
    applyPotionDropOnKill,
    getSkillTreeRegenRate,
    onTurnStarted: payload => {
        passiveSkillManager.handleTurnStarted(payload);
        syncEffectState();
        updateEnemyUI();
        updatePlayerUI();
    },
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
        consumeInventoryItem,
        showInfoTooltipFn: showInfoTooltip,
        hideInfoTooltipFn: hideInfoTooltip,
        showItemInfoFn: showItemInfo
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
    modalBtn,
    onModalConfirm: () => {
        overlay.classList.add("hidden");
        initAudio();
        setBgMusicTrack(INTRO_MUSIC_SRC, { restart: true, play: true });
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
    setAudioVolume: applyMasterVolume,
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

window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!currentGameStats.isCutsceneEventActive) return;
    currentGameStats.skipCutsceneRequested = true;
    currentGameStats.skipNextCutsceneTransition = true;
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);

window.addEventListener("DOMContentLoaded", initGame);











