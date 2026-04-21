const state = {
    levels: [],
    levelBackgrounds: [],
    activeImageJobs: 0,
    sortBy: "name"
};

const el = {
    status: document.getElementById("status"),
    backgroundPanelList: document.getElementById("background-panel-list"),
    addBgPickerBtn: document.getElementById("add-bg-picker-btn"),
    addBgPickerText: document.getElementById("add-bg-picker-text"),
    addBgPreview: document.getElementById("add-bg-preview"),
    addBgFileInput: document.getElementById("add-bg-file-input"),
    addBgLevelSelect: document.getElementById("add-bg-level-select"),
    addBgNameInput: document.getElementById("add-bg-name-input"),
    addBgSaveBtn: document.getElementById("add-bg-save-btn"),
    addBgWarning: document.getElementById("add-bg-warning"),
    backgroundSortSelect: document.getElementById("background-sort-select"),
    imageProcessingOverlay: document.getElementById("image-processing-overlay"),
    processingOverlayText: document.getElementById("processing-overlay-text"),
    processingProgressFill: document.getElementById("processing-progress-fill"),
    processingProgressLabel: document.getElementById("processing-progress-label")
};
const LARGE_BACKGROUND_THRESHOLD_BYTES = 3 * 1024 * 1024;

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

function setStatus(message, kind = "muted") {
    if (!el.status) return;
    el.status.textContent = message;
    el.status.className = kind === "muted" ? "muted mt8" : `muted mt8 status-${kind}`;
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

function sanitizeImageBaseName(input, fallback) {
    const trimmed = String(input || "").trim();
    const withoutExtension = trimmed.replace(/\.[a-zA-Z0-9]+$/, "");
    const safe = withoutExtension.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
    return safe || String(fallback || "background");
}

function applyLevelPrefixToName(rawName, levelId) {
    const safeLevelId = Number.isFinite(Number(levelId)) && Number(levelId) > 0 ? Number(levelId) : 1;
    const requiredPrefix = `level_${safeLevelId}_`;
    const sanitized = sanitizeImageBaseName(rawName, `${requiredPrefix}background`);
    if (sanitized.startsWith(requiredPrefix)) return sanitized;
    if (/^level_\d+_/.test(sanitized)) {
        return sanitized.replace(/^level_\d+_/, requiredPrefix);
    }
    return `${requiredPrefix}${sanitized}`;
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
        renderAddPanel();
        renderBackgroundPanel();
        if (payload && payload.compression) {
            const compression = payload.compression;
            if (compression.enabled && compression.compressed) {
                const attempts = `${compression.attemptsUsed || 1}/${compression.maxAttempts || plannedAttempts}`;
                setStatus(`Replaced background image (TinyPNG compressed, attempts ${attempts}).`, "ok");
            } else if (!compression.enabled) {
                setStatus("Replaced background image. TinyPNG disabled (missing API key).", "ok");
            } else {
                setStatus(`Replaced background image. TinyPNG skipped (${compression.reason || "no change"}).`, "ok");
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

async function openBackgroundInFolder(backgroundPath) {
    const response = await fetch("/api/open-in-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: backgroundPath })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to open folder.");
    return payload;
}

function createLevelBackgroundRequest(payload, plannedAttempts = 2) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const attemptTicker = createAttemptTicker(plannedAttempts);
        xhr.open("POST", "/api/level-backgrounds", true);
        xhr.timeout = 120000;
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = event => {
            if (!event.lengthComputable || event.total <= 0) return;
            const uploadPercent = Math.floor((event.loaded / event.total) * 85);
            setProcessingProgress(uploadPercent, "Uploading new background...");
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
            reject(new Error(body.error || "Create background failed."));
        };
        xhr.onerror = () => {
            attemptTicker.stop();
            reject(new Error("Create background failed."));
        };
        xhr.ontimeout = () => {
            attemptTicker.stop();
            reject(new Error("Create background timed out. Please try a smaller image."));
        };
        xhr.send(JSON.stringify(payload));
    });
}

async function createLevelBackground({ levelId, file, backgroundImageName }) {
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(5, "Reading image...");
    try {
        const plannedAttempts = getPlannedBackgroundAttempts(file.size);
        const dataBase64 = await fileToBase64(file);
        const payload = await createLevelBackgroundRequest({
            levelId,
            filename: file.name,
            dataBase64,
            backgroundImageName
        }, plannedAttempts);
        setProcessingProgress(100, "Done");
        return payload;
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

function formatBackgroundUsage(usageList) {
    if (!Array.isArray(usageList) || usageList.length === 0) return "";
    return usageList
        .map(entry => `Level ${entry.levelId} Round ${entry.round}`)
        .join(", ");
}

function createLabeledField(labelText, controlEl) {
    const field = document.createElement("div");
    field.className = "stats-field";
    const label = document.createElement("span");
    label.className = "add-col-label";
    label.textContent = labelText;
    field.appendChild(label);
    field.appendChild(controlEl);
    return field;
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatUpdatedTime(updatedAtMs) {
    const ms = Number(updatedAtMs) || 0;
    if (ms <= 0) return "n/a";
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return "n/a";
    return date.toLocaleString();
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

    const metaRow = document.createElement("div");
    metaRow.className = "background-meta-row";

    const sizeTag = document.createElement("span");
    sizeTag.className = "background-meta-tag";
    sizeTag.textContent = `size: ${formatBytes(entry.sizeBytes)}`;

    const updatedTag = document.createElement("span");
    updatedTag.className = "background-meta-tag";
    updatedTag.textContent = `updated: ${formatUpdatedTime(entry.updatedAtMs)}`;

    metaRow.appendChild(sizeTag);
    metaRow.appendChild(updatedTag);
    content.appendChild(metaRow);

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
                renderAddPanel();
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
                renderAddPanel();
                renderBackgroundPanel();
                setStatus("Removed background image.", "ok");
            })
            .catch(error => setStatus(error.message, "err"));
    });

    const openFolderLink = document.createElement("button");
    openFolderLink.type = "button";
    openFolderLink.className = "background-open-link";
    openFolderLink.textContent = "Open Folder";
    openFolderLink.addEventListener("click", () => {
        openBackgroundInFolder(entry.background)
            .then(() => {
                setStatus("Opened file location in Explorer.", "ok");
            })
            .catch(error => setStatus(error.message, "err"));
    });

    actions.appendChild(saveNameBtn);
    actions.appendChild(replaceBtn);
    actions.appendChild(removeBtn);
    content.appendChild(actions);
    content.appendChild(openFolderLink);
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
    const sorted = backgrounds.slice().sort((a, b) => {
        if (state.sortBy === "updated") {
            return (Number(b.updatedAtMs) || 0) - (Number(a.updatedAtMs) || 0);
        }
        if (state.sortBy === "size") {
            return (Number(b.sizeBytes) || 0) - (Number(a.sizeBytes) || 0);
        }
        const aName = String(a.backgroundImageName || a.fileName || a.background || "");
        const bName = String(b.backgroundImageName || b.fileName || b.background || "");
        return aName.localeCompare(bName);
    });

    sorted
        .forEach(entry => {
            el.backgroundPanelList.appendChild(createBackgroundCard(entry));
        });
}

function renderAddPanel() {
    if (!el.addBgLevelSelect) return;
    const levels = Array.isArray(state.levels) ? state.levels : [];
    const previousValue = String(el.addBgLevelSelect.value || "");
    el.addBgLevelSelect.innerHTML = "";
    levels.forEach(level => {
        const option = document.createElement("option");
        option.value = String(level.id);
        option.textContent = level.name || `Level ${level.id}`;
        el.addBgLevelSelect.appendChild(option);
    });
    if (levels.length > 0) {
        const hasLevelOne = levels.some(level => Number(level.id) === 1);
        if (hasLevelOne) {
            el.addBgLevelSelect.value = "1";
        } else if (previousValue && levels.some(level => String(level.id) === previousValue)) {
            el.addBgLevelSelect.value = previousValue;
        } else {
            el.addBgLevelSelect.value = String(levels[0].id);
        }
    }
    const selectedLevel = Number(el.addBgLevelSelect.value || 1);
    el.addBgNameInput.value = applyLevelPrefixToName(
        el.addBgNameInput.value,
        selectedLevel
    );
}

function syncNamePrefixToSelectedLevel() {
    if (!el.addBgLevelSelect || !el.addBgNameInput) return;
    const selectedLevel = Number(el.addBgLevelSelect.value || 1);
    el.addBgNameInput.value = applyLevelPrefixToName(el.addBgNameInput.value, selectedLevel);
}

function updateNameFromFileSelection(fileName) {
    if (!el.addBgLevelSelect || !el.addBgNameInput) return;
    const selectedLevel = Number(el.addBgLevelSelect.value || 1);
    const next = applyLevelPrefixToName(fileName, selectedLevel);
    el.addBgNameInput.value = next;
}

function initializeDefaultAddName() {
    if (!el.addBgNameInput || !el.addBgLevelSelect) return;
    if (el.addBgNameInput.value.trim().length > 0) return;
    const selectedLevel = Number(el.addBgLevelSelect.value || 1);
    el.addBgNameInput.value = applyLevelPrefixToName("", selectedLevel);
}

function bindAddControls() {
    if (el.backgroundSortSelect) {
        el.backgroundSortSelect.value = state.sortBy;
        el.backgroundSortSelect.addEventListener("change", () => {
            state.sortBy = String(el.backgroundSortSelect.value || "name");
            renderBackgroundPanel();
        });
    }

    if (el.addBgPickerBtn && el.addBgFileInput) {
        el.addBgPickerBtn.addEventListener("click", () => {
            el.addBgFileInput.click();
        });
    }
    if (el.addBgFileInput && el.addBgPreview && el.addBgPickerText) {
        el.addBgFileInput.addEventListener("change", () => {
            const file = el.addBgFileInput.files && el.addBgFileInput.files[0] ? el.addBgFileInput.files[0] : null;
            if (!file) return;
            if (el.addBgPreview.dataset.objectUrl) {
                try { URL.revokeObjectURL(el.addBgPreview.dataset.objectUrl); } catch (_) {}
            }
            const previewUrl = URL.createObjectURL(file);
            el.addBgPreview.dataset.objectUrl = previewUrl;
            el.addBgPreview.src = previewUrl;
            el.addBgPreview.classList.remove("hidden");
            el.addBgPickerText.classList.add("hidden");
            if (!el.addBgNameInput.value || /^level_\d+_background$/.test(el.addBgNameInput.value)) {
                updateNameFromFileSelection(file.name);
            }
        });
    }
    if (el.addBgLevelSelect && el.addBgNameInput) {
        el.addBgLevelSelect.addEventListener("change", () => {
            syncNamePrefixToSelectedLevel();
        });
    }
    if (el.addBgSaveBtn) {
        el.addBgSaveBtn.addEventListener("click", () => {
            const file = el.addBgFileInput && el.addBgFileInput.files && el.addBgFileInput.files[0]
                ? el.addBgFileInput.files[0]
                : null;
            const levelId = Number(el.addBgLevelSelect && el.addBgLevelSelect.value || 0);
            const nextName = applyLevelPrefixToName(
                el.addBgNameInput && el.addBgNameInput.value,
                levelId
            );
            if (el.addBgNameInput) el.addBgNameInput.value = nextName;
            if (!file) {
                if (el.addBgWarning) {
                    el.addBgWarning.textContent = "Please choose an image file first.";
                    el.addBgWarning.classList.remove("hidden");
                }
                return;
            }
            if (!Number.isFinite(levelId) || levelId <= 0) {
                if (el.addBgWarning) {
                    el.addBgWarning.textContent = "Please choose a valid level.";
                    el.addBgWarning.classList.remove("hidden");
                }
                return;
            }
            if (el.addBgWarning) {
                el.addBgWarning.textContent = "";
                el.addBgWarning.classList.add("hidden");
            }
            setStatus(`Adding background to level ${levelId}...`);
            createLevelBackground({
                levelId,
                file,
                backgroundImageName: nextName
            })
                .then(async payload => {
                    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
                    renderAddPanel();
                    renderBackgroundPanel();
                    resetAddForm();
                    initializeDefaultAddName();
                    if (payload && payload.compression && payload.compression.enabled) {
                        const attempts = `${payload.compression.attemptsUsed || 1}/${payload.compression.maxAttempts || getPlannedBackgroundAttempts(file.size)}`;
                        setStatus(`Added new background '${nextName}' to level ${levelId} (attempts ${attempts}).`, "ok");
                    } else {
                        setStatus(`Added new background '${nextName}' to level ${levelId}.`, "ok");
                    }
                })
                .catch(error => {
                    setStatus(error.message || "Failed to add background image.", "err");
                });
        });
    }
}

function resetAddForm() {
    if (el.addBgPreview && el.addBgPreview.dataset.objectUrl) {
        try { URL.revokeObjectURL(el.addBgPreview.dataset.objectUrl); } catch (_) {}
        delete el.addBgPreview.dataset.objectUrl;
    }
    if (el.addBgPreview) {
        el.addBgPreview.classList.add("hidden");
        el.addBgPreview.removeAttribute("src");
    }
    if (el.addBgPickerText) el.addBgPickerText.classList.remove("hidden");
    if (el.addBgFileInput) el.addBgFileInput.value = "";
    if (el.addBgWarning) {
        el.addBgWarning.textContent = "";
        el.addBgWarning.classList.add("hidden");
    }
    if (el.addBgNameInput && el.addBgLevelSelect) {
        const selectedLevel = Number(el.addBgLevelSelect.value || 1);
        el.addBgNameInput.value = applyLevelPrefixToName("", selectedLevel);
    }
}

async function init() {
    setupCollapsiblePanels();
    bindAddControls();
    setStatus("Loading backgrounds...");
    await Promise.all([fetchLevels(), fetchLevelBackgrounds()]);
    renderAddPanel();
    initializeDefaultAddName();
    renderBackgroundPanel();
    setStatus(`Loaded ${state.levelBackgrounds.length} background image${state.levelBackgrounds.length === 1 ? "" : "s"}.`, "ok");
}

init().catch(error => setStatus(error.message, "err"));
