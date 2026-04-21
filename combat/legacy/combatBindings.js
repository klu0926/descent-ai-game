import { createBattleGameLoop } from "../../game/gameLoop.js";
import {
    advanceToNextRoundFlow,
    applyDarkHarvestFlow,
    applyEnemyTurnDotsFlow,
    applyPlayerOnHitEffectsFlow,
    applySkillTreeTurnEffectsFlow,
    applyTrapOnEnemyTurnStartFlow,
    enemyAttacksFlow,
    handleLossFlow,
    handleWinFlow,
    maybeTriggerSurvivalistFlow,
    playerAttacksFlow,
    triggerDodgeCounterFlow
} from "./combatFlow.js";

export function createCombatBindings(ctx) {
    function waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function applyEnemyTurnDots() {
        return applyEnemyTurnDotsFlow({
            currentGameStats: ctx.currentGameStats,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            getEnemyTurnDots: ctx.getEnemyTurnDots,
            popPassive: ctx.popPassive,
            floatText: ctx.floatText,
            playSound: ctx.playSound,
            triggerScreenShake: ctx.triggerScreenShake,
            showHitCut: ctx.showHitCut,
            triggerAnimation: ctx.triggerAnimation,
            uiEnemyAvatar: ctx.uiEnemyAvatar,
            updateEnemyUI: ctx.updateEnemyUI
        });
    }

    function maybeTriggerSurvivalist(previousHp) {
        maybeTriggerSurvivalistFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            shouldTriggerSurvivalist: ctx.shouldTriggerSurvivalist,
            popPassive: ctx.popPassive,
            floatText: ctx.floatText,
            playSound: ctx.playSound
        }, previousHp);
    }

    function applyDarkHarvest() {
        applyDarkHarvestFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            getDarkHarvestAmount: ctx.getDarkHarvestAmount,
            popPassive: ctx.popPassive
        });
    }

    function applyPlayerOnHitEffects(baseDamage) {
        applyPlayerOnHitEffectsFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            getDarkHarvestAmount: ctx.getDarkHarvestAmount,
            getPlayerFlatOnHitDamage: ctx.getPlayerFlatOnHitDamage,
            countPassive: ctx.countPassive,
            popPassive: ctx.popPassive,
            floatText: ctx.floatText,
            playSound: ctx.playSound,
            triggerScreenShake: ctx.triggerScreenShake,
            showHitCut: ctx.showHitCut,
            getPlayerLifestealRate: ctx.getPlayerLifestealRate,
            getPlayerOnHitHealRate: ctx.getPlayerOnHitHealRate,
            hasPassive: ctx.hasPassive
        }, baseDamage);
    }

    function applySkillTreeTurnEffects() {
        return applySkillTreeTurnEffectsFlow({
            currentGameStats: ctx.currentGameStats,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            levelManager: ctx.levelManager,
            playerInfo: ctx.playerInfo,
            getSkillRank: ctx.getSkillRank,
            canTriggerTurnSkill: ctx.canTriggerTurnSkill,
            floatText: ctx.floatText,
            showHitCut: ctx.showHitCut,
            showFireEffect: ctx.showFireEffect || ctx.showHitCut,
            uiTurnDisplay: ctx.uiTurnDisplay,
            updateEnemyUI: ctx.updateEnemyUI,
            updatePlayerUI: ctx.updatePlayerUI,
            onTurnStarted: ctx.onTurnStarted,
            playSound: ctx.playSound,
            handleWin
        });
    }

    function applyTrapOnEnemyTurnStart() {
        return applyTrapOnEnemyTurnStartFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            getSkillRank: ctx.getSkillRank,
            floatText: ctx.floatText,
            showHitCut: ctx.showHitCut,
            playSound: ctx.playSound,
            triggerScreenShake: ctx.triggerScreenShake,
            updateEnemyUI: ctx.updateEnemyUI,
            handleWin
        });
    }

    function triggerDodgeCounter() {
        triggerDodgeCounterFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            getSkillRank: ctx.getSkillRank,
            floatText: ctx.floatText,
            showHitCut: ctx.showHitCut,
            triggerScreenShake: ctx.triggerScreenShake,
            playSound: ctx.playSound,
            updatePlayerUI: ctx.updatePlayerUI,
            updateEnemyUI: ctx.updateEnemyUI
        });
    }

    async function playerAttacks() {
        await playerAttacksFlow({
            currentGameStats: ctx.currentGameStats,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            playerInfo: ctx.playerInfo,
            uiPlayerAvatar: ctx.uiPlayerAvatar,
            uiEnemyAvatar: ctx.uiEnemyAvatar,
            triggerAnimation: ctx.triggerAnimation,
            playSound: ctx.playSound,
            tryDodge: ctx.tryDodge,
            triggerDodgeAnimation: ctx.triggerDodgeAnimation,
            floatText: ctx.floatText,
            rollDamage: ctx.rollDamage,
            hasPassive: ctx.hasPassive,
            popPassive: ctx.popPassive,
            getPlayerCritMultiplier: ctx.getPlayerCritMultiplier,
            rollChance: ctx.rollChance,
            getLuckyStrikeChance: ctx.getLuckyStrikeChance,
            triggerCritFlash: ctx.triggerCritFlash,
            triggerScreenShake: ctx.triggerScreenShake,
            showHitCut: ctx.showHitCut,
            onPlayerSuccessfulHit: ctx.onPlayerSuccessfulHit,
            applySkillTreeAttackHealing: ctx.applySkillTreeAttackHealing,
            updateEnemyUI: ctx.updateEnemyUI,
            applyPlayerOnHitEffects,
            updatePlayerUI: ctx.updatePlayerUI,
            handleWin,
            getTimeWarpChance: ctx.getTimeWarpChance
        });
    }

    async function enemyAttacks() {
        await enemyAttacksFlow({
            currentGameStats: ctx.currentGameStats,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            playerInfo: ctx.playerInfo,
            uiEnemyAvatar: ctx.uiEnemyAvatar,
            uiPlayerAvatar: ctx.uiPlayerAvatar,
            triggerAnimation: ctx.triggerAnimation,
            playSound: ctx.playSound,
            applyTrapOnEnemyTurnStart,
            tryDodge: ctx.tryDodge,
            rollChance: ctx.rollChance,
            getPlayerExtraDodgeChance: ctx.getPlayerExtraDodgeChance,
            countPassive: ctx.countPassive,
            popPassive: ctx.popPassive,
            setPlayerAvatarTemporary: ctx.setPlayerAvatarTemporary,
            triggerDodgeAnimation: ctx.triggerDodgeAnimation,
            floatText: ctx.floatText,
            getSkillRank: ctx.getSkillRank,
            recalculateStats: ctx.recalculateStats,
            updatePlayerUI: ctx.updatePlayerUI,
            triggerDodgeCounter,
            rollDamage: ctx.rollDamage,
            getEnemyDisplayedAtk: ctx.getEnemyDisplayedAtk,
            hasPassive: ctx.hasPassive,
            getDivineShieldChance: ctx.getDivineShieldChance,
            getPlayerDamageReduction: ctx.getPlayerDamageReduction,
            getPhantomChance: ctx.getPhantomChance,
            triggerCritFlash: ctx.triggerCritFlash,
            triggerScreenShake: ctx.triggerScreenShake,
            showHitCut: ctx.showHitCut,
            maybeTriggerSurvivalist,
            getPlayerReflectRate: ctx.getPlayerReflectRate,
            updateEnemyUI: ctx.updateEnemyUI,
            getCounterChance: ctx.getCounterChance,
            handleLoss,
            handleWin
        });
    }

    function handleWin() {
        handleWinFlow({
            currentGameStats: ctx.currentGameStats,
            playerInfo: ctx.playerInfo,
            gameLoop,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            floatText: ctx.floatText,
            clearEnemyDisplay: ctx.clearEnemyDisplay,
            applyPotionDropOnKill: ctx.applyPotionDropOnKill,
            countPassive: ctx.countPassive,
            getBloodthirstHealAmount: ctx.getBloodthirstHealAmount,
            popPassive: ctx.popPassive,
            updatePlayerUI: ctx.updatePlayerUI,
            playSound: ctx.playSound,
            advanceToNextRound
        });
    }

    function advanceToNextRound() {
        advanceToNextRoundFlow({
            currentGameStats: ctx.currentGameStats,
            presentScavengerPotionReward: ctx.presentScavengerPotionReward,
            lootOverlay: ctx.lootOverlay,
            floatText: ctx.floatText,
            startLevel
        });
    }

    function handleLoss() {
        handleLossFlow({
            gameLoop,
            gameEventBus: ctx.gameEventBus,
            GAME_EVENTS: ctx.GAME_EVENTS,
            currentGameStats: ctx.currentGameStats,
            setPauseState: ctx.setPauseState,
            clearScreenSpaceEffects: ctx.clearScreenSpaceEffects,
            floatText: ctx.floatText,
            eqReadout: ctx.eqReadout,
            overlay: ctx.overlay,
            playSound: ctx.playSound
        });
    }

    function startBattleLoop() {
        gameLoop.start();
    }

    async function animateEnemyEntrance() {
        const enemyCard = ctx.uiEnemyCard;
        if (!enemyCard) return;
        enemyCard.classList.remove("enemy-entering");
        void enemyCard.offsetWidth;
        enemyCard.classList.add("enemy-entering");
        await Promise.race([
            new Promise(resolve => enemyCard.addEventListener("animationend", resolve, { once: true })),
            waitMs(460)
        ]);
        enemyCard.classList.remove("enemy-entering");
    }

    async function runRoundTransition(midpoint) {
        const shouldSkipTransition = typeof ctx.consumeCutsceneTransitionSkip === "function"
            ? ctx.consumeCutsceneTransitionSkip()
            : false;
        if (shouldSkipTransition) {
            await midpoint();
            return;
        }
        const overlay = ctx.roundTransitionOverlay;
        if (!overlay) {
            await midpoint();
            return;
        }
        overlay.classList.add("is-active");
        await waitMs(430);
        await midpoint();
        overlay.classList.remove("is-active");
        await waitMs(430);
    }

    async function releaseOverallBlackFadeIfNeeded() {
        const overlay = ctx.overallBlackFadeOverlay;
        if (!overlay || overlay.dataset.released === "true") return;
        overlay.dataset.released = "true";
        overlay.classList.remove("is-active");
        if (ctx.roundTransitionOverlay) {
            ctx.roundTransitionOverlay.classList.remove("is-active");
        }
        await waitMs(430);
        overlay.classList.add("hidden");
    }

    async function spawnEnemy(level, round) {
        const configuredEnemyId = typeof ctx.getRoundEnemyId === "function"
            ? ctx.getRoundEnemyId(level, round)
            : null;
        if (configuredEnemyId && typeof ctx.createEnemyFromId === "function") {
            ctx.currentGameStats.currentEnemy = ctx.createEnemyFromId(configuredEnemyId);
        } else {
            ctx.currentGameStats.currentEnemy = ctx.createEnemy();
        }
        if (typeof ctx.syncEffectState === "function") ctx.syncEffectState();
        ctx.showEnemyDisplay();
        ctx.uiEnemyName.innerText = ctx.currentGameStats.currentEnemy.name;
        ctx.uiEnemyAvatar.src = ctx.currentGameStats.currentEnemy.img;
        ctx.uiEnemyAvatar.removeAttribute("title");
        ctx.applyEnemySize(ctx.currentGameStats.currentEnemy.size);
        ctx.updateEnemyUI();
        await animateEnemyEntrance();
    }

    async function beginRoundEncounter(level, round) {
        await spawnEnemy(level, round);
        ctx.updatePlayerUI();
        await releaseOverallBlackFadeIfNeeded();
        ctx.currentGameStats.currentRound = Math.max(0, (Number(ctx.currentGameStats.currentRound) || 0) + 1);
        if (ctx.uiLevelDisplay) {
            ctx.uiLevelDisplay.innerText = `${ctx.currentGameStats.currentRound}`;
        }
        ctx.currentGameStats.isPlayerTurn = true;
        ctx.gameEventBus.emit(ctx.GAME_EVENTS.LEVEL_STARTED, {
            level: ctx.currentGameStats.currentLevel,
            round: ctx.currentGameStats.currentRound
        });
        startBattleLoop();
    }

    async function handleCutsceneRound(level, round) {
        const videoPath = typeof ctx.getRoundCutsceneVideo === "function"
            ? ctx.getRoundCutsceneVideo(level, round)
            : null;
        if (typeof ctx.playRoundCutscene === "function") {
            await ctx.playRoundCutscene(videoPath || "");
        } else {
            await waitMs(500);
        }

        const nextRound = Math.max(1, (Number(round) || 1) + 1);
        await startLevel(level, nextRound);
    }

    async function handleVendorRound(level, round) {
        if (typeof ctx.playRoundVendorEvent === "function") {
            await ctx.playRoundVendorEvent(level, round);
        } else {
            await waitMs(500);
        }
        const nextRound = Math.max(1, (Number(round) || 1) + 1);
        await startLevel(level, nextRound);
    }

    async function startLevel(level, round = 1) {
        const nextLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.trunc(Number(level))) : 1;
        const nextRound = Number.isFinite(Number(round)) ? Math.max(1, Math.trunc(Number(round))) : 1;
        const isFirstRound = nextRound === 1;
        if (ctx.levelManager && typeof ctx.levelManager.setProgress === "function") {
            ctx.levelManager.setProgress({ level: nextLevel, scene: nextRound, turn: 0 });
            if (typeof ctx.levelManager.syncToCurrentGame === "function") {
                ctx.levelManager.syncToCurrentGame(ctx.currentGameStats);
            }
        } else {
            ctx.currentGameStats.currentLevel = nextLevel;
            ctx.currentGameStats.currentScene = nextRound;
            ctx.currentGameStats.currentTurn = 0;
        }
        if (isFirstRound) {
            ctx.currentGameStats.currentRound = 0;
        }
        const existingAppliedStatusState = ctx.currentGameStats.battleState
            && ctx.currentGameStats.battleState.__appliedStatusSkills
            && ctx.currentGameStats.battleState.__appliedStatusSkills.entries
            ? ctx.currentGameStats.battleState.__appliedStatusSkills.entries
            : {};
        Object.values(existingAppliedStatusState).forEach(entry => {
            if (!entry || typeof entry !== "object") return;
            const unsubscribers = Array.isArray(entry.unsubscribers) ? entry.unsubscribers : [];
            unsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === "function") unsubscribe();
            });
        });
        ctx.currentGameStats.battleState.survivalUsed = false;
        ctx.currentGameStats.battleState.turnCount = 0;
        ctx.currentGameStats.battleState.currentTurnNumber = 0;
        ctx.currentGameStats.battleState.turnOwner = "player";
        ctx.currentGameStats.battleState.playerTurnCount = 0;
        ctx.currentGameStats.battleState.enemyTurnCount = 0;
        ctx.currentGameStats.battleState.dodgeCounterWindow = 0;
        ctx.currentGameStats.battleState.skillTreeDodgeBuffTurns = 0;
        ctx.currentGameStats.battleState.trapReady = false;
        ctx.currentGameStats.battleState.attackHitsForTrap = 0;
        ctx.currentGameStats.battleState.trapCritArmed = false;
        ctx.currentGameStats.battleState.relentlessCounterCooldown = 0;
        ctx.currentGameStats.battleState.potionAtkBuffTurns = 0;
        ctx.currentGameStats.battleState.healingScrollRegenTurns = 0;
        ctx.currentGameStats.battleState.__appliedStatusSkills = { entries: {} };
        if (ctx.playerInfo && typeof ctx.playerInfo === "object") {
            ctx.playerInfo.activeStatuses = [];
        }
        if (ctx.currentGameStats.currentEnemy && typeof ctx.currentGameStats.currentEnemy === "object") {
            ctx.currentGameStats.currentEnemy.activeStatuses = [];
        }
        if (ctx.levelManager && typeof ctx.levelManager.setTurn === "function") {
            ctx.levelManager.setTurn(0);
            if (typeof ctx.levelManager.syncToCurrentGame === "function") {
                ctx.levelManager.syncToCurrentGame(ctx.currentGameStats);
            }
        } else {
            ctx.currentGameStats.currentTurn = 0;
        }
        if (typeof ctx.syncEffectState === "function") ctx.syncEffectState();
        const displayedRound = Math.max(0, Number(ctx.currentGameStats.currentRound) || 0);
        ctx.uiLevelDisplay.innerText = `${displayedRound}`;
        if (ctx.uiTurnDisplay) ctx.uiTurnDisplay.innerText = `${ctx.currentGameStats.currentTurn || 0}`;
        const roundType = typeof ctx.getRoundType === "function"
            ? ctx.getRoundType(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene)
            : "fight";
        const roundBackgroundPath = typeof ctx.getRoundBackgroundPath === "function"
            ? ctx.getRoundBackgroundPath(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene)
            : "";
        if (typeof ctx.setBattleArenaBackground === "function") {
            if (isFirstRound && roundType === "cutscene") {
                // For a first-scene cutscene, keep arena hidden and avoid loading arena background.
            } else if (isFirstRound) {
                // Keep the arena hidden behind black until scene 1 actually starts.
                if (ctx.roundTransitionOverlay) {
                    ctx.roundTransitionOverlay.classList.add("is-active");
                }
                ctx.setBattleArenaBackground(roundBackgroundPath);
            } else {
                await runRoundTransition(async () => {
                    ctx.setBattleArenaBackground(roundBackgroundPath);
                });
            }
        }
        if (typeof ctx.setArenaLevelWarning === "function") {
            const warningText = typeof ctx.getRoundLevelObjectWarning === "function"
                ? ctx.getRoundLevelObjectWarning(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene)
                : "";
            ctx.setArenaLevelWarning(warningText);
        }
        if (ctx.roundStartBtn) {
            ctx.roundStartBtn.classList.add("hidden");
            ctx.roundStartBtn.disabled = false;
            ctx.roundStartBtn.onclick = null;
        }
        if (roundType === "cutscene") {
            ctx.clearEnemyDisplay();
            ctx.updatePlayerUI();
            if (isFirstRound) {
                await handleCutsceneRound(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene);
            } else {
                await handleCutsceneRound(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene);
            }
            return;
        }
        if (roundType === "vendor") {
            ctx.clearEnemyDisplay();
            ctx.updatePlayerUI();
            await handleVendorRound(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene);
            return;
        }
        if (isFirstRound && ctx.roundStartBtn) {
            ctx.clearEnemyDisplay();
            ctx.roundStartBtn.classList.remove("hidden");
            ctx.roundStartBtn.disabled = false;
            ctx.roundStartBtn.onclick = async () => {
                ctx.roundStartBtn.disabled = true;
                ctx.roundStartBtn.classList.add("hidden");
                await beginRoundEncounter(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene);
            };
            ctx.updatePlayerUI();
            return;
        }
        await beginRoundEncounter(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentScene);
    }

    const gameLoop = createBattleGameLoop({
        eventBus: ctx.gameEventBus,
        getIsPaused: () => ctx.currentGameStats.isPaused,
        getIsAnimating: () => ctx.currentGameStats.isAnimating,
        applySkillTreeTurnEffects,
        recalculateStats: ctx.recalculateStats,
        updatePlayerUI: ctx.updatePlayerUI,
        getRegenRate: () => ctx.getPlayerRegenRate() + ctx.getSkillTreeRegenRate(),
        getIsPlayerTurn: () => ctx.currentGameStats.isPlayerTurn,
        canApplyRegen: () => ctx.playerInfo.hp < ctx.playerInfo.maxHp,
        applyRegen: regenRate => {
            const heal = Math.floor(ctx.playerInfo.maxHp * regenRate);
            ctx.playerInfo.hp = Math.min(ctx.playerInfo.maxHp, ctx.playerInfo.hp + heal);
            if (ctx.countPassive("regen") > 0) ctx.popPassive("Regeneration");
            if (ctx.countPassive("mend") > 0) ctx.popPassive("Mend");
            ctx.floatText("player", `+${heal} HP`, "heal");
            ctx.playSound("heal");
        },
        applyEnemyTurnDots,
        onEnemyDefeatedByDots: handleWin,
        playerAttacks,
        enemyAttacks,
        intervalMs: 1000
    });

    return {
        gameLoop,
        applyEnemyTurnDots,
        applySkillTreeTurnEffects,
        applyTrapOnEnemyTurnStart,
        triggerDodgeCounter,
        playerAttacks,
        enemyAttacks,
        handleWin,
        advanceToNextRound,
        handleLoss,
        startBattleLoop,
        spawnEnemy,
        startLevel
    };
}
