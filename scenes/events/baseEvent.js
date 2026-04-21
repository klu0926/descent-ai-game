export class Event {
    static TYPES = Object.freeze({
        CUTSCENE: "cutscene",
        VENDOR: "vendor"
    });

    constructor({
        id = "",
        type = "",
        name = "",
        description = "",
        skippable = true,
        enabled = true,
        metadata = {}
    } = {}) {
        this.id = String(id || "");
        this.type = String(type || "").trim().toLowerCase();
        this.name = String(name || "");
        this.description = String(description || "");
        this.skippable = Boolean(skippable);
        this.enabled = Boolean(enabled);
        this.metadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
    }

    isPlayable() {
        return this.enabled;
    }

    async beforeRun(context = {}) {
        void context;
    }

    async execute(context = {}) {
        void context;
        throw new Error(`Event.execute is not implemented for "${this.type || "unknown"}"`);
    }

    async afterRun(context = {}, result = null) {
        void context;
        return result;
    }

    async run(context = {}) {
        if (!this.isPlayable()) {
            return { ok: false, skipped: true, reason: "disabled", eventType: this.type, eventId: this.id };
        }
        await this.beforeRun(context);
        const result = await this.execute(context);
        const finalResult = await this.afterRun(context, result);
        return {
            ok: true,
            skipped: false,
            eventType: this.type,
            eventId: this.id,
            ...(finalResult && typeof finalResult === "object" ? finalResult : {})
        };
    }
}

