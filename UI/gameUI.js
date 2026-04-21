import { getItemImage, getItemTempIcon } from "../items/item.js";
import {
    getEssenceTooltip,
    getEmptyConsumableSlotTooltip,
    getEmptyGearSlotTooltip
} from "./components/inventoryTooltips/inventoryTooltips.js";

export function createUIRefs() {
    return {
        uiPlayerHpBar: document.getElementById("player-hp-bar"),
        uiPlayerHpText: document.getElementById("player-hp-text"),
        uiPlayerAtk: document.getElementById("player-atk"),
        uiPlayerDef: document.getElementById("player-def"),
        uiPlayerCrit: document.getElementById("player-crit"),
        uiPlayerDodge: document.getElementById("player-dodge"),
        uiPlayerAim: document.getElementById("player-aim"),
        uiPlayerAvatar: document.getElementById("player-avatar"),
        uiSkillsReadout: document.getElementById("player-skills"),
        uiEnemySkillsReadout: document.getElementById("enemy-skills"),
        uiEnemyName: document.getElementById("enemy-name"),
        uiEnemyHpBar: document.getElementById("enemy-hp-bar"),
        uiEnemyHpText: document.getElementById("enemy-hp-text"),
        uiEnemyAtk: document.getElementById("enemy-atk"),
        uiEnemyDef: document.getElementById("enemy-def"),
        uiEnemyCrit: document.getElementById("enemy-crit"),
        uiEnemyDodge: document.getElementById("enemy-dodge"),
        uiEnemyAim: document.getElementById("enemy-aim"),
        uiEnemyAvatar: document.getElementById("enemy-avatar"),
        uiEnemyCard: document.getElementById("enemy-card"),
        uiEnemyInfo: document.getElementById("enemy-info"),
        uiEnemyHpContainer: document.getElementById("enemy-hp-container"),
        uiEnemyStatsPanel: document.getElementById("enemy-stats-panel"),
        uiLevelDisplay: document.getElementById("current-level"),
        uiTurnDisplay: document.getElementById("current-turn"),
        uiArenaLevelWarning: document.getElementById("arena-level-warning"),
        overallBlackFadeOverlay: document.getElementById("overall-black-fade"),
        roundStartBtn: document.getElementById("round-start-btn"),
        roundTransitionOverlay: document.getElementById("round-transition-overlay"),
        overlay: document.getElementById("overlay"),
        modalBtn: document.getElementById("modal-btn"),
        lootOverlay: document.getElementById("loot-overlay"),
        lootOptionsContainer: document.getElementById("loot-options"),
        lootLeaveBtn: document.getElementById("loot-leave-btn"),
        tutorialOverlay: document.getElementById("tutorial-overlay"),
        pauseOverlay: document.getElementById("pause-overlay"),
        startJourneyBtn: document.getElementById("start-journey-btn"),
        eqReadout: document.getElementById("eq-readout"),
        infoTooltip: document.getElementById("info-tooltip"),
        bgMusic: document.getElementById("bg-music"),
        musicBtn: document.getElementById("music-toggle-btn"),
        pauseBtn: document.getElementById("pause-toggle-btn"),
        skillTreeBtn: document.getElementById("skill-tree-btn"),
        cheatBtn: document.getElementById("cheat-btn"),
        pauseResumeBtn: document.getElementById("pause-resume-btn"),
        editorPageBtn: document.getElementById("editor-page-btn"),
        uiPlayerName: document.getElementById("player-name"),
        skillTreeOverlay: document.getElementById("skill-tree-overlay"),
        skillTreeSections: document.getElementById("skill-tree-sections"),
        skillTreeStatus: document.getElementById("skill-tree-status"),
        skillTreeCloseBtn: document.getElementById("skill-tree-close-btn"),
        skillTreePortrait: document.getElementById("skill-tree-portrait"),
        skillTreeTooltip: document.getElementById("skill-tree-tooltip"),
        cheatOverlay: document.getElementById("cheat-overlay"),
        cheatCloseBtn: document.getElementById("cheat-close-btn"),
        cheatSaveBtn: document.getElementById("cheat-save-btn"),
        cheatResetBtn: document.getElementById("cheat-reset-btn"),
        cheatHpInput: document.getElementById("cheat-hp"),
        cheatMaxHpInput: document.getElementById("cheat-maxhp"),
        cheatAtkInput: document.getElementById("cheat-atk"),
        cheatDefInput: document.getElementById("cheat-def"),
        cheatCritInput: document.getElementById("cheat-crit"),
        cheatDodgeInput: document.getElementById("cheat-dodge"),
        cheatAimInput: document.getElementById("cheat-aim"),
        cheatGodModeInput: document.getElementById("cheat-godmode"),
        cheatReverseSkillInput: document.getElementById("cheat-reverse-skill"),
        classOverlay: document.getElementById("class-overlay"),
        classOptions: document.getElementById("class-options"),
        confirmClassBtn: document.getElementById("confirm-class-btn"),
        introCinematicOverlay: document.getElementById("intro-cinematic-overlay"),
        introCinematicVideo: document.getElementById("intro-cinematic-video")
    };
}

function renderItemVisualIntoSlot(slot, item) {
    const imagePath = getItemImage(item);
    const tempIcon = getItemTempIcon(item);
    if (imagePath) {
        slot.innerHTML = `<img class="item-slot-image" src="${imagePath}" alt="">`;
        return;
    }
    slot.innerText = tempIcon;
}

export function floatText(target, msg, type = "info") {
    let container;
    if (target === "player") container = document.getElementById("player-fct");
    else if (target === "enemy") container = document.getElementById("enemy-fct");
    else container = document.querySelector(".battle-arena");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `floating-text float-${type}`;
    el.innerText = msg;
    if (target === "system") container.appendChild(el);
    else container.prepend(el);
    setTimeout(() => { if (container.contains(el)) el.remove(); }, 1200);
}

export function clearScreenSpaceEffects() {
    const gameContainer = document.getElementById("game-container");
    if (!gameContainer) return;
    gameContainer.classList.remove("anim-shake");
    gameContainer.classList.remove("anim-crit-flash");
}

export function setPauseState({ paused, currentGameStats, pauseBtn, pauseOverlay, skillTreeOverlay }) {
    currentGameStats.isPaused = paused;
    if (paused) clearScreenSpaceEffects();
    if (pauseBtn) pauseBtn.innerText = paused ? "\u25B6\uFE0F" : "\u23F8\uFE0F";
    const skillTreeVisible = skillTreeOverlay && !skillTreeOverlay.classList.contains("hidden");
    if (pauseOverlay) pauseOverlay.classList.toggle("hidden", !paused || skillTreeVisible);
}

export function isAnyFullscreenOverlayVisible(overlays) {
    return overlays.some(element => element && !element.classList.contains("hidden"));
}

export function scheduleAvatarBlurPulse(element, className, minDelayMs, maxDelayMs, pulseMs) {
    if (!element) return;

    const tick = () => {
        const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
        setTimeout(() => {
            if (element) {
                element.classList.add(className);
                setTimeout(() => {
                    if (element) element.classList.remove(className);
                }, pulseMs);
            }
            tick();
        }, delay);
    };

    tick();
}

export function startAvatarBlurPulses({ currentGameStats, uiPlayerAvatar, uiEnemyAvatar }) {
    if (currentGameStats.avatarBlurPulsesStarted) return;
    currentGameStats.avatarBlurPulsesStarted = true;
    scheduleAvatarBlurPulse(uiPlayerAvatar, "avatar-blur-pulse", 4200, 5800, 200);
    scheduleAvatarBlurPulse(uiEnemyAvatar, "avatar-blur-pulse", 6200, 7800, 200);
}

export function mountFullscreenOverlaysToBody(overlays) {
    overlays.forEach(element => {
        if (!element || element.parentElement === document.body) return;
        document.body.appendChild(element);
    });
}

export function triggerScreenShake(isBlockedByOverlay) {
    if (isBlockedByOverlay) return;
    const shakeTargets = [
        document.querySelector(".top-controls"),
        document.querySelector(".arena-hud")
    ].filter(Boolean);

    shakeTargets.forEach(element => {
        element.classList.remove("anim-shake");
        void element.offsetWidth;
        element.classList.add("anim-shake");
    });
    setTimeout(() => {
        shakeTargets.forEach(element => element.classList.remove("anim-shake"));
    }, 250);
}

export function triggerCritFlash() {
    const battleArena = document.querySelector(".battle-arena");
    const inventorySplit = document.querySelector(".inventory-split");
    if (!battleArena) return;
    battleArena.classList.remove("anim-crit-flash");
    void battleArena.offsetWidth;
    battleArena.classList.add("anim-crit-flash");
    if (inventorySplit) {
        inventorySplit.classList.remove("anim-shake");
        void inventorySplit.offsetWidth;
        inventorySplit.classList.add("anim-shake");
    }
    setTimeout(() => { battleArena.classList.remove("anim-crit-flash"); }, 180);
    setTimeout(() => {
        if (inventorySplit) inventorySplit.classList.remove("anim-shake");
    }, 250);
}

export function setBattleArenaBackground(imagePath) {
    const battleArena = document.querySelector(".battle-arena");
    if (!battleArena) return;
    const normalized = typeof imagePath === "string" ? imagePath.trim() : "";
    if (!normalized) {
        battleArena.style.removeProperty("--arena-bg-image");
        return;
    }
    const escapedPath = normalized.replace(/"/g, '\\"');
    battleArena.style.setProperty("--arena-bg-image", `url("${escapedPath}")`);
}

export function setArenaLevelWarning({ element, message }) {
    if (!element) return;
    const text = typeof message === "string" ? message.trim() : "";
    element.innerText = text;
    element.classList.toggle("hidden", !text);
}

export function updatePlayerNameUI({ uiPlayerName, currentGameStats, classes }) {
    if (uiPlayerName) {
        const activeClassName = (currentGameStats.selectedClassId && classes[currentGameStats.selectedClassId])
            ? classes[currentGameStats.selectedClassId].name
            : "Adventurer";
        uiPlayerName.innerText = `${activeClassName}`;
    }
}

export function applyEnemySize({ uiEnemyAvatar, enemySizeToPx, size }) {
    const avatarSize = enemySizeToPx[size] || enemySizeToPx.m;
    uiEnemyAvatar.style.width = `${avatarSize}px`;
    uiEnemyAvatar.style.height = `${avatarSize}px`;
}

export function clearEnemyDisplay({
    uiEnemyName,
    uiEnemyAvatar,
    uiEnemyHpBar,
    uiEnemyHpText,
    uiEnemyAtk,
    uiEnemyDef,
    uiEnemyCrit,
    uiEnemyDodge,
    uiEnemyAim,
    uiEnemyHpContainer,
    uiEnemyStatsPanel,
    uiEnemySkillsReadout,
    eqReadout,
    defaultReadoutHtml,
    resetEqReadoutBackground
}) {
    uiEnemyName.innerText = "";
    uiEnemyName.style.borderBottom = "none";
    uiEnemyAvatar.removeAttribute("src");
    uiEnemyAvatar.removeAttribute("title");
    uiEnemyAvatar.style.width = "";
    uiEnemyAvatar.style.height = "";
    uiEnemyHpBar.style.width = "0%";
    uiEnemyHpText.innerText = "";
    uiEnemyAtk.innerText = "";
    uiEnemyDef.innerText = "";
    uiEnemyCrit.innerText = "";
    uiEnemyDodge.innerText = "";
    uiEnemyAim.innerText = "";
    if (uiEnemyHpContainer) uiEnemyHpContainer.style.visibility = "hidden";
    if (uiEnemyStatsPanel) uiEnemyStatsPanel.style.visibility = "hidden";
    if (uiEnemySkillsReadout) uiEnemySkillsReadout.innerHTML = "";
    if (uiEnemyAvatar) uiEnemyAvatar.style.visibility = "hidden";
    if (eqReadout) eqReadout.innerHTML = defaultReadoutHtml;
    resetEqReadoutBackground();
}

function getSkillInitials(name = "") {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 0) return "?";
    if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function highlightValueToken(text) {
    const escaped = escapeHtml(text);
    const withTokenHighlight = escaped.replace(/\[(value|chance)\]/gi, '<span class="skill-token-value">[$1]</span>');
    return withTokenHighlight.replace(/(^|[^a-zA-Z0-9_])([+-]?\d+(?:\.\d+)?%?)(?=$|[^a-zA-Z0-9_])/g, "$1<span class=\"skill-token-value\">$2</span>");
}

function normalizeReadoutSkills(skills) {
    if (!Array.isArray(skills)) return [];
    return skills
        .filter(skill => skill && typeof skill === "object")
        .map(skill => ({
            id: String(skill.id || skill.name || "").trim(),
            name: String(skill.name || skill.id || "Skill").trim(),
            image: String(skill.image || "").trim(),
            rank: Number.isFinite(Number(skill.rank)) ? Number(skill.rank) : 0,
            desc: String(skill.desc || skill.note || "").trim(),
            kind: String(skill.kind || skill.skillType || "").trim().toLowerCase()
        }))
        .filter(skill => skill.id);
}

function ensureCombatSkillTooltip() {
    let tooltip = document.getElementById("combat-skill-tooltip");
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "combat-skill-tooltip";
    tooltip.className = "info-tooltip hidden combat-skill-tooltip";
    document.body.appendChild(tooltip);
    return tooltip;
}

function showCombatSkillTooltip(skill, x, y) {
    const tooltip = ensureCombatSkillTooltip();
    const title = skill.rank > 1 ? `${skill.name} (Rank ${skill.rank})` : skill.name;
    const desc = String(skill.desc || "").trim();
    tooltip.innerHTML = desc
        ? `<div class="skill-tooltip-title">${escapeHtml(title)}</div><div class="skill-tooltip-desc">${highlightValueToken(desc)}</div>`
        : `<div class="skill-tooltip-title">${escapeHtml(title)}</div>`;
    tooltip.classList.remove("hidden");
    const rect = tooltip.getBoundingClientRect();
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 720;
    const nextLeft = Math.min(Math.max(10, x + 14), Math.max(10, viewportW - rect.width - 10));
    const nextTop = Math.min(Math.max(10, y + 14), Math.max(10, viewportH - rect.height - 10));
    tooltip.style.left = `${nextLeft}px`;
    tooltip.style.top = `${nextTop}px`;
}

function hideCombatSkillTooltip() {
    const tooltip = document.getElementById("combat-skill-tooltip");
    if (!tooltip) return;
    tooltip.classList.add("hidden");
}

function renderSingleReadout(container, skills, side = "player") {
    if (!container) return;
    container.innerHTML = "";
    container.classList.toggle("skills-readout-enemy", side === "enemy");
    const normalized = normalizeReadoutSkills(skills);
    normalized.forEach(skill => {
        const chip = document.createElement("div");
        chip.className = "combat-skill-chip";
        if (skill.kind === "debuff") chip.classList.add("is-debuff");
        else if (skill.kind === "buff") chip.classList.add("is-buff");
        else if (skill.kind === "passive") chip.classList.add("is-passive");
        chip.title = skill.rank > 1 ? `${skill.name} (Rank ${skill.rank})` : skill.name;
        chip.addEventListener("mouseenter", event => {
            showCombatSkillTooltip(skill, event.clientX, event.clientY);
        });
        chip.addEventListener("mousemove", event => {
            showCombatSkillTooltip(skill, event.clientX, event.clientY);
        });
        chip.addEventListener("mouseleave", () => {
            hideCombatSkillTooltip();
        });
        if (skill.image) {
            chip.style.backgroundImage = `url("${skill.image.replace(/"/g, '\\"')}")`;
            chip.classList.add("has-image");
        } else {
            chip.textContent = getSkillInitials(skill.name);
        }
        if (skill.rank > 1) {
            const rankBadge = document.createElement("span");
            rankBadge.className = "combat-skill-rank";
            rankBadge.textContent = `${skill.rank}`;
            chip.appendChild(rankBadge);
        }
        container.appendChild(chip);
    });
}

export function renderCombatSkillReadouts({
    playerContainer,
    enemyContainer,
    playerSkills,
    enemySkills
}) {
    renderSingleReadout(playerContainer, playerSkills, "player");
    renderSingleReadout(enemyContainer, enemySkills, "enemy");
}

export function showEnemyDisplay({ uiEnemyName, uiEnemyHpContainer, uiEnemyStatsPanel, uiEnemyAvatar, uiEnemyInfo }) {
    uiEnemyName.style.borderBottom = "";
    if (uiEnemyHpContainer) uiEnemyHpContainer.style.visibility = "visible";
    if (uiEnemyStatsPanel) uiEnemyStatsPanel.style.visibility = "visible";
    if (uiEnemyAvatar) uiEnemyAvatar.style.visibility = "visible";
    if (uiEnemyInfo) uiEnemyInfo.style.visibility = "visible";
}

export function updatePlayerUI({ uiPlayerAtk, uiPlayerDef, uiPlayerCrit, uiPlayerDodge, uiPlayerAim, uiPlayerHpBar, uiPlayerHpText, playerInfo }) {
    if (uiPlayerAtk) uiPlayerAtk.innerText = `${playerInfo.atk}`;
    if (uiPlayerDef) uiPlayerDef.innerText = `${playerInfo.def}`;
    if (uiPlayerCrit) uiPlayerCrit.innerText = `${playerInfo.crit}%`;
    if (uiPlayerDodge) uiPlayerDodge.innerText = `${playerInfo.dodge}`;
    if (uiPlayerAim) uiPlayerAim.innerText = `${playerInfo.aim}`;
    const hpPct = Math.max(0, (playerInfo.hp / playerInfo.maxHp) * 100);
    uiPlayerHpBar.style.width = `${hpPct}%`;
    uiPlayerHpText.innerText = `${playerInfo.hp} / ${playerInfo.maxHp}`;
    const headerHp = document.getElementById("header-hp");
    if (headerHp) headerHp.innerText = `${playerInfo.hp}/${playerInfo.maxHp}`;
    const essenceValue = document.getElementById("essence-value");
    if (essenceValue) {
        const essence = Math.max(0, Math.floor(Number(playerInfo.essence) || 0));
        essenceValue.innerText = `${essence}`;
    }
    uiPlayerHpBar.style.background = hpPct < 30
        ? "linear-gradient(to bottom, #b63a3a, #5a1212)"
        : "linear-gradient(to bottom, #9a2f2f, #4b0f0f)";
}

export function updateEnemyUI({ uiEnemyAtk, uiEnemyDef, uiEnemyCrit, uiEnemyDodge, uiEnemyAim, uiEnemyHpBar, uiEnemyHpText, currentEnemy, getEnemyDisplayedAtk }) {
    if (!currentEnemy) return;
    if (uiEnemyAtk) uiEnemyAtk.innerText = `${getEnemyDisplayedAtk()}`;
    if (uiEnemyDef) uiEnemyDef.innerText = `${currentEnemy.def}`;
    if (uiEnemyCrit) uiEnemyCrit.innerText = `${currentEnemy.crit}%`;
    if (uiEnemyDodge) uiEnemyDodge.innerText = `${currentEnemy.dodge}`;
    if (uiEnemyAim) uiEnemyAim.innerText = `${currentEnemy.aim}`;
    const hpPct = Math.max(0, (currentEnemy.hp / currentEnemy.maxHp) * 100);
    uiEnemyHpBar.style.width = `${hpPct}%`;
    uiEnemyHpText.innerText = `${currentEnemy.hp} / ${currentEnemy.maxHp}`;
}

export function showHitCut({ target, uiPlayerAvatar, uiEnemyAvatar, hitCutSrc, effectSrc = hitCutSrc }) {
    const avatar = target === "player" ? uiPlayerAvatar : uiEnemyAvatar;
    if (!avatar || !avatar.parentElement) return;

    const container = avatar.parentElement;
    let effect = container.querySelector(".cut-effect");
    if (!effect) {
        effect = document.createElement("img");
        effect.className = "cut-effect";
        effect.alt = "";
        effect.draggable = false;
        container.appendChild(effect);
    }
    effect.src = effectSrc;

    effect.classList.remove("cut-effect--play");
    void effect.offsetWidth;
    effect.classList.add("cut-effect--play");
}

export function triggerAnimation({ element, currentGameStats, animClass, durationMs = 350 }) {
    return new Promise(resolve => {
        currentGameStats.isAnimating = true;
        element.classList.add(animClass);
        setTimeout(() => {
            element.classList.remove(animClass);
            currentGameStats.isAnimating = false;
            resolve();
        }, durationMs);
    });
}

export function triggerDodgeAnimation({
    target,
    uiPlayerAvatar,
    uiEnemyAvatar,
    currentGameStats,
    playSound,
    durationMs = 260
}) {
    const element = target === "player" ? uiPlayerAvatar : uiEnemyAvatar;
    const animClass = target === "player" ? "anim-dodge-left" : "anim-dodge-right";
    return new Promise(resolve => {
        currentGameStats.isAnimating = true;
        playSound("swoosh");
        element.classList.add(animClass);
        setTimeout(() => {
            element.classList.remove(animClass);
            currentGameStats.isAnimating = false;
            resolve();
        }, durationMs);
    });
}

export function resetEqReadoutBackground(eqReadout) {
    if (!eqReadout) return;
    eqReadout.style.backgroundImage = "";
    eqReadout.style.backgroundSize = "";
    eqReadout.style.backgroundPosition = "";
    eqReadout.style.backgroundRepeat = "";
    eqReadout.style.imageRendering = "";
}

export function bindCombatStatTooltips({
    uiPlayerAtk,
    uiPlayerDef,
    uiPlayerCrit,
    uiPlayerDodge,
    uiPlayerAim,
    uiEnemyAtk,
    uiEnemyDef,
    uiEnemyCrit,
    uiEnemyDodge,
    uiEnemyAim,
    getPlayerStats,
    getEnemyStats,
    showTooltip,
    hideTooltip
}) {
    function getStatTooltipHtml(owner, statKey) {
        const isPlayer = owner === "player";
        const actor = isPlayer ? getPlayerStats() : getEnemyStats();
        if (!actor) return "";

        const value = actor[statKey];
        const opposing = isPlayer ? getEnemyStats() : getPlayerStats();
        const opposingAim = opposing ? (opposing.aim || 0) : 0;
        const currentDodgeChance = Math.max(0, ((statKey === "dodge" ? value : (actor.dodge || 0)) - opposingAim));

        if (statKey === "atk") return `<div class="stat-tip-text">Roll 1-${value} attack damage.</div>`;
        if (statKey === "def") return `<div class="stat-tip-text">Roll 1-${value} defense to reduce damage.</div>`;
        if (statKey === "crit") return `<div class="stat-tip-text">${value}% chance to critical hit.</div>`;
        if (statKey === "dodge") return `<div class="stat-tip-text">Chance = max(0, DODGE - AIM). Now ${currentDodgeChance}%.</div>`;
        if (statKey === "aim") return `<div class="stat-tip-text">Lowers target dodge by ${value}%.</div>`;
        return "";
    }

    function bindStatTooltip(element, owner, statKey, side) {
        if (!element) return;
        const trigger = element.closest(".stat-stack") || element;
        trigger.onmouseover = event => {
            const html = getStatTooltipHtml(owner, statKey);
            if (!html) return;
            showTooltip(html, event.clientX, event.clientY, side, "above", true);
        };
        trigger.onmousemove = event => {
            const html = getStatTooltipHtml(owner, statKey);
            if (!html) return;
            showTooltip(html, event.clientX, event.clientY, side, "above", true);
        };
        trigger.onmouseout = () => {
            hideTooltip();
        };
    }

    bindStatTooltip(uiPlayerAtk, "player", "atk", "right");
    bindStatTooltip(uiPlayerDef, "player", "def", "right");
    bindStatTooltip(uiPlayerCrit, "player", "crit", "right");
    bindStatTooltip(uiPlayerDodge, "player", "dodge", "right");
    bindStatTooltip(uiPlayerAim, "player", "aim", "right");

    bindStatTooltip(uiEnemyAtk, "enemy", "atk", "left");
    bindStatTooltip(uiEnemyDef, "enemy", "def", "left");
    bindStatTooltip(uiEnemyCrit, "enemy", "crit", "left");
    bindStatTooltip(uiEnemyDodge, "enemy", "dodge", "left");
    bindStatTooltip(uiEnemyAim, "enemy", "aim", "left");
}

export function showEnemyInfo(currentEnemy) {
    if (!currentEnemy) return "";
    return `
        <div class="slot-item-name golden-text" style="font-size: 1.2rem; border-bottom: 1px solid var(--border-gold-dim); padding-bottom: 5px; margin-bottom: 8px;">${currentEnemy.name}</div>
        <div class="slot-item-stats" style="font-size: 1.15rem; color: var(--text-highlight); font-weight: bold; margin-bottom: 8px;">Class: ${currentEnemy.type}</div>
        <div class="slot-item-desc" style="color: #ffffff; font-size: 1rem; line-height: 1.4;">${currentEnemy.desc}</div>
    `;
}

export function renderEquipment({
    playerInfo,
    gearSlotOrder,
    gearSlotLabels,
    consumableSlotCount,
    consumeInventoryItem,
    showInfoTooltipFn,
    hideInfoTooltipFn,
    showItemInfoFn
}) {
    const GEAR_PLACEHOLDER_ICONS = {
        helmet: "resources/images/UI/gear_ui/helmet.png",
        body: "resources/images/UI/gear_ui/armour.png",
        shoes: "resources/images/UI/gear_ui/shoe.png",
        hands: "resources/images/UI/gear_ui/glove.png",
        weapon_1: "resources/images/UI/gear_ui/weapon.png",
        weapon_2: "resources/images/UI/gear_ui/weapon.png",
        relic_1: "resources/images/UI/gear_ui/ring.png",
        relic_2: "resources/images/UI/gear_ui/ring.png"
    };

    function getGearPlaceholderIcon(slotKey) {
        return GEAR_PLACEHOLDER_ICONS[slotKey] || "";
    }

    const gearGrid = document.getElementById("gear-grid");
    const consumableGrid = document.getElementById("inventory-grid");
    const essenceCell = document.getElementById("essence-cell");
    const essenceValue = document.getElementById("essence-value");
    if (gearGrid) gearGrid.innerHTML = "";
    if (consumableGrid) consumableGrid.innerHTML = "";
    const essenceAmount = Math.max(0, Math.floor(Number(playerInfo.essence) || 0));

    if (essenceValue) {
        essenceValue.innerText = `${essenceAmount}`;
    }
    if (essenceCell) {
        essenceCell.onmouseover = event => {
            showInfoTooltipFn(getEssenceTooltip(essenceAmount), event.clientX, event.clientY, "right", "above");
        };
        essenceCell.onmousemove = event => {
            showInfoTooltipFn(getEssenceTooltip(essenceAmount), event.clientX, event.clientY, "right", "above");
        };
        essenceCell.onmouseout = () => {
            hideInfoTooltipFn();
        };
    }

    gearSlotOrder.forEach(slotKey => {
        const item = playerInfo.gearSlots[slotKey];
        const slot = document.createElement("div");
        slot.className = "grid-item";
        slot.dataset.slot = slotKey;
        if (item) {
            slot.classList.add(`rarity-border-${item.rarity || "common"}`);
            slot.classList.remove("gear-slot-empty");
            slot.style.removeProperty("--gear-slot-icon");
            renderItemVisualIntoSlot(slot, item);
            slot.onmouseover = event => {
                showInfoTooltipFn(showItemInfoFn(item, false, slotKey), event.clientX, event.clientY, "right", "above");
            };
            slot.onmousemove = event => {
                showInfoTooltipFn(showItemInfoFn(item, false, slotKey), event.clientX, event.clientY, "right", "above");
            };
            slot.onmouseout = () => {
                hideInfoTooltipFn();
            };
        } else {
            slot.classList.add("empty");
            slot.classList.add("gear-slot-empty");
            const iconPath = getGearPlaceholderIcon(slotKey);
            if (iconPath) {
                slot.style.setProperty("--gear-slot-icon", `url(\"${iconPath}\")`);
            } else {
                slot.style.removeProperty("--gear-slot-icon");
            }
            slot.innerText = "";
            slot.onmouseover = event => {
                showInfoTooltipFn(getEmptyGearSlotTooltip({ gearSlotKey: slotKey, gearSlotLabels }), event.clientX, event.clientY, "right", "above");
            };
            slot.onmousemove = event => {
                showInfoTooltipFn(getEmptyGearSlotTooltip({ gearSlotKey: slotKey, gearSlotLabels }), event.clientX, event.clientY, "right", "above");
            };
            slot.onmouseout = () => {
                hideInfoTooltipFn();
            };
        }
        if (gearGrid) gearGrid.appendChild(slot);
    });

    for (let index = 0; index < consumableSlotCount; index += 1) {
        const item = playerInfo.consumables[index];
        const slot = document.createElement("div");
        slot.className = "grid-item";
        if (item) {
            slot.classList.add(`rarity-border-${item.rarity || "common"}`);
            renderItemVisualIntoSlot(slot, item);
            slot.onmouseover = event => {
                showInfoTooltipFn(showItemInfoFn(item, true), event.clientX, event.clientY, "right", "above");
            };
            slot.onmousemove = event => {
                showInfoTooltipFn(showItemInfoFn(item, true), event.clientX, event.clientY, "right", "above");
            };
            slot.onmouseout = () => {
                hideInfoTooltipFn();
            };
            slot.oncontextmenu = event => {
                event.preventDefault();
                consumeInventoryItem(index);
            };
        } else {
            slot.classList.add("empty");
            slot.onmouseover = event => {
                showInfoTooltipFn(getEmptyConsumableSlotTooltip(), event.clientX, event.clientY, "right", "above");
            };
            slot.onmousemove = event => {
                showInfoTooltipFn(getEmptyConsumableSlotTooltip(), event.clientX, event.clientY, "right", "above");
            };
            slot.onmouseout = () => {
                hideInfoTooltipFn();
            };
        }
        if (consumableGrid) consumableGrid.appendChild(slot);
    }

}
