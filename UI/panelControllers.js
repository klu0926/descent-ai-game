export function openSkillTreePanel({
    skillTreeOverlay,
    classOverlay,
    currentGameStats,
    clearScreenSpaceEffects,
    setPauseState,
    pauseOverlay,
    renderSkillTree
}) {
    if (!skillTreeOverlay || (classOverlay && !classOverlay.classList.contains("hidden"))) return;
    currentGameStats.skillTreeOpenedFromPausedState = currentGameStats.isPaused;
    clearScreenSpaceEffects();
    setPauseState(true);
    if (pauseOverlay) pauseOverlay.classList.add("hidden");
    skillTreeOverlay.classList.remove("hidden");
    renderSkillTree();
}

export function closeSkillTreePanel({
    skillTreeOverlay,
    skillTreeTooltip,
    currentGameStats,
    setPauseState,
    pauseOverlay
}) {
    if (!skillTreeOverlay) return;
    skillTreeOverlay.classList.add("hidden");
    if (skillTreeTooltip) skillTreeTooltip.classList.add("hidden");
    if (!currentGameStats.skillTreeOpenedFromPausedState) {
        setPauseState(false);
    } else if (pauseOverlay) {
        pauseOverlay.classList.remove("hidden");
    }
}

export function openCheatPanel({
    cheatOverlay,
    classOverlay,
    currentGameStats,
    clearScreenSpaceEffects,
    setPauseState,
    pauseOverlay,
    fillCheatFormWithCurrentStats
}) {
    if (!cheatOverlay || (classOverlay && !classOverlay.classList.contains("hidden"))) return;
    currentGameStats.cheatPanelOpenedFromPausedState = currentGameStats.isPaused;
    clearScreenSpaceEffects();
    setPauseState(true);
    if (pauseOverlay) pauseOverlay.classList.add("hidden");
    fillCheatFormWithCurrentStats();
    cheatOverlay.classList.remove("hidden");
}

export function closeCheatPanel({
    cheatOverlay,
    currentGameStats,
    setPauseState,
    pauseOverlay
}) {
    if (!cheatOverlay) return;
    cheatOverlay.classList.add("hidden");
    if (!currentGameStats.cheatPanelOpenedFromPausedState) {
        setPauseState(false);
    } else if (pauseOverlay) {
        pauseOverlay.classList.remove("hidden");
    }
}
