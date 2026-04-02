const state = {
    enemies: [],
    enemyOrder: [],
    sort: { col: "", dir: "" },
    dirtyById: new Map(),
    levelsPicker: {
        menuEl: null,
        openAnchor: null,
        selectedValues: ["all"],
        onChange: null
    },
    addValidationTouched: false,
    pendingDeleteId: "",
    activeImageJobs: 0,
    newImageFile: null,
    newLevelsSelection: ["all"],
    metadata: {
        enemyTypeOptions: ["monster", "warrior", "mage", "archer", "rogue", "paladin", "spirit", "hunter"],
        enemySizeOptions: ["s", "m", "l", "xl", "2xl"],
        enemySizeToPx: { s: 150, m: 220, l: 300, xl: 400, "2xl": 600 },
        enemyLevelOptions: ["all", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    }
};

const el = {
    status: document.getElementById("status"),
    enemySortBar: document.getElementById("enemy-sort-bar"),
    enemyPanelList: document.getElementById("enemy-panel-list"),
    addBtn: document.getElementById("add-btn"),
    newImagePickerBtn: document.getElementById("new-image-picker-btn"),
    newImageInput: document.getElementById("new-image-input"),
    newImagePickerText: document.getElementById("new-image-picker-text"),
    newImagePreview: document.getElementById("new-image-preview"),
    addFormWarning: document.getElementById("add-form-warning"),
    newName: document.getElementById("new-name"),
    newSize: document.getElementById("new-size"),
    newHp: document.getElementById("new-hp"),
    newAtk: document.getElementById("new-atk"),
    newDef: document.getElementById("new-def"),
    newCrit: document.getElementById("new-crit"),
    newDodge: document.getElementById("new-dodge"),
    newAim: document.getElementById("new-aim"),
    newExp: document.getElementById("new-exp"),
    newDesc: document.getElementById("new-desc"),
    sizeTipTrigger: document.getElementById("size-tip-trigger"),
    addSuccessModal: document.getElementById("add-success-modal"),
    addSuccessMessage: document.getElementById("add-success-message"),
    addSuccessClose: document.getElementById("add-success-close"),
    deleteConfirmModal: document.getElementById("delete-confirm-modal"),
    deleteConfirmMessage: document.getElementById("delete-confirm-message"),
    deleteCancelBtn: document.getElementById("delete-cancel-btn"),
    deleteConfirmBtn: document.getElementById("delete-confirm-btn"),
    imageProcessingOverlay: document.getElementById("image-processing-overlay"),
    processingOverlayText: document.getElementById("processing-overlay-text"),
    processingProgressFill: document.getElementById("processing-progress-fill"),
    processingProgressLabel: document.getElementById("processing-progress-label")
};

const SORT_FIELDS = [
    { key: "id", label: "id" },
    { key: "name", label: "name" },
    { key: "size", label: "size" },
    { key: "file_size", label: "file size" },
    { key: "hp", label: "hp" },
    { key: "atk", label: "atk" },
    { key: "def", label: "def" },
    { key: "crit", label: "crit" },
    { key: "dodge", label: "dodge" },
    { key: "aim", label: "aim" },
    { key: "exp", label: "exp" }
];

function setStatus(message, kind = "muted") {
    if (!el.status) return;
    el.status.textContent = message;
    el.status.className = kind === "muted" ? "muted" : `muted status-${kind}`;
}

function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function showAddSuccessModal(enemyId) {
    if (!el.addSuccessModal) return;
    if (el.addSuccessMessage) {
        el.addSuccessMessage.textContent = `Enemy '${enemyId}' was added successfully.`;
    }
    el.addSuccessModal.classList.remove("hidden");
    el.addSuccessModal.setAttribute("aria-hidden", "false");
}

function closeAddSuccessModal() {
    if (!el.addSuccessModal) return;
    el.addSuccessModal.classList.add("hidden");
    el.addSuccessModal.setAttribute("aria-hidden", "true");
}

function openDeleteConfirmModal(enemyId, enemyName) {
    state.pendingDeleteId = enemyId;
    if (el.deleteConfirmMessage) {
        const nameText = String(enemyName || enemyId || "this enemy");
        el.deleteConfirmMessage.textContent = `Delete '${nameText}' from the project? This will remove its folder, data, and images.`;
    }
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.remove("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "false");
}

function closeDeleteConfirmModal() {
    state.pendingDeleteId = "";
    if (!el.deleteConfirmModal) return;
    el.deleteConfirmModal.classList.add("hidden");
    el.deleteConfirmModal.setAttribute("aria-hidden", "true");
}

function updateImageProcessingOverlay() {
    if (!el.imageProcessingOverlay) return;
    const isBusy = state.activeImageJobs > 0;
    el.imageProcessingOverlay.classList.toggle("hidden", !isBusy);
    el.imageProcessingOverlay.setAttribute("aria-hidden", isBusy ? "false" : "true");
    if (!isBusy) {
        setProcessingProgress(0, "Processing...");
    }
}

function setProcessingProgress(percent, text = "Processing...") {
    const value = Math.max(0, Math.min(100, Math.floor(percent)));
    if (el.processingOverlayText) el.processingOverlayText.textContent = text;
    if (el.processingProgressFill) el.processingProgressFill.style.width = `${value}%`;
    if (el.processingProgressLabel) el.processingProgressLabel.textContent = `${value}%`;
}

function uploadEnemyImageRequest(enemyId, payload) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/enemies/${enemyId}/image`, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = event => {
            if (!event.lengthComputable || event.total <= 0) return;
            const uploadPercent = Math.floor((event.loaded / event.total) * 85);
            setProcessingProgress(uploadPercent, "Uploading image...");
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
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
        xhr.onerror = () => reject(new Error("Image upload failed."));
        xhr.send(JSON.stringify(payload));
    });
}

function getAddFormValidationErrors() {
    const errors = [];
    if (!state.newImageFile) errors.push("Image");
    if (!String(el.newName?.value || "").trim()) errors.push("Name");
    if (!String(el.newSize?.value || "").trim()) errors.push("Size");
    if (!String(el.newDesc?.value || "").trim()) errors.push("Description");

    const numericFields = [
        ["HP", el.newHp],
        ["ATK", el.newAtk],
        ["DEF", el.newDef],
        ["CRIT", el.newCrit],
        ["DODGE", el.newDodge],
        ["AIM", el.newAim],
        ["EXP", el.newExp]
    ];
    numericFields.forEach(([label, input]) => {
        const raw = String(input?.value ?? "").trim();
        const num = Number(raw);
        if (raw === "" || !Number.isFinite(num)) errors.push(label);
    });

    return errors;
}

function refreshAddFormValidation(showErrors = false) {
    if (!el.addBtn) return;
    const errors = getAddFormValidationErrors();
    el.addBtn.disabled = false;
    if (!el.addFormWarning) return;
    if (!showErrors || errors.length === 0) {
        el.addFormWarning.textContent = "";
        el.addFormWarning.classList.add("hidden");
        return;
    }
    el.addFormWarning.textContent = `Missing required fields: ${errors.join(", ")}`;
    el.addFormWarning.classList.remove("hidden");
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

function buildEnemyImageUrl(enemyId) {
    return `/api/enemies/${encodeURIComponent(enemyId)}/image`;
}

async function loadPreviewImage(previewEl, labelEl, sources) {
    const sourceList = Array.isArray(sources) ? sources.filter(Boolean) : [];
    for (const src of sourceList) {
        try {
            const response = await fetch(src, { cache: "no-store" });
            if (!response.ok) continue;
            const blob = await response.blob();
            if (!blob || blob.size === 0) continue;
            if (previewEl.dataset.objectUrl) {
                URL.revokeObjectURL(previewEl.dataset.objectUrl);
            }
            const objectUrl = URL.createObjectURL(blob);
            previewEl.dataset.objectUrl = objectUrl;
            previewEl.src = objectUrl;
            previewEl.classList.remove("hidden");
            labelEl.classList.add("hidden");
            return true;
        } catch (_) {
            // Try next source.
        }
    }
    previewEl.classList.add("hidden");
    labelEl.classList.remove("hidden");
    return false;
}

function resetNewImageSelection() {
    state.newImageFile = null;
    if (el.newImagePreview) {
        el.newImagePreview.src = "";
        el.newImagePreview.classList.add("hidden");
    }
    if (el.newImagePickerText) {
        el.newImagePickerText.classList.remove("hidden");
        el.newImagePickerText.textContent = "click to import image";
    }
    if (el.newImageInput) el.newImageInput.value = "";
    refreshAddFormValidation();
}

function setNewImageSelection(file) {
    state.newImageFile = file || null;
    if (!file) {
        resetNewImageSelection();
        return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (el.newImagePreview) {
        el.newImagePreview.src = objectUrl;
        el.newImagePreview.classList.remove("hidden");
    }
    if (el.newImagePickerText) {
        el.newImagePickerText.classList.add("hidden");
    }
    refreshAddFormValidation();
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

async function uploadEnemyImage(enemyId, file) {
    if (!file) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(5, "Reading image...");
    setStatus(`Uploading image for '${enemyId}'...`);
    try {
        const dataBase64 = await fileToBase64(file);
        setProcessingProgress(88, "Processing image...");
        const payload = await uploadEnemyImageRequest(enemyId, { filename: file.name, dataBase64 });
        setProcessingProgress(98, "Saving image...");

        const target = state.enemies.find(entry => entry.id === enemyId);
        if (target) {
            target.img = payload.img;
            target.imageSizeBytes = Number(payload.imageSizeBytes || (payload.compression && payload.compression.savedBytes) || 0);
        }

        const dirty = state.dirtyById.get(enemyId);
        if (dirty && Object.prototype.hasOwnProperty.call(dirty, "img")) {
            delete dirty.img;
            if (Object.keys(dirty).length === 0) state.dirtyById.delete(enemyId);
        }

        renderEnemyPanel();
        setProcessingProgress(100, "Done");
        if (payload && payload.compression) {
            const compression = payload.compression;
            if (compression.enabled && compression.compressed) {
                const attempts = `${compression.attemptsUsed || 1}/${compression.maxAttempts || 1}`;
                setStatus(
                    `Image updated for '${enemyId}'. TinyPNG compressed ${compression.originalBytes} -> ${compression.savedBytes} bytes (attempts ${attempts}).`,
                    "ok"
                );
            } else if (!compression.enabled) {
                setStatus(`Image updated for '${enemyId}'. TinyPNG disabled (missing API key).`, "ok");
            } else {
                setStatus(`Image updated for '${enemyId}'. TinyPNG skipped (${compression.reason || "no change"}).`, "ok");
            }
        } else {
            setStatus(`Image updated for '${enemyId}'.`, "ok");
        }
        return payload;
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

async function deleteEnemyRequest(enemyId) {
    const response = await fetch(`/api/enemies/${enemyId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Failed to delete ${enemyId}.`);
    return payload;
}

async function deleteEnemy(enemyId) {
    if (!enemyId) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(12, "Preparing deletion...");
    setStatus(`Deleting '${enemyId}'...`);
    try {
        setProcessingProgress(45, "Deleting enemy files...");
        await deleteEnemyRequest(enemyId);
        setProcessingProgress(82, "Updating enemy index...");
        state.enemies = state.enemies.filter(entry => entry.id !== enemyId);
        state.enemyOrder = state.enemyOrder.filter(id => id !== enemyId);
        state.dirtyById.delete(enemyId);
        renderEnemyPanel();
        setProcessingProgress(100, "Deleted");
        setStatus(`Deleted '${enemyId}'.`, "ok");
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
}

async function openImageInFolder(relativePath) {
    const response = await fetch("/api/open-in-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: relativePath })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to open folder.");
    return payload;
}

function getEnemyField(enemy, field) {
    const dirty = state.dirtyById.get(enemy.id);
    if (dirty && field in dirty) return dirty[field];
    return enemy[field];
}

function valuesMatch(a, b) {
    if (typeof a === "number" || typeof b === "number") {
        return Number(a) === Number(b);
    }
    return String(a ?? "") === String(b ?? "");
}

function setDirty(enemy, field, value) {
    if (!enemy || !enemy.id) return;
    const enemyId = enemy.id;
    const existing = { ...(state.dirtyById.get(enemyId) || {}) };
    const originalValue = enemy[field];
    if (valuesMatch(value, originalValue)) {
        delete existing[field];
    } else {
        existing[field] = value;
    }
    if (Object.keys(existing).length === 0) {
        state.dirtyById.delete(enemyId);
        return;
    }
    state.dirtyById.set(enemyId, existing);
}

function resetDirty(enemyId) {
    state.dirtyById.delete(enemyId);
    renderEnemyPanel();
}

function setSelectOptions(selectEl, options, selectedValue = "", getLabel = null) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    options.forEach(optionValue => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = typeof getLabel === "function" ? getLabel(optionValue) : optionValue;
        if (optionValue === selectedValue) option.selected = true;
        selectEl.appendChild(option);
    });
}

function getEnemySizeLabel(sizeValue) {
    const sizeKey = String(sizeValue || "");
    const px = Number(state.metadata.enemySizeToPx && state.metadata.enemySizeToPx[sizeKey]);
    if (Number.isFinite(px) && px > 0) return `${sizeKey} (${px}px)`;
    return sizeKey;
}

function normalizeLevelsSelection(values) {
    const normalized = (Array.isArray(values) ? values : [values])
        .map(entry => String(entry))
        .filter(Boolean);
    if (normalized.includes("all")) return ["all"];
    const unique = Array.from(new Set(normalized));
    return unique.length > 0 ? unique : ["all"];
}

function formatLevelsLabel(values) {
    const normalized = normalizeLevelsSelection(values);
    if (normalized.includes("all")) return "all";
    if (normalized.length <= 3) return normalized.join(", ");
    return `${normalized.length} levels`;
}

function ensureLevelsPickerMenu() {
    if (state.levelsPicker.menuEl) return state.levelsPicker.menuEl;
    const menu = document.createElement("div");
    menu.className = "levels-picker-menu";
    menu.style.display = "none";
    document.body.appendChild(menu);
    state.levelsPicker.menuEl = menu;
    return menu;
}

function closeLevelsPicker() {
    const menu = ensureLevelsPickerMenu();
    menu.style.display = "none";
    menu.innerHTML = "";
    state.levelsPicker.openAnchor = null;
}

function updateLevelsPickerButton(buttonEl, values) {
    if (!buttonEl) return;
    buttonEl.textContent = formatLevelsLabel(values);
}

function openLevelsPicker({ anchorEl, values, onChange }) {
    const menu = ensureLevelsPickerMenu();
    const options = (state.metadata.enemyLevelOptions || []).map(entry => String(entry));
    let selected = normalizeLevelsSelection(values);
    state.levelsPicker.selectedValues = selected;
    state.levelsPicker.onChange = onChange;
    state.levelsPicker.openAnchor = anchorEl;

    const renderOptions = () => {
        menu.innerHTML = "";
        options.forEach(optionValue => {
            const row = document.createElement("label");
            row.className = "levels-picker-option";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = optionValue;
            checkbox.checked = selected.includes(optionValue);
            checkbox.addEventListener("change", () => {
                const next = new Set(selected);
                if (optionValue === "all") {
                    selected = checkbox.checked ? ["all"] : ["all"];
                } else {
                    next.delete("all");
                    if (checkbox.checked) next.add(optionValue);
                    else next.delete(optionValue);
                    selected = normalizeLevelsSelection(Array.from(next));
                }
                state.levelsPicker.selectedValues = selected;
                renderOptions();
                if (typeof state.levelsPicker.onChange === "function") {
                    state.levelsPicker.onChange(selected);
                }
            });
            const text = document.createElement("span");
            text.textContent = optionValue;
            row.appendChild(checkbox);
            row.appendChild(text);
            menu.appendChild(row);
        });
    };

    renderOptions();
    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 270, rect.bottom + 6)}px`;
    menu.style.display = "block";
}

function renderSizeHelp() {
    if (!el.sizeTipTrigger) return;
    const entries = Object.entries(state.metadata.enemySizeToPx || {});
    if (entries.length === 0) {
        el.sizeTipTrigger.dataset.tip = "";
        return;
    }
    const text = entries.map(([size, px]) => `${size} = ${px}px`).join(" | ");
    el.sizeTipTrigger.dataset.tip = `Size pixels: ${text}`;
}

function renderCreateFormOptions() {
    const sizeOptions = state.metadata.enemySizeOptions || [];
    setSelectOptions(el.newSize, sizeOptions, sizeOptions.includes("m") ? "m" : sizeOptions[0], getEnemySizeLabel);
    renderSizeHelp();
    refreshAddFormValidation();
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

function createEnemyStatInput(enemy, field, isNumber = false, onDirtyChange = null) {
    const input = document.createElement("input");
    if (isNumber) {
        input.type = "number";
        input.className = "small";
        input.value = Number(getEnemyField(enemy, field) ?? 0);
    } else {
        input.type = "text";
        input.value = String(getEnemyField(enemy, field) ?? "");
    }
    input.addEventListener("input", () => {
        setDirty(enemy, field, isNumber ? Number(input.value || 0) : input.value);
        input.classList.add("dirty");
        if (typeof onDirtyChange === "function") onDirtyChange();
    });
    return input;
}

function createEnemyCard(enemy) {
    const card = document.createElement("div");
    card.className = "enemy-card";
    let saveBtn = null;
    let resetBtn = null;
    const updateCardActionState = () => {
        const dirty = state.dirtyById.get(enemy.id);
        const hasChanges = Boolean(dirty && Object.keys(dirty).length > 0);
        if (saveBtn) saveBtn.disabled = !hasChanges;
        if (resetBtn) resetBtn.disabled = !hasChanges;
    };

    const statsRow = document.createElement("div");
    statsRow.className = "stats-row enemy-stats-row";

    const nameInput = createEnemyStatInput(enemy, "name", false, updateCardActionState);
    statsRow.appendChild(createLabeledField("name", nameInput));

    const sizeSelect = document.createElement("select");
    const sizeOptions = state.metadata.enemySizeOptions || [];
    setSelectOptions(sizeSelect, sizeOptions, getEnemyField(enemy, "size") || sizeOptions[0], getEnemySizeLabel);
    sizeSelect.addEventListener("change", () => {
        setDirty(enemy, "size", sizeSelect.value);
        sizeSelect.classList.add("dirty");
        updateCardActionState();
    });
    statsRow.appendChild(createLabeledField("size", sizeSelect));

    statsRow.appendChild(createLabeledField("hp", createEnemyStatInput(enemy, "hp", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("atk", createEnemyStatInput(enemy, "atk", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("def", createEnemyStatInput(enemy, "def", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("crit", createEnemyStatInput(enemy, "crit", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("dodge", createEnemyStatInput(enemy, "dodge", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("aim", createEnemyStatInput(enemy, "aim", true, updateCardActionState)));
    statsRow.appendChild(createLabeledField("exp", createEnemyStatInput(enemy, "exp", true, updateCardActionState)));

    card.appendChild(statsRow);

    const mediaRow = document.createElement("div");
    mediaRow.className = "add-media-row enemy-media-row";

    const imageField = document.createElement("div");
    imageField.className = "add-image-row";
    const imageLabel = document.createElement("span");
    imageLabel.className = "add-col-label";
    imageLabel.textContent = "image";

    const pickerButton = document.createElement("button");
    pickerButton.type = "button";
    pickerButton.className = "new-image-picker-btn";

    const pickerText = document.createElement("span");
    pickerText.className = "new-image-picker-text";
    pickerText.textContent = "click to import image";

    const preview = document.createElement("img");
    preview.className = "new-image-preview";
    preview.classList.add("hidden");
    preview.alt = `${enemy.id} image preview`;
    preview.loading = "lazy";

    const apiSource = buildEnemyImageUrl(enemy.id);
    const fileSource = buildProjectAssetUrl(getEnemyField(enemy, "img"));
    loadPreviewImage(preview, pickerText, [apiSource, fileSource]).catch(() => {
        preview.classList.add("hidden");
        pickerText.classList.remove("hidden");
    });

    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.className = "enemy-image-input";

    pickerButton.addEventListener("click", () => imageInput.click());
    imageInput.addEventListener("change", () => {
        const file = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
        uploadEnemyImage(enemy.id, file).catch(error => setStatus(error.message, "err"));
        imageInput.value = "";
    });

    pickerButton.appendChild(pickerText);
    pickerButton.appendChild(preview);

    imageField.appendChild(imageLabel);
    imageField.appendChild(pickerButton);
    imageField.appendChild(imageInput);
    const imageMetaRow = document.createElement("div");
    imageMetaRow.className = "row";
    const imageSizeText = document.createElement("div");
    imageSizeText.className = "muted";
    imageSizeText.textContent = `file size: ${formatFileSize(enemy.imageSizeBytes)}`;
    imageMetaRow.appendChild(imageSizeText);
    imageField.appendChild(imageMetaRow);

    const openFolderLink = document.createElement("button");
    openFolderLink.type = "button";
    openFolderLink.className = "background-open-link";
    openFolderLink.textContent = "Open Folder";
    openFolderLink.addEventListener("click", () => {
        const imgPath = String(getEnemyField(enemy, "img") || "").trim();
        if (!imgPath) {
            setStatus("No image path found for this enemy.", "err");
            return;
        }
        openImageInFolder(imgPath)
            .then(() => setStatus("Opened file location in Explorer.", "ok"))
            .catch(error => setStatus(error.message, "err"));
    });
    imageField.appendChild(openFolderLink);

    const descField = document.createElement("div");
    descField.className = "add-desc-row";
    const descLabel = document.createElement("span");
    descLabel.className = "add-col-label";
    descLabel.textContent = "description";
    const descInput = document.createElement("textarea");
    descInput.className = "enemy-description";
    descInput.value = String(getEnemyField(enemy, "desc") ?? "");
    descInput.addEventListener("input", () => {
        setDirty(enemy, "desc", descInput.value);
        descInput.classList.add("dirty");
        updateCardActionState();
    });
    descField.appendChild(descLabel);
    descField.appendChild(descInput);

    mediaRow.appendChild(imageField);
    mediaRow.appendChild(descField);
    card.appendChild(mediaRow);

    const actionRow = document.createElement("div");
    actionRow.className = "enemy-card-actions";

    saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
        saveEnemyChanges(enemy.id).catch(error => setStatus(error.message, "err"));
    });

    resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn-secondary";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => resetDirty(enemy.id));
    updateCardActionState();

    actionRow.appendChild(saveBtn);
    actionRow.appendChild(resetBtn);
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
        openDeleteConfirmModal(enemy.id, getEnemyField(enemy, "name"));
    });
    actionRow.appendChild(deleteBtn);
    card.appendChild(actionRow);

    return card;
}

function renderEnemyPanel() {
    if (!el.enemyPanelList) return;
    el.enemyPanelList.innerHTML = "";
    getRenderedEnemies().forEach(enemy => {
        el.enemyPanelList.appendChild(createEnemyCard(enemy));
    });
}

function getEnemySortValue(enemy, col) {
    if (!enemy) return "";
    if (col === "id") return String(enemy.id || "");
    if (col === "name") return String(getEnemyField(enemy, "name") || "");
    if (col === "file_size") return Number(enemy.imageSizeBytes || 0);
    if (col === "size") {
        const sizeOrder = { s: 1, m: 2, l: 3, xl: 4 };
        const sizeValue = String(getEnemyField(enemy, "size") || "").toLowerCase();
        return sizeOrder[sizeValue] || 0;
    }
    return Number(getEnemyField(enemy, col) || 0);
}

function getRenderedEnemies() {
    if (!state.sort.col || !state.sort.dir) return state.enemies;
    const sorted = [...state.enemies];
    const dirMul = state.sort.dir === "asc" ? 1 : -1;
    const numericCols = new Set(["size", "file_size", "hp", "atk", "def", "crit", "dodge", "aim", "exp"]);
    sorted.sort((a, b) => {
        const av = getEnemySortValue(a, state.sort.col);
        const bv = getEnemySortValue(b, state.sort.col);
        if (numericCols.has(state.sort.col)) {
            return (Number(av || 0) - Number(bv || 0)) * dirMul;
        }
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dirMul;
    });
    return sorted;
}

function toggleEnemySort(col) {
    if (state.sort.col !== col) {
        state.sort = { col, dir: "asc" };
    } else if (state.sort.dir === "asc") {
        state.sort = { col, dir: "desc" };
    } else {
        state.sort = { col: "", dir: "" };
    }
    renderSortControls();
    renderEnemyPanel();
}

function renderSortControls() {
    if (!el.enemySortBar) return;
    el.enemySortBar.innerHTML = "";
    SORT_FIELDS.forEach(field => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "enemy-sort-btn";
        const isActive = state.sort.col === field.key && Boolean(state.sort.dir);
        if (isActive) btn.classList.add("is-active");
        const suffix = isActive ? (state.sort.dir === "asc" ? " ^" : " v") : " <>";
        btn.textContent = `${field.label}${suffix}`;
        btn.addEventListener("click", () => toggleEnemySort(field.key));
        el.enemySortBar.appendChild(btn);
    });
}

function sortEnemiesByUiOrder(incomingEnemies) {
    if (!Array.isArray(incomingEnemies)) return [];
    if (!Array.isArray(state.enemyOrder) || state.enemyOrder.length === 0) {
        state.enemyOrder = incomingEnemies.map(enemy => enemy.id);
        return incomingEnemies;
    }
    const orderIndex = new Map();
    state.enemyOrder.forEach((id, index) => orderIndex.set(id, index));
    const sorted = [...incomingEnemies].sort((a, b) => {
        const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return String(a.id || "").localeCompare(String(b.id || ""));
    });
    state.enemyOrder = sorted.map(enemy => enemy.id);
    return sorted;
}

async function fetchEnemies(options = {}) {
    if (!el.enemyPanelList) return;
    setStatus("Loading enemies...");
    const response = await fetch("/api/enemies");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load enemies.");
    if (options.rename && options.rename.from && options.rename.to) {
        state.enemyOrder = state.enemyOrder.map(id => (id === options.rename.from ? options.rename.to : id));
    }
    state.enemies = sortEnemiesByUiOrder(payload.enemies || []);
    state.dirtyById.clear();
    renderEnemyPanel();
    setStatus(`Loaded ${state.enemies.length} enemies.`, "ok");
}

async function fetchMetadata() {
    const response = await fetch("/api/enemy-metadata");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load enemy metadata.");
    state.metadata = {
        enemyTypeOptions: Array.isArray(payload.enemyTypeOptions) ? payload.enemyTypeOptions : state.metadata.enemyTypeOptions,
        enemySizeOptions: Array.isArray(payload.enemySizeOptions) ? payload.enemySizeOptions : state.metadata.enemySizeOptions,
        enemySizeToPx: payload.enemySizeToPx && typeof payload.enemySizeToPx === "object" ? payload.enemySizeToPx : state.metadata.enemySizeToPx,
        enemyLevelOptions: Array.isArray(payload.enemyLevelOptions) ? payload.enemyLevelOptions : state.metadata.enemyLevelOptions
    };
    renderCreateFormOptions();
}

async function saveEnemyChanges(enemyId) {
    const changes = state.dirtyById.get(enemyId);
    if (!changes || Object.keys(changes).length === 0) {
        setStatus(`No changes to save for '${enemyId}'.`);
        return;
    }

    setStatus(`Saving '${enemyId}'...`);
    const response = await fetch(`/api/enemies/${enemyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Failed to save ${enemyId}.`);

    if (payload.renamed && payload.id && payload.oldId) {
        state.dirtyById.clear();
        await fetchEnemies({ rename: { from: payload.oldId, to: payload.id } });
        setStatus(`Renamed '${payload.oldId}' to '${payload.id}' and saved.`, "ok");
        return;
    }
    const target = state.enemies.find(entry => entry.id === enemyId);
    if (target) Object.assign(target, changes);
    state.dirtyById.delete(enemyId);
    renderEnemyPanel();
    setStatus(`Saved '${payload.id || enemyId}'.`, "ok");
}

async function addEnemy() {
    const validationErrors = getAddFormValidationErrors();
    if (validationErrors.length > 0) {
        state.addValidationTouched = true;
        refreshAddFormValidation(true);
        return;
    }

    const defaultType = (state.metadata.enemyTypeOptions || [])[0] || "monster";
    const defaultSize = (state.metadata.enemySizeOptions || [])[0] || "m";
    const selectedLevels = normalizeLevelsSelection(state.newLevelsSelection);
    const displayName = (el.newName.value || "New Enemy").trim() || "New Enemy";

    const payload = {
        name: displayName,
        type: defaultType,
        size: el.newSize.value || defaultSize,
        levels: ["all"],
        hp: Number(el.newHp.value || 0),
        atk: Number(el.newAtk.value || 0),
        def: Number(el.newDef.value || 0),
        crit: Number(el.newCrit.value || 0),
        dodge: Number(el.newDodge.value || 0),
        aim: Number(el.newAim.value || 0),
        exp: Number(el.newExp.value || 0),
        desc: el.newDesc.value || "Describe this enemy."
    };

    setStatus(`Adding enemy '${displayName}'...`);
    const response = await fetch("/api/enemies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to add enemy.");

    let imageUploadPayload = null;
    if (state.newImageFile) {
        imageUploadPayload = await uploadEnemyImage(data.id, state.newImageFile);
    }

    el.newName.value = "";
    el.newDesc.value = "";
    resetNewImageSelection();
    state.addValidationTouched = false;

    await fetchEnemies();
    if (imageUploadPayload && imageUploadPayload.compression) {
        const compression = imageUploadPayload.compression;
        if (compression.enabled && compression.compressed) {
            const attempts = `${compression.attemptsUsed || 1}/${compression.maxAttempts || 1}`;
            setStatus(`Enemy '${data.id}' added with TinyPNG compression (attempts ${attempts}).`, "ok");
        } else if (!compression.enabled) {
            setStatus(`Enemy '${data.id}' added. TinyPNG disabled (missing API key).`, "ok");
        } else {
            setStatus(`Enemy '${data.id}' added. TinyPNG skipped (${compression.reason || "no change"}).`, "ok");
        }
    } else {
        setStatus(`Enemy '${data.id}' added.`, "ok");
    }
    showAddSuccessModal(data.id);
    refreshAddFormValidation(false);
}

if (el.addBtn) {
    el.addBtn.addEventListener("click", () => addEnemy().catch(error => setStatus(error.message, "err")));
}

if (el.newImagePickerBtn && el.newImageInput) {
    el.newImagePickerBtn.addEventListener("click", () => el.newImageInput.click());
    el.newImageInput.addEventListener("change", () => {
        const file = el.newImageInput.files && el.newImageInput.files[0] ? el.newImageInput.files[0] : null;
        setNewImageSelection(file);
    });
}

if (el.addSuccessClose) {
    el.addSuccessClose.addEventListener("click", closeAddSuccessModal);
}

if (el.addSuccessModal) {
    el.addSuccessModal.addEventListener("click", event => {
        if (event.target === el.addSuccessModal) {
            closeAddSuccessModal();
        }
    });
}

if (el.deleteCancelBtn) {
    el.deleteCancelBtn.addEventListener("click", closeDeleteConfirmModal);
}

if (el.deleteConfirmBtn) {
    el.deleteConfirmBtn.addEventListener("click", () => {
        const id = state.pendingDeleteId;
        closeDeleteConfirmModal();
        deleteEnemy(id).catch(error => setStatus(error.message, "err"));
    });
}

if (el.deleteConfirmModal) {
    el.deleteConfirmModal.addEventListener("click", event => {
        if (event.target === el.deleteConfirmModal) {
            closeDeleteConfirmModal();
        }
    });
}

[
    el.newName,
    el.newSize,
    el.newHp,
    el.newAtk,
    el.newDef,
    el.newCrit,
    el.newDodge,
    el.newAim,
    el.newExp,
    el.newDesc
].filter(Boolean).forEach(input => {
    input.addEventListener("input", () => refreshAddFormValidation(state.addValidationTouched));
    input.addEventListener("change", () => refreshAddFormValidation(state.addValidationTouched));
});

document.addEventListener("click", event => {
    const menu = ensureLevelsPickerMenu();
    if (menu.style.display === "none") return;
    if (event.target.closest(".levels-picker-menu")) return;
    if (event.target.closest(".levels-picker-trigger")) return;
    closeLevelsPicker();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeAddSuccessModal();
        closeDeleteConfirmModal();
    }
});

Promise.all([fetchMetadata(), fetchEnemies()]).catch(error => setStatus(error.message, "err"));
renderSortControls();
resetNewImageSelection();
refreshAddFormValidation();
