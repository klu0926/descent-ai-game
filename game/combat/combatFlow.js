export function applyEnemyTurnDotsFlow(ctx) {
    const { currentGameStats } = ctx;
    if (!currentGameStats.currentEnemy || currentGameStats.currentEnemy.hp <= 0) return false;

    const dots = ctx.getEnemyTurnDots();
    let totalDamage = 0;

    if (dots.fireDamage > 0) {
        totalDamage += dots.fireDamage;
        ctx.popPassive("Aura of Fire");
    }

    if (dots.venomDamage > 0) {
        totalDamage += dots.venomDamage;
        ctx.popPassive("Venom");
    }

    if (totalDamage <= 0) return false;

    currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - totalDamage);
    if (ctx.gameEventBus && ctx.GAME_EVENTS) {
        ctx.gameEventBus.emit(ctx.GAME_EVENTS.ENEMY_HIT, { damage: totalDamage, source: "dot" });
    }
    ctx.floatText("enemy", `-${totalDamage}`, "dmg");
    ctx.playSound("hit");
    ctx.triggerScreenShake();
    ctx.showHitCut("enemy");
    if (currentGameStats.currentEnemy.hp > 0) ctx.triggerAnimation(ctx.uiEnemyAvatar, "anim-damage");
    ctx.updateEnemyUI();
    return currentGameStats.currentEnemy.hp <= 0;
}

export function maybeTriggerSurvivalistFlow(ctx, previousHp) {
    const { currentGameStats, playerInfo } = ctx;
    if (ctx.shouldTriggerSurvivalist(previousHp, playerInfo.hp)) {
        currentGameStats.battleState.survivalUsed = true;
        playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + 50);
        ctx.popPassive("Survivalist");
        ctx.floatText("player", "+50 HP", "heal");
        ctx.playSound("heal");
    }
}

export function applyDarkHarvestFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    const stolen = ctx.getDarkHarvestAmount(currentGameStats.currentEnemy);
    if (stolen <= 0) return;

    currentGameStats.currentEnemy.maxHp -= stolen;
    currentGameStats.currentEnemy.hp = Math.min(currentGameStats.currentEnemy.hp, currentGameStats.currentEnemy.maxHp);
    playerInfo.maxHp += stolen;
    playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + stolen);
    ctx.popPassive("Dark Harvest");
}

export function applyPlayerOnHitEffectsFlow(ctx, baseDamage) {
    const { currentGameStats, playerInfo } = ctx;
    let totalBonusDamage = 0;
    const flatBonus = ctx.getPlayerFlatOnHitDamage();
    if (flatBonus > 0 && currentGameStats.currentEnemy.hp > 0) {
        totalBonusDamage += flatBonus;
        if (ctx.countPassive("poison") > 0) ctx.popPassive("Poison Touch");
        if (ctx.countPassive("smite") > 0) ctx.popPassive("Smite");
    }

    if (totalBonusDamage > 0) {
        currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - totalBonusDamage);
        ctx.floatText("enemy", `-${totalBonusDamage}`, "dmg");
        ctx.playSound("hit");
        ctx.triggerScreenShake();
        ctx.showHitCut("enemy");
    }

    const lifestealRate = ctx.getPlayerLifestealRate();
    if (lifestealRate > 0 && baseDamage > 0) {
        const heal = Math.floor(baseDamage * lifestealRate);
        if (heal > 0) {
            playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
            ctx.popPassive(lifestealRate >= 0.4 ? "Vampiric Touch" : "Lifesteal");
            ctx.floatText("player", `+${heal} HP`, "heal");
        }
    }

    const onHitHealRate = ctx.getPlayerOnHitHealRate();
    if (onHitHealRate > 0 && baseDamage > 0) {
        const heal = Math.floor(playerInfo.maxHp * onHitHealRate);
        if (heal > 0) {
            playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
            ctx.popPassive("Light Burst");
            ctx.floatText("player", `+${heal} HP`, "heal");
        }
    }

    if (baseDamage > 0 && ctx.hasPassive("dark")) {
        applyDarkHarvestFlow(ctx);
    }
}

export function applySkillTreeTurnEffectsFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    const battleState = currentGameStats.battleState;
    const isPlayerPhase = currentGameStats.isPlayerTurn;
    const canTriggerTurnSkill = typeof ctx.canTriggerTurnSkill === "function"
        ? ctx.canTriggerTurnSkill
        : skillId => {
            void skillId;
            return battleState.turnOwner === "player";
        };
    battleState.turnOwner = isPlayerPhase ? "player" : "enemy";

    if (isPlayerPhase) {
        battleState.playerTurnCount += 1;
        battleState.turnCount = battleState.playerTurnCount;
        if (battleState.skillTreeDodgeBuffTurns > 0) battleState.skillTreeDodgeBuffTurns -= 1;
        if (battleState.relentlessCounterCooldown > 0) battleState.relentlessCounterCooldown -= 1;
        if (battleState.potionAtkBuffTurns > 0) battleState.potionAtkBuffTurns -= 1;
        if (battleState.healingScrollRegenTurns > 0) battleState.healingScrollRegenTurns -= 1;
    } else {
        battleState.enemyTurnCount += 1;
    }
    battleState.currentTurnNumber = battleState.turnCount;

    if (ctx.uiTurnDisplay) ctx.uiTurnDisplay.innerText = `${battleState.currentTurnNumber}`;

    const fireRank = ctx.getSkillRank("fire_scroll");
    if (canTriggerTurnSkill("fire_scroll") && currentGameStats.currentEnemy && currentGameStats.currentEnemy.hp > 0 && fireRank > 0 && battleState.currentTurnNumber % 10 === 0) {
        const fireDamage = fireRank === 1
            ? Math.max(5, Math.floor(playerInfo.atk * 0.45))
            : Math.max(10, Math.floor(playerInfo.atk * 0.9));
        currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - fireDamage);
        ctx.floatText("enemy", `-${fireDamage}`, "dmg");
        ctx.floatText("player", "Fire Scroll", "info");
        ctx.showFireEffect("enemy");
        ctx.updateEnemyUI();
        if (currentGameStats.currentEnemy.hp <= 0) {
            ctx.handleWin();
            return true;
        }
    }

    const healingRank = ctx.getSkillRank("healing_scroll");
    if (canTriggerTurnSkill("healing_scroll") && healingRank > 0 && battleState.currentTurnNumber % 15 === 0) {
        const heal = Math.max(1, Math.floor(playerInfo.maxHp * 0.25));
        playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
        ctx.floatText("player", `+${heal} HP`, "heal");
        if (healingRank >= 2) {
            battleState.healingScrollRegenTurns = 3;
            ctx.floatText("player", "Regen up", "info");
        }
        ctx.playSound("heal");
        ctx.updatePlayerUI();
    }
    return false;
}

export function applyTrapOnEnemyTurnStartFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    if (!currentGameStats.battleState.trapReady || !currentGameStats.currentEnemy || currentGameStats.currentEnemy.hp <= 0) return false;
    const snareRank = ctx.getSkillRank("hidden_snare");
    if (snareRank <= 0) return false;

    let trapScale = 0.35;
    if (snareRank === 2) trapScale = 0.7;
    if (snareRank >= 3) trapScale = 1.05;
    let trapDamage = Math.max(1, Math.floor(playerInfo.atk * trapScale));

    const trapBoostRank = ctx.getSkillRank("opportunistic_trap");
    if (trapBoostRank > 0) {
        trapDamage = Math.floor(trapDamage * (1 + trapBoostRank * 0.2));
    }
    if (currentGameStats.battleState.trapCritArmed && trapBoostRank >= 2) {
        trapDamage = Math.floor(trapDamage * 2);
        ctx.floatText("player", "Trap crit!", "crit");
    }

    currentGameStats.battleState.trapReady = false;
    currentGameStats.battleState.trapCritArmed = false;
    currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - trapDamage);
    ctx.floatText("enemy", `-${trapDamage}`, "dmg");
    ctx.floatText("player", "Hidden Snare", "info");
    ctx.showHitCut("enemy");
    ctx.playSound("hit");
    ctx.triggerScreenShake();
    ctx.updateEnemyUI();

    if (currentGameStats.currentEnemy.hp <= 0) {
        ctx.handleWin();
        return true;
    }
    return false;
}

export function triggerDodgeCounterFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    if (!currentGameStats.currentEnemy || currentGameStats.currentEnemy.hp <= 0) return;
    const reactiveChance = ctx.getSkillRank("reactive_strike") * 0.1;
    const relentlessUnlocked = ctx.getSkillRank("relentless_counter") > 0;
    let shouldCounter = false;

    if (relentlessUnlocked && currentGameStats.battleState.relentlessCounterCooldown <= 0) {
        shouldCounter = true;
        currentGameStats.battleState.relentlessCounterCooldown = 2;
    } else if (reactiveChance > 0 && Math.random() < reactiveChance) {
        shouldCounter = true;
    }
    if (!shouldCounter) return;

    const flowBonus = ctx.getSkillRank("flowing_counter") * 0.2;
    const counterDmg = Math.max(1, Math.floor(playerInfo.atk * 0.5 * (1 + flowBonus)));
    currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - counterDmg);
    ctx.floatText("enemy", `-${counterDmg}`, "dmg");
    ctx.floatText("player", "Counter!", "counter");
    ctx.showHitCut("enemy");
    ctx.triggerScreenShake();
    ctx.playSound("hit");
    if (ctx.getSkillRank("flowing_counter") > 0) {
        const heal = Math.max(1, Math.floor(playerInfo.maxHp * 0.01 * ctx.getSkillRank("flowing_counter")));
        playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
        ctx.floatText("player", `+${heal} HP`, "heal");
        ctx.updatePlayerUI();
    }
    ctx.updateEnemyUI();
}

export async function playerAttacksFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    await ctx.triggerAnimation(ctx.uiPlayerAvatar, "anim-attack-right");
    ctx.playSound("slash");

    if (ctx.tryDodge(playerInfo.aim, currentGameStats.currentEnemy.dodge)) {
        await ctx.triggerDodgeAnimation("enemy");
        ctx.floatText("enemy", "Dodge!", "heal");
        if (ctx.gameEventBus && ctx.GAME_EVENTS) {
            ctx.gameEventBus.emit(ctx.GAME_EVENTS.ENEMY_DODGE, { source: "basic_attack" });
        }
        currentGameStats.isPlayerTurn = false;
        return;
    }

    const atkBuffMultiplier = currentGameStats.battleState.potionAtkBuffTurns > 0 ? 1.1 : 1;
    let rolledAtk = ctx.rollDamage(Math.max(1, Math.floor(playerInfo.atk * atkBuffMultiplier)));
    let isCrit = false;
    let isLucky = false;

    if (ctx.hasPassive("first_strike") && playerInfo.hp === playerInfo.maxHp) {
        rolledAtk *= 2;
        ctx.popPassive("First Strike");
    }

    if (ctx.hasPassive("frenzy") && playerInfo.hp <= Math.floor(playerInfo.maxHp / 2)) {
        rolledAtk = Math.floor(rolledAtk * 1.5);
        ctx.popPassive("Frenzy");
    }

    if (ctx.hasPassive("blight") && currentGameStats.currentEnemy.hp <= Math.floor(currentGameStats.currentEnemy.maxHp * 0.2)) {
        rolledAtk *= 3;
        ctx.popPassive("Blight");
    }

    if (Math.random() < (playerInfo.crit / 100)) {
        rolledAtk = Math.floor(rolledAtk * ctx.getPlayerCritMultiplier());
        isCrit = true;
        if (ctx.hasPassive("earth")) ctx.popPassive("Earth Shatter");
    }

    if (ctx.rollChance(ctx.getLuckyStrikeChance())) {
        rolledAtk = Math.floor(rolledAtk * 3);
        isLucky = true;
        ctx.popPassive("Lucky Strike");
    }

    const rolledDef = ctx.hasPassive("shadow") ? 0 : ctx.rollDamage(currentGameStats.currentEnemy.def);
    if (ctx.hasPassive("shadow")) ctx.popPassive("Shadow Strike");
    const dmg = Math.max(0, rolledAtk - rolledDef);
    currentGameStats.currentEnemy.hp -= dmg;

    if (isCrit) {
        ctx.floatText("player", "Crit attack!", "info");
        ctx.playSound("crit");
        ctx.triggerCritFlash();
    }
    if (isLucky) {
        ctx.floatText("player", "Lucky hit!", "info");
        ctx.playSound("crit");
    }

    if (rolledDef > 0 && dmg === 0) {
        ctx.floatText("enemy", "Defended", "block");
        ctx.playSound("block");
        ctx.triggerAnimation(ctx.uiEnemyAvatar, "anim-defended");
        if (ctx.gameEventBus && ctx.GAME_EVENTS) {
            ctx.gameEventBus.emit(ctx.GAME_EVENTS.ENEMY_BLOCK, { source: "basic_attack" });
        }
    }

    if (dmg > 0) {
        if (ctx.gameEventBus && ctx.GAME_EVENTS) {
            ctx.gameEventBus.emit(ctx.GAME_EVENTS.ENEMY_HIT, {
                damage: dmg,
                isCrit,
                isLucky,
                source: "basic_attack"
            });
        }
        ctx.floatText("enemy", `-${dmg}`, isCrit ? "crit" : "dmg");
        if (!isCrit) ctx.playSound("hit");
        ctx.triggerScreenShake();
        ctx.showHitCut("enemy");
        ctx.onPlayerSuccessfulHit();
        ctx.applySkillTreeAttackHealing(dmg);
    }

    if (dmg > 0) ctx.triggerAnimation(ctx.uiEnemyAvatar, "anim-damage");
    ctx.updateEnemyUI();
    if (dmg > 0) ctx.applyPlayerOnHitEffects(dmg);
    ctx.updatePlayerUI();

    if (currentGameStats.currentEnemy.hp <= 0) ctx.handleWin();
    else if (ctx.rollChance(ctx.getTimeWarpChance())) {
        ctx.popPassive("Time Warp");
        currentGameStats.isPlayerTurn = true;
    } else currentGameStats.isPlayerTurn = false;
}

export async function enemyAttacksFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    await ctx.triggerAnimation(ctx.uiEnemyAvatar, "anim-attack-left");
    ctx.playSound("slash");
    if (ctx.applyTrapOnEnemyTurnStart()) return;

    let dodged = false;
    if (ctx.tryDodge(currentGameStats.currentEnemy.aim, playerInfo.dodge)) {
        dodged = true;
    } else if (ctx.rollChance(ctx.getPlayerExtraDodgeChance())) {
        dodged = true;
        if (ctx.countPassive("evasion") > 0) ctx.popPassive("Evasion");
        else if (ctx.countPassive("wind") > 0) ctx.popPassive("Wind Walk");
        else ctx.popPassive("Dodge");
    }

    if (dodged) {
        ctx.setPlayerAvatarTemporary("block", 260);
        await ctx.triggerDodgeAnimation("player");
        ctx.floatText("player", "Dodge!", "heal");
        if (ctx.gameEventBus && ctx.GAME_EVENTS) {
            ctx.gameEventBus.emit(ctx.GAME_EVENTS.PLAYER_DODGE, { source: "enemy_attack" });
        }
        ctx.recalculateStats();
        ctx.updatePlayerUI();
        ctx.triggerDodgeCounter();
    } else {
        let rolledAtk = ctx.rollDamage(ctx.getEnemyDisplayedAtk());
        let isCrit = false;
        if (!ctx.hasPassive("holy") && Math.random() < (currentGameStats.currentEnemy.crit / 100)) {
            rolledAtk = Math.floor(rolledAtk * 1.5);
            isCrit = true;
        } else if (ctx.hasPassive("holy") && Math.random() < (currentGameStats.currentEnemy.crit / 100)) {
            ctx.popPassive("Holy Light");
        }

        const rolledDef = ctx.rollDamage(playerInfo.def);
        const previousHp = playerInfo.hp;
        let dmg = Math.max(0, rolledAtk - rolledDef);

        if (currentGameStats.cheatOverrides.godMode) {
            dmg = 0;
            ctx.floatText("player", "God Mode", "info");
        }

        if (dmg > 0 && ctx.rollChance(ctx.getDivineShieldChance())) {
            ctx.popPassive("Divine Shield");
            dmg = 0;
        }

        if (dmg > 0) {
            dmg = Math.max(0, Math.floor(dmg * (1 - ctx.getPlayerDamageReduction())));
            if (ctx.getPlayerDamageReduction() > 0) ctx.popPassive("Bulwark");
        }

        if (dmg >= playerInfo.hp && ctx.rollChance(ctx.getPhantomChance())) {
            ctx.popPassive("Phantom");
            dmg = 0;
        }

        playerInfo.hp -= dmg;

        if (isCrit) {
            ctx.floatText("enemy", "Crit attack!", "info");
            ctx.playSound("crit");
            ctx.triggerCritFlash();
        }

        if (rolledDef > 0 && dmg === 0) {
            ctx.floatText("player", "Defended", "block");
            ctx.playSound("block");
            ctx.setPlayerAvatarTemporary("block", 350);
            ctx.triggerAnimation(ctx.uiPlayerAvatar, "anim-defended");
            if (ctx.gameEventBus && ctx.GAME_EVENTS) {
                ctx.gameEventBus.emit(ctx.GAME_EVENTS.PLAYER_BLOCK, { source: "enemy_attack" });
            }
        }

        if (dmg > 0) {
            if (ctx.gameEventBus && ctx.GAME_EVENTS) {
                ctx.gameEventBus.emit(ctx.GAME_EVENTS.PLAYER_HIT, {
                    damage: dmg,
                    isCrit,
                    source: "enemy_attack"
                });
            }
            ctx.floatText("player", `-${dmg}`, isCrit ? "crit" : "dmg");
            if (!isCrit) ctx.playSound("hit");
            ctx.triggerScreenShake();
            ctx.showHitCut("player");
        }

        if (dmg > 0) ctx.triggerAnimation(ctx.uiPlayerAvatar, "anim-damage");
        ctx.maybeTriggerSurvivalist(previousHp);
        ctx.updatePlayerUI();

        const reflectRate = ctx.getPlayerReflectRate();
        if (reflectRate > 0) {
            const reflectDmg = Math.floor(dmg * reflectRate);
            if (reflectDmg > 0) {
                currentGameStats.currentEnemy.hp -= reflectDmg;
                if (ctx.countPassive("spikes") > 0) ctx.popPassive("Spiked Armor");
                if (ctx.countPassive("thorns") > 0) ctx.popPassive("Thorns");
                ctx.floatText("enemy", `-${reflectDmg}`, "dmg");
                ctx.playSound("hit");
                ctx.triggerScreenShake();
                ctx.showHitCut("enemy");
                ctx.updateEnemyUI();
            }
        }

        if (dmg > 0 && ctx.rollChance(ctx.getCounterChance()) && currentGameStats.currentEnemy.hp > 0) {
            const counterDmg = Math.max(1, Math.floor(playerInfo.atk * 0.5));
            currentGameStats.currentEnemy.hp = Math.max(0, currentGameStats.currentEnemy.hp - counterDmg);
            ctx.popPassive("Counter Attack");
            ctx.floatText("enemy", `-${counterDmg}`, "dmg");
            ctx.playSound("hit");
            ctx.triggerScreenShake();
            ctx.showHitCut("enemy");
            ctx.updateEnemyUI();
        }
    }

    if (playerInfo.hp <= 0) ctx.handleLoss();
    else if (currentGameStats.currentEnemy.hp <= 0) ctx.handleWin();
    else currentGameStats.isPlayerTurn = true;
}

export function handleWinFlow(ctx) {
    const { currentGameStats, playerInfo } = ctx;
    ctx.gameLoop.stop();
    ctx.gameEventBus.emit(ctx.GAME_EVENTS.BATTLE_WON, { level: currentGameStats.currentLevel });
    ctx.floatText("enemy", "Defeated", "info");
    ctx.clearEnemyDisplay();
    const heal = Math.floor(playerInfo.maxHp * 0.2);
    playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + heal);
    if (ctx.countPassive("bloodthirst") > 0) {
        const bloodHeal = ctx.getBloodthirstHealAmount();
        playerInfo.hp = Math.min(playerInfo.maxHp, playerInfo.hp + bloodHeal);
        ctx.popPassive("Bloodthirst");
        ctx.floatText("player", `+${bloodHeal} HP`, "heal");
    }
    ctx.updatePlayerUI();
    ctx.floatText("player", `+${heal} HP`, "heal");
    ctx.playSound("victory");

    if (currentGameStats.currentEnemy && currentGameStats.currentEnemy.exp) {
        playerInfo.exp += currentGameStats.currentEnemy.exp;
        ctx.floatText("player", `+${currentGameStats.currentEnemy.exp} EXP`, "system");
        const previousLevel = playerInfo.lvl;
        if (ctx.checkLevelUp(playerInfo)) {
            const maxPlayerLevel = typeof ctx.getMaxPlayerLevel === "function" ? ctx.getMaxPlayerLevel() : ctx.maxPlayerLevel;
            if (playerInfo.lvl > maxPlayerLevel) playerInfo.lvl = maxPlayerLevel;
            const gainedLevels = Math.max(0, playerInfo.lvl - previousLevel);
            ctx.applyClassLevelUpGrowth(gainedLevels);
            ctx.gainSkillPoints(gainedLevels);
            ctx.recalculateStats();
            ctx.updateExpUI();
            ctx.updatePlayerUI();
            if (gainedLevels > 0) {
                ctx.floatText("player", `Level ${playerInfo.lvl} (+${gainedLevels} SP)`, "system");
            }
        }
        ctx.updateExpUI();
    }

    ctx.advanceToNextRound();
}

export function advanceToNextRoundFlow(ctx) {
    if (ctx.presentScavengerPotionReward()) return;
    if (ctx.lootOverlay) ctx.lootOverlay.classList.add("hidden");
    ctx.floatText("system", `Round ${ctx.currentGameStats.currentLevel + 1}`, "system");
    setTimeout(() => {
        ctx.startLevel(ctx.currentGameStats.currentLevel + 1);
    }, 1000);
}

export function handleLossFlow(ctx) {
    ctx.gameLoop.stop();
    ctx.gameEventBus.emit(ctx.GAME_EVENTS.BATTLE_LOST, { level: ctx.currentGameStats.currentLevel });
    ctx.setPauseState(false);
    ctx.clearScreenSpaceEffects();
    ctx.floatText("player", "Defeated", "dmg");
    if (ctx.eqReadout) ctx.eqReadout.innerHTML = "";
    document.getElementById("modal-desc").innerText = `Journey ended at Round ${ctx.currentGameStats.currentLevel}.`;
    ctx.overlay.classList.remove("hidden");
    ctx.playSound("hit");
}
