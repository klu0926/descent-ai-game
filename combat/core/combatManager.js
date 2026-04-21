import { COMBAT_EVENTS } from "./combatEvents.js";
import { CombatEventBus } from "./combatEventBus.js";

function toInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.floor(parsed);
}

export class CombatManager {
    constructor({
        eventBus = new CombatEventBus(),
        randomFn = Math.random
    } = {}) {
        this.eventBus = eventBus;
        this.randomFn = randomFn;
        this.state = {
            inCombat: false,
            round: 0,
            turn: 0,
            activeTeam: "player"
        };
        this.participants = new Map();
        this.skillUnsubscribersByOwner = new Map();
    }

    on(eventName, handler) {
        return this.eventBus.on(eventName, handler);
    }

    once(eventName, handler) {
        return this.eventBus.once(eventName, handler);
    }

    emit(eventName, payload) {
        this.eventBus.emit(eventName, payload);
    }

    addCharacter(character) {
        if (!character || !character.id) return;
        this.participants.set(character.id, character);
    }

    getCharacter(characterId) {
        return this.participants.get(characterId) || null;
    }

    registerPassive(ownerId, passive) {
        const owner = this.getCharacter(ownerId);
        if (!owner || !passive || typeof passive.register !== "function") return;
        const unsubscribers = passive.register(this, owner);
        if (!this.skillUnsubscribersByOwner.has(ownerId)) {
            this.skillUnsubscribersByOwner.set(ownerId, []);
        }
        this.skillUnsubscribersByOwner.get(ownerId).push(...unsubscribers);
    }

    clearOwnerPassives(ownerId) {
        const unsubscribers = this.skillUnsubscribersByOwner.get(ownerId) || [];
        unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === "function") unsubscribe();
        });
        this.skillUnsubscribersByOwner.delete(ownerId);
    }

    startCombat({ round = 1, activeTeam = "player" } = {}) {
        this.state.inCombat = true;
        this.state.round = Math.max(1, toInt(round, 1));
        this.state.turn = 0;
        this.state.activeTeam = activeTeam || "player";
        this.emit(COMBAT_EVENTS.COMBAT_STARTED, {
            round: this.state.round,
            activeTeam: this.state.activeTeam
        });
        this.emit(COMBAT_EVENTS.ROUND_STARTED, {
            round: this.state.round
        });
    }

    endCombat({ winnerId = "", reason = "unknown" } = {}) {
        this.state.inCombat = false;
        this.emit(COMBAT_EVENTS.COMBAT_ENDED, {
            winnerId,
            reason,
            round: this.state.round,
            turn: this.state.turn
        });
    }

    startTurn({ activeTeam } = {}) {
        if (!this.state.inCombat) return;
        this.state.turn += 1;
        if (activeTeam) this.state.activeTeam = activeTeam;
        this.emit(COMBAT_EVENTS.TURN_STARTED, {
            turn: this.state.turn,
            activeTeam: this.state.activeTeam
        });
    }

    endTurn() {
        if (!this.state.inCombat) return;
        this.emit(COMBAT_EVENTS.TURN_ENDED, {
            turn: this.state.turn,
            activeTeam: this.state.activeTeam
        });
    }

    resolveAttack({
        attackerId,
        defenderId,
        source = "basic_attack",
        baseDamage = null
    } = {}) {
        const attacker = this.getCharacter(attackerId);
        const defender = this.getCharacter(defenderId);
        if (!attacker || !defender || !attacker.isAlive() || !defender.isAlive()) return null;

        this.emit(COMBAT_EVENTS.ACTION_DECLARED, {
            actionType: "attack",
            source,
            attackerId,
            defenderId
        });

        const dodgeChance = Math.max(0, (defender.dodge - attacker.aim) / 100);
        const dodged = this.randomFn() < dodgeChance;
        if (dodged) {
            const result = {
                actionType: "attack",
                source,
                attackerId,
                defenderId,
                dodged: true,
                damage: 0
            };
            this.emit(COMBAT_EVENTS.ACTION_RESOLVED, result);
            return result;
        }

        const attackValue = baseDamage === null
            ? Math.max(0, toInt(attacker.atk, 0))
            : Math.max(0, toInt(baseDamage, 0));
        const damage = Math.max(0, attackValue - Math.max(0, toInt(defender.def, 0)));
        defender.receiveDamage(damage);

        this.emit(COMBAT_EVENTS.DAMAGE_APPLIED, {
            source,
            attackerId,
            defenderId,
            damage
        });

        const result = {
            actionType: "attack",
            source,
            attackerId,
            defenderId,
            dodged: false,
            damage
        };
        this.emit(COMBAT_EVENTS.ACTION_RESOLVED, result);

        if (!defender.isAlive()) {
            this.emit(COMBAT_EVENTS.CHARACTER_DEFEATED, {
                source,
                attackerId,
                defenderId
            });
        }
        return result;
    }

    applyHeal({
        source = "heal",
        casterId,
        targetId,
        amount = 0
    } = {}) {
        const target = this.getCharacter(targetId);
        if (!target || !target.isAlive()) return 0;
        const healed = target.receiveHealing(amount);
        if (healed > 0) {
            this.emit(COMBAT_EVENTS.HEAL_APPLIED, {
                source,
                casterId,
                targetId,
                amount: healed
            });
        }
        return healed;
    }
}

