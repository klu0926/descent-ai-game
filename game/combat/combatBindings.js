import { createBattleGameLoop } from "../gameLoop.js";
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
            checkLevelUp: ctx.checkLevelUp,
            getMaxPlayerLevel: ctx.getMaxPlayerLevel,
            applyClassLevelUpGrowth: ctx.applyClassLevelUpGrowth,
            gainSkillPoints: ctx.gainSkillPoints,
            recalculateStats: ctx.recalculateStats,
            updateExpUI: ctx.updateExpUI,
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

    async function spawnEnemy(level, round) {
        const enemyLevel = Number.isFinite(Number(round)) ? Math.max(1, Math.trunc(Number(round))) : Math.max(1, Math.trunc(Number(level) || 1));
        const configuredEnemyId = typeof ctx.getRoundEnemyId === "function"
            ? ctx.getRoundEnemyId(level, round)
            : null;
        if (configuredEnemyId && typeof ctx.createEnemyFromId === "function") {
            ctx.currentGameStats.currentEnemy = ctx.createEnemyFromId(configuredEnemyId, enemyLevel);
        } else {
            ctx.currentGameStats.currentEnemy = ctx.createEnemy(enemyLevel);
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
        ctx.currentGameStats.isPlayerTurn = true;
        ctx.gameEventBus.emit(ctx.GAME_EVENTS.LEVEL_STARTED, {
            level: ctx.currentGameStats.currentLevel,
            round: ctx.currentGameStats.currentRound
        });
        startBattleLoop();
    }

    async function startLevel(level, round = 1) {
        const nextLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.trunc(Number(level))) : 1;
        const nextRound = Number.isFinite(Number(round)) ? Math.max(1, Math.trunc(Number(round))) : 1;
        const isFirstRound = nextRound === 1;
        if (ctx.levelManager && typeof ctx.levelManager.setProgress === "function") {
            ctx.levelManager.setProgress({ level: nextLevel, round: nextRound, turn: 0 });
            if (typeof ctx.levelManager.syncToCurrentGame === "function") {
                ctx.levelManager.syncToCurrentGame(ctx.currentGameStats);
            }
        } else {
            ctx.currentGameStats.currentLevel = nextLevel;
            ctx.currentGameStats.currentRound = nextRound;
            ctx.currentGameStats.currentTurn = 0;
        }
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
        if (ctx.levelManager && typeof ctx.levelManager.setTurn === "function") {
            ctx.levelManager.setTurn(0);
            if (typeof ctx.levelManager.syncToCurrentGame === "function") {
                ctx.levelManager.syncToCurrentGame(ctx.currentGameStats);
            }
        } else {
            ctx.currentGameStats.currentTurn = 0;
        }
        if (typeof ctx.syncEffectState === "function") ctx.syncEffectState();
        const displayedRound = typeof ctx.currentGameStats.currentRound === "number"
            ? ctx.currentGameStats.currentRound
            : ctx.currentGameStats.currentLevel;
        ctx.uiLevelDisplay.innerText = displayedRound;
        if (ctx.uiTurnDisplay) ctx.uiTurnDisplay.innerText = `${ctx.currentGameStats.currentTurn || 0}`;
        const roundBackgroundPath = typeof ctx.getRoundBackgroundPath === "function"
            ? ctx.getRoundBackgroundPath(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentRound)
            : "";
        if (typeof ctx.setBattleArenaBackground === "function") {
            if (isFirstRound) {
                ctx.setBattleArenaBackground(roundBackgroundPath);
            } else {
                await runRoundTransition(async () => {
                    ctx.setBattleArenaBackground(roundBackgroundPath);
                });
            }
        }
        if (typeof ctx.setArenaLevelWarning === "function") {
            const warningText = typeof ctx.getRoundLevelObjectWarning === "function"
                ? ctx.getRoundLevelObjectWarning(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentRound)
                : "";
            ctx.setArenaLevelWarning(warningText);
        }
        if (ctx.roundStartBtn) {
            ctx.roundStartBtn.classList.add("hidden");
            ctx.roundStartBtn.disabled = false;
            ctx.roundStartBtn.onclick = null;
        }
        if (isFirstRound && ctx.roundStartBtn) {
            ctx.clearEnemyDisplay();
            ctx.roundStartBtn.classList.remove("hidden");
            ctx.roundStartBtn.disabled = false;
            ctx.roundStartBtn.onclick = async () => {
                ctx.roundStartBtn.disabled = true;
                ctx.roundStartBtn.classList.add("hidden");
                await beginRoundEncounter(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentRound);
            };
            ctx.updatePlayerUI();
            return;
        }
        await beginRoundEncounter(ctx.currentGameStats.currentLevel, ctx.currentGameStats.currentRound);
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
