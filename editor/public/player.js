const state = {
    playerClass: null,
    dirty: {},
    activeImageJobs: 0,
    availableItems: []
};

const el = {
    status: document.getElementById("player-status"),
    panelList: document.getElementById("player-panel-list"),
    imageProcessingOverlay: document.getElementById("image-processing-overlay"),
    processingOverlayText: document.getElementById("processing-overlay-text"),
    processingProgressFill: document.getElementById("processing-progress-fill"),
    processingProgressLabel: document.getElementById("processing-progress-label"),
    saveBtn: null,
    resetBtn: null
};

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

function valuesMatch(a, b) {
    if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
    return String(a ?? "") === String(b ?? "");
}

function setDirty(path, value, original) {
    if (valuesMatch(value, original)) delete state.dirty[path];
    else state.dirty[path] = value;
}

function getDirty(path, fallback) {
    return Object.prototype.hasOwnProperty.call(state.dirty, path) ? state.dirty[path] : fallback;
}

function hasDirty() {
    return Object.keys(state.dirty).length > 0;
}

function refreshActionButtons() {
    const active = hasDirty();
    if (el.saveBtn) el.saveBtn.disabled = !active;
    if (el.resetBtn) el.resetBtn.disabled = !active;
}

function fileToBase64(file) {
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

function buildProjectAssetUrl(relativePath) {
    const raw = String(relativePath || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `/project/${encodeURI(raw.replace(/\\/g, "/").replace(/^\/+/, ""))}`;
}

async function fetchWanderer() {
    const response = await fetch("/api/player/wanderer");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load wanderer data.");
    state.playerClass = payload.playerClass || null;
    state.dirty = {};
    refreshActionButtons();
}

async function fetchAvailableItems() {
    const response = await fetch("/api/items-gears", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load items.");
    const items = Array.isArray(payload.items) ? payload.items : [];
    const gears = Array.isArray(payload.gears) ? payload.gears : [];
    state.availableItems = [...items, ...gears].map(entry => ({
        id: String(entry.id || ""),
        name: String(entry.name || entry.id || ""),
        image: String(entry.image || ""),
        kind: String(entry.kind || (entry.gearType ? "gear" : "item"))
    })).filter(entry => entry.id);
}

async function saveWanderer() {
    if (!hasDirty()) {
        setStatus("No changes to save.");
        return;
    }
    const current = state.playerClass || {};
    const payload = {
        name: getDirty("name", current.name),
        description: getDirty("description", current.description),
        locked: getDirty("locked", current.locked),
        gold: Number(getDirty("gold", current.gold)),
        inventory: Array.isArray(getDirty("inventory", current.inventory || []))
            ? getDirty("inventory", current.inventory || [])
            : [],
        portrait: getDirty("portrait", current.portrait),
        skillCardPortrait: getDirty("skillCardPortrait", current.skillCardPortrait),
        sprites: {
            attack: getDirty("sprites.attack", current.sprites && current.sprites.attack),
            block: getDirty("sprites.block", current.sprites && current.sprites.block)
        },
        baseStats: {
            hp: Number(getDirty("baseStats.hp", current.baseStats && current.baseStats.hp)),
            atk: Number(getDirty("baseStats.atk", current.baseStats && current.baseStats.atk)),
            def: Number(getDirty("baseStats.def", current.baseStats && current.baseStats.def)),
            crit: Number(getDirty("baseStats.crit", current.baseStats && current.baseStats.crit)),
            dodge: Number(getDirty("baseStats.dodge", current.baseStats && current.baseStats.dodge)),
            aim: Number(getDirty("baseStats.aim", current.baseStats && current.baseStats.aim))
        },
        levelUpGrowth: {
            hp: Number(getDirty("levelUpGrowth.hp", current.levelUpGrowth && current.levelUpGrowth.hp)),
            atk: Number(getDirty("levelUpGrowth.atk", current.levelUpGrowth && current.levelUpGrowth.atk)),
            def: Number(getDirty("levelUpGrowth.def", current.levelUpGrowth && current.levelUpGrowth.def)),
            crit: Number(getDirty("levelUpGrowth.crit", current.levelUpGrowth && current.levelUpGrowth.crit)),
            dodge: Number(getDirty("levelUpGrowth.dodge", current.levelUpGrowth && current.levelUpGrowth.dodge)),
            aim: Number(getDirty("levelUpGrowth.aim", current.levelUpGrowth && current.levelUpGrowth.aim))
        }
    };
    setStatus("Saving wanderer...");
    const response = await fetch("/api/player/wanderer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to save wanderer.");
    state.playerClass = body.playerClass || state.playerClass;
    state.dirty = {};
    render();
    refreshActionButtons();
    setStatus("Saved wanderer class data.", "ok");
}

async function uploadPlayerImage(target, file) {
    if (!file) return;
    state.activeImageJobs += 1;
    updateImageProcessingOverlay();
    setProcessingProgress(10, "Reading image...");
    try {
        const dataBase64 = await fileToBase64(file);
        setProcessingProgress(70, "Uploading image...");
        const response = await fetch("/api/player/wanderer/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target,
                filename: file.name,
                dataBase64
            })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to upload image.");
        await fetchWanderer();
        render();
        setProcessingProgress(100, "Done");
        setStatus(`Updated ${target} image.`, "ok");
    } finally {
        state.activeImageJobs = Math.max(0, state.activeImageJobs - 1);
        updateImageProcessingOverlay();
    }
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

function createTextInput(path, value, multiline = false) {
    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    if (!multiline) input.type = "text";
    if (multiline) input.rows = 6;
    input.value = String(getDirty(path, value) ?? "");
    input.addEventListener("input", () => {
        setDirty(path, input.value, value);
        input.classList.add("dirty");
        refreshActionButtons();
    });
    return input;
}

function createNumberInput(path, value) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "small";
    input.value = String(getDirty(path, value) ?? 0);
    input.addEventListener("input", () => {
        setDirty(path, Number(input.value || 0), value);
        input.classList.add("dirty");
        refreshActionButtons();
    });
    return input;
}

function createImageField(label, path, target) {
    const wrap = document.createElement("div");
    wrap.className = "add-image-row";
    const title = document.createElement("span");
    title.className = "add-col-label";
    title.textContent = label;
    const picker = document.createElement("button");
    picker.type = "button";
    picker.className = "new-image-picker-btn";
    const pickerText = document.createElement("span");
    pickerText.className = "new-image-picker-text";
    pickerText.textContent = "click to import image";
    const preview = document.createElement("img");
    preview.className = "new-image-preview hidden";
    preview.alt = `${label} preview`;
    const currentPath = getDirty(path, path.split(".").reduce((acc, key) => (acc ? acc[key] : ""), state.playerClass));
    const src = buildProjectAssetUrl(currentPath);
    if (src) {
        preview.src = src;
        preview.classList.remove("hidden");
        pickerText.classList.add("hidden");
    }
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.className = "enemy-image-input";
    picker.addEventListener("click", () => imageInput.click());
    imageInput.addEventListener("change", () => {
        const file = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
        uploadPlayerImage(target, file).catch(error => setStatus(error.message, "err"));
        imageInput.value = "";
    });
    const openFolderLink = document.createElement("button");
    openFolderLink.type = "button";
    openFolderLink.className = "background-open-link";
    openFolderLink.textContent = "Open Folder";
    openFolderLink.addEventListener("click", async () => {
        const latestPath = String(getDirty(path, path.split(".").reduce((acc, key) => (acc ? acc[key] : ""), state.playerClass)) || "").trim();
        if (!latestPath) {
            setStatus("No image path found.", "err");
            return;
        }
        const response = await fetch("/api/open-in-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: latestPath })
        });
        const payload = await response.json();
        if (!response.ok) {
            setStatus(payload.error || "Failed to open folder.", "err");
            return;
        }
        setStatus("Opened file location in Explorer.", "ok");
    });
    wrap.appendChild(title);
    picker.appendChild(pickerText);
    picker.appendChild(preview);
    wrap.appendChild(picker);
    wrap.appendChild(imageInput);
    wrap.appendChild(openFolderLink);
    return wrap;
}

function render() {
    if (!el.panelList) return;
    el.panelList.innerHTML = "";
    const data = state.playerClass;
    if (!data) return;

    const card = document.createElement("div");
    card.className = "enemy-card";

    const topRow = document.createElement("div");
    topRow.className = "stats-row enemy-stats-row";
    topRow.appendChild(createLabeledField("name", createTextInput("name", data.name)));
    topRow.appendChild(createLabeledField("gold", createNumberInput("gold", data.gold || 0)));
    const lockedInput = document.createElement("input");
    lockedInput.type = "checkbox";
    lockedInput.className = "plain-checkbox";
    lockedInput.checked = Boolean(getDirty("locked", data.locked));
    lockedInput.addEventListener("change", () => {
        setDirty("locked", Boolean(lockedInput.checked), Boolean(data.locked));
        refreshActionButtons();
    });
    topRow.appendChild(createLabeledField("locked", lockedInput));
    card.appendChild(topRow);

    const baseStatsRow = document.createElement("div");
    baseStatsRow.className = "stats-row enemy-stats-row";
    ["hp", "atk", "def", "crit", "dodge", "aim"].forEach(key => {
        baseStatsRow.appendChild(createLabeledField(`base ${key}`, createNumberInput(`baseStats.${key}`, data.baseStats[key])));
    });
    card.appendChild(baseStatsRow);

    const growthRow = document.createElement("div");
    growthRow.className = "stats-row enemy-stats-row";
    ["hp", "atk", "def", "crit", "dodge", "aim"].forEach(key => {
        growthRow.appendChild(createLabeledField(`growth ${key}`, createNumberInput(`levelUpGrowth.${key}`, data.levelUpGrowth[key])));
    });
    card.appendChild(growthRow);

    const itemsLabel = document.createElement("span");
    itemsLabel.className = "add-col-label";
    itemsLabel.textContent = "items";
    card.appendChild(itemsLabel);

    const itemsRow = document.createElement("div");
    itemsRow.className = "player-items-row";

    const itemsList = document.createElement("div");
    itemsList.className = "player-items-list";
    const originalInventory = Array.isArray(data.inventory) ? data.inventory : [];
    const currentInventory = Array.isArray(getDirty("inventory", originalInventory))
        ? getDirty("inventory", originalInventory)
        : [];
    const renderInventoryChips = list => {
        itemsList.innerHTML = "";
        list.forEach(itemId => {
            const itemRef = state.availableItems.find(entry => entry.id === itemId);
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "player-item-chip";
            chip.title = "Click to remove";
            const img = document.createElement("img");
            img.className = "player-item-chip-image";
            img.alt = "";
            const src = buildProjectAssetUrl(itemRef && itemRef.image);
            if (src) img.src = src;
            else img.classList.add("hidden");
            const name = document.createElement("span");
            name.textContent = itemRef ? itemRef.name : itemId;
            chip.appendChild(img);
            chip.appendChild(name);
            chip.addEventListener("click", () => {
                const next = list.filter(id => id !== itemId);
                setDirty("inventory", next, originalInventory);
                render();
                refreshActionButtons();
            });
            itemsList.appendChild(chip);
        });
    };
    renderInventoryChips(currentInventory);
    itemsRow.appendChild(itemsList);

    const addWrap = document.createElement("div");
    addWrap.className = "player-item-add-wrap";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-secondary";
    addBtn.textContent = "Add Item";
    const picker = document.createElement("div");
    picker.className = "player-item-picker hidden";
    state.availableItems.forEach(entry => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "player-item-option";
        const thumb = document.createElement("img");
        thumb.className = "player-item-option-image";
        thumb.alt = "";
        const src = buildProjectAssetUrl(entry.image);
        if (src) thumb.src = src;
        else thumb.classList.add("hidden");
        const label = document.createElement("span");
        label.textContent = entry.name;
        option.appendChild(thumb);
        option.appendChild(label);
        option.addEventListener("click", () => {
            const list = Array.isArray(getDirty("inventory", originalInventory))
                ? getDirty("inventory", originalInventory)
                : [];
            if (!list.includes(entry.id)) {
                const next = [...list, entry.id];
                setDirty("inventory", next, originalInventory);
                render();
                refreshActionButtons();
            }
            picker.classList.add("hidden");
        });
        picker.appendChild(option);
    });
    addBtn.addEventListener("click", () => {
        picker.classList.toggle("hidden");
    });
    document.addEventListener("click", event => {
        if (picker.classList.contains("hidden")) return;
        const target = event.target;
        if (addWrap.contains(target)) return;
        picker.classList.add("hidden");
    });
    addWrap.appendChild(addBtn);
    addWrap.appendChild(picker);
    itemsRow.appendChild(addWrap);
    card.appendChild(itemsRow);

    const descRow = document.createElement("div");
    descRow.className = "add-media-row";
    const descField = document.createElement("div");
    descField.className = "class-desc";
    descField.appendChild(createLabeledField("description", createTextInput("description", data.description, true)));
    descRow.appendChild(descField);
    card.appendChild(descRow);

    const mediaRow = document.createElement("div");
    mediaRow.className = "player-image-row";
    mediaRow.appendChild(createImageField("portrait", "portrait", "portrait"));
    mediaRow.appendChild(createImageField("skill card portrait", "skillCardPortrait", "skillCardPortrait"));
    mediaRow.appendChild(createImageField("attack sprite", "sprites.attack", "attack"));
    mediaRow.appendChild(createImageField("block sprite", "sprites.block", "block"));
    card.appendChild(mediaRow);

    const actions = document.createElement("div");
    actions.className = "enemy-card-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => saveWanderer().catch(error => setStatus(error.message, "err")));
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn-secondary";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
        state.dirty = {};
        render();
        refreshActionButtons();
        setStatus("Reset unsaved changes.");
    });
    el.saveBtn = saveBtn;
    el.resetBtn = resetBtn;
    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    card.appendChild(actions);

    el.panelList.appendChild(card);
}

async function init() {
    setStatus("Loading wanderer class data...");
    await Promise.all([fetchWanderer(), fetchAvailableItems()]);
    render();
    refreshActionButtons();
    setStatus("Loaded Wanderer class.", "ok");
}

init().catch(error => setStatus(error.message, "err"));
