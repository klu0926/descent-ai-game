export function bindUIControls({
    modalBtn,
    onModalConfirm,
    musicBtn,
    bgMusic,
    getVolumeState,
    setNextVolume,
    setAudioVolume,
    pauseBtn,
    pauseResumeBtn,
    classOverlay,
    getIsPaused,
    setPauseState,
    skillTreeBtn,
    openSkillTree,
    cheatBtn,
    openCheatPanel,
    skillTreeCloseBtn,
    skillTreeOverlay,
    closeSkillTree,
    cheatCloseBtn,
    cheatSaveBtn,
    saveCheatStats,
    cheatResetBtn,
    resetCheatToClassDefault,
    cheatOverlay,
    closeCheatPanel,
    skillTreeSections,
    spendSkillPoint,
    reverseSkillPoint,
    showSkillTooltip,
    hideSkillTooltip,
    lootLeaveBtn,
    playSound,
    leaveLootSelection,
    uiEnemyAvatar,
    showEnemyInfo,
    showInfoTooltip,
    hideInfoTooltip,
    startJourneyBtn,
    onStartJourney,
    editorPageBtn,
    onOpenEditorPage
}) {
    if (modalBtn) {
        modalBtn.onclick = onModalConfirm;
    }

    if (musicBtn) {
        const state = getVolumeState();
        musicBtn.innerText = state.icon;
        musicBtn.onclick = () => {
            const next = setNextVolume();
            setAudioVolume(next.vol);
            if (bgMusic) bgMusic.volume = next.vol;
            musicBtn.innerText = next.icon;
        };
    }

    if (pauseBtn) {
        pauseBtn.innerText = "\u23F8\uFE0F";
        pauseBtn.onclick = () => {
            setPauseState(!getIsPaused());
        };
    }

    if (pauseResumeBtn) {
        pauseResumeBtn.onclick = () => {
            setPauseState(false);
        };
    }

    window.addEventListener("keydown", event => {
        const isEscape = event.key === "Escape";
        const isSpace = event.code === "Space" || event.key === " ";
        if (!isEscape && !isSpace) return;
        if (event.repeat) return;
        const targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
        if (targetTag === "input" || targetTag === "textarea") return;
        if (classOverlay && !classOverlay.classList.contains("hidden")) return;
        if (isSpace) event.preventDefault();
        setPauseState(!getIsPaused());
    });

    if (skillTreeBtn) {
        skillTreeBtn.onclick = () => {
            openSkillTree();
        };
    }

    if (cheatBtn) {
        cheatBtn.onclick = () => {
            openCheatPanel();
        };
    }

    if (skillTreeCloseBtn) {
        skillTreeCloseBtn.onclick = () => {
            closeSkillTree();
        };
    }

    if (skillTreeOverlay) {
        skillTreeOverlay.onclick = event => {
            if (event.target === skillTreeOverlay) closeSkillTree();
        };
    }

    if (cheatCloseBtn) {
        cheatCloseBtn.onclick = () => {
            closeCheatPanel();
        };
    }

    if (cheatSaveBtn) {
        cheatSaveBtn.onclick = () => {
            saveCheatStats();
        };
    }

    if (cheatResetBtn) {
        cheatResetBtn.onclick = () => {
            resetCheatToClassDefault();
        };
    }

    if (cheatOverlay) {
        cheatOverlay.onclick = event => {
            if (event.target === cheatOverlay) closeCheatPanel();
        };
    }

    if (skillTreeSections) {
        skillTreeSections.onclick = event => {
            const trigger = event.target.closest("[data-skill-id]");
            if (!trigger) return;
            spendSkillPoint(trigger.dataset.skillId);
        };

        skillTreeSections.oncontextmenu = event => {
            const trigger = event.target.closest("[data-skill-id]");
            if (!trigger) return;
            event.preventDefault();
            reverseSkillPoint(trigger.dataset.skillId);
        };

        skillTreeSections.onmouseover = event => {
            const trigger = event.target.closest("[data-skill-id]");
            if (!trigger) return;
            showSkillTooltip(trigger, event.clientX, event.clientY);
        };

        skillTreeSections.onmousemove = event => {
            const trigger = event.target.closest("[data-skill-id]");
            if (!trigger) return;
            showSkillTooltip(trigger, event.clientX, event.clientY);
        };

        skillTreeSections.onmouseout = event => {
            const target = event.target.closest("[data-skill-id]");
            if (!target) return;
            hideSkillTooltip();
        };
    }

    if (lootLeaveBtn) {
        lootLeaveBtn.onclick = () => {
            playSound("pick");
            leaveLootSelection();
        };
    }

    if (uiEnemyAvatar) {
        uiEnemyAvatar.onmouseover = event => {
            const html = showEnemyInfo();
            if (!html) return;
            showInfoTooltip(html, event.clientX, event.clientY, "left");
        };
        uiEnemyAvatar.onmousemove = event => {
            const html = showEnemyInfo();
            if (!html) return;
            showInfoTooltip(html, event.clientX, event.clientY, "left");
        };
        uiEnemyAvatar.onmouseout = () => {
            hideInfoTooltip();
        };
    }

    if (startJourneyBtn) {
        startJourneyBtn.onclick = onStartJourney;
    }

    if (editorPageBtn) {
        editorPageBtn.onclick = onOpenEditorPage;
    }
}
