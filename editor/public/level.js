const state = {
    levels: [],
    levelBackgrounds: [],
    enemies: [],
    sellableEntries: [],
    activeImageJobs: 0,
    openEnemyMenu: null,
    dirtyByRound: new Map(),
    pendingRoundDelete: null,
    pendingBackgroundImport: null,
    pendingBackgroundSelect: null,
    pendingVendorSelect: null
};

const el = {
    status: document.getElementById("status"),
    levelPanelList: document.getElementById("level-panel-list"),
    imageProcessingOverlay: document.getElementById("image-processing-overlay"),
    processingOverlayText: document.getElementById("processing-overlay-text"),
    processingProgressFill: document.getElementById("processing-progress-fill"),
    processingProgressLabel: document.getElementById("processing-progress-label"),
    deleteConfirmModal: document.getElementById("delete-confirm-modal"),
    deleteConfirmMessage: document.getElementById("delete-confirm-message"),
    deleteCancelBtn: document.getElementById("delete-cancel-btn"),
    deleteConfirmBtn: document.getElementById("delete-confirm-btn"),
    bgSelectModal: document.getElementById("bg-select-modal"),
    bgSelectList: document.getElementById("bg-select-list"),
    bgSelectCloseBtn: document.getElementById("bg-select-close-btn"),
    vendorSelectModal: document.getElementById("vendor-select-modal"),
    vendorSelectList: document.getElementById("vendor-select-list"),
    vendorSelectCloseBtn: document.getElementById("vendor-select-close-btn"),
    bgImportModal: document.getElementById("bg-import-modal"),
    bgImportNameInput: document.getElementById("bg-import-name-input"),
    bgImportCancelBtn: document.getElementById("bg-import-cancel-btn"),
    bgImportConfirmBtn: document.getElementById("bg-import-confirm-btn")
};

const DIRTY_PENDING_IMAGE_FILE = "__pendingImageFile";
const DIRTY_PENDING_IMAGE_PREVIEW_URL = "__pendingImagePreviewUrl";
const DIRTY_BACKGROUND_MODE = "__backgroundMode";
const ADD_NEW_IMAGE_VALUE = "__add_new_image__";
const LARGE_BACKGROUND_THRESHOLD_BYTES = 3 * 1024 * 1024;
const ROUND_AUTO_SAVE_DELAY_MS = 280;

function getPlannedBackgroundAttempts(fileSize) {
    return Number(fileSize) > LARGE_BACKGROUND_THRESHOLD_BYTES ? 3 : 2;
}

function createAttemptTicker(totalAttempts, labelPrefix = "Compressing background") {
    let timer = null;
    let current = 1;
    const safeTotal = Math.max(1, Number(totalAttempts) || 1);
    return {
        start() {
            setProcessingProgress(87, `${labelPrefix} (${current}/${safeTotal})...`);
            if (safeTotal <= 1) return;
            timer = setInterval(() => {
                current = Math.min(safeTotal, current + 1);
                const phasePercent = 87 + Math.floor((current / safeTotal) * 10);
                setProcessingProgress(phasePercent, `${labelPrefix} (${current}/${safeTotal})...`);
                if (current >= safeTotal && timer) {
                    clearInterval(timer);
                    timer = null;
                }
            }, 1800);
        },
        stop() {
            if (timer) clearInterval(timer);
            timer = null;
        }
    };
}

function setupCollapsiblePanels() {
    const toggleButtons = Array.from(document.querySelectorAll("[data-collapse-toggle]"));
    toggleButtons.forEach(button => {
        const targetId = String(button.getAttribute("data-collapse-target") || "");
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (!target) return;
        const applyState = isExpanded => {
            target.classList.toggle("hidden", !isExpanded);
            button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
            button.textContent = isExpanded ? "Close" : "Open";
        };
        applyState(true);
        button.addEventListener("click", () => {
            const expanded = button.getAttribute("aria-expanded") === "true";
            applyState(!expanded);
        });
    });
}

function setStatus(message, kind = "muted") {
    if (!el.status) return;
    el.status.textContent = message;
    el.status.className = kind === "muted" ? "muted" : `muted status-${kind}`;
}

function setProcessingProgress(percent, text = "Processing...") {
    const value = Math.max(0, Math.min(100, Math.floor(percent)));
    if (el.processingOverlayText) el.processingOverlayText.textContent = text;
    if (el.processingProgressFill) el.processingProgressFill.style.width = `${value}%`;
    if (el.processingProgressLabel) el.processingProgressLabel.textContent = `${value}%`;
}

function updateImageProcessingOverlay() {
    if (!el.imageProcessingOverlay) return;
    const isBusy = state.activeImageJobs > 0;
    el.imageProcessingOverlay.classList.toggle("hidden", !isBusy);
    el.imageProcessingOverlay.setAttribute("aria-hidden", isBusy ? "false" : "true");
    if (!isBusy) setProcessingProgress(0, "Processing...");
}

function buildProjectAssetUrl(relativePath) {
    const raw = String(relativePath || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const normalized = raw.replace(/\\/g, "/");
    if (normalized.startsWith("/project/")) return encodeURI(normalized);
    if (normalized.startsWith("project/")) return `/${encodeURI(normalized)}`;
    return `/project/${encodeURI(normalized.replace(/^\/+/, ""))}`;
}

function sanitizeImageBaseName(input, fallback) {
    const trimmed = String(input || "").trim();
    const withoutExtension = trimmed.replace(/\.[a-zA-Z0-9]+$/, "");
    const safe = withoutExtension.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
    return safe || String(fallback || "background");
}

async function loadPreviewImage(previewEl, labelEl, source) {
    const src = String(source || "");
    if (!src) {
        previewEl.classList.add("hidden");
        labelEl.classList.remove("hidden");
        return false;
    }
    try {
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) throw new Error("Image not found.");
        const blob = await response.blob();
        if (!blob || blob.size <= 0) throw new Error("Empty image.");
        if (previewEl.dataset.objectUrl) URL.revokeObjectURL(previewEl.dataset.objectUrl);
        const objectUrl = URL.createObjectURL(blob);
        previewEl.dataset.objectUrl = objectUrl;
        previewEl.src = objectUrl;
        previewEl.classList.remove("hidden");
        labelEl.classList.add("hidden");
        return true;
    } catch (_) {
        previewEl.classList.add("hidden");
        labelEl.classList.remove("hidden");
        return false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            const dataBase64 = result.includes(",") ? result.split(",")[1] : "";
            resolve(dataBase64);
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
    });
}

function closeEnemyMenu() {
    if (state.openEnemyMenu) {
        state.openEnemyMenu.classList.add("hidden");
        state.openEnemyMenu = null;
    }
}

function openDeleteConfirmModal({ levelId, roundIndex }) {
    state.pendingRoundDelete = { levelId, roundIndex };
    if (el.deleteConfirmMessage) {
        el.deleteConfirmMessage.textContent = `Remove round ${roundIndex + 1} from level ${levelId}?`;
    }
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.remove("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "false");
}

function closeDeleteConfirmModal() {
    state.pendingRoundDelete = null;
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.add("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "true");
}

function openBackgroundImportModal({ level, round, roundIndex, file, defaultName }) {
    if (!file) return;
    const safeDefaultName = sanitizeImageBaseName(defaultName || file.name, `level_${level.id}_round_${roundIndex + 1}`);
    state.pendingBackgroundImport = {
        level,
        round,
        roundIndex,
        file,
        defaultName: safeDefaultName
    };
    if (el.bgImportNameInput) {
        el.bgImportNameInput.value = safeDefaultName;
    }
    if (!el.bgImportModal) return;
    el.bgImportModal.classList.remove("hidden");
    el.bgImportModal.setAttribute("aria-hidden", "false");
}

function closeBackgroundImportModal({ clearPending = true } = {}) {
    if (clearPending) {
        state.pendingBackgroundImport = null;
    }
    if (!el.bgImportModal) return;
    el.bgImportModal.classList.add("hidden");
    el.bgImportModal.setAttribute("aria-hidden", "true");
}

function getBackgroundPathLabel(backgroundPath) {
    const raw = String(backgroundPath || "").trim();
    if (!raw) return "none";
    const slash = raw.lastIndexOf("/");
    return slash >= 0 ? raw.slice(slash + 1) : raw;
}

function renderBackgroundSelectModal() {
    if (!el.bgSelectList) return;
    el.bgSelectList.innerHTML = "";
    const backgrounds = Array.isArray(state.levelBackgrounds) ? state.levelBackgrounds : [];
    if (backgrounds.length <= 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No backgrounds available. Add backgrounds in the Background page first.";
        el.bgSelectList.appendChild(empty);
        return;
    }
    const sorted = backgrounds
        .slice()
        .sort((a, b) => String(a.backgroundImageName || a.fileName || a.background || "").localeCompare(String(b.backgroundImageName || b.fileName || b.background || "")));
    sorted.forEach(entry => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "bg-select-option";
        option.dataset.backgroundPath = String(entry.background || "");
        option.dataset.backgroundName = String(entry.backgroundImageName || "");

        const thumbText = document.createElement("span");
        thumbText.className = "new-image-picker-text";
        thumbText.textContent = "no preview";

        const thumb = document.createElement("img");
        thumb.className = "bg-select-thumb hidden";
        thumb.alt = `${entry.backgroundImageName || entry.fileName || "background"} preview`;
        loadPreviewImage(thumb, thumbText, buildProjectAssetUrl(entry.background)).catch(() => {
            thumb.classList.add("hidden");
            thumbText.classList.remove("hidden");
        });

        const name = document.createElement("div");
        name.className = "bg-select-name";
        name.textContent = entry.backgroundImageName || getBackgroundPathLabel(entry.background);

        const pathText = document.createElement("div");
        pathText.className = "bg-select-path";
        pathText.textContent = entry.background || "";

        option.appendChild(thumbText);
        option.appendChild(thumb);
        option.appendChild(name);
        option.appendChild(pathText);
        el.bgSelectList.appendChild(option);
    });
}

function openBackgroundSelectModal(levelId, roundIndex) {
    state.pendingBackgroundSelect = { levelId, roundIndex };
    renderBackgroundSelectModal();
    if (!el.bgSelectModal) return;
    el.bgSelectModal.classList.remove("hidden");
    el.bgSelectModal.setAttribute("aria-hidden", "false");
}

function closeBackgroundSelectModal() {
    state.pendingBackgroundSelect = null;
    if (!el.bgSelectModal) return;
    el.bgSelectModal.classList.add("hidden");
    el.bgSelectModal.setAttribute("aria-hidden", "true");
}

function renderVendorSelectModal() {
    if (!el.vendorSelectList) return;
    el.vendorSelectList.innerHTML = "";
    const pending = state.pendingVendorSelect;
    if (!pending) return;
    const level = state.levels.find(entry => Number(entry.id) === Number(pending.levelId));
    if (!level || !Array.isArray(level.rounds) || !level.rounds[pending.roundIndex]) return;
    const round = level.rounds[pending.roundIndex];
    const selectedIds = new Set(getValidVendorItems(getRoundField(level, round, pending.roundIndex, "vendorItems")));

    if (!Array.isArray(state.sellableEntries) || state.sellableEntries.length <= 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No sellable items found. Add items/gears in Items page first.";
        el.vendorSelectList.appendChild(empty);
        return;
    }

    state.sellableEntries.forEach(entry => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "bg-select-option vendor-select-option";
        option.dataset.itemId = entry.id;
        option.classList.toggle("is-selected", selectedIds.has(entry.id));

        const thumbText = document.createElement("span");
        thumbText.className = "new-image-picker-text";
        thumbText.textContent = "no preview";

        const thumb = document.createElement("img");
        thumb.className = "bg-select-thumb hidden";
        thumb.alt = `${entry.name} preview`;
        loadPreviewImage(thumb, thumbText, buildProjectAssetUrl(entry.image)).catch(() => {
            thumb.classList.add("hidden");
            thumbText.classList.remove("hidden");
        });

        const name = document.createElement("div");
        name.className = "bg-select-name";
        name.textContent = `${entry.name} (${entry.id})`;

        const price = document.createElement("div");
        price.className = "bg-select-path";
        const safePrice = Number.isFinite(entry.price) ? entry.price : 100;
        price.textContent = `Price: ${safePrice}`;

        const desc = document.createElement("div");
        desc.className = "vendor-select-desc";
        desc.textContent = entry.desc || "No description.";

        option.appendChild(thumbText);
        option.appendChild(thumb);
        option.appendChild(name);
        option.appendChild(price);
        option.appendChild(desc);
        el.vendorSelectList.appendChild(option);
    });
}

function openVendorSelectModal(levelId, roundIndex) {
    state.pendingVendorSelect = { levelId, roundIndex };
    renderVendorSelectModal();
    if (!el.vendorSelectModal) return;
    el.vendorSelectModal.classList.remove("hidden");
    el.vendorSelectModal.setAttribute("aria-hidden", "false");
}

function closeVendorSelectModal() {
    state.pendingVendorSelect = null;
    if (!el.vendorSelectModal) return;
    el.vendorSelectModal.classList.add("hidden");
    el.vendorSelectModal.setAttribute("aria-hidden", "true");
}

function toggleVendorItemFromModal(itemId) {
    const pending = state.pendingVendorSelect;
    if (!pending) return;
    const level = state.levels.find(entry => Number(entry.id) === Number(pending.levelId));
    if (!level || !Array.isArray(level.rounds) || !level.rounds[pending.roundIndex]) return;
    const round = level.rounds[pending.roundIndex];
    const current = getValidVendorItems(getRoundField(level, round, pending.roundIndex, "vendorItems"));
    const hasItem = current.includes(itemId);
    const next = hasItem ? current.filter(id => id !== itemId) : [...current, itemId];
    setRoundDirty(level, round, pending.roundIndex, "vendorItems", getValidVendorItems(next));
    queueRoundAutoSave(level.id, pending.roundIndex);
    renderVendorSelectModal();
    renderLevelPanel();
    setStatus(`Vendor items updated for level ${level.id}, round ${pending.roundIndex + 1}. Auto-saving.`);
}

function assignBackgroundToPendingRound(backgroundPath, backgroundImageName = "") {
    const pending = state.pendingBackgroundSelect;
    if (!pending) return;
    const level = state.levels.find(entry => Number(entry.id) === Number(pending.levelId));
    if (!level || !Array.isArray(level.rounds) || !level.rounds[pending.roundIndex]) {
        closeBackgroundSelectModal();
        return;
    }
    const round = level.rounds[pending.roundIndex];
    const nextPath = String(backgroundPath || "").trim();
    if (!nextPath) return;
    const fallbackName = sanitizeImageBaseName(
        getBackgroundPathLabel(nextPath).replace(/\.[a-zA-Z0-9]+$/, ""),
        `level_${level.id}_round_${pending.roundIndex + 1}`
    );
    const nextName = sanitizeImageBaseName(backgroundImageName, fallbackName);

    setRoundDirty(level, round, pending.roundIndex, DIRTY_PENDING_IMAGE_FILE, null);
    setRoundDirty(level, round, pending.roundIndex, DIRTY_PENDING_IMAGE_PREVIEW_URL, null);
    setRoundDirty(level, round, pending.roundIndex, "background", nextPath);
    setRoundDirty(level, round, pending.roundIndex, "backgroundImageName", nextName);
    setRoundDirty(level, round, pending.roundIndex, DIRTY_BACKGROUND_MODE, "existing");
    closeBackgroundSelectModal();
    queueRoundAutoSave(level.id, pending.roundIndex);
    renderLevelPanel();
    setStatus(`Background selected for level ${level.id}, round ${pending.roundIndex + 1}. Auto-saving...`, "ok");
}

function getRoundKey(levelId, roundIndex) {
    return `${levelId}:${roundIndex}`;
}

function valuesMatch(a, b) {
    if (a === null && b === null) return true;
    if (typeof a === "object" || typeof b === "object") return a === b;
    return String(a ?? "") === String(b ?? "");
}

function getRoundField(level, round, roundIndex, field) {
    const dirty = state.dirtyByRound.get(getRoundKey(level.id, roundIndex));
    if (dirty && Object.prototype.hasOwnProperty.call(dirty, field)) return dirty[field];
    return round[field];
}

function setRoundDirty(level, round, roundIndex, field, value) {
    const key = getRoundKey(level.id, roundIndex);
    const existing = { ...(state.dirtyByRound.get(key) || {}) };
    if (field === DIRTY_PENDING_IMAGE_FILE || field === DIRTY_PENDING_IMAGE_PREVIEW_URL) {
        if (value == null) delete existing[field];
        else existing[field] = value;
        if (Object.keys(existing).length === 0) {
            state.dirtyByRound.delete(key);
            return;
        }
        state.dirtyByRound.set(key, existing);
        return;
    }
    const originalValue = round[field];
    if (valuesMatch(value, originalValue)) {
        delete existing[field];
    } else {
        existing[field] = value;
    }
    if (Object.keys(existing).length === 0) {
        state.dirtyByRound.delete(key);
        return;
    }
    state.dirtyByRound.set(key, existing);
}

function getRoundDirty(levelId, roundIndex) {
    return state.dirtyByRound.get(getRoundKey(levelId, roundIndex)) || null;
}

function getAutoSaveState() {
    if (!state.autoSave) {
        state.autoSave = {
            timers: new Map(),
            inFlight: new Set(),
            rerun: new Set()
        };
    }
    return state.autoSave;
}

function queueRoundAutoSave(levelId, roundIndex) {
    const autoSave = getAutoSaveState();
    const key = getRoundKey(levelId, roundIndex);
    const existingTimer = autoSave.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
        autoSave.timers.delete(key);
        runRoundAutoSave(levelId, roundIndex).catch(error => {
            setStatus(error.message || `Auto-save failed for level ${levelId}, round ${roundIndex + 1}.`, "err");
        });
    }, ROUND_AUTO_SAVE_DELAY_MS);
    autoSave.timers.set(key, timer);
}

async function runRoundAutoSave(levelId, roundIndex) {
    const autoSave = getAutoSaveState();
    const key = getRoundKey(levelId, roundIndex);
    if (autoSave.inFlight.has(key)) {
        autoSave.rerun.add(key);
        return;
    }
    const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
    if (!level || !Array.isArray(level.rounds) || !level.rounds[roundIndex]) return;
    autoSave.inFlight.add(key);
    try {
        await saveRoundChanges(level, roundIndex);
    } finally {
        autoSave.inFlight.delete(key);
        if (autoSave.rerun.has(key)) {
            autoSave.rerun.delete(key);
            await runRoundAutoSave(levelId, roundIndex);
        }
    }
}

function clearAllDirty() {
    state.dirtyByRound.forEach((dirty, key) => {
        void key;
        const previewUrl = dirty && dirty[DIRTY_PENDING_IMAGE_PREVIEW_URL];
        if (previewUrl) {
            try { URL.revokeObjectURL(previewUrl); } catch (_) {}
        }
    });
    state.dirtyByRound.clear();
}

function clearPendingImagePreview(levelId, roundIndex) {
    const dirty = getRoundDirty(levelId, roundIndex);
    if (!dirty) return;
    const previewUrl = dirty[DIRTY_PENDING_IMAGE_PREVIEW_URL];
    if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (_) {}
    }
}

function hasRoundDirty(levelId, roundIndex) {
    const dirty = state.dirtyByRound.get(getRoundKey(levelId, roundIndex));
    if (!dirty) return false;
    const meaningfulKeys = Object.keys(dirty).filter(key => key !== DIRTY_BACKGROUND_MODE);
    return meaningfulKeys.length > 0;
}

function resetRoundDirty(levelId, roundIndex) {
    clearPendingImagePreview(levelId, roundIndex);
    state.dirtyByRound.delete(getRoundKey(levelId, roundIndex));
}

function createLabeledField(labelText, controlEl, extraClass = "") {
    const field = document.createElement("div");
    field.className = `stats-field${extraClass ? ` ${extraClass}` : ""}`;
    const label = document.createElement("span");
    label.className = "add-col-label";
    label.textContent = labelText;
    field.appendChild(label);
    field.appendChild(controlEl);
    return field;
}

async function fetchLevels() {
    const response = await fetch("/api/levels");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load levels.");
    state.levels = Array.isArray(payload.levels) ? payload.levels : [];
}

async function fetchLevelBackgrounds() {
    const response = await fetch("/api/level-backgrounds");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load level backgrounds.");
    state.levelBackgrounds = Array.isArray(payload.backgrounds) ? payload.backgrounds : [];
}

async function fetchEnemies() {
    const response = await fetch("/api/enemies");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load enemies.");
    state.enemies = Array.isArray(payload.enemies) ? payload.enemies : [];
}

async function fetchSellableEntries() {
    const response = await fetch("/api/items-gears");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load items/gears.");
    const items = Array.isArray(payload.items) ? payload.items : [];
    const gears = Array.isArray(payload.gears) ? payload.gears : [];
    state.sellableEntries = [...items, ...gears]
        .map(entry => ({
            id: String(entry && entry.id || "").trim(),
            name: String(entry && entry.name || entry && entry.id || "unnamed").trim()
            ,
            price: Number(entry && entry.price),
            image: String(entry && entry.image || "").trim(),
            desc: String(
                (entry && (entry.storyDesc || entry.desc || entry.functionDesc)) || ""
            ).trim()
        }))
        .filter(entry => entry.id)
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function renameLevelBackground(backgroundPath, backgroundImageName) {
    const response = await fetch("/api/level-backgrounds/rename", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            background: backgroundPath,
            backgroundImageName
        })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to rename background image.");
    return payload;
}

function replaceLevelBackgroundRequest(payload, plannedAttempts = 2) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const attemptTicker = createAttemptTicker(plannedAttempts, "Compressing replacement");
        xhr.open("POST", "/api/level-backgrounds/replace", true);
        xhr.timeout = 120000;
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = event => {
            if (!event.lengthComputable || event.total <= 0) return;
            const uploadPercent = Math.floor((event.loaded / event.total) * 85);
            setProcessingProgress(uploadPercent, "Uploading replacement image...");
        };
        xhr.upload.onload = () => {
            setProcessingProgress(86, "Upload complete. Processing on server...");
            attemptTicker.start();
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            attemptTicker.stop();
            let body = {};
            try {
                body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            } catch (_) {
                body = {};
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(body);
                return;
            }
            reject(new Error(body.error || "Background replacement failed."));
        };
        xhr.onerror = () => {
            attemptTicker.stop();
            reject(new Error("Background replacement failed."));
        };
        xhr.ontimeout = () => {
            attemptTicker.stop();
            reject(new Error("Background replacement timed out. Please try a smaller image."));
        };
        xhr.send(JSON.stringify(payload));
    });
}

async function replaceLevelBackground(backgroundPath, file) {
    if (!backgroundPath || !file) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(5, "Reading replacement image...");
    setStatus("Replacing background image...");
    try {
        const plannedAttempts = getPlannedBackgroundAttempts(file.size);
        const dataBase64 = await fileToBase64(file);
        const payload = await replaceLevelBackgroundRequest({
            background: backgroundPath,
            filename: file.name,
            dataBase64
        }, plannedAttempts);
        setProcessingProgress(100, "Done");
        await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
        renderLevelPanel();
        renderBackgroundPanel();
        if (payload && payload.compression) {
            const compression = payload.compression;
            if (compression.enabled && compression.compressed) {
                const reduction = Number.isFinite(compression.reductionPercent) ? `${compression.reductionPercent}%` : "n/a";
                const target = Number.isFinite(compression.targetReductionPercent) ? `${compression.targetReductionPercent}%` : "n/a";
                const attempts = `${compression.attemptsUsed || 1}/${compression.maxAttempts || plannedAttempts}`;
                setStatus(
                    `Replaced background. TinyPNG compressed ${compression.originalBytes} -> ${compression.savedBytes} bytes (${reduction} smaller, target ${target}, attempts ${attempts}).`,
                    "ok"
                );
            } else if (!compression.enabled) {
                setStatus("Replaced background. TinyPNG disabled (missing API key).", "ok");
            } else {
                setStatus(`Replaced background. TinyPNG skipped (${compression.reason || "no change"}).`, "ok");
            }
        } else {
            setStatus("Replaced background image.", "ok");
        }
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

async function removeLevelBackground(backgroundPath) {
    const response = await fetch("/api/level-backgrounds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            background: backgroundPath
        })
    });
    const payload = await response.json();
    if (!response.ok) {
        if (payload && Array.isArray(payload.usage) && payload.usage.length > 0) {
            const usageText = payload.usage
                .map(entry => `Level ${entry.levelId} Round ${entry.round}`)
                .join(", ");
            throw new Error(`Cannot remove image. In use by ${usageText}.`);
        }
        throw new Error(payload.error || "Failed to remove background image.");
    }
    return payload;
}

function getEnemyById(enemyId) {
    return state.enemies.find(entry => String(entry.id) === String(enemyId)) || null;
}

function getDefaultEnemyIdForNewRound() {
    const sorted = state.enemies
        .slice()
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    const first = sorted[0];
    return first && first.id ? String(first.id) : null;
}

function getValidVendorItems(value) {
    const validIds = new Set((state.sellableEntries || []).map(entry => String(entry.id)));
    const list = Array.isArray(value) ? value : [];
    return Array.from(new Set(
        list
            .map(entry => String(entry || "").trim())
            .filter(entry => entry && validIds.has(entry))
    ));
}

async function updateRound(levelId, roundIndex, changes) {
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/rounds/${encodeURIComponent(roundIndex)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes || {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to update round.");

    const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
    if (level && Array.isArray(level.rounds) && level.rounds[roundIndex]) {
        level.rounds[roundIndex] = { ...level.rounds[roundIndex], ...(payload.round || changes || {}) };
    }
    return payload;
}

async function addRound(levelId) {
    setStatus(`Adding round to level ${levelId}...`);
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/rounds`, {
        method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to add round.");

    // New rounds should start with a default enemy (first option in picker order).
    const roundIndex = Number(payload && payload.roundIndex);
    const defaultEnemyId = getDefaultEnemyIdForNewRound();
    if (Number.isInteger(roundIndex) && roundIndex >= 0 && defaultEnemyId) {
        await updateRound(levelId, roundIndex, { enemy: defaultEnemyId });
    }

    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
    clearAllDirty();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Added round ${payload.roundIndex + 1} to level ${levelId}.`, "ok");
}

async function removeRound(levelId, roundIndex) {
    setStatus(`Removing round ${roundIndex + 1} from level ${levelId}...`);
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/rounds/${encodeURIComponent(roundIndex)}`, {
        method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to remove round.");
    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
    clearAllDirty();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Removed round ${roundIndex + 1} from level ${levelId}.`, "ok");
}

function uploadRoundBackgroundRequest(levelId, roundIndex, payload, plannedAttempts = 2) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const attemptTicker = createAttemptTicker(plannedAttempts);
        xhr.open("POST", `/api/levels/${encodeURIComponent(levelId)}/rounds/${encodeURIComponent(roundIndex)}/background`, true);
        xhr.timeout = 120000;
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = event => {
            if (!event.lengthComputable || event.total <= 0) return;
            const uploadPercent = Math.floor((event.loaded / event.total) * 85);
            setProcessingProgress(uploadPercent, "Uploading image...");
        };
        xhr.upload.onload = () => {
            setProcessingProgress(86, "Upload complete. Processing on server...");
            attemptTicker.start();
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            attemptTicker.stop();
            let body = {};
            try {
                body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            } catch (_) {
                body = {};
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(body);
                return;
            }
            reject(new Error(body.error || "Image upload failed."));
        };
        xhr.onerror = () => {
            attemptTicker.stop();
            reject(new Error("Image upload failed."));
        };
        xhr.ontimeout = () => {
            attemptTicker.stop();
            reject(new Error("Image upload timed out. Please try a smaller image."));
        };
        xhr.send(JSON.stringify(payload));
    });
}

async function uploadRoundBackground(levelId, roundIndex, file, imageBaseName) {
    if (!file) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(5, "Reading image...");
    setStatus(`Uploading round background for level ${levelId}, round ${roundIndex + 1}...`);
    try {
        const plannedAttempts = getPlannedBackgroundAttempts(file.size);
        const dataBase64 = await fileToBase64(file);
        const payload = await uploadRoundBackgroundRequest(levelId, roundIndex, {
            filename: file.name,
            dataBase64,
            backgroundImageName: imageBaseName
        }, plannedAttempts);
        setProcessingProgress(98, "Saving image...");

        const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
        if (level && Array.isArray(level.rounds) && level.rounds[roundIndex]) {
            level.rounds[roundIndex].background = payload.background;
            level.rounds[roundIndex].backgroundImageName = payload.backgroundImageName;
            if (!Array.isArray(level.backgroundImages)) level.backgroundImages = [];
            if (payload.background && !level.backgroundImages.includes(payload.background)) {
                level.backgroundImages.push(payload.background);
            }
        }

        await fetchLevelBackgrounds();
        renderLevelPanel();
        renderBackgroundPanel();
        setProcessingProgress(100, "Done");
        if (payload && payload.compression) {
            const compression = payload.compression;
            if (compression.enabled && compression.compressed) {
                const reduction = Number.isFinite(compression.reductionPercent) ? `${compression.reductionPercent}%` : "n/a";
                const target = Number.isFinite(compression.targetReductionPercent) ? `${compression.targetReductionPercent}%` : "n/a";
                const attempts = `${compression.attemptsUsed || 1}/${compression.maxAttempts || plannedAttempts}`;
                setStatus(
                    `Updated background for level ${levelId}, round ${roundIndex + 1}. TinyPNG compressed ${compression.originalBytes} -> ${compression.savedBytes} bytes (${reduction} smaller, target ${target}, attempts ${attempts}).`,
                    "ok"
                );
            } else if (!compression.enabled) {
                setStatus(
                    `Updated background for level ${levelId}, round ${roundIndex + 1}. TinyPNG disabled (missing API key).`,
                    "ok"
                );
            } else {
                setStatus(
                    `Updated background for level ${levelId}, round ${roundIndex + 1}. TinyPNG skipped (${compression.reason || "no change"}).`,
                    "ok"
                );
            }
        } else {
            setStatus(`Updated background for level ${levelId}, round ${roundIndex + 1}.`, "ok");
        }
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

function createEnemyPicker(level, round, roundIndex, selectedEnemyId, onSelect) {
    const picker = document.createElement("div");
    picker.className = "level-enemy-picker";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "level-enemy-trigger";

    const selectedEnemy = selectedEnemyId ? getEnemyById(selectedEnemyId) : null;
    trigger.textContent = selectedEnemy ? selectedEnemy.name || selectedEnemy.id : "(none)";

    const menu = document.createElement("div");
    menu.className = "level-enemy-menu hidden";

    const makeOption = (enemyEntry, label, enemyId) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "level-enemy-option";
        if (!enemyEntry) option.classList.add("level-enemy-option-none");

        const thumb = document.createElement("img");
        thumb.className = "level-enemy-thumb";
        if (enemyEntry) thumb.src = `/api/enemies/${encodeURIComponent(enemyEntry.id)}/image`;
        else thumb.src = "";
        thumb.alt = enemyEntry ? `${enemyEntry.name || enemyEntry.id} portrait` : "none";
        if (!enemyEntry) thumb.classList.add("hidden");

        const meta = document.createElement("div");
        meta.className = "level-enemy-meta";

        const nameEl = document.createElement("div");
        nameEl.className = "level-enemy-name";
        nameEl.textContent = label;
        meta.appendChild(nameEl);

        if (enemyEntry) {
            const statsEl = document.createElement("div");
            statsEl.className = "level-enemy-stats";
            statsEl.textContent = `HP ${enemyEntry.hp} | ATK ${enemyEntry.atk} | DEF ${enemyEntry.def}`;
            meta.appendChild(statsEl);
        }

        option.appendChild(thumb);
        option.appendChild(meta);
        option.addEventListener("click", () => {
            closeEnemyMenu();
            if (typeof onSelect === "function") onSelect(enemyId);
        });
        return option;
    };

    state.enemies
        .slice()
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
        .forEach(enemyEntry => {
            const label = `${enemyEntry.name || enemyEntry.id} (${enemyEntry.id})`;
            menu.appendChild(makeOption(enemyEntry, label, enemyEntry.id));
        });

    trigger.addEventListener("click", event => {
        event.stopPropagation();
        if (state.openEnemyMenu && state.openEnemyMenu !== menu) closeEnemyMenu();
        const shouldOpen = menu.classList.contains("hidden");
        if (shouldOpen) {
            menu.classList.remove("hidden");
            state.openEnemyMenu = menu;
        } else {
            closeEnemyMenu();
        }
    });

    picker.appendChild(trigger);
    picker.appendChild(menu);
    return picker;
}

async function saveRoundChanges(level, roundIndex) {
    const key = getRoundKey(level.id, roundIndex);
    const changes = { ...(state.dirtyByRound.get(key) || {}) };
    if (!changes || Object.keys(changes).length === 0) {
        setStatus(`No changes to save for level ${level.id}, round ${roundIndex + 1}.`);
        return;
    }
    setStatus(`Saving level ${level.id}, round ${roundIndex + 1}...`);
    const pendingFile = changes[DIRTY_PENDING_IMAGE_FILE] || null;
    const pendingPreviewUrl = changes[DIRTY_PENDING_IMAGE_PREVIEW_URL] || "";
    const round = level.rounds && level.rounds[roundIndex] ? level.rounds[roundIndex] : null;
    delete changes[DIRTY_PENDING_IMAGE_FILE];
    delete changes[DIRTY_PENDING_IMAGE_PREVIEW_URL];
    delete changes[DIRTY_BACKGROUND_MODE];

    const effectiveType = String(
        Object.prototype.hasOwnProperty.call(changes, "type")
            ? changes.type
            : (round && round.type) || "fight"
    ).trim().toLowerCase();
    const effectiveVendorItems = getValidVendorItems(
        Object.prototype.hasOwnProperty.call(changes, "vendorItems")
            ? changes.vendorItems
            : (round && round.vendorItems)
    );
    if (effectiveType === "vendor" && effectiveVendorItems.length <= 0) {
        if (round) round.vendorItems = [];
        renderLevelPanel();
        setStatus(`Cannot save level ${level.id}, round ${roundIndex + 1}: vendor requires at least 1 item.`, "err");
        return;
    }

    let payload = null;
    if (Object.keys(changes).length > 0) {
        payload = await updateRound(level.id, roundIndex, changes);
    }
    if (round && payload) {
        Object.assign(round, payload.round || changes);
    } else if (round && Object.keys(changes).length > 0) {
        Object.assign(round, changes);
    }

    if (pendingFile) {
        const uploadName = sanitizeImageBaseName(
            (round && round.backgroundImageName) || changes.backgroundImageName || `level_${level.id}_round_${roundIndex + 1}`,
            `level_${level.id}_round_${roundIndex + 1}`
        );
        await uploadRoundBackground(level.id, roundIndex, pendingFile, uploadName);
    }

    if (pendingPreviewUrl) {
        try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
    }
    state.dirtyByRound.delete(key);
    await fetchLevelBackgrounds();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Saved level ${level.id}, round ${roundIndex + 1}.`, "ok");
}

async function commitPendingBackgroundImport() {
    const pending = state.pendingBackgroundImport;
    if (!pending) return;
    const { level, round, roundIndex, file, defaultName } = pending;
    const typedName = sanitizeImageBaseName(
        el.bgImportNameInput ? el.bgImportNameInput.value : "",
        defaultName
    );
    closeBackgroundImportModal({ clearPending: false });
    try {
        await uploadRoundBackground(level.id, roundIndex, file, typedName);
        resetRoundDirty(level.id, roundIndex);
        state.pendingBackgroundImport = null;
    } catch (error) {
        setStatus(error.message || "Failed to import background image.", "err");
        state.pendingBackgroundImport = null;
    }
}

function createRoundCard(level, round, roundIndex, totalRounds) {
    const row = document.createElement("div");
    row.className = "enemy-card";

    const statsRow = document.createElement("div");
    statsRow.className = "stats-row enemy-stats-row";

    let enemyFieldWrap = null;
    let vendorFieldWrap = null;
    let warningEl = null;
    const updateWarningState = () => {
        if (!warningEl) return;
        const effectiveType = String(getRoundField(level, round, roundIndex, "type") || "fight");
        const effectiveEnemy = getRoundField(level, round, roundIndex, "enemy");
        const hasEnemy = !(effectiveEnemy === null || String(effectiveEnemy).trim() === "");
        const effectiveVendorItems = getValidVendorItems(getRoundField(level, round, roundIndex, "vendorItems"));
        const hasVendorItems = effectiveVendorItems.length > 0;
        const shouldWarnFight = effectiveType === "fight" && !hasEnemy;
        const shouldWarnVendor = effectiveType === "vendor" && !hasVendorItems;
        warningEl.textContent = shouldWarnFight
            ? "Warning: Fight rounds require an enemy."
            : (shouldWarnVendor ? "Warning: Vendor rounds require at least 1 selected item." : "");
        warningEl.classList.toggle("hidden", !shouldWarnFight && !shouldWarnVendor);
        warningEl.style.color = shouldWarnVendor ? "#ef4444" : "";
        if (enemyFieldWrap) enemyFieldWrap.classList.toggle("hidden", effectiveType === "vendor");
        if (vendorFieldWrap) vendorFieldWrap.classList.toggle("hidden", effectiveType !== "vendor");
    };
    const roundNumber = document.createElement("input");
    roundNumber.type = "text";
    roundNumber.value = String(roundIndex + 1);
    roundNumber.disabled = true;
    statsRow.appendChild(createLabeledField("round", roundNumber));

    const typeSelect = document.createElement("select");
    const currentType = String(getRoundField(level, round, roundIndex, "type") || "fight");
    [
        { value: "fight", label: "fight" },
        { value: "event", label: "event" },
        { value: "vendor", label: "vendor event" }
    ].forEach(typeEntry => {
        const option = document.createElement("option");
        option.value = typeEntry.value;
        option.textContent = typeEntry.label;
        if (currentType === typeEntry.value) option.selected = true;
        typeSelect.appendChild(option);
    });
    typeSelect.addEventListener("change", () => {
        const nextType = typeSelect.value;
        setRoundDirty(level, round, roundIndex, "type", nextType);
        if (nextType === "vendor") {
            setRoundDirty(level, round, roundIndex, "enemy", null);
        } else {
            setRoundDirty(level, round, roundIndex, "vendorItems", []);
        }
        updateWarningState();
        queueRoundAutoSave(level.id, roundIndex);
        renderLevelPanel();
    });
    statsRow.appendChild(createLabeledField("type", typeSelect));

    const selectedEnemyId = getRoundField(level, round, roundIndex, "enemy");
    const enemyPicker = createEnemyPicker(level, round, roundIndex, selectedEnemyId, enemyId => {
        setRoundDirty(level, round, roundIndex, "enemy", enemyId);
        queueRoundAutoSave(level.id, roundIndex);
        renderLevelPanel();
        setStatus(`Enemy selection changed for level ${level.id}, round ${roundIndex + 1}. Auto-saving.`);
    });
    enemyFieldWrap = createLabeledField("enemy", enemyPicker, "level-enemy-field");
    statsRow.appendChild(enemyFieldWrap);

    const vendorItemsValue = getValidVendorItems(getRoundField(level, round, roundIndex, "vendorItems"));
    const vendorPicker = document.createElement("div");
    vendorPicker.className = "level-vendor-picker";
    const selectedInfo = document.createElement("div");
    selectedInfo.className = "muted";
    selectedInfo.textContent = `selected: ${vendorItemsValue.length}`;
    const openVendorBtn = document.createElement("button");
    openVendorBtn.type = "button";
    openVendorBtn.className = "btn-secondary";
    openVendorBtn.textContent = "Select Vendor Items";
    openVendorBtn.addEventListener("click", () => openVendorSelectModal(level.id, roundIndex));
    vendorPicker.appendChild(selectedInfo);
    vendorPicker.appendChild(openVendorBtn);
    vendorFieldWrap = createLabeledField("item select", vendorPicker, "level-vendor-field");
    statsRow.appendChild(vendorFieldWrap);

    row.appendChild(statsRow);

    const mediaRow = document.createElement("div");
    mediaRow.className = "level-background-section";

    const currentRoundBackground = String(getRoundField(level, round, roundIndex, "background") || "");

    const imageField = document.createElement("div");
    imageField.className = "level-background-left";

    const pickerButton = document.createElement("div");
    pickerButton.className = "new-image-picker-btn";

    const pickerText = document.createElement("span");
    pickerText.className = "new-image-picker-text";
    pickerText.textContent = "no background selected";

    const preview = document.createElement("img");
    preview.className = "new-image-preview hidden";
    preview.alt = `Level ${level.id} round ${roundIndex + 1} background preview`;
    preview.loading = "lazy";
    loadPreviewImage(preview, pickerText, buildProjectAssetUrl(currentRoundBackground)).catch(() => {
        preview.classList.add("hidden");
        pickerText.classList.remove("hidden");
    });

    const backgroundSelectField = document.createElement("div");
    backgroundSelectField.className = "level-background-right";
    const selectorLabel = document.createElement("span");
    selectorLabel.className = "add-col-label";
    selectorLabel.textContent = "background image";
    backgroundSelectField.appendChild(selectorLabel);

    const selectedName = String(getRoundField(level, round, roundIndex, "backgroundImageName") || getBackgroundPathLabel(currentRoundBackground) || "").trim();
    const selectedNameText = document.createElement("div");
    selectedNameText.className = "muted";
    selectedNameText.textContent = selectedName ? `selected: ${selectedName}` : "selected: none";

    const selectBackgroundBtn = document.createElement("button");
    selectBackgroundBtn.type = "button";
    selectBackgroundBtn.className = "btn-secondary";
    selectBackgroundBtn.textContent = "Select Background";
    selectBackgroundBtn.addEventListener("click", () => {
        openBackgroundSelectModal(level.id, roundIndex);
    });

    backgroundSelectField.appendChild(selectedNameText);
    backgroundSelectField.appendChild(selectBackgroundBtn);

    pickerButton.appendChild(pickerText);
    pickerButton.appendChild(preview);
    imageField.appendChild(pickerButton);
    mediaRow.appendChild(imageField);
    mediaRow.appendChild(backgroundSelectField);
    row.appendChild(mediaRow);

    const actionRow = document.createElement("div");
    actionRow.className = "enemy-card-actions";

    const removeRoundBtn = document.createElement("button");
    removeRoundBtn.type = "button";
    removeRoundBtn.className = "btn-danger";
    removeRoundBtn.textContent = "Remove Round";
    removeRoundBtn.disabled = totalRounds <= 1;
    removeRoundBtn.addEventListener("click", () => {
        openDeleteConfirmModal({ levelId: level.id, roundIndex });
    });

    actionRow.appendChild(removeRoundBtn);
    row.appendChild(actionRow);

    warningEl = document.createElement("div");
    warningEl.className = "add-form-warning hidden";
    row.appendChild(warningEl);

    updateWarningState();
    return row;
}

function createLevelCard(level) {
    const card = document.createElement("div");
    card.className = "enemy-card";

    const title = document.createElement("h2");
    title.className = "section-title level-card-title";
    title.textContent = `${level.name || `Level ${level.id}`}`;
    card.appendChild(title);

    const roundsContainer = document.createElement("div");
    roundsContainer.className = "enemy-panel-list";
    const rounds = Array.isArray(level.rounds) ? level.rounds : [];
    rounds.forEach((round, roundIndex) => {
        roundsContainer.appendChild(createRoundCard(level, round, roundIndex, rounds.length));
    });
    card.appendChild(roundsContainer);

    const addRoundRow = document.createElement("div");
    addRoundRow.className = "enemy-card-actions";
    const addRoundBtn = document.createElement("button");
    addRoundBtn.type = "button";
    addRoundBtn.textContent = "Add Round";
    addRoundBtn.addEventListener("click", () => {
        addRound(level.id).catch(error => setStatus(error.message, "err"));
    });
    addRoundRow.appendChild(addRoundBtn);
    card.appendChild(addRoundRow);
    return card;
}

function renderLevelPanel() {
    closeEnemyMenu();
    if (!el.levelPanelList) return;
    el.levelPanelList.innerHTML = "";
    state.levels.forEach(level => {
        el.levelPanelList.appendChild(createLevelCard(level));
    });
}

function formatBackgroundUsage(usageList) {
    if (!Array.isArray(usageList) || usageList.length === 0) return "";
    return usageList
        .map(entry => `Level ${entry.levelId} Round ${entry.round}`)
        .join(", ");
}

function createBackgroundCard(entry) {
    const card = document.createElement("div");
    card.className = "enemy-card level-background-card";

    const previewWrap = document.createElement("div");
    previewWrap.className = "level-background-card-preview";
    const preview = document.createElement("img");
    preview.className = "new-image-preview hidden";
    preview.alt = `${entry.backgroundImageName || entry.fileName || "background"} preview`;
    const previewText = document.createElement("span");
    previewText.className = "new-image-picker-text";
    previewText.textContent = "no preview";
    previewWrap.appendChild(previewText);
    previewWrap.appendChild(preview);
    loadPreviewImage(preview, previewText, buildProjectAssetUrl(entry.background)).catch(() => {
        preview.classList.add("hidden");
        previewText.classList.remove("hidden");
    });

    const content = document.createElement("div");
    content.className = "level-background-card-content";

    const pathText = document.createElement("div");
    pathText.className = "muted level-background-card-path";
    pathText.textContent = entry.background;
    content.appendChild(pathText);

    const statsRow = document.createElement("div");
    statsRow.className = "stats-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = String(entry.backgroundImageName || "");
    nameInput.placeholder = "background_image name";
    statsRow.appendChild(createLabeledField("background_image name", nameInput));
    content.appendChild(statsRow);

    const warningEl = document.createElement("div");
    warningEl.className = "add-form-warning";
    const usageText = formatBackgroundUsage(entry.usedBy);
    const isUsedByRounds = Array.isArray(entry.usedBy) && entry.usedBy.length > 0;
    warningEl.textContent = isUsedByRounds
        ? `In use: ${usageText}. Remove is disabled.`
        : "";
    warningEl.classList.toggle("hidden", !isUsedByRounds);
    content.appendChild(warningEl);

    const actions = document.createElement("div");
    actions.className = "enemy-card-actions";

    const saveNameBtn = document.createElement("button");
    saveNameBtn.type = "button";
    saveNameBtn.textContent = "Save Name";
    saveNameBtn.addEventListener("click", () => {
        const nextName = sanitizeImageBaseName(nameInput.value, entry.backgroundImageName || "background");
        renameLevelBackground(entry.background, nextName)
            .then(async () => {
                await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
                renderLevelPanel();
                renderBackgroundPanel();
                setStatus(`Renamed background to '${nextName}'.`, "ok");
            })
            .catch(error => setStatus(error.message, "err"));
    });

    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.className = "btn-secondary";
    replaceBtn.textContent = "Replace Image";
    const replaceInput = document.createElement("input");
    replaceInput.type = "file";
    replaceInput.accept = "image/*";
    replaceInput.className = "enemy-image-input";
    replaceBtn.addEventListener("click", () => replaceInput.click());
    replaceInput.addEventListener("change", () => {
        const file = replaceInput.files && replaceInput.files[0] ? replaceInput.files[0] : null;
        if (!file) return;
        replaceLevelBackground(entry.background, file).catch(error => {
            setStatus(error.message || "Failed to replace background image.", "err");
        });
        replaceInput.value = "";
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-danger";
    removeBtn.textContent = "Remove Image";
    removeBtn.disabled = isUsedByRounds;
    removeBtn.addEventListener("click", () => {
        removeLevelBackground(entry.background)
            .then(async () => {
                await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
                renderLevelPanel();
                renderBackgroundPanel();
                setStatus("Removed background image.", "ok");
            })
            .catch(error => setStatus(error.message, "err"));
    });

    actions.appendChild(saveNameBtn);
    actions.appendChild(replaceBtn);
    actions.appendChild(removeBtn);
    content.appendChild(actions);
    content.appendChild(replaceInput);

    card.appendChild(previewWrap);
    card.appendChild(content);
    return card;
}

function renderBackgroundPanel() {
    if (!el.backgroundPanelList) return;
    el.backgroundPanelList.innerHTML = "";
    const backgrounds = Array.isArray(state.levelBackgrounds) ? state.levelBackgrounds : [];
    if (backgrounds.length <= 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No level background images found.";
        el.backgroundPanelList.appendChild(empty);
        return;
    }
    backgrounds
        .slice()
        .sort((a, b) => String(a.background || "").localeCompare(String(b.background || "")))
        .forEach(entry => {
            el.backgroundPanelList.appendChild(createBackgroundCard(entry));
        });
}

async function init() {
    setupCollapsiblePanels();
    if (!el.levelPanelList) return;
    setStatus("Loading levels...");
    await Promise.all([fetchLevels(), fetchEnemies(), fetchLevelBackgrounds(), fetchSellableEntries()]);
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Loaded ${state.levels.length} level${state.levels.length === 1 ? "" : "s"}.`, "ok");
}

document.addEventListener("click", event => {
    if (event.target.closest(".level-enemy-picker")) return;
    closeEnemyMenu();
});

if (el.deleteCancelBtn) {
    el.deleteCancelBtn.addEventListener("click", () => {
        closeDeleteConfirmModal();
    });
}

if (el.bgSelectCloseBtn) {
    el.bgSelectCloseBtn.addEventListener("click", () => {
        closeBackgroundSelectModal();
    });
}

if (el.vendorSelectCloseBtn) {
    el.vendorSelectCloseBtn.addEventListener("click", () => {
        closeVendorSelectModal();
    });
}

if (el.bgSelectModal) {
    el.bgSelectModal.addEventListener("click", event => {
        if (event.target === el.bgSelectModal) closeBackgroundSelectModal();
    });
}

if (el.vendorSelectModal) {
    el.vendorSelectModal.addEventListener("click", event => {
        if (event.target === el.vendorSelectModal) closeVendorSelectModal();
    });
}

if (el.bgSelectList) {
    el.bgSelectList.addEventListener("click", event => {
        const trigger = event.target.closest(".bg-select-option");
        if (!trigger) return;
        assignBackgroundToPendingRound(trigger.dataset.backgroundPath || "", trigger.dataset.backgroundName || "");
    });
}

if (el.vendorSelectList) {
    el.vendorSelectList.addEventListener("click", event => {
        const trigger = event.target.closest(".vendor-select-option");
        if (!trigger) return;
        const itemId = String(trigger.dataset.itemId || "").trim();
        if (!itemId) return;
        toggleVendorItemFromModal(itemId);
    });
}

if (el.deleteConfirmBtn) {
    el.deleteConfirmBtn.addEventListener("click", () => {
        const pending = state.pendingRoundDelete;
        if (!pending) {
            closeDeleteConfirmModal();
            return;
        }
        closeDeleteConfirmModal();
        removeRound(pending.levelId, pending.roundIndex).catch(error => setStatus(error.message, "err"));
    });
}

if (el.bgImportCancelBtn) {
    el.bgImportCancelBtn.addEventListener("click", () => {
        closeBackgroundImportModal();
    });
}

if (el.bgImportConfirmBtn) {
    el.bgImportConfirmBtn.addEventListener("click", () => {
        commitPendingBackgroundImport().catch(error => {
            setStatus(error.message || "Failed to import background image.", "err");
        });
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeDeleteConfirmModal();
        closeBackgroundSelectModal();
        closeVendorSelectModal();
        closeBackgroundImportModal();
    }
    if (event.key === "Enter" && el.bgImportModal && !el.bgImportModal.classList.contains("hidden")) {
        commitPendingBackgroundImport().catch(error => {
            setStatus(error.message || "Failed to import background image.", "err");
        });
    }
});

init().catch(error => setStatus(error.message, "err"));
