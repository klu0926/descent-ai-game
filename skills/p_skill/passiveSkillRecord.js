import { Skill } from "../skill.js";

// Adapter for migrated legacy passive records so they use the current Skill parent class
// while preserving legacy fields (trigger, modifiers, meta, etc.).
export class PassiveSkillRecord extends Skill {
    constructor(config = {}) {
        super(config);
        Object.assign(this, config);
        this.skillType = "passive";
    }

    createEventHandlers({ rank, runtime }) {
        const handlers = {};
        const trigger = this.trigger && typeof this.trigger === "object" ? this.trigger : {};
        const triggerEvent = String(trigger.event || "").trim();
        if (!triggerEvent) return handlers;

        const gameEvents = runtime && runtime.GAME_EVENTS ? runtime.GAME_EVENTS : {};
        const resolvedEvent = this.resolveEventName(triggerEvent, gameEvents);
        if (!resolvedEvent) return handlers;

        handlers[resolvedEvent] = payload => {
            this.handleTriggeredEvent({
                rank,
                payload,
                runtime,
                triggerEvent
            });
        };
        return handlers;
    }

    onActivate({ rank, runtime }) {
        const trigger = this.trigger && typeof this.trigger === "object" ? this.trigger : {};
        if (!Boolean(trigger.autoApplied)) return;
        const battleState = this.ensureBattleState(runtime);
        if (!battleState) return;
        const appliedKey = `__auto_applied_${this.id}`;
        if (battleState[appliedKey]) return;
        const deltaCollector = [];
        const applied = this.handleEffects({
            rank,
            payload: { source: "auto_applied" },
            runtime,
            triggerEvent: "",
            battleState,
            deltaCollector
        });
        if (applied) {
            battleState[appliedKey] = true;
            const deltaKey = `__auto_applied_delta_${this.id}`;
            battleState[deltaKey] = Array.isArray(deltaCollector) ? deltaCollector : [];
        }
    }

    onDeactivate({ runtime }) {
        const battleState = this.ensureBattleState(runtime);
        if (!battleState) return;
        const deltaKey = `__auto_applied_delta_${this.id}`;
        const deltas = Array.isArray(battleState[deltaKey]) ? battleState[deltaKey] : [];
        if (!deltas.length) return;
        deltas.forEach(deltaEntry => {
            if (!deltaEntry || typeof deltaEntry !== "object") return;
            if (String(deltaEntry.kind || "") !== "stat") return;
            const side = String(deltaEntry.side || "player").trim().toLowerCase();
            const stat = String(deltaEntry.stat || "").trim();
            const delta = Number(deltaEntry.delta);
            if (!stat || !Number.isFinite(delta) || delta === 0) return;
            const target = side === "enemy"
                ? (runtime && runtime.currentGameStats ? runtime.currentGameStats.currentEnemy : null)
                : (runtime && runtime.playerInfo ? runtime.playerInfo : null);
            if (!target || !Object.prototype.hasOwnProperty.call(target, stat)) return;
            const current = Number(target[stat]) || 0;
            target[stat] = Math.max(0, Math.floor(current - delta));
        });
        battleState[deltaKey] = [];
        const appliedKey = `__auto_applied_${this.id}`;
        battleState[appliedKey] = false;
    }

    getEffects() {
        if (!Array.isArray(this.effects)) return [];
        return this.effects.filter(effect => effect && typeof effect === "object");
    }

    resolveEventName(triggerEvent, gameEvents) {
        if (!triggerEvent) return "";
        if (gameEvents && gameEvents[triggerEvent]) return gameEvents[triggerEvent];
        // Compatibility for legacy passive config naming.
        if (triggerEvent === "TURN_START" && gameEvents && gameEvents.TURN_TICK) return gameEvents.TURN_TICK;
        return triggerEvent;
    }

    ensureBattleState(runtime) {
        const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
        if (!currentGameStats || typeof currentGameStats !== "object") return null;
        if (!currentGameStats.battleState || typeof currentGameStats.battleState !== "object") {
            currentGameStats.battleState = {};
        }
        const battleState = currentGameStats.battleState;
        if (!Number.isFinite(battleState.skillTreeDodgeBuffTurns)) battleState.skillTreeDodgeBuffTurns = 0;
        if (!Number.isFinite(battleState.attackHitsForTrap)) battleState.attackHitsForTrap = 0;
        if (typeof battleState.trapReady !== "boolean") battleState.trapReady = false;
        if (typeof battleState.trapCritArmed !== "boolean") battleState.trapCritArmed = false;
        return battleState;
    }

    getNumericValue(effect, key, fallback = 0, { rank = 1 } = {}) {
        const direct = Number(effect && effect[key]);
        if (Number.isFinite(direct)) return direct;
        const perRank = Number(effect && effect[`${key}PerRank`]);
        if (Number.isFinite(perRank)) return perRank * Math.max(1, Number(rank) || 1);
        const fromModifierKey = String(effect && effect[`${key}FromModifier`] || "").trim();
        if (fromModifierKey) {
            const modifiers = this.modifiers && typeof this.modifiers === "object" ? this.modifiers : {};
            const modifierValue = Number(modifiers[fromModifierKey]);
            if (Number.isFinite(modifierValue)) return modifierValue;
        }
        return fallback;
    }

    getRankEffectMultiplier(rank = 1) {
        const safeRank = Math.max(1, Math.floor(Number(rank) || 1));
        if (!Array.isArray(this.scaling) || safeRank <= 1) return 1;
        const found = this.scaling.find(entry => Number(entry && entry.rank) === safeRank);
        const raw = Number(found && found.modifiers && found.modifiers.effectMultiplier);
        if (!Number.isFinite(raw)) return 1;
        return Math.max(0, raw);
    }

    getEffectValueNumber(effect, { rank = 1, fallback = 0, useScaling = true } = {}) {
        const direct = Number(effect && effect.value);
        const base = Number.isFinite(direct) ? direct : fallback;
        if (!useScaling) return base;
        return base * this.getRankEffectMultiplier(rank);
    }

    getEffectPercentRate(effect, { rank = 1, fallback = 0 } = {}) {
        const scaledValue = this.getEffectValueNumber(effect, { rank, fallback });
        if (!Number.isFinite(scaledValue) || scaledValue <= 0) return 0;
        return Math.max(0, scaledValue) / 100;
    }

    resolveTargetEntity(effect, runtime) {
        const rawTarget = String(effect && effect.target || "self").trim().toLowerCase();
        const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
        const player = runtime && runtime.playerInfo ? runtime.playerInfo : null;
        const enemy = currentGameStats && currentGameStats.currentEnemy ? currentGameStats.currentEnemy : null;
        const ownerSide = String(runtime && runtime.skillOwner || "player").trim().toLowerCase() === "enemy"
            ? "enemy"
            : "player";
        const oppositeSide = ownerSide === "enemy" ? "player" : "enemy";
        if (rawTarget === "self" || rawTarget === "ally") {
            return ownerSide === "enemy"
                ? { entity: enemy, side: "enemy" }
                : { entity: player, side: "player" };
        }
        if (rawTarget === "enemy" || rawTarget === "other") {
            return oppositeSide === "enemy"
                ? { entity: enemy, side: "enemy" }
                : { entity: player, side: "player" };
        }
        return ownerSide === "enemy"
            ? { entity: enemy, side: "enemy" }
            : { entity: player, side: "player" };
    }

    executeEffect(effect, { rank, payload, runtime, battleState, deltaCollector = null }) {
        const type = String(effect.type || "").trim().toLowerCase();
        if (!type) return false;

        if (type === "counter_threshold_flag") {
            const sourceEquals = String(effect.sourceEquals || "").trim();
            const source = payload && typeof payload.source === "string" ? payload.source : "";
            if (sourceEquals && source !== sourceEquals) return false;
            const counterKey = String(effect.counterKey || "").trim();
            if (!counterKey) return false;
            const step = Math.max(1, Math.floor(this.getNumericValue(effect, "step", 1, { rank })));
            const threshold = Math.max(1, Math.floor(this.getNumericValue(effect, "threshold", 1, { rank })));
            const resetTo = Math.max(0, Math.floor(this.getNumericValue(effect, "resetTo", 0, { rank })));
            battleState[counterKey] = Math.max(0, Math.floor(Number(battleState[counterKey]) || 0)) + step;
            if (battleState[counterKey] < threshold) return false;
            battleState[counterKey] = resetTo;
            const readyFlagKey = String(effect.readyFlagKey || "").trim();
            if (readyFlagKey) battleState[readyFlagKey] = Boolean(effect.readyFlagValue ?? true);
            const floatText = String(effect.floatText || "").trim();
            if (floatText && runtime && typeof runtime.floatText === "function") {
                runtime.floatText(String(effect.floatTextTarget || "player"), floatText, String(effect.floatTextKind || "info"));
            }
            return true;
        }

        if (type === "set_turns_on_event") {
            const stateKey = String(effect.stateKey || "").trim();
            if (!stateKey) return false;
            const turns = Math.max(0, Math.floor(this.getNumericValue(effect, "turns", 0, { rank })));
            battleState[stateKey] = Math.max(Math.floor(Number(battleState[stateKey]) || 0), turns);
            return true;
        }

        if (type === "arm_flag_if_flag") {
            const requiredFlagKey = String(effect.requiredFlagKey || "").trim();
            if (requiredFlagKey && !battleState[requiredFlagKey]) return false;
            const minRank = Math.max(1, Math.floor(this.getNumericValue(effect, "minRank", 1, { rank })));
            if ((Number(rank) || 1) < minRank) return false;
            const flagKey = String(effect.flagKey || "").trim();
            if (!flagKey) return false;
            battleState[flagKey] = Boolean(effect.flagValue ?? true);
            return true;
        }

        if (type === "add_hp" || type === "add_hp_percent" || type === "reduce_hp" || type === "reduce_hp_percent") {
            const resolved = this.resolveTargetEntity(effect, runtime);
            const entity = resolved.entity;
            if (!entity) return false;
            const currentHp = Number(entity.hp);
            const maxHp = Number(entity.maxHp);
            if (!Number.isFinite(currentHp) || !Number.isFinite(maxHp) || maxHp <= 0) return false;
            const isPercentType = type === "add_hp_percent" || type === "reduce_hp_percent";
            let amount = 0;
            if (isPercentType) {
                const percent = Math.max(0, this.getEffectValueNumber(effect, {
                    rank,
                    fallback: this.getNumericValue(effect, "amount", 0, { rank }),
                    useScaling: true
                }));
                amount = Math.floor(maxHp * (percent / 100));
            } else {
                amount = Math.floor(Math.max(0, this.getEffectValueNumber(effect, {
                    rank,
                    fallback: this.getNumericValue(effect, "amount", 0, { rank }),
                    useScaling: true
                })));
            }
            if (!Number.isFinite(amount) || amount <= 0) return false;
            const isReduce = type === "reduce_hp" || type === "reduce_hp_percent";
            const nextHp = isReduce
                ? Math.max(0, currentHp - amount)
                : Math.min(maxHp, currentHp + amount);
            const delta = nextHp - currentHp;
            if (delta === 0) return false;
            entity.hp = nextHp;
            if (runtime && typeof runtime.floatText === "function") {
                if (delta > 0) runtime.floatText(resolved.side, `+${delta} HP`, "heal");
                else runtime.floatText(resolved.side, `${delta} HP`, "dmg");
            }
            return true;
        }

        if (type === "heal") {
            const playerInfo = runtime && runtime.playerInfo ? runtime.playerInfo : null;
            if (!playerInfo) return false;
            const amount = Math.max(0, Math.floor(this.getEffectValueNumber(effect, { rank, fallback: this.getNumericValue(effect, "amount", 0, { rank }), useScaling: true })));
            if (amount <= 0) return false;
            const previousHp = Number(playerInfo.hp) || 0;
            playerInfo.hp = Math.min(Number(playerInfo.maxHp) || previousHp, previousHp + amount);
            const healed = playerInfo.hp - previousHp;
            if (healed > 0 && runtime && typeof runtime.floatText === "function") {
                runtime.floatText("player", `+${healed} HP`, "heal");
            }
            return healed > 0;
        }

        if (type === "heal_percent_max_hp") {
            const playerInfo = runtime && runtime.playerInfo ? runtime.playerInfo : null;
            if (!playerInfo) return false;
            const rate = Math.max(0, this.getEffectPercentRate(effect, { rank, fallback: this.getNumericValue(effect, "rate", 0, { rank }) * 100 }));
            if (rate <= 0) return false;
            const amount = Math.max(0, Math.floor((Number(playerInfo.maxHp) || 0) * rate));
            if (amount <= 0) return false;
            const previousHp = Number(playerInfo.hp) || 0;
            playerInfo.hp = Math.min(Number(playerInfo.maxHp) || previousHp, previousHp + amount);
            const healed = playerInfo.hp - previousHp;
            if (healed > 0 && runtime && typeof runtime.floatText === "function") {
                runtime.floatText("player", `+${healed} HP`, "heal");
            }
            return healed > 0;
        }

        if (type === "damage_enemy_flat") {
            const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
            const enemy = currentGameStats && currentGameStats.currentEnemy ? currentGameStats.currentEnemy : null;
            if (!enemy || !Number.isFinite(enemy.hp) || enemy.hp <= 0) return false;
            const amount = Math.max(0, Math.floor(this.getEffectValueNumber(effect, { rank, fallback: this.getNumericValue(effect, "amount", 0, { rank }), useScaling: true })));
            if (amount <= 0) return false;
            enemy.hp = Math.max(0, enemy.hp - amount);
            if (runtime && typeof runtime.floatText === "function") runtime.floatText("enemy", `-${amount}`, "dmg");
            return true;
        }

        if (type === "dodge") {
            const resolved = this.resolveTargetEntity(effect, runtime);
            const entity = resolved.entity;
            if (!entity) return false;
            const amount = Math.max(0, this.getEffectValueNumber(effect, { rank, fallback: this.getNumericValue(effect, "amount", 0, { rank }), useScaling: true }));
            if (amount <= 0) return false;
            const next = Math.min(100, Math.max(0, (Number(entity.dodge) || 0) + amount));
            entity.dodge = Math.floor(next);
            if (runtime && typeof runtime.floatText === "function") {
                runtime.floatText(resolved.side, `+${Math.floor(amount)} DODGE`, "info");
            }
            return true;
        }

        if (type === "damage_enemy_percent_max_hp") {
            const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
            const enemy = currentGameStats && currentGameStats.currentEnemy ? currentGameStats.currentEnemy : null;
            if (!enemy || !Number.isFinite(enemy.hp) || enemy.hp <= 0) return false;
            const rate = Math.max(0, this.getNumericValue(effect, "rate", 0, { rank }));
            if (rate <= 0) return false;
            const amount = Math.max(0, Math.floor((Number(enemy.maxHp) || 0) * rate));
            if (amount <= 0) return false;
            enemy.hp = Math.max(0, enemy.hp - amount);
            if (runtime && typeof runtime.floatText === "function") runtime.floatText("enemy", `-${amount}`, "dmg");
            return true;
        }

        if (type === "counter_attack") {
            const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
            const playerInfo = runtime && runtime.playerInfo ? runtime.playerInfo : null;
            const enemy = currentGameStats && currentGameStats.currentEnemy ? currentGameStats.currentEnemy : null;
            if (!playerInfo || !enemy) return false;
            if (!Number.isFinite(enemy.hp) || enemy.hp <= 0) return false;

            const scale = Math.max(0, this.getNumericValue(effect, "scale", 1, { rank }));
            const flatBonus = Math.max(0, Math.floor(this.getNumericValue(effect, "flatBonus", 0, { rank })));
            const playerAtk = Math.max(1, Math.floor(Number(playerInfo.atk) || 1));
            const enemyDef = Math.max(0, Math.floor(Number(enemy.def) || 0));
            const rawDamage = Math.floor(playerAtk * scale) + flatBonus;
            const damage = Math.max(1, rawDamage - enemyDef);
            enemy.hp = Math.max(0, enemy.hp - damage);

            if (runtime && typeof runtime.floatText === "function") {
                runtime.floatText("enemy", `-${damage}`, "dmg");
                runtime.floatText("player", "Counter!", "counter");
            }
            return true;
        }

        const statDeltaMap = {
            add_atk: { stat: "atk", sign: 1, label: "ATK" },
            reduce_atk: { stat: "atk", sign: -1, label: "ATK" },
            add_defence: { stat: "def", sign: 1, label: "DEF" },
            add_def: { stat: "def", sign: 1, label: "DEF" },
            reduce_def: { stat: "def", sign: -1, label: "DEF" },
            add_crit: { stat: "crit", sign: 1, label: "CRIT" },
            reduce_crit: { stat: "crit", sign: -1, label: "CRIT" },
            add_dodge: { stat: "dodge", sign: 1, label: "DODGE" },
            reduce_dodge: { stat: "dodge", sign: -1, label: "DODGE" },
            add_aim: { stat: "aim", sign: 1, label: "AIM" },
            reduce_aim: { stat: "aim", sign: -1, label: "AIM" }
        };
        const statDeltaDef = statDeltaMap[type];
        if (statDeltaDef) {
            const resolved = this.resolveTargetEntity(effect, runtime);
            const entity = resolved.entity;
            if (!entity) return false;
            const current = Number(entity[statDeltaDef.stat]) || 0;
            let amount = this.getEffectValueNumber(effect, { rank, fallback: this.getNumericValue(effect, "amount", 0, { rank }), useScaling: true });
            if (String(effect.valueType || "").trim() === "%") {
                amount = current * (amount / 100);
            }
            const delta = statDeltaDef.sign * Math.floor(Math.abs(amount));
            if (!Number.isFinite(delta) || delta === 0) return false;
            const next = Math.max(0, Math.floor(current + delta));
            entity[statDeltaDef.stat] = next;
            if (Array.isArray(deltaCollector)) {
                deltaCollector.push({
                    kind: "stat",
                    side: resolved.side,
                    stat: statDeltaDef.stat,
                    delta
                });
            }
            if (runtime && typeof runtime.floatText === "function") {
                const sign = delta > 0 ? "+" : "";
                runtime.floatText(resolved.side, `${sign}${delta} ${statDeltaDef.label}`, "info");
            }
            return true;
        }

        if (type === "set_flag") {
            const flagKey = String(effect.flagKey || "").trim();
            if (!flagKey) return false;
            battleState[flagKey] = Boolean(effect.flagValue ?? true);
            return true;
        }

        if (type === "clear_flag") {
            const flagKey = String(effect.flagKey || "").trim();
            if (!flagKey) return false;
            battleState[flagKey] = false;
            return true;
        }

        if (type === "add_counter") {
            const counterKey = String(effect.counterKey || "").trim();
            if (!counterKey) return false;
            const step = Math.max(1, Math.floor(this.getNumericValue(effect, "step", 1, { rank })));
            battleState[counterKey] = Math.max(0, Math.floor(Number(battleState[counterKey]) || 0)) + step;
            return true;
        }

        const unknownKey = `__unknown_effect_${this.id}_${type}`;
        if (!battleState[unknownKey]) {
            battleState[unknownKey] = true;
            console.warn(`[PassiveSkillRecord] Unsupported effect type '${type}' in skill '${this.id}'.`);
        }
        return false;
    }

    handleEffects({ rank, payload, runtime, triggerEvent, battleState, deltaCollector = null }) {
        const effects = this.getEffects();
        if (effects.length <= 0) return false;
        let applied = false;
        effects.forEach((effect, index) => {
            const onEvent = String(effect.onEvent || "").trim();
            if (onEvent && onEvent !== triggerEvent) return;
            const chanceRaw = Number(effect.chance);
            const chance = Number.isFinite(chanceRaw) ? Math.max(0, Math.min(100, chanceRaw)) : 100;
            if (chance <= 0) return;
            if (chance < 100 && Math.random() * 100 >= chance) return;
            const once = Boolean(effect.once);
            const onceKey = `__once_${this.id}_${index}`;
            if (once && battleState[onceKey]) return;
            if (this.executeEffect(effect, { rank, payload, runtime, battleState, deltaCollector })) {
                applied = true;
                if (once) battleState[onceKey] = true;
            }
        });
        return applied;
    }

    handleTriggeredEvent({ rank, payload, runtime, triggerEvent }) {
        const battleState = this.ensureBattleState(runtime);
        if (!battleState) return;

        if (this.handleEffects({ rank, payload, runtime, triggerEvent, battleState })) return;

        if (triggerEvent === "ENEMY_HIT" && this.id === "hidden_snare") {
            const source = payload && typeof payload.source === "string" ? payload.source : "";
            if (source !== "basic_attack") return;
            const triggerConfig = this.trigger && typeof this.trigger === "object" ? this.trigger : {};
            const requiredHits = Math.max(1, Math.floor(Number(triggerConfig.requiredHits) || 5));
            battleState.attackHitsForTrap += 1;
            if (battleState.attackHitsForTrap >= requiredHits) {
                battleState.attackHitsForTrap = 0;
                battleState.trapReady = true;
                if (runtime && typeof runtime.floatText === "function") {
                    runtime.floatText("player", "Trap ready", "info");
                }
            }
            return;
        }

        if (triggerEvent === "PLAYER_DODGE") {
            if (this.id === "evasive_instinct" || this.id === "ghost_walker") {
                const modifiers = this.modifiers && typeof this.modifiers === "object" ? this.modifiers : {};
                const buffTurns = Math.max(1, Math.floor(Number(modifiers.dodgeBuffTurns) || 2));
                battleState.skillTreeDodgeBuffTurns = Math.max(battleState.skillTreeDodgeBuffTurns, buffTurns);
                return;
            }

            if (this.id === "opportunistic_trap") {
                if (!battleState.trapReady) return;
                if (rank >= 2) battleState.trapCritArmed = true;
            }
        }
    }
}
