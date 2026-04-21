const state = {
    levels: [],
    levelBackgrounds: [],
    enemies: [],
    cutsceneVideos: [],
    sellableEntries: [],
    activeImageJobs: 0,
    openEnemyMenu: null,
    dirtyByScene: new Map(),
    pendingSceneDelete: null,
    pendingBackgroundImport: null,
    pendingBackgroundSelect: null,
    pendingVendorSelect: null,
    collapsedLevels: new Set()
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
        button.classList.add("editor-close-icon-btn");
        const applyState = isExpanded => {
            target.classList.toggle("hidden", !isExpanded);
            button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
            button.textContent = isExpanded ? "\u25B4" : "\u25BE";
        };
        applyState(true);
        button.addEventListener("click", () => {
            const expanded = button.getAttribute("aria-expanded") === "true";
            applyState(!expanded);
        });
    });
}

function setupCloseButtons() {
    const closeButtons = [el.bgSelectCloseBtn, el.vendorSelectCloseBtn].filter(Boolean);
    closeButtons.forEach(button => {
        button.classList.add("editor-close-icon-btn");
        button.textContent = "\u2715";
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

function openDeleteConfirmModal({ levelId, sceneIndex }) {
    state.pendingSceneDelete = { levelId, sceneIndex };
    if (el.deleteConfirmMessage) {
        el.deleteConfirmMessage.textContent = `Remove Scene ${sceneIndex + 1} from level ${levelId}?`;
    }
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.remove("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "false");
}

function closeDeleteConfirmModal() {
    state.pendingSceneDelete = null;
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.add("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "true");
}

function openBackgroundImportModal({ level, scene, sceneIndex, file, defaultName }) {
    if (!file) return;
    const safeDefaultName = sanitizeImageBaseName(defaultName || file.name, `level_${level.id}_scene_${sceneIndex + 1}`);
    state.pendingBackgroundImport = {
        level,
        scene,
        sceneIndex,
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
        empty.textContent = "No backgrounds available. Add backgrounds in the background page first.";
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

function openBackgroundSelectModal(levelId, sceneIndex) {
    state.pendingBackgroundSelect = { levelId, sceneIndex };
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
    if (!level || !Array.isArray(level.scenes) || !level.scenes[pending.sceneIndex]) return;
    const scene = level.scenes[pending.sceneIndex];
    const selectedIds = new Set(getValidVendorItems(getSceneField(level, scene, pending.sceneIndex, "vendorItems")));

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

function openVendorSelectModal(levelId, sceneIndex) {
    state.pendingVendorSelect = { levelId, sceneIndex };
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
    if (!level || !Array.isArray(level.scenes) || !level.scenes[pending.sceneIndex]) return;
    const scene = level.scenes[pending.sceneIndex];
    const current = getValidVendorItems(getSceneField(level, scene, pending.sceneIndex, "vendorItems"));
    const hasItem = current.includes(itemId);
    const next = hasItem ? current.filter(id => id !== itemId) : [...current, itemId];
    setSceneDirty(level, scene, pending.sceneIndex, "vendorItems", getValidVendorItems(next));
    queueSceneAutoSave(level.id, pending.sceneIndex);
    renderVendorSelectModal();
    renderLevelPanel();
    setStatus(`Vendor items updated for level ${level.id}, Scene ${pending.sceneIndex + 1}. Auto-saving.`);
}

function assignBackgroundToPendingRound(backgroundPath, backgroundImageName = "") {
    const pending = state.pendingBackgroundSelect;
    if (!pending) return;
    const level = state.levels.find(entry => Number(entry.id) === Number(pending.levelId));
    if (!level || !Array.isArray(level.scenes) || !level.scenes[pending.sceneIndex]) {
        closeBackgroundSelectModal();
        return;
    }
    const scene = level.scenes[pending.sceneIndex];
    const nextPath = String(backgroundPath || "").trim();
    if (!nextPath) return;
    const fallbackName = sanitizeImageBaseName(
        getBackgroundPathLabel(nextPath).replace(/\.[a-zA-Z0-9]+$/, ""),
        `level_${level.id}_scene_${pending.sceneIndex + 1}`
    );
    const nextName = sanitizeImageBaseName(backgroundImageName, fallbackName);

    setSceneDirty(level, scene, pending.sceneIndex, DIRTY_PENDING_IMAGE_FILE, null);
    setSceneDirty(level, scene, pending.sceneIndex, DIRTY_PENDING_IMAGE_PREVIEW_URL, null);
    setSceneDirty(level, scene, pending.sceneIndex, "background", nextPath);
    setSceneDirty(level, scene, pending.sceneIndex, "backgroundImageName", nextName);
    setSceneDirty(level, scene, pending.sceneIndex, DIRTY_BACKGROUND_MODE, "existing");
    closeBackgroundSelectModal();
    queueSceneAutoSave(level.id, pending.sceneIndex);
    renderLevelPanel();
    setStatus(`background selected for level ${level.id}, Scene ${pending.sceneIndex + 1}. Auto-saving...`, "ok");
}

function getSceneKey(levelId, sceneIndex) {
    return `${levelId}:${sceneIndex}`;
}

function valuesMatch(a, b) {
    if (a === null && b === null) return true;
    if (typeof a === "object" || typeof b === "object") return a === b;
    return String(a ?? "") === String(b ?? "");
}

function getSceneField(level, scene, sceneIndex, field) {
    const dirty = state.dirtyByScene.get(getSceneKey(level.id, sceneIndex));
    if (dirty && Object.prototype.hasOwnProperty.call(dirty, field)) return dirty[field];
    return scene[field];
}

function setSceneDirty(level, scene, sceneIndex, field, value) {
    const key = getSceneKey(level.id, sceneIndex);
    const existing = { ...(state.dirtyByScene.get(key) || {}) };
    if (field === DIRTY_PENDING_IMAGE_FILE || field === DIRTY_PENDING_IMAGE_PREVIEW_URL) {
        if (value == null) delete existing[field];
        else existing[field] = value;
        if (Object.keys(existing).length === 0) {
            state.dirtyByScene.delete(key);
            return;
        }
        state.dirtyByScene.set(key, existing);
        return;
    }
    const originalValue = scene[field];
    if (valuesMatch(value, originalValue)) {
        delete existing[field];
    } else {
        existing[field] = value;
    }
    if (Object.keys(existing).length === 0) {
        state.dirtyByScene.delete(key);
        return;
    }
    state.dirtyByScene.set(key, existing);
}

function getSceneDirty(levelId, sceneIndex) {
    return state.dirtyByScene.get(getSceneKey(levelId, sceneIndex)) || null;
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

function queueSceneAutoSave(levelId, sceneIndex) {
    const autoSave = getAutoSaveState();
    const key = getSceneKey(levelId, sceneIndex);
    const existingTimer = autoSave.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
        autoSave.timers.delete(key);
        runSceneAutoSave(levelId, sceneIndex).catch(error => {
            setStatus(error.message || `Auto-save failed for level ${levelId}, Scene ${sceneIndex + 1}.`, "err");
        });
    }, ROUND_AUTO_SAVE_DELAY_MS);
    autoSave.timers.set(key, timer);
}

async function runSceneAutoSave(levelId, sceneIndex) {
    const autoSave = getAutoSaveState();
    const key = getSceneKey(levelId, sceneIndex);
    if (autoSave.inFlight.has(key)) {
        autoSave.rerun.add(key);
        return;
    }
    const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
    if (!level || !Array.isArray(level.scenes) || !level.scenes[sceneIndex]) return;
    autoSave.inFlight.add(key);
    try {
        await saveSceneChanges(level, sceneIndex);
    } finally {
        autoSave.inFlight.delete(key);
        if (autoSave.rerun.has(key)) {
            autoSave.rerun.delete(key);
            await runSceneAutoSave(levelId, sceneIndex);
        }
    }
}

function clearAllDirty() {
    state.dirtyByScene.forEach((dirty, key) => {
        void key;
        const previewUrl = dirty && dirty[DIRTY_PENDING_IMAGE_PREVIEW_URL];
        if (previewUrl) {
            try { URL.revokeObjectURL(previewUrl); } catch (_) {}
        }
    });
    state.dirtyByScene.clear();
}

function clearPendingImagePreview(levelId, sceneIndex) {
    const dirty = getSceneDirty(levelId, sceneIndex);
    if (!dirty) return;
    const previewUrl = dirty[DIRTY_PENDING_IMAGE_PREVIEW_URL];
    if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (_) {}
    }
}

function hasSceneDirty(levelId, sceneIndex) {
    const dirty = state.dirtyByScene.get(getSceneKey(levelId, sceneIndex));
    if (!dirty) return false;
    const meaningfulKeys = Object.keys(dirty).filter(key => key !== DIRTY_BACKGROUND_MODE);
    return meaningfulKeys.length > 0;
}

function resetSceneDirty(levelId, sceneIndex) {
    clearPendingImagePreview(levelId, sceneIndex);
    state.dirtyByScene.delete(getSceneKey(levelId, sceneIndex));
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

async function fetchCutsceneVideos() {
    const response = await fetch("/api/cutscene-videos");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load cutscene videos.");
    state.cutsceneVideos = Array.isArray(payload.videos) ? payload.videos : [];
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
            reject(new Error(body.error || "background replacement failed."));
        };
        xhr.onerror = () => {
            attemptTicker.stop();
            reject(new Error("background replacement failed."));
        };
        xhr.ontimeout = () => {
            attemptTicker.stop();
            reject(new Error("background replacement timed out. Please try a smaller image."));
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
                .map(entry => `Level ${entry.levelId} Scene ${entry.scene}`)
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

function getDefaultEnemyIdForNewScene() {
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

async function updateScene(levelId, sceneIndex, changes) {
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/scenes/${encodeURIComponent(sceneIndex)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes || {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to update scene.");

    const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
    if (level && Array.isArray(level.scenes) && level.scenes[sceneIndex]) {
        level.scenes[sceneIndex] = { ...level.scenes[sceneIndex], ...(payload.scene || changes || {}) };
    }
    return payload;
}

async function addScene(levelId) {
    setStatus(`Adding Scene to level ${levelId}...`);
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/scenes`, {
        method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to add scene.");

    // New scenes should start with a default enemy (first option in picker order).
    const sceneIndex = Number(payload && payload.sceneIndex);
    const defaultEnemyId = getDefaultEnemyIdForNewScene();
    if (Number.isInteger(sceneIndex) && sceneIndex >= 0 && defaultEnemyId) {
        await updateScene(levelId, sceneIndex, { enemy: defaultEnemyId });
    }

    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
    clearAllDirty();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Added Scene ${payload.sceneIndex + 1} to level ${levelId}.`, "ok");
}

async function removeScene(levelId, sceneIndex) {
    setStatus(`Removing Scene ${sceneIndex + 1} from level ${levelId}...`);
    const response = await fetch(`/api/levels/${encodeURIComponent(levelId)}/scenes/${encodeURIComponent(sceneIndex)}`, {
        method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to remove scene.");
    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
    clearAllDirty();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Removed Scene ${sceneIndex + 1} from level ${levelId}.`, "ok");
}

function uploadSceneBackgroundRequest(levelId, sceneIndex, payload, plannedAttempts = 2) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const attemptTicker = createAttemptTicker(plannedAttempts);
        xhr.open("POST", `/api/levels/${encodeURIComponent(levelId)}/scenes/${encodeURIComponent(sceneIndex)}/background`, true);
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

async function uploadSceneBackground(levelId, sceneIndex, file, imageBaseName) {
    if (!file) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(5, "Reading image...");
    setStatus(`Uploading scene background for level ${levelId}, Scene ${sceneIndex + 1}...`);
    try {
        const plannedAttempts = getPlannedBackgroundAttempts(file.size);
        const dataBase64 = await fileToBase64(file);
        const payload = await uploadSceneBackgroundRequest(levelId, sceneIndex, {
            filename: file.name,
            dataBase64,
            backgroundImageName: imageBaseName
        }, plannedAttempts);
        setProcessingProgress(98, "Saving image...");

        const level = state.levels.find(entry => Number(entry.id) === Number(levelId));
        if (level && Array.isArray(level.scenes) && level.scenes[sceneIndex]) {
            level.scenes[sceneIndex].background = payload.background;
            level.scenes[sceneIndex].backgroundImageName = payload.backgroundImageName;
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
                    `Updated background for level ${levelId}, Scene ${sceneIndex + 1}. TinyPNG compressed ${compression.originalBytes} -> ${compression.savedBytes} bytes (${reduction} smaller, target ${target}, attempts ${attempts}).`,
                    "ok"
                );
            } else if (!compression.enabled) {
                setStatus(
                    `Updated background for level ${levelId}, Scene ${sceneIndex + 1}. TinyPNG disabled (missing API key).`,
                    "ok"
                );
            } else {
                setStatus(
                    `Updated background for level ${levelId}, Scene ${sceneIndex + 1}. TinyPNG skipped (${compression.reason || "no change"}).`,
                    "ok"
                );
            }
        } else {
            setStatus(`Updated background for level ${levelId}, Scene ${sceneIndex + 1}.`, "ok");
        }
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

function createEnemyPicker(level, scene, sceneIndex, selectedEnemyId, onSelect) {
    const picker = document.createElement("div");
    picker.className = "level-enemy-picker";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "level-enemy-trigger";

    const selectedEnemy = selectedEnemyId ? getEnemyById(selectedEnemyId) : null;
    trigger.textContent = selectedEnemy ? selectedEnemy.name || selectedEnemy.id : "";

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

async function saveSceneChanges(level, sceneIndex) {
    const key = getSceneKey(level.id, sceneIndex);
    const changes = { ...(state.dirtyByScene.get(key) || {}) };
    if (!changes || Object.keys(changes).length === 0) {
        setStatus(`No changes to save for level ${level.id}, Scene ${sceneIndex + 1}.`);
        return;
    }
    setStatus(`Saving level ${level.id}, Scene ${sceneIndex + 1}...`);
    const pendingFile = changes[DIRTY_PENDING_IMAGE_FILE] || null;
    const pendingPreviewUrl = changes[DIRTY_PENDING_IMAGE_PREVIEW_URL] || "";
    const scene = level.scenes && level.scenes[sceneIndex] ? level.scenes[sceneIndex] : null;
    delete changes[DIRTY_PENDING_IMAGE_FILE];
    delete changes[DIRTY_PENDING_IMAGE_PREVIEW_URL];
    delete changes[DIRTY_BACKGROUND_MODE];

    const rawEffectiveType = String(
        Object.prototype.hasOwnProperty.call(changes, "type")
            ? changes.type
            : (scene && scene.type) || "fight"
    ).trim().toLowerCase();
    const effectiveType = rawEffectiveType === "event" ? "cutscene" : rawEffectiveType;
    const firstEnemyId = state.enemies
        .slice()
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
        .map(entry => String(entry && entry.id || "").trim())
        .find(Boolean) || "";
    const effectiveVendorItems = getValidVendorItems(
        Object.prototype.hasOwnProperty.call(changes, "vendorItems")
            ? changes.vendorItems
            : (scene && scene.vendorItems)
    );
    const effectiveCutsceneVideo = String(
        Object.prototype.hasOwnProperty.call(changes, "cutsceneVideo")
            ? changes.cutsceneVideo
            : (scene && scene.cutsceneVideo) || ""
    ).trim();
    const effectiveEnemy = String(
        Object.prototype.hasOwnProperty.call(changes, "enemy")
            ? changes.enemy
            : (scene && scene.enemy) || ""
    ).trim();
    if (effectiveType === "fight" && !effectiveEnemy && firstEnemyId) {
        changes.enemy = firstEnemyId;
    }
    if (effectiveType === "vendor" && effectiveVendorItems.length <= 0) {
        if (scene) scene.vendorItems = [];
        renderLevelPanel();
        setStatus(`Cannot save level ${level.id}, Scene ${sceneIndex + 1}: vendor requires at least 1 item.`, "err");
        return;
    }
    if (effectiveType === "cutscene" && !effectiveCutsceneVideo) {
        if (scene) scene.cutsceneVideo = null;
        renderLevelPanel();
        setStatus(`Cannot save level ${level.id}, Scene ${sceneIndex + 1}: cutscene requires a selected video.`, "err");
        return;
    }

    let payload = null;
    if (Object.keys(changes).length > 0) {
        payload = await updateScene(level.id, sceneIndex, changes);
    }
    if (scene && payload) {
        Object.assign(scene, payload.scene || changes);
    } else if (scene && Object.keys(changes).length > 0) {
        Object.assign(scene, changes);
    }

    if (pendingFile) {
        const uploadName = sanitizeImageBaseName(
            (scene && scene.backgroundImageName) || changes.backgroundImageName || `level_${level.id}_scene_${sceneIndex + 1}`,
            `level_${level.id}_scene_${sceneIndex + 1}`
        );
        await uploadSceneBackground(level.id, sceneIndex, pendingFile, uploadName);
    }

    if (pendingPreviewUrl) {
        try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
    }
    state.dirtyByScene.delete(key);
    await fetchLevelBackgrounds();
    renderLevelPanel();
    renderBackgroundPanel();
    setStatus(`Saved level ${level.id}, Scene ${sceneIndex + 1}.`, "ok");
}

async function commitPendingBackgroundImport() {
    const pending = state.pendingBackgroundImport;
    if (!pending) return;
    const { level, scene, sceneIndex, file, defaultName } = pending;
    const typedName = sanitizeImageBaseName(
        el.bgImportNameInput ? el.bgImportNameInput.value : "",
        defaultName
    );
    closeBackgroundImportModal({ clearPending: false });
    try {
        await uploadSceneBackground(level.id, sceneIndex, file, typedName);
        resetSceneDirty(level.id, sceneIndex);
        state.pendingBackgroundImport = null;
    } catch (error) {
        setStatus(error.message || "Failed to import background image.", "err");
        state.pendingBackgroundImport = null;
    }
}

function createSceneCard(level, scene, sceneIndex, totalScenes) {
    const row = document.createElement("div");
    row.className = "enemy-card";

    const statsRow = document.createElement("div");
    statsRow.className = "stats-row enemy-stats-row";

    let enemyFieldWrap = null;
    let cutsceneFieldWrap = null;
    let vendorFieldWrap = null;
    let warningEl = null;
    const updateWarningState = () => {
        if (!warningEl) return;
        const rawEffectiveType = String(getSceneField(level, scene, sceneIndex, "type") || "fight").trim().toLowerCase();
        const effectiveType = rawEffectiveType === "event" ? "cutscene" : rawEffectiveType;
        const effectiveEnemy = getSceneField(level, scene, sceneIndex, "enemy");
        const hasEnemy = !(effectiveEnemy === null || String(effectiveEnemy).trim() === "");
        const effectiveVendorItems = getValidVendorItems(getSceneField(level, scene, sceneIndex, "vendorItems"));
        const effectiveCutsceneVideo = String(getSceneField(level, scene, sceneIndex, "cutsceneVideo") || "").trim();
        const hasVendorItems = effectiveVendorItems.length > 0;
        const shouldWarnFight = effectiveType === "fight" && !hasEnemy;
        const shouldWarnVendor = effectiveType === "vendor" && !hasVendorItems;
        warningEl.textContent = shouldWarnFight
            ? "Warning: Fight scenes require an enemy."
            : (shouldWarnVendor ? "Warning: Vendor scenes require at least 1 selected item." : "");
        warningEl.classList.toggle("hidden", !shouldWarnFight && !shouldWarnVendor);
        warningEl.style.color = shouldWarnVendor ? "#ef4444" : "";
        if (enemyFieldWrap) enemyFieldWrap.classList.toggle("hidden", effectiveType !== "fight");
        if (cutsceneFieldWrap) cutsceneFieldWrap.classList.toggle("hidden", effectiveType !== "cutscene");
        if (vendorFieldWrap) vendorFieldWrap.classList.toggle("hidden", effectiveType !== "vendor");
    };
    const roundNumber = document.createElement("div");
    roundNumber.className = "scene-number-display";
    roundNumber.textContent = String(sceneIndex + 1);
    statsRow.appendChild(createLabeledField("scene", roundNumber));

    const typeSelect = document.createElement("select");
    const rawCurrentType = String(getSceneField(level, scene, sceneIndex, "type") || "fight").trim().toLowerCase();
    const currentType = rawCurrentType === "event" ? "cutscene" : rawCurrentType;
    row.classList.toggle("level-round-event", currentType !== "fight");
    row.classList.toggle("event-round-card", currentType !== "fight");
    row.classList.toggle("level-round-fight", currentType === "fight");
    const sortedEnemies = state.enemies
        .slice()
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    const firstEnemyId = sortedEnemies.length > 0 ? String(sortedEnemies[0] && sortedEnemies[0].id || "").trim() : "";
    const firstCutsceneVideoPath = state.cutsceneVideos.length > 0
        ? String(state.cutsceneVideos[0] && state.cutsceneVideos[0].path || "").trim()
        : "";
    [
        { value: "fight", label: "fight" },
        { value: "cutscene", label: "cutscene event" },
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
        setSceneDirty(level, scene, sceneIndex, "type", nextType);
        if (nextType === "vendor") {
            setSceneDirty(level, scene, sceneIndex, "enemy", null);
            setSceneDirty(level, scene, sceneIndex, "cutsceneVideo", null);
        } else if (nextType === "cutscene") {
            setSceneDirty(level, scene, sceneIndex, "enemy", null);
            setSceneDirty(level, scene, sceneIndex, "vendorItems", []);
            setSceneDirty(level, scene, sceneIndex, "cutsceneVideo", firstCutsceneVideoPath || null);
        } else {
            if (!String(getSceneField(level, scene, sceneIndex, "enemy") || "").trim()) {
                setSceneDirty(level, scene, sceneIndex, "enemy", firstEnemyId || null);
            }
            setSceneDirty(level, scene, sceneIndex, "cutsceneVideo", null);
            setSceneDirty(level, scene, sceneIndex, "vendorItems", []);
        }
        updateWarningState();
        queueSceneAutoSave(level.id, sceneIndex);
        renderLevelPanel();
    });
    statsRow.appendChild(createLabeledField("type", typeSelect));

    const selectedEnemyIdRaw = String(getSceneField(level, scene, sceneIndex, "enemy") || "").trim();
    const selectedEnemyId = (currentType === "fight" && !selectedEnemyIdRaw)
        ? (firstEnemyId || null)
        : (selectedEnemyIdRaw || null);
    const enemyPicker = createEnemyPicker(level, scene, sceneIndex, selectedEnemyId, enemyId => {
        setSceneDirty(level, scene, sceneIndex, "enemy", enemyId);
        queueSceneAutoSave(level.id, sceneIndex);
        renderLevelPanel();
        setStatus(`Enemy selection changed for level ${level.id}, Scene ${sceneIndex + 1}. Auto-saving.`);
    });
    enemyFieldWrap = createLabeledField("enemy", enemyPicker, "level-enemy-field");
    statsRow.appendChild(enemyFieldWrap);

    const cutsceneVideoSelect = document.createElement("select");
    const selectedCutsceneVideoRaw = String(getSceneField(level, scene, sceneIndex, "cutsceneVideo") || "").trim();
    const selectedCutsceneVideo = selectedCutsceneVideoRaw || firstCutsceneVideoPath;
    state.cutsceneVideos.forEach(video => {
        const option = document.createElement("option");
        option.value = String(video && video.path || "");
        option.textContent = String(video && video.name || video && video.path || "video");
        if (option.value === selectedCutsceneVideo) option.selected = true;
        cutsceneVideoSelect.appendChild(option);
    });
    cutsceneVideoSelect.addEventListener("change", () => {
        const nextVideo = String(cutsceneVideoSelect.value || "").trim();
        setSceneDirty(level, scene, sceneIndex, "cutsceneVideo", nextVideo || null);
        queueSceneAutoSave(level.id, sceneIndex);
        renderLevelPanel();
        setStatus(`Cutscene video changed for level ${level.id}, Scene ${sceneIndex + 1}. Auto-saving.`);
    });
    cutsceneFieldWrap = createLabeledField("cutscene", cutsceneVideoSelect, "level-cutscene-field");
    statsRow.appendChild(cutsceneFieldWrap);

    const vendorItemsValue = getValidVendorItems(getSceneField(level, scene, sceneIndex, "vendorItems"));
    const vendorPicker = document.createElement("div");
    vendorPicker.className = "level-vendor-picker";
    const selectedInfo = document.createElement("div");
    selectedInfo.className = "muted";
    selectedInfo.textContent = `selected: ${vendorItemsValue.length}`;
    const openVendorBtn = document.createElement("button");
    openVendorBtn.type = "button";
    openVendorBtn.className = "btn-secondary";
    openVendorBtn.textContent = "Select Vendor Items";
    openVendorBtn.addEventListener("click", () => openVendorSelectModal(level.id, sceneIndex));
    vendorPicker.appendChild(selectedInfo);
    vendorPicker.appendChild(openVendorBtn);
    vendorFieldWrap = createLabeledField("item select", vendorPicker, "level-vendor-field");
    statsRow.appendChild(vendorFieldWrap);

    row.appendChild(statsRow);

    const mediaRow = document.createElement("div");
    mediaRow.className = "level-background-section";

    const currentSceneBackground = String(getSceneField(level, scene, sceneIndex, "background") || "");

    const imageField = document.createElement("div");
    imageField.className = "level-background-left";

    const pickerButton = document.createElement("div");
    pickerButton.className = "new-image-picker-btn";

    const pickerText = document.createElement("span");
    pickerText.className = "new-image-picker-text";
    pickerText.textContent = currentType === "cutscene" ? "no background needed" : "no background selected";

    const preview = document.createElement("img");
    preview.className = "new-image-preview hidden";
    preview.alt = `Level ${level.id} Scene ${sceneIndex + 1} background preview`;
    preview.loading = "lazy";
    const cutscenePreview = document.createElement("video");
    cutscenePreview.className = "new-image-preview hidden";
    cutscenePreview.muted = true;
    cutscenePreview.loop = true;
    cutscenePreview.autoplay = false;
    cutscenePreview.controls = false;
    cutscenePreview.playsInline = true;
    cutscenePreview.preload = "metadata";
    const cutsceneToggleBtn = document.createElement("button");
    cutsceneToggleBtn.type = "button";
    cutsceneToggleBtn.className = "cutscene-preview-toggle hidden";
    cutsceneToggleBtn.textContent = "Play Video";
    const syncCutsceneToggleLabel = () => {
        cutsceneToggleBtn.textContent = cutscenePreview.paused ? "Play Video" : "Stop Video";
    };
    cutsceneToggleBtn.addEventListener("click", async () => {
        if (cutscenePreview.paused) {
            try {
                if (cutscenePreview.readyState === 0) {
                    cutscenePreview.load();
                }
                if (cutscenePreview.currentTime <= 0) {
                    cutscenePreview.currentTime = 0;
                }
                await cutscenePreview.play();
                setStatus(`Playing cutscene preview for level ${level.id}, Scene ${sceneIndex + 1}.`, "ok");
            } catch (error) {
                setStatus(`Failed to play cutscene preview: ${error && error.message ? error.message : "unknown error"}`, "err");
            }
        } else {
            cutscenePreview.pause();
            setStatus(`Stopped cutscene preview for level ${level.id}, Scene ${sceneIndex + 1}.`);
        }
        syncCutsceneToggleLabel();
    });
    cutscenePreview.addEventListener("play", syncCutsceneToggleLabel);
    cutscenePreview.addEventListener("pause", syncCutsceneToggleLabel);
    cutscenePreview.addEventListener("error", () => {
        const mediaError = cutscenePreview.error;
        const code = mediaError && typeof mediaError.code === "number" ? mediaError.code : 0;
        setStatus(`Failed to load cutscene preview video (error code: ${code || "unknown"}).`, "err");
    });
    if (currentType !== "cutscene") {
        loadPreviewImage(preview, pickerText, buildProjectAssetUrl(currentSceneBackground)).catch(() => {
            preview.classList.add("hidden");
            pickerText.classList.remove("hidden");
        });
    } else {
        preview.classList.add("hidden");
        const cutsceneVideoUrl = buildProjectAssetUrl(selectedCutsceneVideo);
        if (cutsceneVideoUrl) {
            cutscenePreview.src = cutsceneVideoUrl;
            cutscenePreview.classList.remove("hidden");
            cutsceneToggleBtn.classList.remove("hidden");
            pickerText.classList.add("hidden");
            syncCutsceneToggleLabel();
        } else {
            cutscenePreview.classList.add("hidden");
            cutsceneToggleBtn.classList.add("hidden");
            pickerText.classList.remove("hidden");
            pickerText.textContent = "no cutscene video selected";
        }
    }

    const backgroundSelectField = document.createElement("div");
    backgroundSelectField.className = "level-background-right";
    const selectorLabel = document.createElement("span");
    selectorLabel.className = "add-col-label";
    selectorLabel.textContent = "background image";
    backgroundSelectField.appendChild(selectorLabel);

    const selectedName = String(getSceneField(level, scene, sceneIndex, "backgroundImageName") || getBackgroundPathLabel(currentSceneBackground) || "").trim();
    const selectedNameText = document.createElement("div");
    selectedNameText.className = "muted";
    selectedNameText.textContent = selectedName ? `selected: ${selectedName}` : "selected: none";

    const selectBackgroundBtn = document.createElement("button");
    selectBackgroundBtn.type = "button";
    selectBackgroundBtn.className = "btn-secondary";
    selectBackgroundBtn.textContent = "Select background";
    selectBackgroundBtn.addEventListener("click", () => {
        openBackgroundSelectModal(level.id, sceneIndex);
    });

    backgroundSelectField.appendChild(selectedNameText);
    backgroundSelectField.appendChild(selectBackgroundBtn);
    if (currentType === "cutscene") backgroundSelectField.classList.add("hidden");

    pickerButton.appendChild(pickerText);
    pickerButton.appendChild(preview);
    pickerButton.appendChild(cutscenePreview);
    pickerButton.appendChild(cutsceneToggleBtn);
    imageField.appendChild(pickerButton);
    mediaRow.appendChild(imageField);
    mediaRow.appendChild(backgroundSelectField);
    row.appendChild(mediaRow);

    const actionRow = document.createElement("div");
    actionRow.className = "enemy-card-actions";

    const removeRoundBtn = document.createElement("button");
    removeRoundBtn.type = "button";
    removeRoundBtn.className = "btn-danger";
    removeRoundBtn.textContent = "Remove Scene";
    removeRoundBtn.disabled = totalScenes <= 1;
    removeRoundBtn.addEventListener("click", () => {
        openDeleteConfirmModal({ levelId: level.id, sceneIndex });
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

    const header = document.createElement("div");
    header.className = "level-card-header";

    const title = document.createElement("h2");
    title.className = "section-title level-card-title";
    title.textContent = `${level.name || `Level ${level.id}`}`;
    header.appendChild(title);

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "btn-secondary level-collapse-btn";
    const isCollapsed = state.collapsedLevels.has(level.id);
    collapseBtn.textContent = isCollapsed ? "\u25BE" : "\u25B4";
    collapseBtn.addEventListener("click", () => {
        if (state.collapsedLevels.has(level.id)) state.collapsedLevels.delete(level.id);
        else state.collapsedLevels.add(level.id);
        renderLevelPanel();
    });
    header.appendChild(collapseBtn);
    card.appendChild(header);

    const scenesContainer = document.createElement("div");
    scenesContainer.className = "enemy-panel-list";
    if (isCollapsed) scenesContainer.classList.add("hidden");
    const rounds = Array.isArray(level.scenes) ? level.scenes : [];
    rounds.forEach((scene, sceneIndex) => {
        scenesContainer.appendChild(createSceneCard(level, scene, sceneIndex, rounds.length));
    });
    card.appendChild(scenesContainer);

    const addRoundRow = document.createElement("div");
    addRoundRow.className = "enemy-card-actions";
    const addRoundBtn = document.createElement("button");
    addRoundBtn.type = "button";
    addRoundBtn.textContent = "Add Scene";
    addRoundBtn.addEventListener("click", () => {
        addScene(level.id).catch(error => setStatus(error.message, "err"));
    });
    addRoundRow.appendChild(addRoundBtn);
    if (isCollapsed) addRoundRow.classList.add("hidden");
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
        .map(entry => `Level ${entry.levelId} Scene ${entry.scene}`)
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
    setupCloseButtons();
    if (!el.levelPanelList) return;
    setStatus("Loading levels...");
    await Promise.all([fetchLevels(), fetchEnemies(), fetchCutsceneVideos(), fetchLevelBackgrounds(), fetchSellableEntries()]);
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
        const pending = state.pendingSceneDelete;
        if (!pending) {
            closeDeleteConfirmModal();
            return;
        }
        closeDeleteConfirmModal();
        removeScene(pending.levelId, pending.sceneIndex).catch(error => setStatus(error.message, "err"));
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
