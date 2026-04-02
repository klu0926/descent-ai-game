const TEMP_ICON_OPTIONS = [
    { value: "\uD83D\uDCE6", label: "\uD83D\uDCE6 box" },
    { value: "\uD83C\uDF56", label: "\uD83C\uDF56 food" },
    { value: "\uD83E\uDDEA", label: "\uD83E\uDDEA potion" },
    { value: "\uD83E\uDE96", label: "\uD83E\uDE96 helmet" },
    { value: "\uD83E\uDDBA", label: "\uD83E\uDDBA armor" },
    { value: "\uD83D\uDC5F", label: "\uD83D\uDC5F shoes" },
    { value: "\uD83E\uDDE4", label: "\uD83E\uDDE4 glove" },
    { value: "\u2694\uFE0F", label: "\u2694\uFE0F weapon" },
    { value: "\uD83D\uDC8D", label: "\uD83D\uDC8D ring" }
];
const BOX_ICON = "\uD83D\uDCE6";
const DEFAULT_ITEM_TYPE_OPTIONS = ["consumable", "material", "quest", "misc"];
const DEFAULT_CONSUMABLE_TYPE_OPTIONS = ["healing", "buff", "utility", "none"];
const DEFAULT_GEAR_TYPE_OPTIONS = ["weapon", "armor", "accessory"];
const DEFAULT_GEAR_SLOT_OPTIONS = ["helmet", "body", "shoes", "hands", "weapon", "relic"];
const CHARACTER_STAT_KEYS = ["hp", "atk", "def", "crit", "dodge", "aim"];

const state = {
    items: [],
    gears: [],
    records: [],
    dirty: new Map(),
    pendingImages: new Map(),
    addImageFile: null,
    pendingDelete: null,
    activeImageJobs: 0,
    filterMode: "all",
    sortMode: "name",
    metadata: {
        itemTypeOptions: DEFAULT_ITEM_TYPE_OPTIONS.slice(),
        consumableTypeOptions: DEFAULT_CONSUMABLE_TYPE_OPTIONS.slice(),
        gearTypeOptions: DEFAULT_GEAR_TYPE_OPTIONS.slice(),
        gearSlotOptions: DEFAULT_GEAR_SLOT_OPTIONS.slice()
    }
};

const el = {
    status: document.getElementById("items-status"),
    filterBar: document.getElementById("entry-filter-bar"),
    panelList: document.getElementById("entry-panel-list"),
    newName: document.getElementById("new-name"),
    newTempIcon: document.getElementById("new-temp-icon"),
    newPrice: document.getElementById("new-price"),
    newKind: document.getElementById("new-kind"),
    newSubtypeWrap: document.getElementById("new-subtype-wrap"),
    newSubtypeLabel: document.getElementById("new-subtype-label"),
    newSubtype: document.getElementById("new-subtype"),
    newStoryDesc: document.getElementById("new-story-desc"),
    newFunctionDesc: document.getElementById("new-function-desc"),
    newStatHp: document.getElementById("new-stat-hp"),
    newStatAtk: document.getElementById("new-stat-atk"),
    newStatDef: document.getElementById("new-stat-def"),
    newStatCrit: document.getElementById("new-stat-crit"),
    newStatDodge: document.getElementById("new-stat-dodge"),
    newStatAim: document.getElementById("new-stat-aim"),
    newConsumableEffects: document.getElementById("new-consumable-effects"),
    newHealAmount: document.getElementById("new-heal-amount"),
    newHealPercent: document.getElementById("new-heal-percent"),
    newEffectMode: document.getElementById("new-effect-mode"),
    newEffectTurnWrap: document.getElementById("new-effect-turn-wrap"),
    newEffectTurns: document.getElementById("new-effect-turns"),
    newEffectRoundWrap: document.getElementById("new-effect-round-wrap"),
    newEffectRounds: document.getElementById("new-effect-rounds"),
    newImagePickerBtn: document.getElementById("new-image-picker-btn"),
    newImagePickerText: document.getElementById("new-image-picker-text"),
    newImagePreview: document.getElementById("new-image-preview"),
    newImageInput: document.getElementById("new-image-input"),
    addBtn: document.getElementById("add-entry-btn"),
    addWarning: document.getElementById("add-entry-warning"),
    addSuccessModal: document.getElementById("add-success-modal"),
    addSuccessMessage: document.getElementById("add-success-message"),
    addSuccessClose: document.getElementById("add-success-close"),
    deleteModal: document.getElementById("entry-delete-modal"),
    deleteMessage: document.getElementById("entry-delete-message"),
    deleteCancelBtn: document.getElementById("entry-delete-cancel-btn"),
    deleteConfirmBtn: document.getElementById("entry-delete-confirm-btn"),
    imageProcessingOverlay: document.getElementById("image-processing-overlay"),
    processingOverlayText: document.getElementById("processing-overlay-text"),
    processingProgressFill: document.getElementById("processing-progress-fill"),
    processingProgressLabel: document.getElementById("processing-progress-label")
};

const itemHoverTooltip = document.createElement("div");
itemHoverTooltip.className = "info-tooltip hidden";
document.body.appendChild(itemHoverTooltip);

function status(msg, kind = "muted") {
    if (!el.status) return;
    el.status.textContent = msg;
    el.status.className = kind === "muted" ? "muted mt8" : `muted mt8 status-${kind}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatItemStats(stats) {
    if (!stats || typeof stats !== "object") return "";
    const parts = Object.entries(stats)
        .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 0)
        .map(([key, value]) => `${String(key).toUpperCase()} ${Number(value) > 0 ? "+" : ""}${Number(value)}`);
    return parts.length > 0 ? parts.join(" | ") : "";
}

function formatConsumableEffectText(entry) {
    if (!entry || typeof entry !== "object") return "";
    const parts = [];
    const healAmount = Number.parseInt(String(entry.healAmount ?? "").trim(), 10);
    const healPercentRaw = Number(entry.healPercent);
    if (Number.isFinite(healAmount) && healAmount > 0) {
        parts.push(`Healing Amount: +${healAmount} HP`);
    }
    if (Number.isFinite(healPercentRaw) && healPercentRaw > 0) {
        parts.push(`Healing %: ${Math.round(healPercentRaw * 100)}%`);
    }
    return parts.join(" | ");
}

function buildItemHoverCardHtml(entry) {
    if (!entry || typeof entry !== "object") return "";
    const itemName = escapeHtml(entry.name || "");
    const rarity = escapeHtml(entry.rarity || "common");
    const statsText = escapeHtml(formatItemStats(entry.stats));
    const descText = escapeHtml(entry.storyDesc || entry.desc || "");
    const consumableEffectText = escapeHtml(formatConsumableEffectText(entry));
    const isConsumable = String(entry.rewardType || "").toLowerCase() === "consumable"
        || String(entry.itemType || "").toLowerCase() === "consumable"
        || String(entry.type || "").toLowerCase() === "consumable";
    const useHint = isConsumable
        ? `<div style="margin-top: 8px; color: #eab308; font-size: 0.95rem;">Right-click this item to use.</div>`
        : "";
    const passives = Array.isArray(entry.passives) ? entry.passives : [];
    const passivesHtml = passives.map(passive => {
        if (passive && typeof passive === "object") {
            const pName = escapeHtml(passive.name || "Passive");
            const pDesc = escapeHtml(passive.desc || "");
            return `<div style="margin-top: 5px; font-size: 0.9rem;">&#10024; <strong style="color:#eab308;">${pName}</strong>${pDesc ? `: ${pDesc}` : ""}</div>`;
        }
        const text = escapeHtml(String(passive || "").trim());
        if (!text) return "";
        return `<div style="margin-top: 5px; font-size: 0.9rem;">&#10024; <strong style="color:#eab308;">${text}</strong></div>`;
    }).join("");

    return `
        ${itemName ? `<div class="slot-item-name rarity-${rarity}" style="font-size: 1.2rem; border-bottom: 1px solid var(--border-gold-dim, #5c4727); padding-bottom: 5px; margin-bottom: 8px;">${itemName}</div>` : ""}
        ${descText ? `<div class="slot-item-desc" style="color: #ffffff; font-size: 1rem; line-height: 1.4;">${descText}</div>` : ""}
        ${statsText ? `<div class="slot-item-stats" style="font-size: 0.9rem; color: var(--text-green, #86efac); margin-top: 6px; margin-bottom: 8px;">${statsText}</div>` : ""}
        ${consumableEffectText ? `<div class="slot-item-stats" style="font-size: 0.9rem; color: var(--text-green, #86efac); margin-top: 6px;">${consumableEffectText}</div>` : ""}
        ${useHint}
        ${passivesHtml ? `<div style="line-height: 1.4;">${passivesHtml}</div>` : ""}
    `;
}

function showItemHoverTooltip(entry, x, y) {
    if (!itemHoverTooltip) return;
    itemHoverTooltip.innerHTML = buildItemHoverCardHtml(entry);
    itemHoverTooltip.classList.remove("hidden");
    const width = itemHoverTooltip.offsetWidth || 340;
    const height = itemHoverTooltip.offsetHeight || 180;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 720;
    const desiredLeft = x + 16;
    const desiredTop = y + 12;
    const left = Math.min(desiredLeft, viewportW - width - 12);
    const top = Math.min(desiredTop, viewportH - height - 12);
    itemHoverTooltip.style.left = `${Math.max(12, left)}px`;
    itemHoverTooltip.style.top = `${Math.max(12, top)}px`;
}

function hideItemHoverTooltip() {
    if (!itemHoverTooltip) return;
    itemHoverTooltip.classList.add("hidden");
}

function normalizeKind(kind) {
    return String(kind || "item").toLowerCase() === "gear" ? "gear" : "item";
}

function collectionForKind(kind) {
    return normalizeKind(kind) === "gear" ? "gears" : "items";
}

function endpointFor(kind, id = "") {
    const collection = collectionForKind(kind);
    return `/api/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

function imageEndpointFor(kind, id) {
    return `${endpointFor(kind, id)}/image`;
}

function recordKey(kind, id) {
    return `${normalizeKind(kind)}:${String(id || "")}`;
}

function parsePrice(input, fallback = 0) {
    const parsed = Number.parseInt(String(input ?? "").trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    const safeFallback = Number.parseInt(String(fallback ?? "").trim(), 10);
    return Number.isFinite(safeFallback) && safeFallback >= 0 ? safeFallback : 0;
}

function setProgress(percent, text = "Processing image...") {
    const value = Math.max(0, Math.min(100, Math.floor(percent)));
    if (el.processingOverlayText) el.processingOverlayText.textContent = text;
    if (el.processingProgressFill) el.processingProgressFill.style.width = `${value}%`;
    if (el.processingProgressLabel) el.processingProgressLabel.textContent = `${value}%`;
}

function toggleOverlay() {
    if (!el.imageProcessingOverlay) return;
    const busy = state.activeImageJobs > 0;
    el.imageProcessingOverlay.classList.toggle("hidden", !busy);
    el.imageProcessingOverlay.setAttribute("aria-hidden", busy ? "false" : "true");
    if (!busy) setProgress(0);
}

function populateTempIconSelect(selectEl, selectedValue = BOX_ICON) {
    if (!selectEl) return;
    const target = String(selectedValue || BOX_ICON);
    selectEl.innerHTML = "";
    TEMP_ICON_OPTIONS.forEach(icon => {
        const option = document.createElement("option");
        option.value = icon.value;
        option.textContent = icon.label;
        if (icon.value === target) option.selected = true;
        selectEl.appendChild(option);
    });
    if (!TEMP_ICON_OPTIONS.some(icon => icon.value === target)) {
        const fallback = document.createElement("option");
        fallback.value = target;
        fallback.textContent = `${target} custom`;
        fallback.selected = true;
        selectEl.appendChild(fallback);
    }
}

function populateSelectFromOptions(selectEl, options, selectedValue = "", { allowCustom = true } = {}) {
    if (!selectEl) return;
    const list = Array.isArray(options) ? options.map(option => String(option || "").trim()).filter(Boolean) : [];
    const safeOptions = list.length > 0 ? list : [String(selectedValue || "").trim()].filter(Boolean);
    const fallback = safeOptions.length > 0 ? safeOptions[0] : "none";
    const target = String(selectedValue || fallback || "").trim();
    selectEl.innerHTML = "";
    safeOptions.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        if (value === target) option.selected = true;
        selectEl.appendChild(option);
    });
    if (allowCustom && !safeOptions.includes(target) && target) {
        const option = document.createElement("option");
        option.value = target;
        option.textContent = target;
        option.selected = true;
        selectEl.appendChild(option);
    }
}

function renderAddTypeOptions() {
    const kind = normalizeKind(el.newKind && el.newKind.value || "item");
    if (kind === "gear") {
        if (el.newSubtypeLabel) el.newSubtypeLabel.textContent = "gear type";
        populateSelectFromOptions(
            el.newSubtype,
            state.metadata.gearSlotOptions,
            normalizeGearSlotFamily(el.newSubtype && el.newSubtype.value || "body"),
            { allowCustom: false }
        );
        return;
    }
    if (el.newSubtypeLabel) el.newSubtypeLabel.textContent = "item type";
    populateSelectFromOptions(el.newSubtype, state.metadata.itemTypeOptions, el.newSubtype && el.newSubtype.value || "consumable");
}

function inferGearTypeFromSlot(slotType) {
    const slot = String(slotType || "").trim().toLowerCase();
    if (slot === "weapon" || slot.startsWith("weapon_")) return "weapon";
    if (slot === "relic" || slot.startsWith("relic_")) return "accessory";
    return "armor";
}

function normalizeGearSlotFamily(slotType) {
    const slot = String(slotType || "").trim().toLowerCase();
    if (slot === "weapon" || slot === "weapon_1" || slot === "weapon_2") return "weapon";
    if (slot === "relic" || slot === "relic_1" || slot === "relic_2") return "relic";
    if (slot === "helmet" || slot === "body" || slot === "shoes" || slot === "hands") return slot;
    return "body";
}

function syncAddTypeVisibility() {
    if (el.newSubtypeWrap) el.newSubtypeWrap.classList.remove("hidden");
    renderAddTypeOptions();
    syncAddConsumableVisibility();
}

function setAddImage(file) {
    state.addImageFile = file || null;
    if (!file) {
        if (el.newImageInput) el.newImageInput.value = "";
        if (el.newImagePreview) {
            el.newImagePreview.src = "";
            el.newImagePreview.classList.add("hidden");
        }
        if (el.newImagePickerText) {
            el.newImagePickerText.classList.remove("hidden");
            el.newImagePickerText.textContent = "click to import image";
        }
        return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (el.newImagePreview) {
        el.newImagePreview.src = objectUrl;
        el.newImagePreview.classList.remove("hidden");
    }
    if (el.newImagePickerText) el.newImagePickerText.classList.add("hidden");
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const value = String(reader.result || "");
            resolve(value.includes(",") ? value.split(",")[1] : "");
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
    });
}

async function uploadImage(kind, entryId, file) {
    if (!file) return null;
    state.activeImageJobs += 1;
    toggleOverlay();
    setProgress(5, "Reading image...");
    try {
        const dataBase64 = await fileToBase64(file);
        const payload = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", imageEndpointFor(kind, entryId), true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.upload.onprogress = event => {
                if (!event.lengthComputable || event.total <= 0) return;
                setProgress((event.loaded / event.total) * 85, "Uploading image...");
            };
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== XMLHttpRequest.DONE) return;
                let body = {};
                try { body = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (_) {}
                if (xhr.status >= 200 && xhr.status < 300) resolve(body);
                else reject(new Error(body.error || "Image upload failed."));
            };
            xhr.onerror = () => reject(new Error("Image upload failed."));
            xhr.send(JSON.stringify({ filename: file.name, dataBase64 }));
        });

        setProgress(100, "Done");
        const compression = payload && payload.compression;
        if (compression && compression.enabled && compression.compressed) {
            status(`Image updated for '${entryId}'. TinyPNG compressed ${compression.originalBytes} -> ${compression.savedBytes} bytes.`, "ok");
        } else if (compression && !compression.enabled) {
            status(`Image updated for '${entryId}'. TinyPNG disabled.`, "ok");
        } else {
            status(`Image updated for '${entryId}'.`, "ok");
        }
        return payload;
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        toggleOverlay();
    }
}

async function openImageInFolder(imagePath) {
    const response = await fetch("/api/open-in-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: imagePath })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to open folder.");
    return payload;
}

function getAddErrors() {
    const errors = [];
    if (!state.addImageFile) errors.push("Image");
    if (!String(el.newName && el.newName.value || "").trim()) errors.push("Name");
    return errors;
}

function refreshAddValidation(showErrors = false) {
    const errors = getAddErrors();
    if (!el.addWarning) return errors.length === 0;
    if (!showErrors || errors.length === 0) {
        el.addWarning.textContent = "";
        el.addWarning.classList.add("hidden");
        return true;
    }
    el.addWarning.textContent = `Missing required fields: ${errors.join(", ")}`;
    el.addWarning.classList.remove("hidden");
    return false;
}

async function loadData() {
    const response = await fetch("/api/items-gears", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load items/gears.");
    const metadata = payload && typeof payload === "object" ? payload.metadata || {} : {};
    state.metadata = {
        itemTypeOptions: Array.isArray(metadata.itemTypeOptions) && metadata.itemTypeOptions.length ? metadata.itemTypeOptions : DEFAULT_ITEM_TYPE_OPTIONS.slice(),
        consumableTypeOptions: Array.isArray(metadata.consumableTypeOptions) && metadata.consumableTypeOptions.length ? metadata.consumableTypeOptions : DEFAULT_CONSUMABLE_TYPE_OPTIONS.slice(),
        gearTypeOptions: Array.isArray(metadata.gearTypeOptions) && metadata.gearTypeOptions.length ? metadata.gearTypeOptions : DEFAULT_GEAR_TYPE_OPTIONS.slice(),
        gearSlotOptions: Array.isArray(metadata.gearSlotOptions) && metadata.gearSlotOptions.length ? metadata.gearSlotOptions : DEFAULT_GEAR_SLOT_OPTIONS.slice()
    };
    renderAddTypeOptions();
    syncAddTypeVisibility();

    state.items = Array.isArray(payload.items) ? payload.items : [];
    state.gears = Array.isArray(payload.gears) ? payload.gears : [];
    state.records = [
        ...state.items.map(item => ({ ...item, kind: "item" })),
        ...state.gears.map(gear => ({ ...gear, kind: "gear" }))
    ];

    renderFilters();
    renderCards();
    status(`Loaded ${state.items.length} items and ${state.gears.length} gears.`, "ok");
}

function renderFilters() {
    if (!el.filterBar) return;
    el.filterBar.innerHTML = "";

    const makeBtn = (label, active, onClick) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `enemy-sort-btn${active ? " is-active" : ""}`;
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
    };

    const filters = [
        { key: "all", label: `all (${state.records.length})` },
        { key: "items", label: `items (${state.items.length})` },
        { key: "gears", label: `gears (${state.gears.length})` }
    ];
    filters.forEach(filter => {
        el.filterBar.appendChild(makeBtn(filter.label, state.filterMode === filter.key, () => {
            state.filterMode = filter.key;
            renderFilters();
            renderCards();
        }));
    });

    el.filterBar.appendChild(makeBtn("sort name", state.sortMode === "name", () => {
        state.sortMode = "name";
        renderFilters();
        renderCards();
    }));
    el.filterBar.appendChild(makeBtn("sort implemented", state.sortMode === "implemented", () => {
        state.sortMode = "implemented";
        renderFilters();
        renderCards();
    }));
}

function getVisibleRecords() {
    let list = state.records.slice();
    if (state.filterMode === "items") list = list.filter(entry => entry.kind === "item");
    if (state.filterMode === "gears") list = list.filter(entry => entry.kind === "gear");

    if (state.sortMode === "implemented") {
        list.sort((a, b) => {
            const aImplemented = Boolean(a.implemented);
            const bImplemented = Boolean(b.implemented);
            if (aImplemented !== bImplemented) return aImplemented ? -1 : 1;
            return String(a.name || "").localeCompare(String(b.name || ""));
        });
    } else {
        list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    return list;
}

function valuesEqualForDirty(nextValue, originalValue) {
    const a = nextValue;
    const b = originalValue;
    if (a && typeof a === "object" && b && typeof b === "object") {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
    if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
    return String(a ?? "") === String(b ?? "");
}

function parseIntLoose(value, fallback = 0, min = Number.NEGATIVE_INFINITY) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
}

function parseFloatLoose(value, fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeStatsFromObject(stats) {
    const source = stats && typeof stats === "object" ? stats : {};
    const normalized = {};
    CHARACTER_STAT_KEYS.forEach(statKey => {
        normalized[statKey] = parseIntLoose(source[statKey], 0);
    });
    return normalized;
}

function readStatsFromAddForm() {
    return {
        hp: parseIntLoose(el.newStatHp && el.newStatHp.value, 0),
        atk: parseIntLoose(el.newStatAtk && el.newStatAtk.value, 0),
        def: parseIntLoose(el.newStatDef && el.newStatDef.value, 0),
        crit: parseIntLoose(el.newStatCrit && el.newStatCrit.value, 0),
        dodge: parseIntLoose(el.newStatDodge && el.newStatDodge.value, 0),
        aim: parseIntLoose(el.newStatAim && el.newStatAim.value, 0)
    };
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function isConsumableKind(kind, subtypeValue) {
    return normalizeKind(kind) === "item" && String(subtypeValue || "").trim().toLowerCase() === "consumable";
}

function syncAddConsumableVisibility() {
    const show = isConsumableKind(el.newKind && el.newKind.value, el.newSubtype && el.newSubtype.value);
    if (el.newConsumableEffects) el.newConsumableEffects.classList.toggle("hidden", !show);
    const mode = String(el.newEffectMode && el.newEffectMode.value || "once");
    if (el.newEffectTurnWrap) el.newEffectTurnWrap.classList.toggle("hidden", !show || mode !== "turn");
    if (el.newEffectRoundWrap) el.newEffectRoundWrap.classList.toggle("hidden", !show || mode !== "round");
}

function setCardDirtyValue(cardKey, prop, nextValue, originalValue) {
    const dirty = { ...(state.dirty.get(cardKey) || {}) };
    if (valuesEqualForDirty(nextValue, originalValue)) {
        delete dirty[prop];
    } else {
        dirty[prop] = nextValue;
    }
    if (Object.keys(dirty).length === 0) {
        state.dirty.delete(cardKey);
    } else {
        state.dirty.set(cardKey, dirty);
    }
}

function renderCards() {
    if (!el.panelList) return;
    el.panelList.innerHTML = "";

    const records = getVisibleRecords();
    if (!records.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No entries found.";
        el.panelList.appendChild(empty);
        return;
    }

    records.forEach(entry => {
        const key = recordKey(entry.kind, entry.id);
        const implemented = Boolean(entry.implemented);
        const getEntryWithDirty = () => ({ ...entry, ...(state.dirty.get(key) || {}) });

        const card = document.createElement("div");
        card.className = "enemy-card add-main-col items-panel-card";

        const indicatorRow = document.createElement("div");
        indicatorRow.className = "implemented-row";
        const dot = document.createElement("span");
        dot.className = `implemented-dot ${implemented ? "is-true" : "is-false"}`;
        dot.title = implemented ? "implemented" : "not implemented";
        const text = document.createElement("span");
        text.className = "implemented-text";
        text.textContent = implemented ? "implemented" : "not implemented";
        indicatorRow.appendChild(dot);
        indicatorRow.appendChild(text);
        card.appendChild(indicatorRow);

        const actions = document.createElement("div");
        actions.className = "enemy-card-actions";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";

        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "btn-secondary";
        resetBtn.textContent = "Reset";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-danger";
        deleteBtn.textContent = "Delete";

        const updateActionState = () => {
            const dirty = state.dirty.get(key);
            const hasDirty = Boolean(dirty && Object.keys(dirty).length > 0);
            const hasPendingImage = state.pendingImages.has(key);
            const isActive = hasDirty || hasPendingImage;
            saveBtn.disabled = !isActive;
            resetBtn.disabled = !isActive;
        };

        const makeInputField = (label, value, prop) => {
            const wrap = document.createElement("div");
            wrap.className = "stats-field";
            const labelEl = document.createElement("span");
            labelEl.className = "add-col-label";
            labelEl.textContent = label;
            const input = document.createElement("input");
            input.type = "text";
            input.value = String(value || "");
            input.addEventListener("input", () => {
                setCardDirtyValue(key, prop, input.value, String(value || ""));
                input.classList.add("dirty");
                updateActionState();
            });
            wrap.appendChild(labelEl);
            wrap.appendChild(input);
            return wrap;
        };

        const rowOne = document.createElement("div");
        rowOne.className = "items-add-row-one";

        const typeWrap = document.createElement("div");
        typeWrap.className = "stats-field";
        const typeLabel = document.createElement("span");
        typeLabel.className = "add-col-label";
        typeLabel.textContent = "type";
        const typeSelect = document.createElement("select");
        const itemOption = document.createElement("option");
        itemOption.value = "item";
        itemOption.textContent = "item";
        const gearOption = document.createElement("option");
        gearOption.value = "gear";
        gearOption.textContent = "gear";
        typeSelect.appendChild(itemOption);
        typeSelect.appendChild(gearOption);
        typeSelect.value = entry.kind === "gear" ? "gear" : "item";
        typeSelect.disabled = true;
        typeWrap.appendChild(typeLabel);
        typeWrap.appendChild(typeSelect);
        rowOne.appendChild(typeWrap);
        rowOne.appendChild(makeInputField("name", entry.name, "name"));

        const subtypeWrap = document.createElement("div");
        subtypeWrap.className = "stats-field";
        const subtypeLabel = document.createElement("span");
        subtypeLabel.className = "add-col-label";
        subtypeLabel.textContent = entry.kind === "gear" ? "gear type" : "item type";
        const subtypeSelect = document.createElement("select");
        const subtypeOptions = entry.kind === "gear" ? state.metadata.gearSlotOptions : state.metadata.itemTypeOptions;
        const subtypeValue = entry.kind === "gear"
            ? normalizeGearSlotFamily(entry.slotType || "body")
            : String(entry.itemType || "consumable");
        populateSelectFromOptions(subtypeSelect, subtypeOptions, subtypeValue, { allowCustom: entry.kind !== "gear" });
        subtypeSelect.addEventListener("change", () => {
            if (entry.kind === "gear") {
                setCardDirtyValue(key, "slotType", subtypeSelect.value, normalizeGearSlotFamily(entry.slotType || "body"));
                setCardDirtyValue(key, "gearType", inferGearTypeFromSlot(subtypeSelect.value), String(entry.gearType || inferGearTypeFromSlot(entry.slotType || "body")));
            } else {
                setCardDirtyValue(key, "itemType", subtypeSelect.value, String(entry.itemType || "consumable"));
            }
            subtypeSelect.classList.add("dirty");
            if (typeof syncCardConsumableVisibility === "function") syncCardConsumableVisibility();
            updateActionState();
        });
        subtypeWrap.appendChild(subtypeLabel);
        subtypeWrap.appendChild(subtypeSelect);
        rowOne.appendChild(subtypeWrap);

        const iconWrap = document.createElement("div");
        iconWrap.className = "stats-field";
        const iconLabel = document.createElement("span");
        iconLabel.className = "add-col-label";
        iconLabel.textContent = "temp icon";
        const iconSelect = document.createElement("select");
        populateTempIconSelect(iconSelect, entry.temp_icon || BOX_ICON);
        iconSelect.addEventListener("change", () => {
            setCardDirtyValue(key, "temp_icon", iconSelect.value, String(entry.temp_icon || BOX_ICON));
            iconSelect.classList.add("dirty");
            updateActionState();
        });
        iconWrap.appendChild(iconLabel);
        iconWrap.appendChild(iconSelect);
        rowOne.appendChild(iconWrap);

        rowOne.appendChild((() => {
            const wrap = document.createElement("div");
            wrap.className = "stats-field price-field";
            const labelEl = document.createElement("span");
            labelEl.className = "add-col-label";
            labelEl.textContent = "price";
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "1";
            const originalPrice = parsePrice(entry.price, 100);
            input.value = String(originalPrice);
            input.addEventListener("input", () => {
                const nextPrice = parsePrice(input.value, originalPrice);
                setCardDirtyValue(key, "price", nextPrice, originalPrice);
                input.classList.add("dirty");
                updateActionState();
            });
            wrap.appendChild(labelEl);
            wrap.appendChild(input);
            return wrap;
        })());

        card.appendChild(rowOne);

        const rowTwo = document.createElement("div");
        rowTwo.className = "items-add-row-two";

        const imageField = document.createElement("div");
        imageField.className = "add-image-row items-inline-image";
        const imageLabel = document.createElement("span");
        imageLabel.className = "add-col-label";
        imageLabel.textContent = "image";
        const picker = document.createElement("button");
        picker.type = "button";
        picker.className = "new-image-picker-btn add-image-inline-btn";
        const pickerText = document.createElement("span");
        pickerText.className = "new-image-picker-text";
        pickerText.textContent = "click to import image";
        const preview = document.createElement("img");
        preview.className = "new-image-preview hidden";
        preview.alt = `${entry.kind} image`;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.className = "enemy-image-input";
        picker.appendChild(pickerText);
        picker.appendChild(preview);
        imageField.appendChild(imageLabel);
        imageField.appendChild(picker);
        imageField.appendChild(fileInput);
        const imageMetaRow = document.createElement("div");
        imageMetaRow.className = "background-meta-row";
        const sizeTag = document.createElement("span");
        sizeTag.className = "background-meta-tag";
        sizeTag.textContent = `size: ${formatBytes(entry.imageSizeBytes)}`;
        imageMetaRow.appendChild(sizeTag);
        imageField.appendChild(imageMetaRow);
        const openFolderLink = document.createElement("button");
        openFolderLink.type = "button";
        openFolderLink.className = "background-open-link";
        openFolderLink.textContent = "Open Folder";
        openFolderLink.addEventListener("click", () => {
            const imagePath = String(entry.image || "").trim();
            if (!imagePath) {
                status("No image path found for this entry.", "err");
                return;
            }
            openImageInFolder(imagePath)
                .then(() => status("Opened file location in Explorer.", "ok"))
                .catch(error => status(error.message, "err"));
        });
        imageField.appendChild(openFolderLink);
        rowTwo.appendChild(imageField);

        picker.addEventListener("click", () => fileInput.click());
        picker.addEventListener("mouseenter", event => {
            showItemHoverTooltip(getEntryWithDirty(), event.clientX, event.clientY);
        });
        picker.addEventListener("mousemove", event => {
            showItemHoverTooltip(getEntryWithDirty(), event.clientX, event.clientY);
        });
        picker.addEventListener("mouseleave", () => {
            hideItemHoverTooltip();
        });
        fileInput.addEventListener("change", async () => {
            const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
            if (!file) return;
            preview.src = URL.createObjectURL(file);
            preview.classList.remove("hidden");
            pickerText.classList.add("hidden");
            picker.disabled = true;
            try {
                await uploadImage(entry.kind, entry.id, file);
                state.pendingImages.delete(key);
            } catch (error) {
                // Keep a fallback pending image so Save can retry upload manually.
                state.pendingImages.set(key, file);
                status(error.message, "err");
            } finally {
                picker.disabled = false;
                fileInput.value = "";
                updateActionState();
            }
        });
        fetch(imageEndpointFor(entry.kind, entry.id), { cache: "no-store" })
            .then(resp => resp.ok ? resp.blob() : null)
            .then(blob => {
                if (!blob) return;
                preview.src = URL.createObjectURL(blob);
                preview.classList.remove("hidden");
                pickerText.classList.add("hidden");
            })
            .catch(() => {});

        const storyWrap = document.createElement("div");
        storyWrap.className = "add-desc-row";
        const storyLabel = document.createElement("span");
        storyLabel.className = "add-col-label";
        storyLabel.textContent = "story desc";
        const storyInput = document.createElement("textarea");
        storyInput.value = String(entry.storyDesc || "");
        storyInput.addEventListener("input", () => {
            setCardDirtyValue(key, "storyDesc", storyInput.value, String(entry.storyDesc || ""));
            storyInput.classList.add("dirty");
            updateActionState();
        });
        storyWrap.appendChild(storyLabel);
        storyWrap.appendChild(storyInput);
        rowTwo.appendChild(storyWrap);

        const functionWrap = document.createElement("div");
        functionWrap.className = "add-desc-row";
        const functionLabel = document.createElement("span");
        functionLabel.className = "add-col-label";
        functionLabel.textContent = "function desc";
        const functionInput = document.createElement("textarea");
        functionInput.value = String(entry.functionDesc || "");
        functionInput.addEventListener("input", () => {
            setCardDirtyValue(key, "functionDesc", functionInput.value, String(entry.functionDesc || ""));
            functionInput.classList.add("dirty");
            updateActionState();
        });
        functionWrap.appendChild(functionLabel);
        functionWrap.appendChild(functionInput);
        rowTwo.appendChild(functionWrap);

        card.appendChild(rowTwo);

        const statsRow = document.createElement("div");
        statsRow.className = "items-stats-row";
        const originalStats = normalizeStatsFromObject(entry.stats);
        const statInputs = {};
        CHARACTER_STAT_KEYS.forEach(statKey => {
            const wrap = document.createElement("div");
            wrap.className = "stats-field";
            const labelEl = document.createElement("span");
            labelEl.className = "add-col-label";
            labelEl.textContent = statKey;
            const input = document.createElement("input");
            input.type = "number";
            input.step = "1";
            input.value = String(originalStats[statKey] || 0);
            statInputs[statKey] = input;
            input.addEventListener("input", () => {
                const nextStats = {};
                CHARACTER_STAT_KEYS.forEach(keyName => {
                    nextStats[keyName] = parseIntLoose(statInputs[keyName].value, 0);
                });
                setCardDirtyValue(key, "stats", nextStats, originalStats);
                input.classList.add("dirty");
                updateActionState();
            });
            wrap.appendChild(labelEl);
            wrap.appendChild(input);
            statsRow.appendChild(wrap);
        });
        card.appendChild(statsRow);

        const effectsRow = document.createElement("div");
        effectsRow.className = "items-effects-row";
        const originalHealAmount = parseIntLoose(entry.healAmount, 0, 0);
        const originalHealPercentUi = parseFloatLoose(Number(entry.healPercent || 0) * 100, 0, 0, 100);
        const originalEffectMode = String(entry.effectMode || "once");
        const originalEffectTurns = parseIntLoose(entry.effectTurns, 1, 1);
        const originalEffectRounds = parseIntLoose(entry.effectRounds, 1, 1);

        const buildNumberEffectField = (label, value, onInput) => {
            const wrap = document.createElement("div");
            wrap.className = "stats-field";
            const labelEl = document.createElement("span");
            labelEl.className = "add-col-label";
            labelEl.textContent = label;
            const input = document.createElement("input");
            input.type = "number";
            input.value = String(value);
            input.addEventListener("input", onInput);
            wrap.appendChild(labelEl);
            wrap.appendChild(input);
            return { wrap, input };
        };

        const healAmountField = buildNumberEffectField("healing amount", originalHealAmount, () => {
            const nextValue = parseIntLoose(healAmountField.input.value, originalHealAmount, 0);
            setCardDirtyValue(key, "healAmount", nextValue, originalHealAmount);
            healAmountField.input.classList.add("dirty");
            updateActionState();
        });
        healAmountField.input.min = "0";
        healAmountField.input.step = "1";
        effectsRow.appendChild(healAmountField.wrap);

        const healPercentField = buildNumberEffectField("healing %", originalHealPercentUi, () => {
            const nextUiValue = parseFloatLoose(healPercentField.input.value, originalHealPercentUi, 0, 100);
            const nextStoredValue = nextUiValue / 100;
            const originalStoredValue = originalHealPercentUi / 100;
            setCardDirtyValue(key, "healPercent", nextStoredValue, originalStoredValue);
            healPercentField.input.classList.add("dirty");
            updateActionState();
        });
        healPercentField.input.min = "0";
        healPercentField.input.max = "100";
        healPercentField.input.step = "0.1";
        effectsRow.appendChild(healPercentField.wrap);

        const modeWrap = document.createElement("div");
        modeWrap.className = "stats-field";
        const modeLabel = document.createElement("span");
        modeLabel.className = "add-col-label";
        modeLabel.textContent = "effect mode";
        const modeSelect = document.createElement("select");
        ["once", "turn", "round"].forEach(mode => {
            const option = document.createElement("option");
            option.value = mode;
            option.textContent = mode;
            if (mode === originalEffectMode) option.selected = true;
            modeSelect.appendChild(option);
        });
        modeWrap.appendChild(modeLabel);
        modeWrap.appendChild(modeSelect);
        effectsRow.appendChild(modeWrap);

        const turnField = buildNumberEffectField("turn count", originalEffectTurns, () => {
            const nextValue = parseIntLoose(turnField.input.value, originalEffectTurns, 1);
            setCardDirtyValue(key, "effectTurns", nextValue, originalEffectTurns);
            turnField.input.classList.add("dirty");
            updateActionState();
        });
        turnField.input.min = "1";
        turnField.input.step = "1";
        effectsRow.appendChild(turnField.wrap);

        const roundField = buildNumberEffectField("round count", originalEffectRounds, () => {
            const nextValue = parseIntLoose(roundField.input.value, originalEffectRounds, 1);
            setCardDirtyValue(key, "effectRounds", nextValue, originalEffectRounds);
            roundField.input.classList.add("dirty");
            updateActionState();
        });
        roundField.input.min = "1";
        roundField.input.step = "1";
        effectsRow.appendChild(roundField.wrap);

        const syncCardConsumableVisibility = () => {
            const dirty = state.dirty.get(key) || {};
            const currentSubtype = Object.prototype.hasOwnProperty.call(dirty, "itemType")
                ? String(dirty.itemType || "")
                : String(entry.itemType || "");
            const currentMode = Object.prototype.hasOwnProperty.call(dirty, "effectMode")
                ? String(dirty.effectMode || "once")
                : String(modeSelect.value || "once");
            const show = entry.kind === "item" && currentSubtype === "consumable";
            effectsRow.classList.toggle("hidden", !show);
            turnField.wrap.classList.toggle("hidden", !show || currentMode !== "turn");
            roundField.wrap.classList.toggle("hidden", !show || currentMode !== "round");
        };

        modeSelect.addEventListener("change", () => {
            setCardDirtyValue(key, "effectMode", modeSelect.value, originalEffectMode);
            modeSelect.classList.add("dirty");
            syncCardConsumableVisibility();
            updateActionState();
        });

        card.appendChild(effectsRow);
        syncCardConsumableVisibility();

        saveBtn.addEventListener("click", async () => {
            try {
                const dirty = { ...(state.dirty.get(key) || {}) };
                let nextId = entry.id;
                if (Object.keys(dirty).length > 0) {
                    const response = await fetch(endpointFor(entry.kind, entry.id), {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(dirty)
                    });
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.error || "Failed to save.");
                    nextId = payload.id || entry.id;
                }

                const file = state.pendingImages.get(key);
                if (file) await uploadImage(entry.kind, nextId, file);

                state.dirty.delete(key);
                state.pendingImages.delete(key);
                await loadData();
            } catch (error) {
                status(error.message, "err");
            }
        });

        resetBtn.addEventListener("click", () => {
            state.dirty.delete(key);
            state.pendingImages.delete(key);
            renderCards();
        });
        deleteBtn.addEventListener("click", () => {
            state.pendingDelete = { kind: entry.kind, id: entry.id, name: entry.name };
            if (el.deleteMessage) el.deleteMessage.textContent = `Delete '${entry.name || entry.id}' from the project?`;
            if (el.deleteModal) {
                el.deleteModal.classList.remove("hidden");
                el.deleteModal.setAttribute("aria-hidden", "false");
            }
        });

        actions.appendChild(saveBtn);
        actions.appendChild(resetBtn);
        actions.appendChild(deleteBtn);
        card.appendChild(actions);
        updateActionState();
        el.panelList.appendChild(card);
    });
}

async function addEntry() {
    if (!refreshAddValidation(true)) return;
    const kind = normalizeKind(el.newKind && el.newKind.value || "item");
    const subtype = String(el.newSubtype && el.newSubtype.value || "").trim();
    const name = String(el.newName && el.newName.value || "").trim();
    const payload = {
        name,
        temp_icon: String(el.newTempIcon && el.newTempIcon.value || BOX_ICON),
        price: parsePrice(el.newPrice && el.newPrice.value, 100),
        storyDesc: String(el.newStoryDesc && el.newStoryDesc.value || "").trim(),
        functionDesc: String(el.newFunctionDesc && el.newFunctionDesc.value || "").trim(),
        stats: readStatsFromAddForm(),
        implemented: false
    };
    if (kind === "gear") {
        payload.slotType = normalizeGearSlotFamily(subtype || "body");
        payload.gearType = inferGearTypeFromSlot(payload.slotType);
    } else {
        payload.itemType = subtype || "consumable";
        payload.consumableType = payload.itemType === "consumable" ? "healing" : "none";
        payload.healAmount = parseIntLoose(el.newHealAmount && el.newHealAmount.value, 0, 0);
        payload.healPercent = parseFloatLoose(el.newHealPercent && el.newHealPercent.value, 0, 0, 100) / 100;
        payload.effectMode = String(el.newEffectMode && el.newEffectMode.value || "once");
        payload.effectTurns = parseIntLoose(el.newEffectTurns && el.newEffectTurns.value, 1, 1);
        payload.effectRounds = parseIntLoose(el.newEffectRounds && el.newEffectRounds.value, 1, 1);
    }

    const response = await fetch(endpointFor(kind), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Failed to add ${kind}.`);

    if (state.addImageFile) await uploadImage(kind, body.id, state.addImageFile);

    if (el.addSuccessMessage) el.addSuccessMessage.textContent = `${kind} '${body.id}' added successfully.`;
    if (el.addSuccessModal) {
        el.addSuccessModal.classList.remove("hidden");
        el.addSuccessModal.setAttribute("aria-hidden", "false");
    }

    if (el.newName) el.newName.value = "";
    if (el.newStoryDesc) el.newStoryDesc.value = "";
    if (el.newFunctionDesc) el.newFunctionDesc.value = "";
    if (el.newTempIcon) el.newTempIcon.value = BOX_ICON;
    if (el.newPrice) el.newPrice.value = "100";
    if (el.newStatHp) el.newStatHp.value = "0";
    if (el.newStatAtk) el.newStatAtk.value = "0";
    if (el.newStatDef) el.newStatDef.value = "0";
    if (el.newStatCrit) el.newStatCrit.value = "0";
    if (el.newStatDodge) el.newStatDodge.value = "0";
    if (el.newStatAim) el.newStatAim.value = "0";
    if (el.newHealAmount) el.newHealAmount.value = "0";
    if (el.newHealPercent) el.newHealPercent.value = "0";
    if (el.newEffectMode) el.newEffectMode.value = "once";
    if (el.newEffectTurns) el.newEffectTurns.value = "1";
    if (el.newEffectRounds) el.newEffectRounds.value = "1";
    if (el.newKind) el.newKind.value = "item";
    if (el.newSubtype) el.newSubtype.value = "consumable";
    syncAddTypeVisibility();
    setAddImage(null);
    refreshAddValidation(false);
    await loadData();
}

if (el.newImagePickerBtn && el.newImageInput) {
    el.newImagePickerBtn.addEventListener("click", () => el.newImageInput.click());
    el.newImageInput.addEventListener("change", () => setAddImage(el.newImageInput.files && el.newImageInput.files[0] ? el.newImageInput.files[0] : null));
}

if (el.newName) {
    el.newName.addEventListener("input", () => refreshAddValidation(false));
}
if (el.newKind) {
    el.newKind.addEventListener("change", () => syncAddTypeVisibility());
}
if (el.newSubtype) el.newSubtype.addEventListener("change", () => syncAddConsumableVisibility());
if (el.newEffectMode) el.newEffectMode.addEventListener("change", () => syncAddConsumableVisibility());

if (el.addBtn) el.addBtn.addEventListener("click", () => addEntry().catch(error => status(error.message, "err")));
if (el.addSuccessClose) el.addSuccessClose.addEventListener("click", () => {
    if (!el.addSuccessModal) return;
    el.addSuccessModal.classList.add("hidden");
    el.addSuccessModal.setAttribute("aria-hidden", "true");
});
if (el.addSuccessModal) el.addSuccessModal.addEventListener("click", event => {
    if (event.target === el.addSuccessModal && el.addSuccessClose) el.addSuccessClose.click();
});
if (el.deleteCancelBtn) el.deleteCancelBtn.addEventListener("click", () => {
    state.pendingDelete = null;
    if (!el.deleteModal) return;
    el.deleteModal.classList.add("hidden");
    el.deleteModal.setAttribute("aria-hidden", "true");
});
if (el.deleteConfirmBtn) el.deleteConfirmBtn.addEventListener("click", async () => {
    try {
        if (!state.pendingDelete) return;
        const response = await fetch(endpointFor(state.pendingDelete.kind, state.pendingDelete.id), { method: "DELETE" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Delete failed.");
        if (el.deleteCancelBtn) el.deleteCancelBtn.click();
        status(`Deleted '${state.pendingDelete.id}'.`, "ok");
        await loadData();
    } catch (error) {
        status(error.message, "err");
    }
});
if (el.deleteModal) el.deleteModal.addEventListener("click", event => {
    if (event.target === el.deleteModal && el.deleteCancelBtn) el.deleteCancelBtn.click();
});

populateTempIconSelect(el.newTempIcon, BOX_ICON);
renderAddTypeOptions();
syncAddTypeVisibility();
setAddImage(null);
refreshAddValidation(false);
loadData().catch(error => status(error.message, "err"));

