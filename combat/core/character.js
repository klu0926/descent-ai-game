export class CombatCharacter {
    constructor({
        id = "",
        name = "",
        team = "neutral",
        hp = 1,
        maxHp = hp,
        atk = 0,
        def = 0,
        crit = 0,
        dodge = 0,
        aim = 0,
        canAct = true,
        tags = []
    } = {}) {
        this.id = String(id || "").trim();
        this.name = String(name || "").trim() || "Unknown";
        this.team = String(team || "neutral").trim() || "neutral";
        this.maxHp = Math.max(1, Math.floor(Number(maxHp) || Number(hp) || 1));
        this.hp = Math.max(0, Math.min(this.maxHp, Math.floor(Number(hp) || this.maxHp)));
        this.atk = Math.max(0, Math.floor(Number(atk) || 0));
        this.def = Math.max(0, Math.floor(Number(def) || 0));
        this.crit = Math.max(0, Math.floor(Number(crit) || 0));
        this.dodge = Math.max(0, Math.floor(Number(dodge) || 0));
        this.aim = Math.max(0, Math.floor(Number(aim) || 0));
        this.canAct = Boolean(canAct);
        this.tags = Array.isArray(tags) ? tags : [];
        this.statuses = [];
    }

    isAlive() {
        return this.hp > 0;
    }

    receiveDamage(amount) {
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
        this.hp = Math.max(0, this.hp - safeAmount);
        return safeAmount;
    }

    receiveHealing(amount) {
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + safeAmount);
        return this.hp - before;
    }
}

