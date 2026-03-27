export function getExpNeeded(level) {
    // curve: starting easy, slowly becoming hard
    // lvl 1->2: 60
    // lvl 2->3: ~120
    // lvl 3->4: ~200
    return Math.floor(40 * Math.pow(1.3, level - 1) + (level * level * 20));
}

const MAX_LEVEL = 20;

export function checkLevelUp(playerInfo) {
    let leveledUp = false;
    while (playerInfo.lvl < MAX_LEVEL && playerInfo.exp >= playerInfo.maxExp) {
        playerInfo.exp -= playerInfo.maxExp;
        playerInfo.lvl += 1;
        playerInfo.maxExp = getExpNeeded(playerInfo.lvl);

        leveledUp = true;
    }
    if (playerInfo.lvl >= MAX_LEVEL) {
        playerInfo.lvl = MAX_LEVEL;
        playerInfo.exp = 0;
    }
    return leveledUp;
}

export function getPlayerExpPercent(playerInfo) {
    if (playerInfo.maxExp <= 0) return 0;
    return Math.min(100, Math.max(0, (playerInfo.exp / playerInfo.maxExp) * 100));
}
