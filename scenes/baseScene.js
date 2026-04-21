export class BaseScene {
    constructor({
        id = "",
        type = "base",
        levelId = 1,
        roundNumber = 1,
        data = {}
    } = {}) {
        this.id = String(id || "").trim();
        this.type = String(type || "base").trim();
        this.levelId = Math.max(1, Math.floor(Number(levelId) || 1));
        this.roundNumber = Math.max(1, Math.floor(Number(roundNumber) || 1));
        this.data = data && typeof data === "object" ? data : {};
    }

    async enter(context = {}) {
        void context;
        return null;
    }

    async start(context = {}) {
        void context;
        return null;
    }

    async exit(context = {}) {
        void context;
        return null;
    }
}

