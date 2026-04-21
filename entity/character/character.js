export class Character {
    constructor({
        name = "",
        type = "",
        hp = 1,
        maxHp = hp,
        atk = 0,
        def = 0,
        crit = 0,
        dodge = 0,
        aim = 0,
        desc = "",
        activeSkills = [],
        passiveSkills = [],
        activeStatuses = []
    } = {}) {
        this.name = name;
        this.type = type;
        this.maxHp = maxHp;
        this.hp = hp;
        this.atk = atk;
        this.def = def;
        this.crit = crit;
        this.dodge = dodge;
        this.aim = aim;
        this.desc = desc;

        this.activeSkills = Array.isArray(activeSkills) ? [...activeSkills] : [];
        this.passiveSkills = Array.isArray(passiveSkills) ? [...passiveSkills] : [];
        this.activeStatuses = Array.isArray(activeStatuses) ? [...activeStatuses] : [];

        // Compatibility aliases with existing runtime readers.
        this.skills = this.activeSkills;
        this.statuses = this.activeStatuses;
        this.statusEffects = this.activeStatuses;
        this.passives = this.passiveSkills;
    }

    setActiveSkills(skills = []) {
        this.activeSkills = Array.isArray(skills) ? [...skills] : [];
        this.skills = this.activeSkills;
    }

    setPassiveSkills(passives = []) {
        this.passiveSkills = Array.isArray(passives) ? [...passives] : [];
        this.passives = this.passiveSkills;
    }

    setActiveStatuses(statuses = []) {
        this.activeStatuses = Array.isArray(statuses) ? [...statuses] : [];
        this.statuses = this.activeStatuses;
        this.statusEffects = this.activeStatuses;
    }

    addActiveSkill(skill) {
        if (!skill) return;
        this.activeSkills.push(skill);
        this.skills = this.activeSkills;
    }

    addPassiveSkill(passive) {
        if (!passive) return;
        this.passiveSkills.push(passive);
        this.passives = this.passiveSkills;
    }

    addActiveStatus(status) {
        if (!status) return;
        this.activeStatuses.push(status);
        this.statuses = this.activeStatuses;
        this.statusEffects = this.activeStatuses;
    }
}

export class EnemyCharacter extends Character {
    constructor({
        img = "",
        size = "m",
        essence = 1,
        canAttack = true,
        ...rest
    } = {}) {
        super(rest);
        this.img = img;
        this.size = size;
        this.essence = Math.max(0, Math.floor(Number(essence) || 0));
        this.canAttack = Boolean(canAttack);
    }
}

export class PlayerCharacter extends Character {
    constructor({
        baseHp = 100,
        baseAtk = 10,
        baseDef = 5,
        baseCrit = 0,
        baseDodge = 5,
        baseAim = 0,
        inventory = [],
        consumables = [],
        gearSlots = {},
        skillPoints = 0,
        skillTreeRanks = {},
        essence = 0,
        activeSkills = [],
        passiveSkills = [],
        activeStatuses = []
    } = {}) {
        super({
            name: "Adventurer",
            type: "player",
            hp: baseHp,
            maxHp: baseHp,
            atk: baseAtk,
            def: baseDef,
            crit: baseCrit,
            dodge: baseDodge,
            aim: baseAim,
            activeSkills,
            passiveSkills,
            activeStatuses
        });

        this.baseHp = baseHp;
        this.baseAtk = baseAtk;
        this.baseDef = baseDef;
        this.baseCrit = baseCrit;
        this.baseDodge = baseDodge;
        this.baseAim = baseAim;
        this.inventory = inventory;
        this.consumables = consumables;
        this.gearSlots = gearSlots;
        this.skillPoints = skillPoints;
        this.skillTreeRanks = skillTreeRanks;
        this.essence = Math.max(0, Math.floor(Number(essence) || 0));
    }
}
