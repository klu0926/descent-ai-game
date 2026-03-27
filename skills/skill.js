export class Skill {
    constructor({
        id = "",
        name = "",
        desc = "",
        section = 0,
        maxRank = 1,
        implemented = false,
        levelData = [],
        image = "",
        turnOwner = null,
        effectTypes = ["generic"], // e.g. ["consumable"], ["damage", "dot"]
        effectType = null // legacy alias
    } = {}) {
        this.id = id;
        this.name = name;
        this.desc = desc;
        this.section = section;
        this.maxRank = maxRank;
        this.implemented = implemented;
        this.levelData = levelData;
        this.image = image;
        this.turnOwner = turnOwner;
        const normalized = Array.isArray(effectTypes)
            ? effectTypes.filter(entry => typeof entry === "string" && entry.trim().length > 0)
            : [];
        if (normalized.length > 0) this.effectTypes = normalized;
        else if (typeof effectType === "string" && effectType.trim().length > 0) this.effectTypes = [effectType];
        else this.effectTypes = ["generic"];
    }

    onActivate() { }

    onDeactivate() { }

    createEventHandlers() {
        return {};
    }
}
