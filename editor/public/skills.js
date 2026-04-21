const state = {
    skills: [],
    skillIcons: [],
    activeFilter: "all",
    metadata: {
        skillTypeOptions: ["passive", "buff", "debuff", "active"],
        targetOptions: ["self", "enemy", "ally"],
        modeOptions: ["action", "passive", "instant", "toggle"],
        triggerEventOptions: []
    }
};

const PASSIVE_EFFECT_OPTIONS = [
    { value: "hp_flat", label: "HP" },
    { value: "hp_percent", label: "HP %" },
    { value: "atk", label: "ATK" },
    { value: "def", label: "DEF" },
    { value: "crit", label: "CRIT" },
    { value: "dodge_stat", label: "DODGE" },
    { value: "aim", label: "AIM" },
    { value: "counter_attack", label: "Counter Attack" },
    { value: "set_flag", label: "Apply Buff" },
    { value: "clear_flag", label: "Remove Buff" },
    { value: "set_debuff", label: "Add Debuff" },
    { value: "clear_debuff", label: "Remove Debuff" }
];
const EFFECT_SIGN_OPTIONS = ["+", "-"];
const APPLY_MODE_OPTIONS = [
    { value: "on_use", label: "on use" },
    { value: "persistent", label: "persistent" },
    { value: "conditional", label: "conditional" }
];
const SUPPORTED_PASSIVE_EFFECT_TYPES = new Set([
    "add_hp",
    "add_hp_percent",
    "reduce_hp",
    "reduce_hp_percent",
    "add_atk",
    "reduce_atk",
    "add_defence",
    "add_def",
    "reduce_def",
    "add_crit",
    "reduce_crit",
    "add_dodge",
    "reduce_dodge",
    "add_aim",
    "reduce_aim",
    "counter_attack",
    "set_flag",
    "clear_flag",
    // Keep legacy runtime names valid for existing saved files.
    "heal",
    "heal_percent_max_hp",
    "damage_enemy_flat"
]);
const SKILL_TARGET_OPTIONS_UI = [
    { value: "self", label: "self" },
    { value: "enemy", label: "opponent" }
];
const MAX_RANK_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));
const EFFECT_VALUE_TYPE_OPTIONS = ["int", "%"];
const EFFECT_CHANCE_OPTIONS = Array.from({ length: 21 }, (_, i) => {
    const value = i * 5;
    return { value: String(value), label: `${value}%` };
});

const el = {
    status: document.getElementById("status"),
    statusError: document.getElementById("status-error"),
    skillsCount: document.getElementById("skills-count"),
    skillList: document.getElementById("skill-list"),
    newName: document.getElementById("new-name"),
    newIconBtn: document.getElementById("new-icon-btn"),
    newIconPreview: document.getElementById("new-icon-preview"),
    newIconFallback: document.getElementById("new-icon-fallback"),
    newSkillType: document.getElementById("new-skill-type"),
    newTriggerTarget: document.getElementById("new-trigger-target"),
    newTriggerEvent: document.getElementById("new-trigger-event"),
    newApplyMode: document.getElementById("new-apply-mode"),
    newEffectSelect: document.getElementById("new-effect-select"),
    newEffectSign: document.getElementById("new-effect-sign"),
    newEffectValue: document.getElementById("new-effect-value"),
    newEffectValueType: document.getElementById("new-effect-value-type"),
    newEffectFlagTarget: document.getElementById("new-effect-flag-target"),
    newEffectChance: document.getElementById("new-effect-chance"),
    newPassiveConfig: document.getElementById("new-passive-config"),
    newTarget: document.getElementById("new-target"),
    newMaxRank: document.getElementById("new-max-rank"),
    newScalingValue: document.getElementById("new-scaling-value"),
    newScalingValueType: document.getElementById("new-scaling-value-type"),
    newDurationTurns: document.getElementById("new-duration-turns"),
    newDesc: document.getElementById("new-desc"),
    newDescInsertValueBtn: document.getElementById("new-desc-insert-value-btn"),
    newDescInsertChanceBtn: document.getElementById("new-desc-insert-chance-btn"),
    newDescPreview: document.getElementById("new-desc-preview"),
    addBtn: document.getElementById("add-btn"),
    skillsFilterAllBtn: document.getElementById("skills-filter-all-btn"),
    skillsFilterActiveBtn: document.getElementById("skills-filter-active-btn"),
    skillsFilterPassiveBtn: document.getElementById("skills-filter-passive-btn"),
    skillsFilterBuffBtn: document.getElementById("skills-filter-buff-btn"),
    skillsFilterDebuffBtn: document.getElementById("skills-filter-debuff-btn"),
    skillsOpenAllBtn: document.getElementById("skills-open-all-btn"),
    skillsCloseAllBtn: document.getElementById("skills-close-all-btn"),
    iconModal: document.getElementById("skill-icon-modal"),
    iconGrid: document.getElementById("skill-icon-grid"),
    iconCloseBtn: document.getElementById("skill-icon-close-btn"),
    iconClearBtn: document.getElementById("skill-icon-clear-btn")
};

if (el.newEffectChance) el.newEffectChance.classList.add("chance-select");
if (el.newEffectValue) el.newEffectValue.classList.add("effect-value-input");
if (el.newEffectValueType) el.newEffectValueType.classList.add("effect-value-type-select");
if (el.newScalingValue) el.newScalingValue.classList.add("effect-value-input");
if (el.newScalingValueType) el.newScalingValueType.classList.add("effect-value-type-select");

function setStatus(message, kind = "muted") {
    const text = String(message || "");
    if (kind === "error") {
        if (el.statusError) {
            el.statusError.textContent = text;
            el.statusError.hidden = !text;
        }
        if (el.status) {
            el.status.textContent = "";
            el.status.className = "muted mt8";
        }
        return;
    }
    if (el.statusError) {
        el.statusError.textContent = "";
        el.statusError.hidden = true;
    }
    if (!el.status) return;
    el.status.textContent = text;
    el.status.className = kind === "muted" ? "muted mt8" : `muted mt8 status-${kind}`;
}

function fillSelect(selectEl, options, { allowEmpty = false, selected = "" } = {}) {
    if (!selectEl) return;
    const frag = document.createDocumentFragment();
    if (allowEmpty) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "-";
        frag.appendChild(option);
    }
    options.forEach(entry => {
        const isObjectOption = entry && typeof entry === "object";
        const value = isObjectOption ? String(entry.value ?? "") : String(entry);
        const label = isObjectOption ? String(entry.label ?? value) : String(entry);
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        frag.appendChild(option);
    });
    selectEl.innerHTML = "";
    selectEl.appendChild(frag);
    if (selected) selectEl.value = selected;
}

function toStoredSkillIconPath(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^\/api\/skill-icons\/([^/?#]+)$/i);
    if (!match) return raw;
    const fileName = decodeURIComponent(match[1]);
    return `resources/images/skill_icons/${fileName}`;
}

function toPreviewSkillIconUrl(value) {
    const raw = String(value || "").trim();
    const relativeMatch = raw.match(/^resources\/images\/skill_icons\/([^/?#]+)$/i);
    if (relativeMatch) return `/api/skill-icons/${encodeURIComponent(relativeMatch[1])}`;
    return raw;
}

function setIconPreview(imgEl, fallbackEl, imagePath) {
    const storedPath = toStoredSkillIconPath(imagePath);
    const previewPath = toPreviewSkillIconUrl(storedPath);
    if (!imgEl || !fallbackEl) return;
    const buttonEl = imgEl.closest(".skill-icon-btn");
    if (!storedPath) {
        imgEl.classList.add("hidden");
        imgEl.removeAttribute("src");
        delete imgEl.dataset.skillPath;
        fallbackEl.classList.remove("hidden");
        if (buttonEl) buttonEl.classList.remove("has-image");
        return;
    }
    imgEl.src = previewPath;
    imgEl.dataset.skillPath = storedPath;
    imgEl.classList.remove("hidden");
    fallbackEl.classList.add("hidden");
    if (buttonEl) buttonEl.classList.add("has-image");
}

function applySkillIconTypeClass(buttonEl, skillType) {
    if (!buttonEl) return;
    buttonEl.classList.remove("type-passive", "type-buff", "type-debuff");
    const normalized = String(skillType || "").trim().toLowerCase();
    if (normalized === "passive") buttonEl.classList.add("type-passive");
    if (normalized === "buff") buttonEl.classList.add("type-buff");
    if (normalized === "debuff") buttonEl.classList.add("type-debuff");
}

function createInput(value = "", placeholder = "") {
    const input = document.createElement("input");
    input.value = String(value ?? "");
    if (placeholder) input.placeholder = placeholder;
    return input;
}

function createNumberInput(value = 0, min = 0) {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(Number(value) || 0);
    input.min = String(min);
    return input;
}

function createSelect(options, value = "", allowEmpty = false) {
    const select = document.createElement("select");
    fillSelect(select, options, { allowEmpty, selected: value });
    return select;
}

function insertTextAtCursor(textareaEl, text) {
    if (!textareaEl) return;
    const insertion = String(text || "");
    const value = String(textareaEl.value || "");
    const start = Number.isFinite(textareaEl.selectionStart) ? textareaEl.selectionStart : value.length;
    const end = Number.isFinite(textareaEl.selectionEnd) ? textareaEl.selectionEnd : value.length;
    const nextValue = value.slice(0, start) + insertion + value.slice(end);
    textareaEl.value = nextValue;
    const nextPos = start + insertion.length;
    textareaEl.focus();
    textareaEl.setSelectionRange(nextPos, nextPos);
    textareaEl.dispatchEvent(new Event("input", { bubbles: true }));
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getHighlightedDescriptionHtml(value) {
    return escapeHtml(value).replace(/\[(value)\]/gi, '<span class="desc-token-highlight">[$1]</span>');
}

function getResolvedHighlightedDescriptionHtml(descText, valueText, chanceText) {
    const rawDesc = String(descText || "");
    const rawValue = Number.parseFloat(String(valueText || "").trim());
    const resolvedValue = Number.isFinite(rawValue)
        ? (Math.abs(rawValue - Math.round(rawValue)) < 0.0001 ? String(Math.round(rawValue)) : String(Number(rawValue.toFixed(2))))
        : "0";
    const rawChance = Number.parseFloat(String(chanceText || "").trim());
    const resolvedChance = Number.isFinite(rawChance)
        ? (Math.abs(rawChance - Math.round(rawChance)) < 0.0001 ? `${Math.round(rawChance)}%` : `${Number(rawChance.toFixed(2))}%`)
        : "0%";
    const escapedValue = escapeHtml(resolvedValue);
    const escapedChance = escapeHtml(resolvedChance);
    return escapeHtml(rawDesc)
        .replace(/\[(value)\]/gi, `<span class="desc-token-highlight">${escapedValue}</span>`)
        .replace(/\[(chance)\]/gi, `<span class="desc-token-highlight">${escapedChance}</span>`);
}

function renderDescriptionPreview(previewEl, value) {
    if (!previewEl) return;
    const raw = String(value || "");
    if (!raw.trim()) {
        previewEl.innerHTML = "";
        return;
    }
    previewEl.innerHTML = getHighlightedDescriptionHtml(raw);
}

function ensureEditorDescTooltip() {
    let tooltip = document.getElementById("editor-desc-tooltip");
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "editor-desc-tooltip";
    tooltip.className = "info-tooltip hidden editor-desc-tooltip";
    document.body.appendChild(tooltip);
    return tooltip;
}

function showEditorDescTooltip(descText, x, y, valueText = "", chanceText = "") {
    const tooltip = ensureEditorDescTooltip();
    const raw = String(descText || "").trim();
    tooltip.innerHTML = raw
        ? `<div class="skill-tooltip-desc">${getResolvedHighlightedDescriptionHtml(raw, valueText, chanceText)}</div>`
        : `<div class="skill-tooltip-desc">No description.</div>`;
    tooltip.classList.remove("hidden");
    const rect = tooltip.getBoundingClientRect();
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 720;
    const nextLeft = Math.min(Math.max(10, x + 14), Math.max(10, viewportW - rect.width - 10));
    const nextTop = Math.min(Math.max(10, y + 14), Math.max(10, viewportH - rect.height - 10));
    tooltip.style.left = `${nextLeft}px`;
    tooltip.style.top = `${nextTop}px`;
}

function hideEditorDescTooltip() {
    const tooltip = document.getElementById("editor-desc-tooltip");
    if (!tooltip) return;
    tooltip.classList.add("hidden");
}

function resolveEditorDescriptionValue(descText, valueText) {
    const rawDesc = String(descText || "");
    if (!/\[value\]/i.test(rawDesc)) return rawDesc;
    const rawValue = Number.parseFloat(String(valueText || "").trim());
    const value = Number.isFinite(rawValue)
        ? (Math.abs(rawValue - Math.round(rawValue)) < 0.0001 ? String(Math.round(rawValue)) : String(Number(rawValue.toFixed(2))))
        : "0";
    return rawDesc.replace(/\[value\]/gi, value);
}

function rowField(label, input) {
    const wrap = document.createElement("div");
    wrap.className = "stats-field";
    const text = document.createElement("span");
    text.className = "skill-col-label";
    text.textContent = label;
    wrap.appendChild(text);
    wrap.appendChild(input);
    return wrap;
}

function buildScaling(maxRank, scaleValue, scaleValueType) {
    const rank = Math.max(1, Number.parseInt(String(maxRank || "1"), 10) || 1);
    const rawValue = Number.parseFloat(String(scaleValue || "0"));
    const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
    const valueType = String(scaleValueType || "%").trim() === "%" ? "%" : "int";
    const multiplier = valueType === "%"
        ? Math.max(0, 1 + (safeValue / 100))
        : Math.max(0, safeValue);
    const output = [];
    for (let i = 2; i <= rank; i += 1) {
        const rankOffset = i - 1;
        const flatAdd = valueType === "int" ? Number((safeValue * rankOffset).toFixed(4)) : 0;
        const percentAddRate = valueType === "%"
            ? Number(((safeValue / 100) * rankOffset).toFixed(6))
            : 0;
        const multiplier = Number((1 + percentAddRate).toFixed(6));
        output.push({
            rank: i,
            modifiers: {
                effectMultiplier: multiplier,
                effectFlatAdd: flatAdd,
                effectPercentAddRate: percentAddRate,
                effectMultiplierInput: Number(safeValue.toFixed(4)),
                effectMultiplierInputType: valueType
            }
        });
    }
    return output;
}

function syncScalingSelector(maxRankEl, scalingValueEl, scalingTypeEl) {
    if (!maxRankEl || !scalingValueEl || !scalingTypeEl) return;
    const rank = Math.max(1, Number.parseInt(String(maxRankEl.value || "1"), 10) || 1);
    const disabled = rank <= 1;
    scalingValueEl.disabled = disabled;
    scalingTypeEl.disabled = disabled;
    const valueWrap = typeof scalingValueEl.closest === "function" ? scalingValueEl.closest(".stats-field") : null;
    const typeWrap = typeof scalingTypeEl.closest === "function" ? scalingTypeEl.closest(".stats-field") : null;
    if (valueWrap) valueWrap.classList.toggle("is-disabled", disabled);
    if (typeWrap) typeWrap.classList.toggle("is-disabled", disabled);
    if (disabled) scalingValueEl.value = "0";
}

function inferTriggerTargetFromEvent(eventName) {
    const value = String(eventName || "").trim().toLowerCase();
    if (value.startsWith("self:")) return "self";
    if (value.startsWith("target:") || value.startsWith("opponent:")) return "opponent";
    if (value.includes("enemy_")) return "opponent";
    if (value.includes("player_")) return "self";
    if (value.startsWith("combat:")) return "combat";
    if (value.startsWith("game:")) return "game";
    return "self";
}

function encodeTurnTickOption(baseEvent, everyTurns) {
    return `${baseEvent}__every_${everyTurns}`;
}

function decodeTriggerSelection(selectionValue) {
    const raw = String(selectionValue || "").trim();
    const match = raw.match(/^(game:turn_tick)__every_(\d+)$/);
    if (!match) return { event: raw, everyTurns: null };
    const everyTurns = Number.parseInt(match[2], 10);
    return {
        event: match[1],
        everyTurns: Number.isFinite(everyTurns) ? everyTurns : null
    };
}

function getPreferredTriggerSelection(trigger) {
    const source = trigger && typeof trigger === "object" ? trigger : {};
    const eventNameRaw = String(source.event || "").trim();
    const eventName = eventNameRaw.startsWith("target:")
        ? eventNameRaw.replace(/^target:/, "opponent:")
        : eventNameRaw;
    const everyTurns = Number.parseInt(String(source.everyTurns || ""), 10);
    if (eventName === "game:turn_tick" && [1, 2, 5, 10].includes(everyTurns)) {
        return encodeTurnTickOption(eventName, everyTurns);
    }
    return eventName;
}

function getEventsForTriggerTarget(triggerTarget) {
    const target = String(triggerTarget || "self").trim().toLowerCase();
    if (target === "self") {
        return [
            "self:hit",
            "self:dodge",
            "self:block",
            "self:attack",
            "self:turn_start"
        ];
    }
    if (target === "target" || target === "opponent") {
        return [
            "opponent:hit",
            "opponent:dodge",
            "opponent:block",
            "opponent:attack",
            "opponent:turn_start"
        ];
    }
    if (target === "game") {
        return state.metadata.triggerEventOptions.filter(eventName => String(eventName || "").toLowerCase().startsWith("game:"));
    }
    if (target === "combat") {
        return state.metadata.triggerEventOptions.filter(eventName => {
            const value = String(eventName || "").toLowerCase();
            if (value.startsWith("game:")) return true;
            return value.startsWith("combat:")
                && !value.includes("player_")
                && !value.includes("enemy_");
        });
    }
    const needle = `${target}_`;
    return state.metadata.triggerEventOptions.filter(eventName => String(eventName || "").toLowerCase().includes(needle));
}

function eventOptionLabel(eventName) {
    const raw = String(eventName || "");
    if (raw === "self:hit") return "hit";
    if (raw === "self:dodge") return "dodge";
    if (raw === "self:block") return "block";
    if (raw === "self:attack") return "attack";
    if (raw === "self:turn_start") return "turn start";
    if (raw === "target:hit") return "hit";
    if (raw === "target:dodge") return "dodge";
    if (raw === "target:block") return "block";
    if (raw === "target:attack") return "attack";
    if (raw === "target:turn_start") return "turn start";
    if (raw === "opponent:hit") return "hit";
    if (raw === "opponent:dodge") return "dodge";
    if (raw === "opponent:block") return "block";
    if (raw === "opponent:attack") return "attack";
    if (raw === "opponent:turn_start") return "turn start";
    const match = raw.match(/^game:turn_tick__every_(\d+)$/);
    if (match) return `turn_tick_${match[1]}`;
    if (raw === "combat:player_turn_start") return "turn start";
    if (raw === "combat:enemy_turn_start") return "turn start";
    return raw.replace(/^game:/i, "").replace(/^combat:/i, "");
}

function fillTriggerEventsByTarget(triggerTargetEl, triggerEventEl, preferred = "") {
    if (!triggerTargetEl || !triggerEventEl) return;
    const rawOptions = getEventsForTriggerTarget(triggerTargetEl.value);
    const options = [];
    rawOptions.forEach(value => {
        if (value === "game:turn_tick") {
            options.push(
                encodeTurnTickOption(value, 1),
                encodeTurnTickOption(value, 2),
                encodeTurnTickOption(value, 5),
                encodeTurnTickOption(value, 10)
            );
            return;
        }
        options.push(value);
    });
    fillSelect(
        triggerEventEl,
        options.map(value => ({ value, label: eventOptionLabel(value) })),
        { allowEmpty: true }
    );
    const preferredValue = String(preferred || "").trim();
    if (preferredValue && options.includes(preferredValue)) {
        triggerEventEl.value = preferredValue;
        return;
    }
    triggerEventEl.value = "";
}

function isPassiveLikeSkillType(skillType) {
    const normalized = String(skillType || "passive").trim().toLowerCase();
    return normalized === "passive" || normalized === "buff" || normalized === "debuff";
}

function shouldShowSkillConfig(skillType) {
    const normalized = String(skillType || "passive").trim().toLowerCase();
    return isPassiveLikeSkillType(normalized) || normalized === "active";
}

function togglePassiveConfig(skillType) {
    if (el.newPassiveConfig) el.newPassiveConfig.classList.toggle("hidden", !shouldShowSkillConfig(skillType));
}

function syncApplyModeBySkillType(skillType, applyModeSelect) {
    if (!applyModeSelect) return;
    const normalizedType = String(skillType || "passive").trim().toLowerCase();
    const isActive = normalizedType === "active";
    if (isActive) {
        applyModeSelect.value = "on_use";
    } else if (applyModeSelect.value === "on_use") {
        applyModeSelect.value = "persistent";
    }
    applyModeSelect.disabled = isActive;
    const wrap = typeof applyModeSelect.closest === "function" ? applyModeSelect.closest(".stats-field") : null;
    if (wrap) wrap.classList.toggle("is-disabled", isActive);
}

function isDirectionalEffect(effectBase) {
    const value = String(effectBase || "").trim().toLowerCase();
    return value === "hp_flat"
        || value === "hp_percent"
        || value === "atk"
        || value === "def"
        || value === "crit"
        || value === "dodge_stat"
        || value === "aim";
}

function isFlagTargetEffect(effectBase) {
    const value = String(effectBase || "").trim().toLowerCase();
    return value === "set_flag"
        || value === "clear_flag"
        || value === "set_debuff"
        || value === "clear_debuff";
}

function getSkillTypeOptions(type) {
    const normalized = String(type || "").trim().toLowerCase();
    return [...state.skills]
        .filter(skill => String(skill && skill.skillType || "").trim().toLowerCase() === normalized)
        .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
        .map(skill => ({
            value: String(skill.id || ""),
            label: String(skill.name || skill.id || "")
        }))
        .filter(entry => entry.value);
}

function getFlagTargetOptions(effectBase) {
    const value = String(effectBase || "").trim().toLowerCase();
    if (value === "set_debuff" || value === "clear_debuff") return getSkillTypeOptions("debuff");
    return getSkillTypeOptions("buff");
}

function inferEffectBaseFromStoredEffect(effect) {
    const effectType = String(effect && effect.type || "").trim().toLowerCase();
    if (effectType === "set_flag" || effectType === "clear_flag") {
        const flagKey = String(effect && effect.flagKey || "").trim();
        if (flagKey) {
            const debuffIds = new Set(getSkillTypeOptions("debuff").map(entry => entry.value));
            if (debuffIds.has(flagKey)) return effectType === "set_flag" ? "set_debuff" : "clear_debuff";
        }
    }
    const parsed = parseStoredEffectType(effectType);
    return parsed.base || "";
}

function syncEffectInputMode({
    effectSelectEl,
    effectFlagTargetEl,
    effectFlagTargetLabelEl,
    effectSignWrap,
    effectValueWrap,
    effectValueTypeWrap,
    effectFlagTargetWrap,
    selectedFlagTarget = ""
}) {
    if (!effectSelectEl) return;
    const effectBase = String(effectSelectEl.value || "").trim().toLowerCase();
    const useFlagTarget = isFlagTargetEffect(effectBase);
    const isDebuffTarget = effectBase === "set_debuff" || effectBase === "clear_debuff";
    if (effectSignWrap) effectSignWrap.classList.toggle("hidden", useFlagTarget);
    if (effectValueWrap) effectValueWrap.classList.toggle("hidden", useFlagTarget);
    if (effectValueTypeWrap) effectValueTypeWrap.classList.toggle("hidden", useFlagTarget);
    if (effectFlagTargetWrap) effectFlagTargetWrap.classList.toggle("hidden", !useFlagTarget);
    if (effectFlagTargetLabelEl) effectFlagTargetLabelEl.textContent = isDebuffTarget ? "debuff" : "buff";
    if (useFlagTarget && effectFlagTargetEl) {
        const options = getFlagTargetOptions(effectBase);
        fillSelect(effectFlagTargetEl, options, { allowEmpty: true, selected: selectedFlagTarget });
    }
}

function mapEffectType(effectBase, effectSign = "+") {
    const key = String(effectBase || "").trim().toLowerCase();
    const sign = String(effectSign || "+").trim() === "-" ? "-" : "+";
    const directionalMap = {
        hp_flat: { "+": "add_hp", "-": "reduce_hp" },
        hp_percent: { "+": "add_hp_percent", "-": "reduce_hp_percent" },
        atk: { "+": "add_atk", "-": "reduce_atk" },
        def: { "+": "add_defence", "-": "reduce_def" },
        crit: { "+": "add_crit", "-": "reduce_crit" },
        dodge_stat: { "+": "add_dodge", "-": "reduce_dodge" },
        aim: { "+": "add_aim", "-": "reduce_aim" }
    };
    if (directionalMap[key]) return directionalMap[key][sign];
    if (key === "counter_attack" || key === "set_flag" || key === "clear_flag") return key;
    if (key === "set_debuff") return "set_flag";
    if (key === "clear_debuff") return "clear_flag";
    return "";
}

function parseStoredEffectType(effectType) {
    const raw = String(effectType || "").trim().toLowerCase();
    const reverseMap = {
        add_hp: { base: "hp_flat", sign: "+" },
        reduce_hp: { base: "hp_flat", sign: "-" },
        heal: { base: "hp_flat", sign: "+" },
        damage_enemy_flat: { base: "hp_flat", sign: "-" },
        add_hp_percent: { base: "hp_percent", sign: "+" },
        reduce_hp_percent: { base: "hp_percent", sign: "-" },
        heal_percent_max_hp: { base: "hp_percent", sign: "+" },
        add_atk: { base: "atk", sign: "+" },
        reduce_atk: { base: "atk", sign: "-" },
        add_defence: { base: "def", sign: "+" },
        add_def: { base: "def", sign: "+" },
        reduce_def: { base: "def", sign: "-" },
        add_crit: { base: "crit", sign: "+" },
        reduce_crit: { base: "crit", sign: "-" },
        add_dodge: { base: "dodge_stat", sign: "+" },
        reduce_dodge: { base: "dodge_stat", sign: "-" },
        add_aim: { base: "aim", sign: "+" },
        reduce_aim: { base: "aim", sign: "-" },
        counter_attack: { base: "counter_attack", sign: "+" },
        set_flag: { base: "set_flag", sign: "+" },
        clear_flag: { base: "clear_flag", sign: "+" }
    };
    return reverseMap[raw] || { base: "", sign: "+" };
}

function syncEffectSignState(effectSelectEl, effectSignEl) {
    if (!effectSelectEl || !effectSignEl) return;
    const enabled = isDirectionalEffect(effectSelectEl.value);
    effectSignEl.disabled = !enabled;
    if (!enabled) effectSignEl.value = "+";
    const wrap = typeof effectSignEl.closest === "function" ? effectSignEl.closest(".stats-field") : null;
    if (wrap) wrap.classList.toggle("is-disabled", !enabled);
}

function getAutoAppliedValue(source = {}) {
    if (typeof source.autoApplied === "boolean") return source.autoApplied;
    const trigger = source.trigger && typeof source.trigger === "object" ? source.trigger : {};
    if (typeof trigger.autoApplied === "boolean") return trigger.autoApplied;
    return false;
}

function getApplyModeValue(source = {}) {
    return getAutoAppliedValue(source) ? "persistent" : "conditional";
}

function setFieldsDisabled(fields = [], disabled = false) {
    fields.forEach(field => {
        if (!field) return;
        field.disabled = Boolean(disabled);
        const fieldWrap = typeof field.closest === "function" ? field.closest(".stats-field") : null;
        if (fieldWrap) fieldWrap.classList.toggle("is-disabled", Boolean(disabled));
    });
}

function buildPayload(base) {
    const skillType = String(base.skillType || "passive").trim().toLowerCase();
    const applyMode = String(base.applyMode || "persistent").trim().toLowerCase();
    const autoApplied = applyMode === "persistent";
    const common = {
        name: String(base.name || "").trim(),
        skillType,
        target: String(base.target || "enemy").trim(),
        maxRank: Number.parseInt(String(base.maxRank || "1"), 10) || 1,
        durationTurns: Number.parseInt(String(base.durationTurns || "0"), 10) || 0,
        desc: String(base.desc || "").trim(),
        image: String(base.image || "").trim()
    };

    const decodedTrigger = decodeTriggerSelection(base.triggerEvent);
    const triggerEvent = autoApplied ? "" : String(decodedTrigger.event || "").trim();
    const rawTriggerTarget = String(base.triggerTarget || inferTriggerTargetFromEvent(triggerEvent)).trim().toLowerCase();
    const triggerTarget = rawTriggerTarget === "target"
        ? "opponent"
        : (rawTriggerTarget === "player"
            ? "self"
            : (rawTriggerTarget === "enemy" ? "opponent" : rawTriggerTarget));
    const effectBase = String(base.effectSelect || "").trim();
    const effectSign = String(base.effectSign || "+").trim() === "-" ? "-" : "+";
    const effectType = mapEffectType(effectBase, effectSign);
    const effectValue = String(base.effectValue || "").trim();
    const effectValueType = String(base.effectValueType || "int").trim().toLowerCase() === "%" ? "%" : "int";
    const effectChance = Math.max(0, Math.min(100, Number.parseInt(String(base.effectChance || "100"), 10) || 0));
    const effectFlagTarget = String(base.effectFlagTarget || "").trim();
    const nextEffect = effectType
        ? {
            type: effectType,
            onEvent: triggerEvent || undefined,
            ...(isFlagTargetEffect(effectBase)
                ? { flagKey: effectFlagTarget }
                : { value: effectValue, valueType: effectValueType }),
            chance: effectChance
        }
        : null;

    if (skillType === "active") {
        return {
            ...common,
            trigger: {
                mode: "on_use",
                target: triggerTarget,
                ...(triggerEvent ? { event: triggerEvent } : {}),
                ...(decodedTrigger.everyTurns ? { everyTurns: decodedTrigger.everyTurns } : {})
            },
            effects: nextEffect ? [nextEffect] : [],
            modifiers: { effectBaseMultiplier: 1 },
            scaling: buildScaling(common.maxRank, base.scalingValue, base.scalingValueType),
            autoApplied: false
        };
    }

    return {
        ...common,
        target: autoApplied ? "self" : common.target,
        trigger: triggerEvent
            ? {
                event: triggerEvent,
                target: triggerTarget,
                autoApplied,
                ...(decodedTrigger.everyTurns ? { everyTurns: decodedTrigger.everyTurns } : {})
            }
            : { target: autoApplied ? "self" : triggerTarget, autoApplied },
        effects: nextEffect ? [nextEffect] : [],
        modifiers: { effectBaseMultiplier: 1 },
        scaling: buildScaling(common.maxRank, base.scalingValue, base.scalingValueType),
        autoApplied
    };
}

async function loadSkills() {
    const response = await fetch("/api/skills", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load skills.");
    state.skills = Array.isArray(payload.skills) ? payload.skills : [];
    state.metadata = payload.metadata || state.metadata;
}

async function loadSkillIcons() {
    const response = await fetch("/api/skill-icons", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load skill icons.");
    state.skillIcons = Array.isArray(payload.icons) ? payload.icons : [];
}

async function createSkill(payload) {
    const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to create skill.");
    return body && body.skill ? body.skill : null;
}

async function updateSkill(skillType, id, payload) {
    const response = await fetch(`/api/skills/${encodeURIComponent(skillType)}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to update skill.");
}

async function deleteSkill(skillType, id) {
    const response = await fetch(`/api/skills/${encodeURIComponent(skillType)}/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to delete skill.");
}

function getNewPayload() {
    return buildPayload({
        name: el.newName?.value,
        image: el.newIconPreview?.dataset?.skillPath || "",
        skillType: el.newSkillType?.value,
        triggerTarget: el.newTriggerTarget?.value,
        triggerEvent: el.newTriggerEvent?.value,
        applyMode: el.newApplyMode?.value,
        effectSelect: el.newEffectSelect?.value,
        effectSign: el.newEffectSign?.value,
        effectValue: el.newEffectValue?.value,
        effectValueType: el.newEffectValueType?.value,
        effectFlagTarget: el.newEffectFlagTarget?.value,
        effectChance: el.newEffectChance?.value,
        target: el.newTarget?.value,
        maxRank: el.newMaxRank?.value,
        scalingValue: el.newScalingValue?.value,
        scalingValueType: el.newScalingValueType?.value,
        durationTurns: el.newDurationTurns?.value,
        desc: el.newDesc?.value
    });
}

function validateSkillPayload(payload) {
    if (!payload || typeof payload !== "object") return "Invalid skill payload.";
    if (!String(payload.name || "").trim()) return "Skill name is required.";
    const skillType = String(payload.skillType || "passive").trim().toLowerCase();
    const isPassiveLike = skillType === "passive" || skillType === "buff" || skillType === "debuff";
    if (!isPassiveLike) return "";

    const trigger = payload.trigger && typeof payload.trigger === "object" ? payload.trigger : {};
    const autoApplied = Boolean(trigger.autoApplied);
    const triggerEvent = String(trigger.event || "").trim();
    if (!autoApplied && !triggerEvent) return "Choose a trigger event or set mode to persistent.";

    const effects = Array.isArray(payload.effects) ? payload.effects : [];
    if (effects.length <= 0) return "";
    const effect = effects[0] || {};
    const effectType = String(effect.type || "").trim().toLowerCase();
    if (!effectType) return "Effect is required for passive skills.";
    if (!SUPPORTED_PASSIVE_EFFECT_TYPES.has(effectType)) return `Unsupported effect type '${effectType}'.`;
    if ((effectType === "set_flag" || effectType === "clear_flag") && !String(effect.flagKey || "").trim()) {
        return "Choose a buff/debuff selection for this effect.";
    }
    const valueType = String(effect.valueType || "int").trim().toLowerCase();
    if (valueType !== "int" && valueType !== "%") return "Effect value type must be int or %.";
    const chance = Number(effect.chance);
    if (!Number.isFinite(chance) || chance < 0 || chance > 100) return "Effect chance must be between 0 and 100.";
    return "";
}

function renderCard(skill) {
    const card = document.createElement("article");
    card.className = "skill-card";
    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "skill-collapse-btn";
    collapseBtn.setAttribute("aria-label", "Collapse skill card");
    collapseBtn.setAttribute("aria-expanded", "true");
    collapseBtn.textContent = "▾";
    const cardBody = document.createElement("div");
    cardBody.className = "skill-card-body";
    const setCollapsed = collapsed => {
        const shouldCollapse = Boolean(collapsed);
        cardBody.classList.toggle("hidden", shouldCollapse);
        collapseBtn.textContent = shouldCollapse ? "▴" : "▾";
        collapseBtn.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
        collapseBtn.setAttribute("aria-label", shouldCollapse ? "Expand skill card" : "Collapse skill card");
    };
    const iconBtn = document.createElement("button");
    iconBtn.type = "button";
    iconBtn.className = "skill-icon-btn";
    iconBtn.setAttribute("aria-label", "Choose skill icon");
    const iconPreview = document.createElement("img");
    iconPreview.className = "skill-icon-img hidden";
    iconPreview.alt = "skill icon preview";
    const iconFallback = document.createElement("span");
    iconFallback.className = "skill-icon-fallback";
    iconBtn.append(iconPreview, iconFallback);
    setIconPreview(iconPreview, iconFallback, skill.image || "");

    const grid = document.createElement("div");
    grid.className = "stats-row mt8 skill-main-row";
    const name = createInput(skill.name, "name");
    const skillType = createSelect(state.metadata.skillTypeOptions, skill.skillType);
    applySkillIconTypeClass(iconBtn, skillType.value);
    const target = createSelect(SKILL_TARGET_OPTIONS_UI, skill.target || "self");
    const maxRank = createSelect(MAX_RANK_OPTIONS, String(skill.maxRank || 1));
    const durationTurns = createNumberInput(skill.durationTurns || 0, 0);
    const iconField = document.createElement("div");
    iconField.className = "stats-field skill-main-icon-field";
    iconField.appendChild(iconBtn);
    [iconField, rowField("name", name), rowField("type", skillType), rowField("duration", durationTurns)].forEach(node => grid.appendChild(node));
    const collapseWrap = document.createElement("div");
    collapseWrap.className = "skill-collapse-wrap";
    collapseWrap.appendChild(collapseBtn);
    grid.appendChild(collapseWrap);
    card.appendChild(grid);

    const mediaRow = document.createElement("div");
    mediaRow.className = "stats-row mt8";
    const descField = document.createElement("div");
    descField.className = "stats-field skill-desc-field";
    const descLabel = document.createElement("span");
    descLabel.className = "skill-col-label";
    descLabel.textContent = "description";
    const desc = document.createElement("textarea");
    desc.className = "enemy-description";
    desc.value = String(skill.desc || "");
    const descInsertValueBtn = document.createElement("button");
    descInsertValueBtn.type = "button";
    descInsertValueBtn.className = "desc-token-btn";
    descInsertValueBtn.textContent = "[VALUE]";
    descInsertValueBtn.addEventListener("click", () => {
        insertTextAtCursor(desc, "[VALUE]");
        syncButtons();
    });
    const descInsertChanceBtn = document.createElement("button");
    descInsertChanceBtn.type = "button";
    descInsertChanceBtn.className = "desc-token-btn";
    descInsertChanceBtn.textContent = "[CHANCE]";
    descInsertChanceBtn.addEventListener("click", () => {
        insertTextAtCursor(desc, "[CHANCE]");
        syncButtons();
    });
    iconBtn.addEventListener("mouseenter", event => {
        showEditorDescTooltip(desc.value, event.clientX, event.clientY, effectValue.value, effectChance.value);
    });
    iconBtn.addEventListener("mousemove", event => {
        showEditorDescTooltip(desc.value, event.clientX, event.clientY, effectValue.value, effectChance.value);
    });
    iconBtn.addEventListener("mouseleave", () => {
        hideEditorDescTooltip();
    });
    descField.appendChild(descLabel);
    descField.appendChild(desc);
    const descTokenRow = document.createElement("div");
    descTokenRow.className = "desc-token-row";
    descTokenRow.appendChild(descInsertValueBtn);
    descTokenRow.appendChild(descInsertChanceBtn);
    descField.appendChild(descTokenRow);
    mediaRow.appendChild(descField);
    cardBody.appendChild(mediaRow);

    const passiveWrap = document.createElement("div");
    passiveWrap.className = "mt8";
    const passiveRowOne = document.createElement("div");
    passiveRowOne.className = "stats-row";
    const inferredTriggerTargetRaw = inferTriggerTargetFromEvent(skill.trigger?.event || "")
        || String(skill.trigger?.target || "self").trim().toLowerCase();
    const inferredTriggerTarget = inferredTriggerTargetRaw === "target"
        ? "opponent"
        : (inferredTriggerTargetRaw === "player"
            ? "self"
            : (inferredTriggerTargetRaw === "enemy" ? "opponent" : inferredTriggerTargetRaw));
    const triggerTarget = createSelect(["self", "opponent", "combat", "game"], inferredTriggerTarget);
    const triggerEvent = createSelect([], "", true);
    fillTriggerEventsByTarget(triggerTarget, triggerEvent, getPreferredTriggerSelection(skill.trigger));
    const firstEffect = Array.isArray(skill.effects) && skill.effects[0] && typeof skill.effects[0] === "object" ? skill.effects[0] : {};
    const storedEffectType = String(firstEffect.type || "");
    const parsedEffect = parseStoredEffectType(storedEffectType);
    const inferredStoredEffectBase = inferEffectBaseFromStoredEffect(firstEffect);
    const effectSelect = createSelect(PASSIVE_EFFECT_OPTIONS, inferredStoredEffectBase || parsedEffect.base, true);
    const effectSign = createSelect(EFFECT_SIGN_OPTIONS, parsedEffect.sign || "+");
    const effectValue = createInput(
        String(firstEffect.value ?? ""),
        ""
    );
    effectValue.classList.add("effect-value-input");
    const effectValueType = createSelect(
        EFFECT_VALUE_TYPE_OPTIONS,
        String(firstEffect.valueType || "int")
    );
    effectValueType.classList.add("effect-value-type-select");
    const effectFlagTarget = createSelect([], String(firstEffect.flagKey || ""), true);
    const effectChance = createSelect(
        EFFECT_CHANCE_OPTIONS,
        String(Number.isFinite(Number(firstEffect.chance)) ? Number(firstEffect.chance) : 100)
    );
    effectChance.classList.add("chance-select");
    const applyModeSelect = createSelect(APPLY_MODE_OPTIONS, getApplyModeValue(skill));
    applyModeSelect.title = "Persistent = always active during duration. Conditional = event-triggered only.";
    triggerTarget.title = "Who triggers it.";
    triggerEvent.title = "When it activates.";
    const applyModeField = rowField("mode", applyModeSelect);
    const triggerField = rowField("trigger", triggerTarget);
    const eventField = rowField("event", triggerEvent);
    const applyModeLabel = applyModeField.querySelector(".skill-col-label");
    const triggerLabel = triggerField.querySelector(".skill-col-label");
    const eventLabel = eventField.querySelector(".skill-col-label");
    if (applyModeLabel) applyModeLabel.title = "Persistent = always active during duration. Conditional = event-triggered only.";
    if (triggerLabel) triggerLabel.title = "Who triggers it.";
    if (eventLabel) eventLabel.title = "When it activates.";
    passiveRowOne.appendChild(applyModeField);
    passiveRowOne.appendChild(triggerField);
    passiveRowOne.appendChild(eventField);
    passiveWrap.appendChild(passiveRowOne);
    const passiveRowTwo = document.createElement("div");
    passiveRowTwo.className = "stats-row mt8";
    const effectField = rowField("effect", effectSelect);
    const effectSignField = rowField("+/-", effectSign);
    const effectValueField = rowField("value", effectValue);
    const effectValueTypeField = rowField("type", effectValueType);
    const effectFlagTargetField = rowField("buff", effectFlagTarget);
    const effectFlagTargetLabel = effectFlagTargetField.querySelector(".skill-col-label");
    passiveRowTwo.appendChild(effectField);
    passiveRowTwo.appendChild(effectSignField);
    passiveRowTwo.appendChild(effectValueField);
    passiveRowTwo.appendChild(effectValueTypeField);
    passiveRowTwo.appendChild(effectFlagTargetField);
    passiveRowTwo.appendChild(rowField("chance", effectChance));
    passiveRowTwo.appendChild(rowField("target", target));
    passiveWrap.appendChild(passiveRowTwo);
    const scalingRow = document.createElement("div");
    scalingRow.className = "stats-row mt8";
    const existingScaleEntry =
        Array.isArray(skill.scaling) && skill.scaling[0] && skill.scaling[0].modifiers
            ? skill.scaling[0].modifiers
            : {};
    const hasStoredInput = Object.prototype.hasOwnProperty.call(existingScaleEntry, "effectMultiplierInput");
    const storedMultiplier = Number(existingScaleEntry.effectMultiplier);
    const existingScaleType = hasStoredInput
        ? String(existingScaleEntry.effectMultiplierInputType || "%").trim() === "%" ? "%" : "int"
        : "%";
    const existingScaleValue = hasStoredInput
        ? String(existingScaleEntry.effectMultiplierInput ?? "0")
        : (Number.isFinite(storedMultiplier) ? String(Number(((storedMultiplier - 1) * 100).toFixed(2))) : "0");
    const scalingValue = createInput(existingScaleValue, "");
    scalingValue.classList.add("effect-value-input");
    const scalingValueType = createSelect(EFFECT_VALUE_TYPE_OPTIONS, existingScaleType);
    scalingValueType.classList.add("effect-value-type-select");
    scalingRow.appendChild(rowField("max rank", maxRank));
    scalingRow.appendChild(rowField("scaling value", scalingValue));
    scalingRow.appendChild(rowField("scaling type", scalingValueType));
    passiveWrap.appendChild(scalingRow);
    cardBody.appendChild(passiveWrap);

    const syncPassiveVisibility = () => {
        passiveWrap.classList.toggle("hidden", !shouldShowSkillConfig(skillType.value));
    };
    const syncApplyModeDisabledState = () => {
        const isActive = String(skillType.value || "passive").trim().toLowerCase() === "active";
        setFieldsDisabled(
            [triggerTarget, triggerEvent],
            isActive || String(applyModeSelect.value || "persistent") === "persistent"
        );
    };
    syncPassiveVisibility();
    syncApplyModeBySkillType(skillType.value, applyModeSelect);
    syncEffectSignState(effectSelect, effectSign);
    syncEffectInputMode({
        effectSelectEl: effectSelect,
        effectFlagTargetEl: effectFlagTarget,
        effectFlagTargetLabelEl: effectFlagTargetLabel,
        effectSignWrap: effectSignField,
        effectValueWrap: effectValueField,
        effectValueTypeWrap: effectValueTypeField,
        effectFlagTargetWrap: effectFlagTargetField,
        selectedFlagTarget: String(firstEffect.flagKey || "")
    });
    syncApplyModeDisabledState();

    syncScalingSelector(maxRank, scalingValue, scalingValueType);
    maxRank.addEventListener("input", () => syncScalingSelector(maxRank, scalingValue, scalingValueType));
    maxRank.addEventListener("change", () => syncScalingSelector(maxRank, scalingValue, scalingValueType));
    triggerTarget.addEventListener("change", () => {
        fillTriggerEventsByTarget(triggerTarget, triggerEvent, triggerEvent.value);
        syncButtons();
    });
    effectSelect.addEventListener("change", () => {
        syncEffectSignState(effectSelect, effectSign);
        syncEffectInputMode({
            effectSelectEl: effectSelect,
            effectFlagTargetEl: effectFlagTarget,
            effectFlagTargetLabelEl: effectFlagTargetLabel,
            effectSignWrap: effectSignField,
            effectValueWrap: effectValueField,
            effectValueTypeWrap: effectValueTypeField,
            effectFlagTargetWrap: effectFlagTargetField
        });
        syncButtons();
    });
    effectSign.addEventListener("change", syncButtons);
    skillType.addEventListener("change", () => {
        applySkillIconTypeClass(iconBtn, skillType.value);
        syncPassiveVisibility();
        syncApplyModeBySkillType(skillType.value, applyModeSelect);
        syncApplyModeDisabledState();
        syncButtons();
    });
    applyModeSelect.addEventListener("change", () => {
        syncApplyModeDisabledState();
        syncButtons();
    });

    const getPayload = () => buildPayload({
        name: name.value,
        image: iconPreview.dataset.skillPath || "",
        skillType: skillType.value,
        triggerTarget: triggerTarget.value,
        triggerEvent: triggerEvent.value,
        applyMode: applyModeSelect.value,
        effectSelect: effectSelect.value,
        effectSign: effectSign.value,
        effectValue: effectValue.value,
        effectValueType: effectValueType.value,
        effectFlagTarget: effectFlagTarget.value,
        effectChance: effectChance.value,
        target: target.value,
        maxRank: maxRank.value,
        scalingValue: scalingValue.value,
        scalingValueType: scalingValueType.value,
        durationTurns: durationTurns.value,
        desc: desc.value
    });

    const original = JSON.stringify(getPayload());
    const actions = document.createElement("div");
    actions.className = "enemy-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.disabled = true;
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset";
    resetBtn.disabled = true;
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger";
    deleteBtn.textContent = "Delete";

    function syncButtons() {
        let dirty = false;
        try {
            dirty = JSON.stringify(getPayload()) !== original;
        } catch (_) {
            dirty = true;
        }
        saveBtn.disabled = !dirty;
        resetBtn.disabled = !dirty;
    }

    saveBtn.addEventListener("click", async () => {
        try {
            const payload = getPayload();
            const validationError = validateSkillPayload(payload);
            if (validationError) throw new Error(validationError);
            await updateSkill(skill.skillType, skill.id, payload);
            await refresh();
            setStatus("Skill saved.", "success");
        } catch (error) {
            setStatus(error.message, "error");
        }
    });

    resetBtn.addEventListener("click", async () => {
        await refresh();
        setStatus("Skill changes reset.", "muted");
    });

    deleteBtn.addEventListener("click", async () => {
        const ok = window.confirm(`Delete ${skill.skillType} skill '${skill.id}'?`);
        if (!ok) return;
        try {
            await deleteSkill(skill.skillType, skill.id);
            await refresh();
            setStatus("Skill deleted.", "success");
        } catch (error) {
            setStatus(error.message, "error");
        }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(deleteBtn);
    cardBody.appendChild(actions);
    card.appendChild(cardBody);

    [name, skillType, triggerTarget, triggerEvent, applyModeSelect, effectSelect, effectSign, effectValue, effectValueType, effectFlagTarget, effectChance, target, maxRank, scalingValue, scalingValueType, durationTurns, desc].forEach(field => {
        field.addEventListener("input", syncButtons);
        field.addEventListener("change", syncButtons);
    });
    iconBtn.addEventListener("click", () => {
        openIconPicker(iconPreview.getAttribute("src") || "", nextPath => {
            setIconPreview(iconPreview, iconFallback, nextPath);
            syncButtons();
        });
    });

    collapseBtn.addEventListener("click", () => {
        const willCollapse = !cardBody.classList.contains("hidden");
        setCollapsed(willCollapse);
    });

    card.__setCollapsed = setCollapsed;

    return card;
}

function render() {
    if (!el.skillList) return;
    el.skillList.innerHTML = "";
    const filterType = String(state.activeFilter || "all").trim().toLowerCase();
    const sorted = [...state.skills]
        .filter(skill => {
            if (filterType === "all") return true;
            return String(skill && skill.skillType || "").trim().toLowerCase() === filterType;
        })
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    sorted.forEach(skill => el.skillList.appendChild(renderCard(skill)));
    if (el.skillsCount) {
        const filterLabel = filterType === "all" ? "all" : filterType;
        el.skillsCount.textContent = `Loaded ${sorted.length} / ${state.skills.length} skills (${filterLabel}).`;
    }
}

function syncFilterButtons() {
    const filterType = String(state.activeFilter || "all").trim().toLowerCase();
    const counts = {
        all: state.skills.length,
        active: state.skills.filter(skill => String(skill && skill.skillType || "").trim().toLowerCase() === "active").length,
        passive: state.skills.filter(skill => String(skill && skill.skillType || "").trim().toLowerCase() === "passive").length,
        buff: state.skills.filter(skill => String(skill && skill.skillType || "").trim().toLowerCase() === "buff").length,
        debuff: state.skills.filter(skill => String(skill && skill.skillType || "").trim().toLowerCase() === "debuff").length
    };
    const map = [
        { key: "all", label: "All", el: el.skillsFilterAllBtn },
        { key: "active", label: "Active", el: el.skillsFilterActiveBtn },
        { key: "passive", label: "Passive", el: el.skillsFilterPassiveBtn },
        { key: "buff", label: "Buff", el: el.skillsFilterBuffBtn },
        { key: "debuff", label: "Debuff", el: el.skillsFilterDebuffBtn }
    ];
    map.forEach(entry => {
        if (!entry.el) return;
        entry.el.textContent = `${entry.label} (${counts[entry.key] ?? 0})`;
        const isActive = entry.key === filterType;
        entry.el.classList.toggle("dirty", isActive);
        entry.el.disabled = isActive;
    });
}

function setSkillsFilter(filterType = "all") {
    const normalized = String(filterType || "all").trim().toLowerCase();
    const allowed = new Set(["all", "active", "passive", "buff", "debuff"]);
    state.activeFilter = allowed.has(normalized) ? normalized : "all";
    const scrollTop = window.scrollY;
    syncFilterButtons();
    render();
    window.scrollTo(0, scrollTop);
}

function setAllSkillCardsCollapsed(collapsed) {
    if (!el.skillList) return;
    Array.from(el.skillList.querySelectorAll(".skill-card")).forEach(card => {
        if (typeof card.__setCollapsed === "function") {
            card.__setCollapsed(collapsed);
        }
    });
}

function resetAddForm() {
    if (el.newName) el.newName.value = "";
    if (el.newDesc) el.newDesc.value = "";
    if (el.newMaxRank) el.newMaxRank.value = "1";
    if (el.newScalingValue) el.newScalingValue.value = "0";
    if (el.newScalingValueType) el.newScalingValueType.value = "int";
    if (el.newDurationTurns) el.newDurationTurns.value = "0";
    if (el.newSkillType) el.newSkillType.value = "passive";
    if (el.newTriggerTarget) el.newTriggerTarget.value = "player";
    if (el.newApplyMode) el.newApplyMode.value = "persistent";
    if (el.newTarget) el.newTarget.value = "self";
    if (el.newTriggerEvent) el.newTriggerEvent.value = "";
    if (el.newEffectSelect) el.newEffectSelect.value = "";
    if (el.newEffectSign) el.newEffectSign.value = "+";
    if (el.newEffectValue) el.newEffectValue.value = "";
    if (el.newEffectValueType) el.newEffectValueType.value = "int";
    if (el.newEffectFlagTarget) el.newEffectFlagTarget.value = "";
    if (el.newEffectChance) el.newEffectChance.value = "100";
    setIconPreview(el.newIconPreview, el.newIconFallback, "");
    syncScalingSelector(el.newMaxRank, el.newScalingValue, el.newScalingValueType);
    syncApplyModeBySkillType(el.newSkillType && el.newSkillType.value, el.newApplyMode);
    setFieldsDisabled(
        [el.newTriggerTarget, el.newTriggerEvent],
        String(el.newApplyMode && el.newApplyMode.value || "persistent") === "persistent"
    );
    syncEffectSignState(el.newEffectSelect, el.newEffectSign);
    syncEffectInputMode({
        effectSelectEl: el.newEffectSelect,
        effectFlagTargetEl: el.newEffectFlagTarget,
        effectFlagTargetLabelEl: el.newEffectFlagTarget && el.newEffectFlagTarget.closest(".stats-field") && el.newEffectFlagTarget.closest(".stats-field").querySelector(".skill-col-label"),
        effectSignWrap: el.newEffectSign && el.newEffectSign.closest(".stats-field"),
        effectValueWrap: el.newEffectValue && el.newEffectValue.closest(".stats-field"),
        effectValueTypeWrap: el.newEffectValueType && el.newEffectValueType.closest(".stats-field"),
        effectFlagTargetWrap: el.newEffectFlagTarget && el.newEffectFlagTarget.closest(".stats-field")
    });
    togglePassiveConfig("passive");
}

async function refresh() {
    await Promise.all([loadSkills(), loadSkillIcons()]);
    fillSelect(el.newSkillType, state.metadata.skillTypeOptions, { selected: "passive" });
    applySkillIconTypeClass(el.newIconBtn, el.newSkillType && el.newSkillType.value);
    fillSelect(el.newTarget, SKILL_TARGET_OPTIONS_UI, { selected: "self" });
    fillSelect(
        el.newTriggerTarget,
        [
            "self",
            { value: "opponent", label: "opponent" },
            "combat",
            "game"
        ],
        { selected: "self" }
    );
    fillSelect(el.newApplyMode, APPLY_MODE_OPTIONS, { selected: "persistent" });
    fillTriggerEventsByTarget(el.newTriggerTarget, el.newTriggerEvent);
    fillSelect(el.newMaxRank, MAX_RANK_OPTIONS, { selected: "1" });
    if (el.newScalingValue) el.newScalingValue.value = "0";
    fillSelect(el.newScalingValueType, EFFECT_VALUE_TYPE_OPTIONS, { selected: "int" });
    fillSelect(el.newEffectSelect, PASSIVE_EFFECT_OPTIONS, { allowEmpty: true });
    fillSelect(el.newEffectSign, EFFECT_SIGN_OPTIONS, { selected: "+" });
    fillSelect(el.newEffectValueType, EFFECT_VALUE_TYPE_OPTIONS, { selected: "int" });
    fillSelect(el.newEffectFlagTarget, [], { allowEmpty: true });
    fillSelect(el.newEffectChance, EFFECT_CHANCE_OPTIONS, { selected: "100" });
    syncScalingSelector(el.newMaxRank, el.newScalingValue, el.newScalingValueType);
    render();
}

function closeIconPicker() {
    if (!el.iconModal) return;
    el.iconModal.classList.add("hidden");
    if (el.iconGrid) el.iconGrid.innerHTML = "";
    state.iconPickerOnSelect = null;
}

function openIconPicker(selectedPath, onSelect) {
    if (!el.iconModal || !el.iconGrid) return;
    state.iconPickerOnSelect = typeof onSelect === "function" ? onSelect : null;
    el.iconGrid.innerHTML = "";
    const selected = toStoredSkillIconPath(selectedPath);
    state.skillIcons.forEach(iconPath => {
        const iconStoredPath = toStoredSkillIconPath(iconPath);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "skill-icon-option";
        if (selected && selected === iconStoredPath) button.classList.add("dirty");
        const img = document.createElement("img");
        img.src = toPreviewSkillIconUrl(iconStoredPath);
        img.className = "skill-icon-img";
        img.alt = iconStoredPath;
        button.appendChild(img);
        button.addEventListener("click", () => {
            if (state.iconPickerOnSelect) state.iconPickerOnSelect(iconStoredPath);
            closeIconPicker();
        });
        el.iconGrid.appendChild(button);
    });
    el.iconModal.classList.remove("hidden");
}

async function init() {
    if (el.newDescInsertValueBtn && el.newDesc) {
        el.newDescInsertValueBtn.addEventListener("click", () => {
            insertTextAtCursor(el.newDesc, "[VALUE]");
        });
    }
    if (el.newDescInsertChanceBtn && el.newDesc) {
        el.newDescInsertChanceBtn.addEventListener("click", () => {
            insertTextAtCursor(el.newDesc, "[CHANCE]");
        });
    }
    if (el.newIconBtn && el.newDesc) {
        el.newIconBtn.addEventListener("mouseenter", event => {
            showEditorDescTooltip(
                el.newDesc.value,
                event.clientX,
                event.clientY,
                el.newEffectValue && el.newEffectValue.value,
                el.newEffectChance && el.newEffectChance.value
            );
        });
        el.newIconBtn.addEventListener("mousemove", event => {
            showEditorDescTooltip(
                el.newDesc.value,
                event.clientX,
                event.clientY,
                el.newEffectValue && el.newEffectValue.value,
                el.newEffectChance && el.newEffectChance.value
            );
        });
        el.newIconBtn.addEventListener("mouseleave", () => {
            hideEditorDescTooltip();
        });
    }
    if (el.newIconBtn) {
        el.newIconBtn.addEventListener("click", () => {
            openIconPicker(el.newIconPreview?.getAttribute("src") || "", nextPath => {
                setIconPreview(el.newIconPreview, el.newIconFallback, nextPath);
            });
        });
    }
    if (el.iconCloseBtn) el.iconCloseBtn.addEventListener("click", closeIconPicker);
    if (el.iconClearBtn) {
        el.iconClearBtn.addEventListener("click", () => {
            if (state.iconPickerOnSelect) state.iconPickerOnSelect("");
            closeIconPicker();
        });
    }
    if (el.iconModal) {
        el.iconModal.addEventListener("click", event => {
            if (event.target === el.iconModal) closeIconPicker();
        });
    }
    if (el.newSkillType) {
        el.newSkillType.addEventListener("change", () => {
            applySkillIconTypeClass(el.newIconBtn, el.newSkillType.value);
            togglePassiveConfig(el.newSkillType.value);
            syncApplyModeBySkillType(el.newSkillType.value, el.newApplyMode);
            setFieldsDisabled(
                [el.newTriggerTarget, el.newTriggerEvent],
                String(el.newSkillType.value || "").trim().toLowerCase() === "active"
                    || String(el.newApplyMode && el.newApplyMode.value || "persistent") === "persistent"
            );
        });
    }
    if (el.newTriggerTarget) {
        el.newTriggerTarget.addEventListener("change", () => {
            fillTriggerEventsByTarget(el.newTriggerTarget, el.newTriggerEvent, el.newTriggerEvent && el.newTriggerEvent.value);
        });
    }
    if (el.newEffectSelect) {
        el.newEffectSelect.addEventListener("change", () => {
            syncEffectSignState(el.newEffectSelect, el.newEffectSign);
            syncEffectInputMode({
                effectSelectEl: el.newEffectSelect,
                effectFlagTargetEl: el.newEffectFlagTarget,
                effectFlagTargetLabelEl: el.newEffectFlagTarget && el.newEffectFlagTarget.closest(".stats-field") && el.newEffectFlagTarget.closest(".stats-field").querySelector(".skill-col-label"),
                effectSignWrap: el.newEffectSign && el.newEffectSign.closest(".stats-field"),
                effectValueWrap: el.newEffectValue && el.newEffectValue.closest(".stats-field"),
                effectValueTypeWrap: el.newEffectValueType && el.newEffectValueType.closest(".stats-field"),
                effectFlagTargetWrap: el.newEffectFlagTarget && el.newEffectFlagTarget.closest(".stats-field")
            });
        });
    }
    if (el.newApplyMode) {
        el.newApplyMode.addEventListener("change", () => {
            setFieldsDisabled(
                [el.newTriggerTarget, el.newTriggerEvent],
                String(el.newApplyMode.value || "persistent") === "persistent"
            );
        });
    }
    if (el.newMaxRank) {
        const update = () => syncScalingSelector(el.newMaxRank, el.newScalingValue, el.newScalingValueType);
        el.newMaxRank.addEventListener("input", update);
        el.newMaxRank.addEventListener("change", update);
    }
    if (el.addBtn) {
        el.addBtn.addEventListener("click", async () => {
            try {
                const payload = getNewPayload();
                const validationError = validateSkillPayload(payload);
                if (validationError) throw new Error(validationError);
                const created = await createSkill(payload);
                await refresh();
                resetAddForm();
                setStatus(`Created '${created && created.id ? created.id : payload.name}'.`, "success");
            } catch (error) {
                setStatus(error.message, "error");
            }
        });
    }
    if (el.skillsOpenAllBtn) {
        el.skillsOpenAllBtn.addEventListener("click", () => {
            setAllSkillCardsCollapsed(false);
        });
    }
    if (el.skillsCloseAllBtn) {
        el.skillsCloseAllBtn.addEventListener("click", () => {
            setAllSkillCardsCollapsed(true);
        });
    }
    if (el.skillsFilterAllBtn) el.skillsFilterAllBtn.addEventListener("click", () => setSkillsFilter("all"));
    if (el.skillsFilterActiveBtn) el.skillsFilterActiveBtn.addEventListener("click", () => setSkillsFilter("active"));
    if (el.skillsFilterPassiveBtn) el.skillsFilterPassiveBtn.addEventListener("click", () => setSkillsFilter("passive"));
    if (el.skillsFilterBuffBtn) el.skillsFilterBuffBtn.addEventListener("click", () => setSkillsFilter("buff"));
    if (el.skillsFilterDebuffBtn) el.skillsFilterDebuffBtn.addEventListener("click", () => setSkillsFilter("debuff"));
    try {
        await refresh();
        resetAddForm();
        setSkillsFilter(state.activeFilter || "all");
        setStatus("");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

init();
