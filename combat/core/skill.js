function createSkillMeta(config = {}, fallbackKind = "generic") {
    return {
        id: String(config.id || "").trim(),
        name: String(config.name || "").trim() || "Unnamed Skill",
        kind: String(config.kind || fallbackKind).trim() || fallbackKind,
        triggerEvents: Array.isArray(config.triggerEvents) ? config.triggerEvents : []
    };
}

export class ActiveSkill {
    constructor(config = {}) {
        const meta = createSkillMeta(config, "active");
        this.id = meta.id;
        this.name = meta.name;
        this.kind = "active";
        this.triggerEvents = meta.triggerEvents;
        this.cooldownTurns = Math.max(0, Math.floor(Number(config.cooldownTurns) || 0));
        this.currentCooldownTurns = 0;
        this.action = typeof config.action === "function" ? config.action : null;
    }

    canUse() {
        return this.currentCooldownTurns <= 0;
    }

    tickCooldown() {
        if (this.currentCooldownTurns > 0) this.currentCooldownTurns -= 1;
    }

    use(context) {
        if (!this.canUse() || typeof this.action !== "function") return null;
        const result = this.action(context);
        this.currentCooldownTurns = this.cooldownTurns;
        return result;
    }
}

export class PassiveSkill {
    constructor(config = {}) {
        const meta = createSkillMeta(config, "passive");
        this.id = meta.id;
        this.name = meta.name;
        this.kind = "passive";
        this.triggerEvents = meta.triggerEvents;
        this.onEvent = typeof config.onEvent === "function" ? config.onEvent : null;
    }

    register(manager, owner) {
        if (!manager || typeof manager.on !== "function") return [];
        if (!this.onEvent || this.triggerEvents.length === 0) return [];

        return this.triggerEvents.map(eventName => manager.on(eventName, payload => {
            this.onEvent({
                eventName,
                payload,
                owner,
                manager
            });
        }));
    }
}
