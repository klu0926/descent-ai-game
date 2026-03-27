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

export function getRewardStatsText(item) {
    if (item.functionDesc) return item.functionDesc;
    if (item.rewardType === "healing" || (item.rewardType === "consumable" && item.consumableType === "healing")) {
        return `HP +${Math.floor((item.healPercent || 0) * 100)}%`;
    }
    return formatStats(item.stats);
}

export function getPassiveShortLabel(name) {
    const words = name.split(" ").filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}
