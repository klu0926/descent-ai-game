const state = {
    playerClass: null,
    dirty: {},
    activeImageJobs: 0,
    availableItems: [],
    availableSkills: []
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

function toPlainText(value) {
    const raw = String(value ?? "");
    if (!raw) return "";
    const decode = document.createElement("div");
    decode.innerHTML = raw;
    const decoded = decode.textContent || "";
    const strip = document.createElement("div");
    strip.innerHTML = decoded;
    return String(strip.textContent || "").trim();
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

function buildSkillIconUrl(pathValue) {
    const raw = String(pathValue || "").trim();
    if (!raw) return "";
    const apiMatch = raw.match(/^\/api\/skill-icons\/([^/?#]+)$/i);
    if (apiMatch) return `/api/skill-icons/${apiMatch[1]}`;
    const resourceMatch = raw.match(/^resources\/images\/skill_icons\/([^/?#]+)$/i);
    if (resourceMatch) return `/api/skill-icons/${encodeURIComponent(resourceMatch[1])}`;
    return buildProjectAssetUrl(raw);
}

async function fetchWanderer() {
    const response = await fetch("/api/player/wanderer");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load wanderer data.");
    state.playerClass = payload.playerClass || null;
    if (state.playerClass && typeof state.playerClass === "object") {
        state.playerClass.description = toPlainText(state.playerClass.description);
    }
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
        kind: String(entry.kind || (entry.gearType ? "gear" : "item")),
        functionDesc: String(entry.functionDesc || "")
    })).filter(entry => entry.id);
}

async function fetchAvailableSkills() {
    const response = await fetch("/api/skills", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load skills.");
    const skills = Array.isArray(payload.skills) ? payload.skills : [];
    state.availableSkills = skills
        .map(entry => ({
            id: String(entry.id || ""),
            name: String(entry.name || entry.id || ""),
            skillType: String(entry.skillType || "passive"),
            image: String(entry.image || ""),
            desc: String(entry.desc || "")
        }))
        .filter(entry => entry.id);
}

async function saveWanderer() {
    if (!hasDirty()) {
        setStatus("No changes to save.");
        return;
    }
    const current = state.playerClass || {};
    const payload = {
        name: getDirty("name", current.name),
        description: toPlainText(getDirty("description", current.description)),
        locked: getDirty("locked", current.locked),
        gold: Number(getDirty("gold", current.gold)),
        inventory: Array.isArray(getDirty("inventory", current.inventory || []))
            ? getDirty("inventory", current.inventory || [])
            : [],
        passiveSkills: Array.isArray(getDirty("passiveSkills", current.passiveSkills || []))
            ? getDirty("passiveSkills", current.passiveSkills || [])
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

function createCenteredPickerModal({ modalId, title, entries, getLabel, getImagePath, onPick, optionImageClass = "player-item-option-image" }) {
    if (modalId) {
        const existing = document.getElementById(modalId);
        if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
    }
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop hidden";
    if (modalId) backdrop.id = modalId;
    const card = document.createElement("div");
    card.className = "modal-card";
    const heading = document.createElement("h2");
    heading.className = "modal-title";
    heading.textContent = title;
    const list = document.createElement("div");
    list.className = "player-item-picker";
    list.style.position = "static";
    list.style.width = "100%";
    list.style.maxHeight = "50vh";
    list.style.display = "flex";
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    actions.appendChild(closeBtn);
    card.appendChild(heading);
    card.appendChild(list);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const close = () => backdrop.classList.add("hidden");
    const open = () => backdrop.classList.remove("hidden");

    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", event => {
        if (event.target === backdrop) close();
    });

    entries.forEach(entry => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "player-item-option";
        const thumb = document.createElement("img");
        thumb.className = optionImageClass;
        thumb.alt = "";
        const rawPath = String(getImagePath(entry) || "").trim();
        const src = (/^https?:\/\//i.test(rawPath) || rawPath.startsWith("/api/") || rawPath.startsWith("/project/"))
            ? rawPath
            : buildProjectAssetUrl(rawPath);
        if (src) thumb.src = src;
        else thumb.classList.add("hidden");
        const label = document.createElement("span");
        label.className = "player-item-option-label";
        label.textContent = getLabel(entry);
        const meta = document.createElement("div");
        meta.className = "player-item-option-meta";
        meta.appendChild(label);
        const descText = String(entry && entry.desc || "").trim();
        if (descText) {
            const desc = document.createElement("span");
            desc.className = "player-item-option-desc";
            desc.textContent = descText;
            meta.appendChild(desc);
        }
        option.appendChild(thumb);
        option.appendChild(meta);
        option.addEventListener("click", () => {
            onPick(entry);
            close();
        });
        list.appendChild(option);
    });

    return { open, close, element: backdrop };
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
    const nameInput = createTextInput("name", data.name);
    nameInput.classList.add("player-name-input");
    topRow.appendChild(createLabeledField("name", nameInput));
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
        baseStatsRow.appendChild(createLabeledField(key, createNumberInput(`baseStats.${key}`, data.baseStats[key])));
    });
    card.appendChild(baseStatsRow);

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
            const chip = document.createElement("div");
            chip.className = "player-item-chip";
            chip.title = itemRef && itemRef.functionDesc ? itemRef.functionDesc : "";
            const img = document.createElement("img");
            img.className = "player-item-chip-image";
            img.alt = "";
            const src = buildProjectAssetUrl(itemRef && itemRef.image);
            if (src) img.src = src;
            else img.classList.add("hidden");
            const name = document.createElement("span");
            name.textContent = itemRef ? itemRef.name : itemId;
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "player-item-chip-remove";
            removeBtn.title = "Remove item";
            removeBtn.setAttribute("aria-label", "Remove item");
            removeBtn.textContent = "×";
            chip.appendChild(img);
            chip.appendChild(name);
            removeBtn.addEventListener("click", () => {
                const next = list.filter(id => id !== itemId);
                setDirty("inventory", next, originalInventory);
                render();
                refreshActionButtons();
            });
            chip.appendChild(removeBtn);
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
    const itemPickerModal = createCenteredPickerModal({
        modalId: "player-item-picker-modal",
        title: "Add Item",
        entries: state.availableItems,
        getLabel: entry => entry.name,
        getImagePath: entry => entry.image,
        onPick: entry => {
            const list = Array.isArray(getDirty("inventory", originalInventory))
                ? getDirty("inventory", originalInventory)
                : [];
            if (!list.includes(entry.id)) {
                const next = [...list, entry.id];
                setDirty("inventory", next, originalInventory);
                render();
                refreshActionButtons();
            }
        }
    });
    addBtn.addEventListener("click", () => itemPickerModal.open());
    addWrap.appendChild(addBtn);
    itemsRow.appendChild(addWrap);
    card.appendChild(itemsRow);

    const skillsLabel = document.createElement("span");
    skillsLabel.className = "add-col-label";
    skillsLabel.textContent = "skills";
    card.appendChild(skillsLabel);

    const skillsRow = document.createElement("div");
    skillsRow.className = "player-items-row";

    const skillsList = document.createElement("div");
    skillsList.className = "player-items-list";
    const originalSkills = Array.isArray(data.passiveSkills) ? data.passiveSkills : [];
    const currentSkills = Array.isArray(getDirty("passiveSkills", originalSkills))
        ? getDirty("passiveSkills", originalSkills)
        : [];
    const renderSkillChips = list => {
        skillsList.innerHTML = "";
        list.forEach(skillId => {
            const skillRef = state.availableSkills.find(entry => entry.id === skillId);
            const chip = document.createElement("div");
            chip.className = "player-item-chip";
            chip.title = skillRef && skillRef.desc ? skillRef.desc : "";
            const img = document.createElement("img");
            img.className = "player-item-chip-image";
            img.alt = "";
            const src = buildSkillIconUrl(skillRef && skillRef.image);
            if (src) img.src = src;
            else img.classList.add("hidden");
            const name = document.createElement("span");
            name.textContent = skillRef ? `${skillRef.name} (${skillRef.skillType})` : skillId;
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "player-item-chip-remove";
            removeBtn.title = "Remove skill";
            removeBtn.setAttribute("aria-label", "Remove skill");
            removeBtn.textContent = "×";
            chip.appendChild(img);
            chip.appendChild(name);
            removeBtn.addEventListener("click", () => {
                const next = list.filter(id => id !== skillId);
                setDirty("passiveSkills", next, originalSkills);
                render();
                refreshActionButtons();
            });
            chip.appendChild(removeBtn);
            skillsList.appendChild(chip);
        });
    };
    renderSkillChips(currentSkills);
    skillsRow.appendChild(skillsList);

    const addSkillWrap = document.createElement("div");
    addSkillWrap.className = "player-item-add-wrap";
    const addSkillBtn = document.createElement("button");
    addSkillBtn.type = "button";
    addSkillBtn.className = "btn-secondary";
    addSkillBtn.textContent = "Add Skill";
    const skillPickerModal = createCenteredPickerModal({
        modalId: "player-skill-picker-modal",
        title: "Add Skill",
        entries: state.availableSkills,
        getLabel: entry => `${entry.name} (${entry.skillType})`,
        getImagePath: entry => buildSkillIconUrl(entry.image),
        optionImageClass: "player-skill-option-image",
        onPick: entry => {
            const list = Array.isArray(getDirty("passiveSkills", originalSkills))
                ? getDirty("passiveSkills", originalSkills)
                : [];
            if (!list.includes(entry.id)) {
                const next = [...list, entry.id];
                setDirty("passiveSkills", next, originalSkills);
                render();
                refreshActionButtons();
            }
        }
    });
    addSkillBtn.addEventListener("click", () => skillPickerModal.open());
    addSkillWrap.appendChild(addSkillBtn);
    skillsRow.appendChild(addSkillWrap);
    card.appendChild(skillsRow);

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
    await Promise.all([fetchWanderer(), fetchAvailableItems(), fetchAvailableSkills()]);
    render();
    refreshActionButtons();
    setStatus("Loaded Wanderer class.", "ok");
}

init().catch(error => setStatus(error.message, "err"));

