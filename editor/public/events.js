const state = {
    events: [],
    openEventIds: new Set(),
    filterMode: "all",
    scopeOptions: ["custom", "combat", "game"]
};

const el = {
    status: document.getElementById("status"),
    eventList: document.getElementById("event-list"),
    newName: document.getElementById("new-name"),
    newScope: document.getElementById("new-scope"),
    newDescription: document.getElementById("new-description"),
    addBtn: document.getElementById("add-btn"),
    openAllBtn: document.getElementById("open-all-btn"),
    closeAllBtn: document.getElementById("close-all-btn"),
    eventFilter: document.getElementById("event-filter")
};

function setStatus(message, kind = "muted") {
    if (!el.status) return;
    el.status.textContent = message || "";
    el.status.className = kind === "muted" ? "muted mt8" : `muted mt8 status-${kind}`;
}

function toId(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function makeInput(value, placeholder = "") {
    const input = document.createElement("input");
    input.value = String(value || "");
    input.placeholder = placeholder;
    return input;
}

function makeSelect(options, value) {
    const select = document.createElement("select");
    (Array.isArray(options) ? options : []).forEach(optionValue => {
        const option = document.createElement("option");
        option.value = String(optionValue);
        option.textContent = String(optionValue);
        select.appendChild(option);
    });
    select.value = String(value || options[0] || "");
    return select;
}

function makeTextarea(value, placeholder = "") {
    const textarea = document.createElement("textarea");
    textarea.className = "enemy-description";
    textarea.value = String(value || "");
    textarea.placeholder = placeholder;
    return textarea;
}

function buildAutoEventFields() {
    const rawName = String(el.newName?.value || "").trim();
    const scope = String(el.newScope?.value || "custom").trim().toLowerCase() || "custom";
    const id = toId(rawName);
    const eventName = id ? `${scope}:${id}` : "";
    return { id, eventName };
}

function syncAutoEventFields() {
    // Kept for compatibility when inputs are hidden/removed.
    buildAutoEventFields();
}

function resetNewForm() {
    if (el.newName) el.newName.value = "";
    if (el.newScope) el.newScope.value = "custom";
    if (el.newDescription) el.newDescription.value = "";
}

async function loadEvents() {
    const response = await fetch("/api/events", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load events.");
    state.events = Array.isArray(payload.events) ? payload.events : [];
}

async function addEvent() {
    const auto = buildAutoEventFields();
    const name = String(el.newName?.value || "").trim();
    const eventName = auto.eventName;
    const scope = String(el.newScope?.value || "custom").trim();
    const description = String(el.newDescription?.value || "").trim();
    const id = auto.id;
    if (!id || !eventName) {
        setStatus("Need at least id/eventName.", "error");
        return;
    }
    const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, eventName, scope, description })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to add event.");
    resetNewForm();
    setStatus(`Added '${id}'.`, "success");
    await refresh();
}

async function updateEvent(id, data) {
    const response = await fetch(`/api/events/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to update event.");
    setStatus(`Saved '${payload.event?.id || id}'.`, "success");
    await refresh();
}

async function deleteEvent(id) {
    const response = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to delete event.");
    setStatus(`Deleted '${id}'.`, "success");
    await refresh();
}

function renderEventCard(entry) {
    const card = document.createElement("article");
    card.className = "enemy-card";

    const header = document.createElement("div");
    header.className = "panel-title-row";

    const title = document.createElement("h3");
    title.className = "enemy-card-title";
    title.textContent = entry.core ? `${entry.name} (core)` : entry.name;
    title.style.marginBottom = "0";
    header.appendChild(title);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "editor-close-icon-btn";
    const isOpen = state.openEventIds.has(entry.id);
    toggleBtn.textContent = isOpen ? "\u25B4" : "\u25BE";
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    header.appendChild(toggleBtn);

    card.appendChild(header);

    const body = document.createElement("div");
    if (!isOpen) body.classList.add("hidden");

    const row = document.createElement("div");
    row.className = "stats-row";

    const idInput = makeInput(entry.id, "id");
    const nameInput = makeInput(entry.name, "name");
    const eventNameInput = makeInput(entry.eventName, "eventName");
    const scopeInput = makeSelect(state.scopeOptions, entry.scope || "custom");

    [idInput, nameInput, eventNameInput, scopeInput].forEach(input => {
        const wrap = document.createElement("div");
        wrap.className = "stats-field";
        wrap.appendChild(input);
        row.appendChild(wrap);
    });
    body.appendChild(row);

    const descriptionInput = makeTextarea(entry.description, "description");
    body.appendChild(descriptionInput);

    const actions = document.createElement("div");
    actions.className = "enemy-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.disabled = Boolean(entry.core);
    saveBtn.addEventListener("click", async () => {
        try {
            await updateEvent(entry.id, {
                id: toId(idInput.value),
                name: String(nameInput.value || "").trim(),
                eventName: String(eventNameInput.value || "").trim(),
                scope: String(scopeInput.value || "custom").trim(),
                description: String(descriptionInput.value || "").trim()
            });
        } catch (error) {
            setStatus(error.message, "error");
        }
    });
    actions.appendChild(saveBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn-danger";
    deleteBtn.disabled = Boolean(entry.core);
    deleteBtn.addEventListener("click", async () => {
        const ok = window.confirm(`Delete event '${entry.id}'?`);
        if (!ok) return;
        try {
            await deleteEvent(entry.id);
        } catch (error) {
            setStatus(error.message, "error");
        }
    });
    actions.appendChild(deleteBtn);

    body.appendChild(actions);

    toggleBtn.addEventListener("click", () => {
        const currentlyOpen = state.openEventIds.has(entry.id);
        if (currentlyOpen) state.openEventIds.delete(entry.id);
        else state.openEventIds.add(entry.id);
        render();
    });

    card.appendChild(body);
    return card;
}

function render() {
    if (!el.eventList) return;
    el.eventList.innerHTML = "";
    const sorted = [...state.events].sort((a, b) => {
        if (Boolean(a.core) !== Boolean(b.core)) return a.core ? -1 : 1;
        return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
    const filtered = sorted.filter(entry => {
        if (state.filterMode === "core") return Boolean(entry.core);
        if (state.filterMode === "non_core") return !Boolean(entry.core);
        return true;
    });
    filtered.forEach(entry => {
        el.eventList.appendChild(renderEventCard(entry));
    });
}

async function refresh() {
    await loadEvents();
    render();
}

async function init() {
    if (el.addBtn) {
        el.addBtn.addEventListener("click", async () => {
            try {
                await addEvent();
            } catch (error) {
                setStatus(error.message, "error");
            }
        });
    }
    syncAutoEventFields();
    if (el.newName) {
        el.newName.addEventListener("input", () => {
            syncAutoEventFields();
        });
    }
    if (el.newScope) {
        el.newScope.addEventListener("change", () => {
            syncAutoEventFields();
        });
    }
    if (el.openAllBtn) {
        el.openAllBtn.addEventListener("click", () => {
            state.events.forEach(entry => {
                if (state.filterMode === "core" && !entry.core) return;
                if (state.filterMode === "non_core" && entry.core) return;
                state.openEventIds.add(entry.id);
            });
            render();
        });
    }
    if (el.closeAllBtn) {
        el.closeAllBtn.addEventListener("click", () => {
            state.openEventIds.clear();
            render();
        });
    }
    if (el.eventFilter) {
        el.eventFilter.addEventListener("change", () => {
            state.filterMode = String(el.eventFilter.value || "all");
            render();
        });
    }
    try {
        await refresh();
        setStatus(`Loaded ${state.events.length} events.`);
    } catch (error) {
        setStatus(error.message, "error");
    }
}

init();
