import { getItemImage, getItemTempIcon } from "../../items/item.js";

function getLootIconMarkup(item) {
    const imagePath = getItemImage(item);
    if (imagePath) return `<img class="loot-icon-image" src="${imagePath}" alt="">`;
    return getItemTempIcon(item);
}

export function applyPotionDropOnKill(ctx) {
    const dropChance = ctx.getPotionDropChance();
    if (dropChance <= 0 || Math.random() >= dropChance) return;
    ctx.currentGameStats.pendingScavengerPotionReward = ctx.createScavengerPotionReward();
    ctx.popPassive("Scavenger's Luck");
    ctx.floatText("player", "Small Potion found", "info");
}

export function presentScavengerPotionReward(ctx) {
    if (!ctx.currentGameStats.pendingScavengerPotionReward || !ctx.lootOptionsContainer || !ctx.lootOverlay) return false;
    ctx.clearScreenSpaceEffects();
    ctx.lootOptionsContainer.innerHTML = "";
    ctx.lootOptionsContainer.classList.add("single-reward");
    const item = ctx.currentGameStats.pendingScavengerPotionReward;
    const itemName = item.name || "Unnamed Item";
    const itemRarity = item.rarity || "common";
    const card = document.createElement("div");
    card.className = "loot-card reward-single-card loot-card-animated";
    card.innerHTML = `
        <div class="loot-icon">${getLootIconMarkup(item)}</div>
        <div class="loot-name rarity-${itemRarity}" style="font-size: 1.05rem;">${itemName}</div>
        <div class="loot-desc">${item.storyDesc || item.desc}</div>
        <div class="loot-stats" style="font-size: 1.15rem;">${ctx.getRewardStatsText(item)}</div>
    `;
    card.onclick = () => {
        const rewardItem = ctx.currentGameStats.pendingScavengerPotionReward;
        ctx.currentGameStats.pendingScavengerPotionReward = null;
        ctx.selectLoot(rewardItem);
    };
    ctx.lootOptionsContainer.appendChild(card);
    ctx.lootOverlay.classList.remove("hidden");
    return true;
}

export function presentLootSelection(ctx) {
    ctx.clearScreenSpaceEffects();
    ctx.lootOptionsContainer.innerHTML = "";
    ctx.lootOptionsContainer.classList.remove("single-reward");
    const options = ctx.generateLootOptions(ctx.currentGameStats.currentLevel);

    options.forEach(item => {
        const itemName = item.name || "Unnamed Item";
        const itemRarity = item.rarity || "common";
        const card = document.createElement("div");
        card.className = "loot-card ornate-border loot-card-animated";
        const passivesHtml = item.passives.map(passive => `<div><br>&#10024; ${passive.name}: ${passive.desc}</div>`).join("");
        card.innerHTML = `
            <div class="loot-icon">${getLootIconMarkup(item)}</div>
            <div class="loot-name rarity-${itemRarity}" style="font-size: 1.05rem;">${itemName} <br><span style="font-size:0.75em; color:gray">Lv.${ctx.currentGameStats.currentLevel}</span></div>
            ${passivesHtml ? `<div class="loot-skills" style="font-size: 1.1rem; line-height: 1.3;">${passivesHtml}</div>` : ""}
            <div class="loot-desc">${item.storyDesc || item.desc}</div>
            <div class="loot-stats" style="font-size: 1.15rem;">${ctx.getRewardStatsText(item)}</div>
        `;
        card.onclick = () => ctx.selectLoot(item);
        ctx.lootOptionsContainer.appendChild(card);
    });

    ctx.lootOverlay.classList.remove("hidden");
}

export function leaveLootSelection(ctx) {
    ctx.currentGameStats.pendingScavengerPotionReward = null;
    if (ctx.lootOptionsContainer) ctx.lootOptionsContainer.classList.remove("single-reward");
    if (ctx.lootOverlay) ctx.lootOverlay.classList.add("hidden");
    ctx.advanceToNextRound();
}

export function selectLoot(ctx, item) {
    if (item.rewardType === "healing") {
        const healAmount = typeof item.getResolvedHealAmount === "function"
            ? item.getResolvedHealAmount(ctx.playerInfo.maxHp, 1)
            : Math.floor(ctx.playerInfo.maxHp * (item.healPercent || 0));
        ctx.playerInfo.hp = Math.min(ctx.playerInfo.maxHp, ctx.playerInfo.hp + healAmount);
        ctx.updatePlayerUI();
        ctx.floatText("player", `+${healAmount} HP`, "heal");
        ctx.playSound("heal");
    } else if (item.rewardType === "consumable") {
        if (ctx.playerInfo.consumables.length >= ctx.consumableSlotCount) {
            ctx.floatText("player", "Consumables full", "info");
            ctx.playSound("block");
            return;
        }
        ctx.playerInfo.consumables.push(item);
        ctx.renderEquipment();
        ctx.floatText("player", `+ ${item.name}`, "system");
        ctx.playSound("pick");
    } else {
        const openSlot = ctx.getNextOpenGearSlot(item);
        if (openSlot) {
            ctx.playerInfo.gearSlots[openSlot] = item;
            ctx.recalculateStats();
            ctx.updatePlayerUI();
            ctx.renderEquipment();
            ctx.floatText("player", `+ ${item.name}`, "system");
            ctx.playSound("pick");
        } else {
            ctx.floatText("player", "All gear slots full", "info");
            ctx.playSound("block");
            return;
        }
    }
    if (ctx.lootOptionsContainer) ctx.lootOptionsContainer.classList.remove("single-reward");
    ctx.lootOverlay.classList.add("hidden");
    ctx.advanceToNextRound();
}
