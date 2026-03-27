export class Passive {
    constructor({
        id = "",
        name = "",
        desc = "",
        implemented = false,
        levelData = [],
        image = "",
        turnOwner = null,
        kind = "neutral", // "buff" | "debuff" | "neutral" | "skill"
        mode = "stats", // "stats" | "action" | "potion" | custom
        effectTypes = ["generic"],
        effectType = null, // legacy alias
        durationTurns = null,
        durationRounds = null,
        turns = null, // legacy alias
        duration = null, // legacy alias
        maxStacks = 1,
        stacks = 1,
        sourceType = "",
        sourceId = "",
        source = "",
        target = "player",
        modifiers = {},
        trigger = {},
        meta = {},
        ui = {},
        appliedAtTurn = null,
        appliedAtRound = null,
        lastAppliedAtTurn = null,
        lastAppliedAtRound = null
    } = {}) {
        this.id = id;
        this.name = name;
        this.desc = desc;
        this.implemented = implemented;
        this.levelData = levelData;
        this.image = image;
        this.turnOwner = turnOwner;
        this.kind = kind;
        this.mode = mode;

        const normalized = Array.isArray(effectTypes)
            ? effectTypes.filter(entry => typeof entry === "string" && entry.trim().length > 0)
            : [];
        if (normalized.length > 0) this.effectTypes = normalized;
        else if (typeof effectType === "string" && effectType.trim().length > 0) this.effectTypes = [effectType];
        else this.effectTypes = ["generic"];

        const resolvedTurns = Number.isFinite(durationTurns)
            ? durationTurns
            : (Number.isFinite(turns) ? turns : duration);
        this.durationTurns = Number.isFinite(resolvedTurns) ? Math.max(0, resolvedTurns) : 0;
        this.remainingTurns = this.durationTurns;

        this.durationRounds = Number.isFinite(durationRounds) ? Math.max(0, durationRounds) : null;
        this.remainingRounds = Number.isFinite(this.durationRounds) ? this.durationRounds : null;

        this.maxStacks = Math.max(1, maxStacks);
        this.stacks = Math.min(this.maxStacks, Math.max(1, stacks));

        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.source = source;
        this.target = target;
        this.modifiers = modifiers;
        this.trigger = trigger;
        this.meta = meta;
        this.ui = ui;

        this.appliedAtTurn = appliedAtTurn;
        this.appliedAtRound = appliedAtRound;
        this.lastAppliedAtTurn = lastAppliedAtTurn;
        this.lastAppliedAtRound = lastAppliedAtRound;
    }

    get isBuff() {
        return this.kind === "buff";
    }

    get isDebuff() {
        return this.kind === "debuff";
    }

    hasTag(tag) {
        if (!tag || !Array.isArray(this.effectTypes)) return false;
        if (this.effectTypes.includes(tag)) return true;
        // Backward compatibility while migrating old consumable tag.
        return tag === "potion" && this.effectTypes.includes("consumable");
    }

    addStacks(amount = 1) {
        this.stacks = Math.min(this.maxStacks, this.stacks + Math.max(0, amount));
        return this.stacks;
    }

    refreshDuration({ turns, rounds } = {}) {
        if (Number.isFinite(turns) && turns > 0) {
            this.durationTurns = Math.max(0, turns);
            this.remainingTurns = this.durationTurns;
        }
        if (Number.isFinite(rounds) && rounds > 0) {
            this.durationRounds = Math.max(0, rounds);
            this.remainingRounds = this.durationRounds;
        }
        return {
            turns: this.remainingTurns,
            rounds: this.remainingRounds
        };
    }

    refreshTurns(turns) {
        if (!Number.isFinite(turns) || turns <= 0) return this.remainingTurns;
        this.durationTurns = Math.max(0, turns);
        this.remainingTurns = this.durationTurns;
        return this.remainingTurns;
    }

    tickTurn() {
        if (this.durationTurns === 0) return this.remainingTurns;
        this.remainingTurns = Math.max(0, this.remainingTurns - 1);
        return this.remainingTurns;
    }

    tickRound() {
        if (!Number.isFinite(this.durationRounds)) return this.remainingRounds;
        if (this.durationRounds === 0) return this.remainingRounds;
        this.remainingRounds = Math.max(0, this.remainingRounds - 1);
        return this.remainingRounds;
    }

    tick() {
        return this.tickTurn();
    }

    isExpired() {
        const turnExpired = this.durationTurns > 0 && this.remainingTurns <= 0;
        const roundExpired = Number.isFinite(this.durationRounds)
            && this.durationRounds > 0
            && this.remainingRounds <= 0;
        return turnExpired || roundExpired;
    }

    // Legacy compatibility for code still using `.duration` as turns.
    get duration() {
        return this.remainingTurns;
    }

    set duration(value) {
        this.durationTurns = Math.max(0, Number.isFinite(value) ? value : 0);
        this.remainingTurns = this.durationTurns;
    }
}
