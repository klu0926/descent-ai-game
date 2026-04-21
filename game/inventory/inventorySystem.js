export function consumeInventoryItem(ctx, index) {
    const item = ctx.playerInfo.consumables[index];
    if (!item) return false;
    if (!(item.rewardType === "consumable" && item.consumableType === "healing")) return false;

    const activeSkills = typeof ctx.getActivePlayerSkills === "function" ? ctx.getActivePlayerSkills() : [];
    const activeStatuses = typeof ctx.getActivePlayerStatuses === "function" ? ctx.getActivePlayerStatuses() : [];
    const activePassives = typeof ctx.getActivePlayerPassives === "function"
        ? ctx.getActivePlayerPassives()
        : [...activeSkills, ...activeStatuses];
    const resolvedEffects = typeof item.resolveConsumableEffects === "function"
        ? item.resolveConsumableEffects({
            getSkillRank: ctx.getSkillRank,
            activePassives,
            activeSkills,
            activeStatuses
        })
        : { healMultiplier: 1, notes: [], meta: {} };
    const healMultiplier = Number.isFinite(resolvedEffects.healMultiplier) ? resolvedEffects.healMultiplier : 1;
    const improvisedRank = resolvedEffects.meta && Number.isFinite(resolvedEffects.meta.improvisedMedicineRank)
        ? resolvedEffects.meta.improvisedMedicineRank
        : 0;

    const healAmount = typeof item.getResolvedHealAmount === "function"
        ? item.getResolvedHealAmount(ctx.playerInfo.maxHp, healMultiplier)
        : Math.max(1, Math.floor(ctx.playerInfo.maxHp * (item.healPercent || 0) * healMultiplier));
    const oldHp = ctx.playerInfo.hp;
    ctx.playerInfo.hp = Math.min(ctx.playerInfo.maxHp, ctx.playerInfo.hp + healAmount);
    const actualHeal = Math.max(0, ctx.playerInfo.hp - oldHp);

    ctx.playerInfo.consumables.splice(index, 1);
    ctx.renderEquipment();
    ctx.updatePlayerUI();
    ctx.resetEqReadoutBackground();
    ctx.playSound("heal");
    ctx.floatText("player", `Potion +${actualHeal} HP`, "heal");
    if (Array.isArray(resolvedEffects.notes)) {
        resolvedEffects.notes.forEach(note => {
            if (!note) return;
            const tone = note.kind === "debuff" ? "dmg" : "info";
            const effectName = note.source || "Effect";
            ctx.floatText("player", effectName, tone);
        });
    }

    if (improvisedRank >= 3 && Math.random() < 0.5) {
        ctx.currentGameStats.battleState.potionAtkBuffTurns = 3;
        ctx.floatText("player", "Improvised boost", "info");
    }

    if (
        ctx &&
        ctx.gameEventBus &&
        typeof ctx.gameEventBus.emit === "function" &&
        ctx.GAME_EVENTS &&
        ctx.GAME_EVENTS.HEAL_ITEM_USED
    ) {
        ctx.gameEventBus.emit(ctx.GAME_EVENTS.HEAL_ITEM_USED, {
            source: "healing_potion",
            itemId: String(item && item.id || ""),
            itemName: String(item && item.name || ""),
            healAmount: actualHeal,
            healRequested: healAmount
        });
    }

    if (ctx && ctx.gameEventBus && typeof ctx.gameEventBus.emit === "function") {
        const customUseEvents = Array.isArray(item && item.itemUseEventTriggers)
            ? item.itemUseEventTriggers
            : [];
        customUseEvents.forEach(eventName => {
            const safeEventName = String(eventName || "").trim();
            if (!safeEventName) return;
            ctx.gameEventBus.emit(safeEventName, {
                source: "item_use",
                itemId: String(item && item.id || ""),
                itemName: String(item && item.name || ""),
                rewardType: String(item && item.rewardType || ""),
                consumableType: String(item && item.consumableType || ""),
                healAmount: actualHeal,
                healRequested: healAmount
            });
        });
    }

    return true;
}
