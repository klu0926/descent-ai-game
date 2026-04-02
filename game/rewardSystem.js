export function formatStats(stats = {}) {
    const formatted = [];
    if (stats.atk) formatted.push(`ATK +${stats.atk}`);
    if (stats.def) formatted.push(`DEF +${stats.def}`);
    if (stats.hp) formatted.push(`HP +${stats.hp}`);
    if (stats.crit) formatted.push(`CRIT +${stats.crit}%`);
    if (stats.dodge) formatted.push(`DODG +${stats.dodge}`);
    if (stats.aim) formatted.push(`AIM +${stats.aim}`);
    return formatted.join("<br>");
}

function getConsumableEffectText(item) {
    const parts = [];
    const healAmount = Number(item && item.healAmount);
    const healPercent = Number(item && item.healPercent);
    if (Number.isFinite(healAmount) && healAmount > 0) parts.push(`HP +${Math.floor(healAmount)}`);
    if (Number.isFinite(healPercent) && healPercent > 0) parts.push(`HP +${Math.floor(healPercent * 100)}%`);
    const mode = String(item && item.effectMode || "").trim().toLowerCase();
    if (mode === "turn") {
        const turns = Math.max(1, Math.floor(Number(item && item.effectTurns) || 1));
        parts.push(`${turns} turn${turns > 1 ? "s" : ""}`);
    } else if (mode === "round") {
        const rounds = Math.max(1, Math.floor(Number(item && item.effectRounds) || 1));
        parts.push(`${rounds} round${rounds > 1 ? "s" : ""}`);
    } else if (mode === "once") {
        parts.push("Once");
    }
    return parts.join(" | ");
}

export function getRewardStatsText(item) {
    if (item.rewardType === "healing" || (item.rewardType === "consumable" && item.consumableType === "healing")) {
        return getConsumableEffectText(item);
    }
    if (item.functionDesc) return item.functionDesc;
    return formatStats(item.stats);
}

export function getPassiveShortLabel(name) {
    const words = name.split(" ").filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}
