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
        desc = ""
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
    }
}

export class EnemyCharacter extends Character {
    constructor({
        img = "",
        size = "m",
        exp = 0,
        ...rest
    } = {}) {
        super(rest);
        this.img = img;
        this.size = size;
        this.exp = exp;
    }
}

export class PlayerCharacter extends Character {
    constructor({
        lvl = 1,
        exp = 0,
        maxExp = 0,
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
        skillTreeRanks = {}
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
            aim: baseAim
        });

        this.lvl = lvl;
        this.exp = exp;
        this.maxExp = maxExp;
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
    }
}
