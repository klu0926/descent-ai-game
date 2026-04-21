function getSkillInitials(skillName) {
    const words = skillName
        .replace(/[^a-zA-Z0-9 ]/g, " ")
        .split(" ")
        .map(part => part.trim())
        .filter(Boolean);
    if (words.length === 0) return "SK";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
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

function getSkillLockReason({
    node,
    rank,
    playerInfo,
    isSectionUnlocked,
    getSectionPointRequirement,
    getTotalSkillSpent
}) {
    if (!node) return "";
    if (!playerInfo || playerInfo.skillPoints <= 0) return "No skill points available.";
    if (!isSectionUnlocked(node.section)) {
        const missing = Math.max(0, getSectionPointRequirement(node.section) - getTotalSkillSpent());
        if (missing > 0) return `Need ${missing} more point${missing > 1 ? "s" : ""} in the tree.`;
    }
    if (rank >= node.maxRank) return "Max rank reached.";
    return "";
}

export function updateSkillTreeButton(skillTreeBtn, points) {
    if (!skillTreeBtn) return;
    const pointsClass = points > 0 ? "skills-points-active" : "skills-points-zero";
    skillTreeBtn.innerHTML = `SKILLS: <span class="${pointsClass}">${points}</span>`;
}

export function renderSkillTree({
    skillTreeSectionsElement,
    skillTreeStatusElement,
    skillTreePortraitElement,
    playerInfo,
    skillTreeSections,
    skillTreeNodes,
    getSkillRank,
    canSpendSkillPoint,
    isSectionUnlocked,
    getSectionPointRequirement,
    getTotalSkillSpent,
    playerClass
}) {
    if (!skillTreeSectionsElement || !skillTreeStatusElement) return;
    skillTreeStatusElement.innerHTML = `
        <span class="skill-tree-metric">Total spent: ${getTotalSkillSpent()}</span>
        <span class="skill-tree-metric skill-tree-points-value">Points: ${playerInfo.skillPoints}</span>
    `;

    const tierRowsHtml = skillTreeSections.map(section => {
        const rowNodesHtml = skillTreeNodes
            .filter(node => node.section === section.id)
            .map((node, idx) => {
                const rank = getSkillRank(node.id);
                const canSpend = canSpendSkillPoint(node);
                const isPointLocked = !isSectionUnlocked(node.section);
                const classesForNode = ["skill-node"];
                if (rank >= node.maxRank) classesForNode.push("is-maxed");
                if (!canSpend) classesForNode.push("is-locked");
                if (isPointLocked) classesForNode.push("is-point-locked");
                const lockReason = getSkillLockReason({
                    node,
                    rank,
                    playerInfo,
                    isSectionUnlocked,
                    getSectionPointRequirement,
                    getTotalSkillSpent
                });
                const iconImage = (node.image || "").replace(/"/g, "&quot;");
                const tooltipSide = idx >= 3 ? "left" : "right";
                return `
                    <button class="${classesForNode.join(" ")}"
                        data-skill-id="${node.id}"
                        data-skill-name="${node.name.replace(/"/g, "&quot;")}"
                        data-skill-desc="${node.desc.replace(/"/g, "&quot;")}"
                        data-skill-lock="${lockReason.replace(/"/g, "&quot;")}"
                        data-tooltip-side="${tooltipSide}">
                        <span class="skill-node-icon${iconImage ? "" : " no-image"}" ${iconImage ? `style="background-image:url('${iconImage}')"` : ""}>
                            ${iconImage ? "" : `<span class="skill-node-initial">${getSkillInitials(node.name)}</span>`}
                            ${rank > 1 ? `<span class="skill-node-rank-badge">${rank}</span>` : ""}
                        </span>
                    </button>
                `;
            })
            .join("");
        return `<div class="skill-tier-row">${rowNodesHtml}</div>`;
    }).join("");

    skillTreeSectionsElement.innerHTML = tierRowsHtml;
    if (skillTreePortraitElement && playerClass && (playerClass.skillCardPortrait || playerClass.portrait)) {
        const portraitPath = playerClass.skillCardPortrait || playerClass.portrait;
        skillTreePortraitElement.style.backgroundImage = `url("${portraitPath}")`;
    }
}

export function showSkillTooltip({
    skillTreeTooltip,
    skillTreeById,
    getSkillRank,
    isSectionUnlocked,
    canSpendSkillPoint,
    target,
    x,
    y
}) {
    if (!skillTreeTooltip || !target) return;
    const skillId = target.dataset.skillId || "";
    const node = skillTreeById.get(skillId);
    const name = target.dataset.skillName || "Unknown Skill";
    let desc = target.dataset.skillDesc || "";
    let extraHtml = "";
    const rank = node ? getSkillRank(node.id) : 0;
    const maxRank = node ? node.maxRank : 0;
    const effectTypes = node && Array.isArray(node.effectTypes) ? node.effectTypes : [];
    const effectTypesHtml = effectTypes.length > 0
        ? `
            <div class="skill-tooltip-effects">
                ${effectTypes.map(type => {
                    const safeType = String(type);
                    const label = safeType.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const typeClass = safeType.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    return `<span class="skill-tooltip-effect-chip skill-tooltip-effect-chip--${typeClass}">${label}</span>`;
                }).join("")}
            </div>
        `
        : "";
    const levelData = node
        ? (Array.isArray(node.levelData) ? node.levelData : (Array.isArray(node.levelDesc) ? node.levelDesc : []))
        : [];
    const formattedCurrentDesc = node && typeof node.formatDescription === "function"
        ? String(node.formatDescription(Math.max(1, rank)) || "")
        : "";
    if (levelData.length > 0) {
        const descIndex = Math.max(0, Math.min(rank - 1, levelData.length - 1));
        if (rank > 0) {
            const rawCurrent = String(levelData[descIndex] || "");
            desc = node && typeof node.formatTextWithTokens === "function"
                ? node.formatTextWithTokens(rawCurrent, rank)
                : (node && typeof node.formatTextWithValue === "function"
                    ? node.formatTextWithValue(rawCurrent, rank)
                    : rawCurrent);
        }
        else desc = "";
        if (rank < maxRank) {
            const nextIndex = Math.min(rank, levelData.length - 1);
            const nextLabel = rank === 0 ? "Level 1:" : "Next level:";
            const rawNext = String(levelData[nextIndex] || "");
            const nextDesc = node && typeof node.formatTextWithTokens === "function"
                ? node.formatTextWithTokens(rawNext, rank + 1)
                : (node && typeof node.formatTextWithValue === "function"
                    ? node.formatTextWithValue(rawNext, rank + 1)
                    : rawNext);
            extraHtml = `
                <div class="skill-tooltip-next-label">${nextLabel}</div>
                <div class="skill-tooltip-next-desc">${highlightValueToken(nextDesc)}</div>
            `;
        }
    } else if (formattedCurrentDesc) {
        desc = formattedCurrentDesc;
    }

    const lockText = node && !canSpendSkillPoint(node)
        ? (target.dataset.skillLock || "")
        : "";
    const hasTreeLock = node ? !isSectionUnlocked(node.section) : false;

    skillTreeTooltip.innerHTML = `
        <div class="skill-tooltip-title">${name}</div>
        ${effectTypesHtml}
        <div class="skill-tooltip-rank">${rank}/${maxRank}</div>
        <div class="skill-tooltip-desc">${highlightValueToken(desc)}</div>
        ${extraHtml}
        ${lockText ? `<div class="skill-tooltip-lock ${hasTreeLock ? "is-tree-lock" : ""}">${lockText}</div>` : ""}
    `;
    skillTreeTooltip.classList.remove("hidden");
    const tooltipSide = target.dataset.tooltipSide === "left" ? "left" : "right";
    if (tooltipSide === "left") {
        const width = skillTreeTooltip.offsetWidth || 280;
        skillTreeTooltip.style.left = `${x - width - 18}px`;
    } else {
        skillTreeTooltip.style.left = `${x + 18}px`;
    }
    skillTreeTooltip.style.top = `${y + 12}px`;
}

export function hideSkillTooltip(skillTreeTooltip) {
    if (!skillTreeTooltip) return;
    skillTreeTooltip.classList.add("hidden");
}
