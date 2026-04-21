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
        trigger = {},
        modifiers = {},
        effects = [],
        scaling = [],
        skillType = "passive",
        emitsEvents = [],
        ...extra
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
        this.skillType = String(skillType || "passive").trim().toLowerCase();
        this.trigger = trigger && typeof trigger === "object" ? { ...trigger } : {};
        this.modifiers = modifiers && typeof modifiers === "object" ? { ...modifiers } : {};
        this.effects = Array.isArray(effects)
            ? effects.filter(entry => entry && typeof entry === "object").map(entry => ({ ...entry }))
            : [];
        this.scaling = Array.isArray(scaling)
            ? scaling.filter(entry => entry && typeof entry === "object").map(entry => ({ ...entry }))
            : [];
        this.emitsEvents = Array.isArray(emitsEvents)
            ? emitsEvents.filter(entry => typeof entry === "string" && entry.trim().length > 0)
            : [];
        Object.assign(this, extra);
    }

    isPassiveLike() {
        return this.skillType === "passive" || this.skillType === "buff" || this.skillType === "debuff";
    }

    onActivate({ rank, runtime } = {}) {
        if (!this.isPassiveLike()) return;
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

    onDeactivate({ runtime } = {}) {
        if (!this.isPassiveLike()) return;
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

    createEventHandlers({ rank, runtime } = {}) {
        if (!this.isPassiveLike()) return {};
        const handlers = {};
        const trigger = this.trigger && typeof this.trigger === "object" ? this.trigger : {};
        const triggerEvent = String(trigger.event || "").trim();
        if (!triggerEvent) return handlers;
        const gameEvents = runtime && runtime.GAME_EVENTS ? runtime.GAME_EVENTS : {};
        this.__runtimeSkillOwner = String(runtime && runtime.skillOwner || "").trim().toLowerCase();
        const resolvedEvent = this.resolveEventName(triggerEvent, gameEvents);
        if (!resolvedEvent) return handlers;
        handlers[resolvedEvent] = payload => {
            this.handleTriggeredEvent({ rank, payload, runtime, triggerEvent });
        };
        return handlers;
    }

    canEmitEvent(eventName) {
        return this.emitsEvents.includes(eventName);
    }

    emitEvent({ eventBus, eventName, payload }) {
        if (!eventBus || typeof eventBus.emit !== "function") return false;
        if (typeof eventName !== "string" || eventName.trim().length === 0) return false;
        if (this.emitsEvents.length > 0 && !this.canEmitEvent(eventName)) return false;
        eventBus.emit(eventName, payload);
        return true;
    }

    getEffects() {
        if (!Array.isArray(this.effects)) return [];
        return this.effects.filter(effect => effect && typeof effect === "object");
    }

    resolveEventName(triggerEvent, gameEvents) {
        if (!triggerEvent) return "";
        const normalizedTrigger = String(triggerEvent).trim().toLowerCase();
        const selfMatch = normalizedTrigger.match(/^self:(hit|dodge|block|attack|turn_start)$/);
        const targetMatch = normalizedTrigger.match(/^(target|opponent):(hit|dodge|block|attack|turn_start)$/);
        if (selfMatch || targetMatch) {
            const ownerSide = String(this.turnOwner || "").trim().toLowerCase()
                || String(this.target || "").trim().toLowerCase()
                || String(gameEvents && gameEvents.__skillOwner || "").trim().toLowerCase();
            const runtimeOwner = String(this.__runtimeSkillOwner || "").trim().toLowerCase();
            const side = runtimeOwner || ownerSide || "player";
            const ownerIsEnemy = side === "enemy";
            const useTargetSide = Boolean(targetMatch);
            const resolvedIsEnemy = useTargetSide ? !ownerIsEnemy : ownerIsEnemy;
            const kind = selfMatch ? selfMatch[1] : targetMatch[2];
            if (kind === "hit") return resolvedIsEnemy ? "combat:enemy_hit" : "combat:player_hit";
            if (kind === "dodge") return resolvedIsEnemy ? "combat:enemy_dodge" : "combat:player_dodge";
            if (kind === "block") return resolvedIsEnemy ? "combat:enemy_block" : "combat:player_block";
            if (kind === "attack") return resolvedIsEnemy ? "combat:enemy_attack" : "combat:player_attack";
            if (kind === "turn_start") return resolvedIsEnemy ? "combat:enemy_turn_start" : "combat:player_turn_start";
        }
        if (gameEvents && gameEvents[triggerEvent]) return gameEvents[triggerEvent];
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
        const safeRank = Math.max(1, Math.floor(Number(rank) || 1));
        if (!Array.isArray(this.scaling) || safeRank <= 1) return base;
        const found = this.scaling.find(entry => Number(entry && entry.rank) === safeRank);
        const modifiers = found && found.modifiers && typeof found.modifiers === "object"
            ? found.modifiers
            : null;
        if (!modifiers) return base * this.getRankEffectMultiplier(safeRank);

        const flatAdd = Number(modifiers.effectFlatAdd);
        if (Number.isFinite(flatAdd)) return base + flatAdd;

        const percentAddRate = Number(modifiers.effectPercentAddRate);
        if (Number.isFinite(percentAddRate)) return base * (1 + percentAddRate);

        return base * this.getRankEffectMultiplier(safeRank);
    }

    getEffectPercentRate(effect, { rank = 1, fallback = 0 } = {}) {
        const scaledValue = this.getEffectValueNumber(effect, { rank, fallback });
        if (!Number.isFinite(scaledValue) || scaledValue <= 0) return 0;
        return Math.max(0, scaledValue) / 100;
    }

    getPrimaryEffectDisplayValue(rank = 1) {
        const effects = this.getEffects();
        if (!effects.length) return null;
        const effect = effects[0];
        if (!effect || typeof effect !== "object") return null;
        const numericValue = this.getEffectValueNumber(effect, {
            rank: Math.max(1, Math.floor(Number(rank) || 1)),
            fallback: this.getNumericValue(effect, "amount", 0, { rank })
        });
        if (!Number.isFinite(numericValue)) return null;
        if (Math.abs(numericValue - Math.round(numericValue)) < 0.0001) return String(Math.round(numericValue));
        return String(Number(numericValue.toFixed(2)));
    }

    formatDescription(rank = 1) {
        const rawDesc = String(this.desc || "").trim();
        return this.formatTextWithTokens(rawDesc, rank);
    }

    getPrimaryEffectChanceValue() {
        const effects = this.getEffects();
        if (!effects.length) return "100";
        const effect = effects[0];
        if (!effect || typeof effect !== "object") return "100";
        const chanceRaw = Number(effect.chance);
        const chance = Number.isFinite(chanceRaw) ? Math.max(0, Math.min(100, chanceRaw)) : 100;
        if (Math.abs(chance - Math.round(chance)) < 0.0001) return `${Math.round(chance)}%`;
        return `${Number(chance.toFixed(2))}%`;
    }

    formatTextWithTokens(text, rank = 1) {
        const rawDesc = String(text || "").trim();
        if (!rawDesc) return "";
        if (!/\[(value|chance)\]/i.test(rawDesc)) return rawDesc;
        let output = rawDesc;
        const value = this.getPrimaryEffectDisplayValue(rank);
        output = output.replace(/\[value\]/gi, value == null ? "0" : value);
        const chance = this.getPrimaryEffectChanceValue();
        output = output.replace(/\[chance\]/gi, chance);
        return output;
    }

    formatTextWithValue(text, rank = 1) {
        return this.formatTextWithTokens(text, rank);
    }

    isStatusSkillType() {
        return this.skillType === "buff" || this.skillType === "debuff";
    }

    resolveTargetEntity(effect, runtime) {
        const rawTarget = String(effect && effect.target || "self").trim().toLowerCase();
        const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
        const player = runtime && runtime.playerInfo ? runtime.playerInfo : null;
        const enemy = currentGameStats && currentGameStats.currentEnemy ? currentGameStats.currentEnemy : null;
        const ownerSide = String(runtime && runtime.skillOwner || "player").trim().toLowerCase() === "enemy" ? "enemy" : "player";
        const oppositeSide = ownerSide === "enemy" ? "player" : "enemy";
        if (rawTarget === "self" || rawTarget === "ally") {
            return ownerSide === "enemy" ? { entity: enemy, side: "enemy" } : { entity: player, side: "player" };
        }
        if (rawTarget === "enemy" || rawTarget === "other") {
            return oppositeSide === "enemy" ? { entity: enemy, side: "enemy" } : { entity: player, side: "player" };
        }
        return ownerSide === "enemy" ? { entity: enemy, side: "enemy" } : { entity: player, side: "player" };
    }

    ensureAppliedStatusState(runtime, battleState) {
        const stateKey = "__appliedStatusSkills";
        if (!battleState[stateKey] || typeof battleState[stateKey] !== "object") {
            battleState[stateKey] = { entries: {} };
        }
        if (!battleState[stateKey].entries || typeof battleState[stateKey].entries !== "object") {
            battleState[stateKey].entries = {};
        }
        return battleState[stateKey];
    }

    getStatusTargetSide(effect, runtime) {
        const targetHint = String(effect && effect.target || this.target || "self").trim().toLowerCase();
        const resolved = this.resolveTargetEntity({ target: targetHint }, runtime);
        return resolved && resolved.side ? resolved.side : "enemy";
    }

    getLinkedStatusDefinition(effect, runtime) {
        const flagKey = String(effect && effect.flagKey || "").trim();
        if (!flagKey || !runtime || typeof runtime.getSkillById !== "function") return null;
        const statusDef = runtime.getSkillById(flagKey);
        if (!statusDef || typeof statusDef !== "object") return null;
        const type = String(statusDef.skillType || "").trim().toLowerCase();
        if (type !== "buff" && type !== "debuff") return null;
        return statusDef;
    }

    toStatusViewEntry(entry) {
        if (!entry || typeof entry !== "object") return null;
        const durationTurns = Math.max(0, Math.floor(Number(entry.durationTurns) || 0));
        const remainingTurns = Math.max(0, Math.floor(Number(entry.remainingTurns) || 0));
        const note = durationTurns > 0 ? `${remainingTurns}/${durationTurns} turns` : "permanent";
        const rank = Math.max(1, Math.floor(Number(entry.rank) || 1));
        const descFromSkill = entry.skill && typeof entry.skill.formatDescription === "function"
            ? entry.skill.formatDescription(rank)
            : "";
        return {
            id: entry.id,
            name: entry.name || entry.id,
            desc: descFromSkill || entry.desc || "",
            image: String(
                (entry.skill && entry.skill.image) || entry.image || ""
            ).trim(),
            note,
            kind: entry.kind || "neutral",
            rank,
            effectTypes: Array.isArray(entry.effectTypes) ? entry.effectTypes : ["generic"]
        };
    }

    syncAppliedStatusesToEntities(runtime, statusState) {
        if (!runtime || !statusState || typeof statusState !== "object") return;
        const entries = Object.values(statusState.entries || {}).filter(Boolean);
        const playerStatuses = entries
            .filter(entry => entry.side === "player")
            .map(entry => this.toStatusViewEntry(entry))
            .filter(Boolean);
        const enemyStatuses = entries
            .filter(entry => entry.side === "enemy")
            .map(entry => this.toStatusViewEntry(entry))
            .filter(Boolean);
        if (runtime.playerInfo && typeof runtime.playerInfo === "object") {
            runtime.playerInfo.activeStatuses = playerStatuses;
        }
        const enemy = runtime.currentGameStats && runtime.currentGameStats.currentEnemy
            ? runtime.currentGameStats.currentEnemy
            : null;
        if (enemy && typeof enemy === "object") {
            enemy.activeStatuses = enemyStatuses;
        }
        if (typeof runtime.syncEffectState === "function") runtime.syncEffectState();
    }

    deactivateAppliedStatusEntry(entry, runtime) {
        if (!entry || typeof entry !== "object") return;
        const unsubscribers = Array.isArray(entry.unsubscribers) ? entry.unsubscribers : [];
        unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === "function") unsubscribe();
        });
        if (entry.skill && typeof entry.skill.onDeactivate === "function") {
            entry.skill.onDeactivate({
                rank: entry.rank,
                runtime: {
                    ...runtime,
                    skillOwner: entry.side
                }
            });
        }
    }

    activateAppliedStatusEntry(entry, runtime) {
        if (!entry || typeof entry !== "object" || !entry.skill) return;
        const statusRuntime = {
            ...runtime,
            skillOwner: entry.side
        };
        if (typeof entry.skill.onActivate === "function") {
            entry.skill.onActivate({
                rank: entry.rank,
                runtime: statusRuntime
            });
        }
        const unsubscribers = [];
        if (runtime && runtime.eventBus && typeof entry.skill.createEventHandlers === "function") {
            const handlers = entry.skill.createEventHandlers({
                rank: entry.rank,
                runtime: {
                    ...statusRuntime,
                    GAME_EVENTS: runtime.GAME_EVENTS || runtime.gameEvents || {}
                }
            }) || {};
            Object.entries(handlers).forEach(([eventName, handler]) => {
                if (!eventName || typeof handler !== "function") return;
                unsubscribers.push(runtime.eventBus.on(eventName, payload => handler(payload)));
            });
        }
        entry.unsubscribers = unsubscribers;
    }

    applyLinkedStatus(effect, runtime, battleState) {
        const statusDef = this.getLinkedStatusDefinition(effect, runtime);
        if (!statusDef) return false;
        const flagKey = String(effect && effect.flagKey || "").trim();
        const side = this.getStatusTargetSide(effect, runtime);
        const state = this.ensureAppliedStatusState(runtime, battleState);
        const entryKey = `${side}:${flagKey}`;
        const existing = state.entries[entryKey] && typeof state.entries[entryKey] === "object"
            ? state.entries[entryKey]
            : null;
        const maxRank = Math.max(1, Math.floor(Number(statusDef.maxRank) || 1));
        const nextRank = existing
            ? Math.min(maxRank, Math.max(1, Math.floor(Number(existing.rank) || 1)) + 1)
            : 1;
        const durationTurns = Math.max(0, Math.floor(Number(statusDef.durationTurns) || 0));
        if (existing) this.deactivateAppliedStatusEntry(existing, runtime);
        const statusSkill = new Skill({
            ...statusDef,
            skillType: String(statusDef.skillType || "buff").trim().toLowerCase()
        });
        const nextEntry = {
            id: flagKey,
            name: statusDef.name || flagKey,
            desc: statusDef.desc || "",
            kind: String(statusDef.skillType || "buff").trim().toLowerCase(),
            effectTypes: Array.isArray(statusDef.effectTypes) ? statusDef.effectTypes : ["generic"],
            side,
            rank: nextRank,
            durationTurns,
            remainingTurns: durationTurns > 0 ? durationTurns : 0,
            skill: statusSkill,
            unsubscribers: []
        };
        state.entries[entryKey] = nextEntry;
        this.activateAppliedStatusEntry(nextEntry, runtime);
        battleState[flagKey] = true;
        this.syncAppliedStatusesToEntities(runtime, state);
        return true;
    }

    removeLinkedStatus(effect, runtime, battleState) {
        const statusDef = this.getLinkedStatusDefinition(effect, runtime);
        if (!statusDef) return false;
        const flagKey = String(effect && effect.flagKey || "").trim();
        const side = this.getStatusTargetSide(effect, runtime);
        const state = this.ensureAppliedStatusState(runtime, battleState);
        const entryKey = `${side}:${flagKey}`;
        const existing = state.entries[entryKey];
        if (existing) {
            this.deactivateAppliedStatusEntry(existing, runtime);
            delete state.entries[entryKey];
        }
        battleState[flagKey] = false;
        this.syncAppliedStatusesToEntities(runtime, state);
        return true;
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
            const nextHp = isReduce ? Math.max(0, currentHp - amount) : Math.min(maxHp, currentHp + amount);
            const delta = nextHp - currentHp;
            if (delta === 0) return false;
            entity.hp = nextHp;
            if (runtime && typeof runtime.floatText === "function") {
                if (this.isStatusSkillType()) {
                    const skillLabel = String(this.name || this.id || "status").trim();
                    const signed = delta > 0 ? `+${delta}` : `${delta}`;
                    runtime.floatText(resolved.side, `${skillLabel} ${signed}`, delta > 0 ? "heal" : "dmg");
                } else if (delta > 0) {
                    runtime.floatText(resolved.side, `+${delta} HP`, "heal");
                } else {
                    runtime.floatText(resolved.side, `${delta} HP`, "dmg");
                }
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
            if (healed > 0 && runtime && typeof runtime.floatText === "function") runtime.floatText("player", `+${healed} HP`, "heal");
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
            if (healed > 0 && runtime && typeof runtime.floatText === "function") runtime.floatText("player", `+${healed} HP`, "heal");
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
            if (runtime && typeof runtime.floatText === "function") runtime.floatText(resolved.side, `+${Math.floor(amount)} DODGE`, "info");
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
            if (String(effect.valueType || "").trim() === "%") amount = current * (amount / 100);
            const delta = statDeltaDef.sign * Math.floor(Math.abs(amount));
            if (!Number.isFinite(delta) || delta === 0) return false;
            const next = Math.max(0, Math.floor(current + delta));
            entity[statDeltaDef.stat] = next;
            if (Array.isArray(deltaCollector)) deltaCollector.push({ kind: "stat", side: resolved.side, stat: statDeltaDef.stat, delta });
            if (runtime && typeof runtime.floatText === "function") {
                const sign = delta > 0 ? "+" : "";
                runtime.floatText(resolved.side, `${sign}${delta} ${statDeltaDef.label}`, "info");
            }
            return true;
        }

        if (type === "set_flag") {
            const flagKey = String(effect.flagKey || "").trim();
            if (!flagKey) return false;
            if (this.applyLinkedStatus(effect, runtime, battleState)) return true;
            battleState[flagKey] = Boolean(effect.flagValue ?? true);
            return true;
        }

        if (type === "clear_flag") {
            const flagKey = String(effect.flagKey || "").trim();
            if (!flagKey) return false;
            if (this.removeLinkedStatus(effect, runtime, battleState)) return true;
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
            console.warn(`[Skill] Unsupported effect type '${type}' in skill '${this.id}'.`);
        }
        return false;
    }

    handleEffects({ rank, payload, runtime, triggerEvent, battleState, deltaCollector = null }) {
        const effects = this.getEffects();
        if (effects.length <= 0) return false;
        let applied = false;
        effects.forEach((effect, index) => {
            const onEvent = String(effect.onEvent || "").trim();
            if (onEvent) {
                const rawMatch = onEvent === triggerEvent;
                if (!rawMatch) {
                    const gameEvents = (runtime && (runtime.GAME_EVENTS || runtime.gameEvents)) || {};
                    const resolvedOnEvent = this.resolveEventName(onEvent, gameEvents);
                    const resolvedTriggerEvent = this.resolveEventName(triggerEvent, gameEvents);
                    if (!resolvedOnEvent || !resolvedTriggerEvent || resolvedOnEvent !== resolvedTriggerEvent) return;
                }
            }
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
        if (!this.isPassiveLike()) return;
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
                if (runtime && typeof runtime.floatText === "function") runtime.floatText("player", "Trap ready", "info");
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

export function tickAppliedStatusSkills({ runtime, payload = {} } = {}) {
    const currentGameStats = runtime && runtime.currentGameStats ? runtime.currentGameStats : null;
    const battleState = currentGameStats && currentGameStats.battleState ? currentGameStats.battleState : null;
    if (!battleState || typeof battleState !== "object") return;
    const state = battleState.__appliedStatusSkills;
    if (!state || typeof state !== "object" || !state.entries || typeof state.entries !== "object") return;
    const turnOwner = String(payload.turnOwner || "").trim().toLowerCase();
    const helper = new Skill();
    let changed = false;
    Object.entries(state.entries).forEach(([entryKey, entry]) => {
        if (!entry || typeof entry !== "object") return;
        const durationTurns = Math.max(0, Math.floor(Number(entry.durationTurns) || 0));
        if (durationTurns <= 0) return;
        const side = String(entry.side || "").trim().toLowerCase();
        if (turnOwner && side && turnOwner !== side) return;
        entry.remainingTurns = Math.max(0, Math.floor(Number(entry.remainingTurns) || 0) - 1);
        if (entry.remainingTurns > 0) {
            changed = true;
            return;
        }
        helper.deactivateAppliedStatusEntry(entry, runtime);
        const flagKey = String(entry.id || "").trim();
        if (flagKey) battleState[flagKey] = false;
        delete state.entries[entryKey];
        changed = true;
    });
    if (changed) helper.syncAppliedStatusesToEntities(runtime, state);
}
