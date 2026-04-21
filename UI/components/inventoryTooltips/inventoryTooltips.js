export function showInfoTooltip({ infoTooltip, html, x, y, side = "right", vertical = "below" }) {
    if (!infoTooltip) return;
    infoTooltip.innerHTML = html;
    infoTooltip.classList.remove("hidden");
    if (side === "left") {
        const width = infoTooltip.offsetWidth || 320;
        infoTooltip.style.left = `${x - width - 16}px`;
    } else {
        infoTooltip.style.left = `${x + 16}px`;
    }
    if (vertical === "above") {
        const height = infoTooltip.offsetHeight || 120;
        infoTooltip.style.top = `${y - height - 12}px`;
    } else {
        infoTooltip.style.top = `${y + 12}px`;
    }
}

export function hideInfoTooltip(infoTooltip) {
    if (!infoTooltip) return;
    infoTooltip.classList.add("hidden");
}

export function showItemInfo({ item, isConsumable = false, gearSlotKey = "", gearSlotLabels, formatStats, consumableEffectNotes = [] }) {
    if (!item) return "";
    const itemName = item.name || "Unnamed Item";
    const itemRarity = item.rarity || "common";
    const healAmount = Number(item.healAmount);
    const healPercent = Number(item.healPercent);
    const classEffectParts = [];
    if (Number.isFinite(healAmount) && healAmount > 0) classEffectParts.push(`Healing +${Math.floor(healAmount)} HP`);
    if (Number.isFinite(healPercent) && healPercent > 0) classEffectParts.push(`Healing ${Math.floor(healPercent * 100)}%`);
    if (isConsumable) {
        const effectMode = String(item.effectMode || "").trim().toLowerCase();
        if (effectMode === "turn") {
            const turns = Math.max(1, Math.floor(Number(item.effectTurns) || 1));
            classEffectParts.push(`${turns} turn${turns > 1 ? "s" : ""}`);
        } else if (effectMode === "round") {
            const rounds = Math.max(1, Math.floor(Number(item.effectRounds) || 1));
            classEffectParts.push(`${rounds} round${rounds > 1 ? "s" : ""}`);
        } else if (effectMode === "once") {
            classEffectParts.push("Once");
        }
    }
    const classEffectText = classEffectParts.join(" | ");
    const useHint = item.rewardType === "consumable"
        ? `<div style="margin-top: 8px; color: var(--text-highlight); font-size: 0.95rem;">Right-click this item to drink.</div>`
        : "";
    const slotHint = !isConsumable && gearSlotKey
        ? `<div style="margin-top: 8px; color: var(--text-muted); font-size: 0.92rem;">Slot: ${gearSlotLabels[gearSlotKey]}</div>`
        : "";

    const passivesHtml = (item.passives || []).map(passive => `<div style="margin-top: 5px; font-size: 1.05rem;">&#10024; <strong style="color:#eab308;">${passive.name}</strong>: ${passive.desc}</div>`).join("");
    const effectNotesHtml = (consumableEffectNotes || []).map(entry => {
        const color = entry.kind === "debuff" ? "#fca5a5" : "#86efac";
        const source = entry.source ? `${entry.source}: ` : "";
        return `<div class="slot-item-desc" style="color: ${color}; font-size: 0.95rem; line-height: 1.35; margin-top: 6px;">${source}${entry.text}</div>`;
    }).join("");
    return `
        <div class="slot-item-name rarity-${itemRarity}" style="font-size: 1.2rem; border-bottom: 1px solid var(--border-gold-dim); padding-bottom: 5px; margin-bottom: 8px;">${itemName}</div>
        <div class="slot-item-stats" style="font-size: 1.1rem; color: var(--text-green); font-weight: bold; margin-bottom: 8px;">${formatStats(item.stats)}</div>
        <div class="slot-item-desc" style="color: #ffffff; font-size: 1rem; line-height: 1.4;">${item.storyDesc || item.desc}</div>
        ${classEffectText ? `<div class="slot-item-stats" style="font-size: 1.05rem; color: var(--text-green); font-weight: bold; margin-top: 6px;">${classEffectText}</div>` : ""}
        ${!classEffectText && item.functionDesc ? `<div class="slot-item-stats" style="font-size: 1.05rem; color: var(--text-green); font-weight: bold; margin-top: 6px;">${item.functionDesc}</div>` : ""}
        ${effectNotesHtml}
        ${slotHint}
        ${useHint}
        <div style="line-height: 1.4;">${passivesHtml}</div>
    `;
}

export function getEmptyGearSlotTooltip({ gearSlotKey = "", gearSlotLabels = {} }) {
    const slotLabel = gearSlotLabels[gearSlotKey] || "Unknown";
    return `<div class="stat-tip-text">Slot: ${slotLabel}</div>`;
}

export function getEmptyConsumableSlotTooltip() {
    return `<div class="stat-tip-text">Slot: Consumable</div>`;
}

export function getEssenceTooltip(currentEssence = 0) {
    const value = Math.max(0, Math.floor(Number(currentEssence) || 0));
    return `<div class="stat-tip-text">Essence: ${value}<br>Special resource for future systems.</div>`;
}
