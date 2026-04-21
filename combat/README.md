# Combat Architecture (New Core)

This folder is the new combat domain layer.

## Goals

- Move combat rules out of one large hardcoded flow file.
- Make all combat interactions event-driven.
- Let passive/active skills react to combat events without tight coupling.
- Keep migration safe by supporting the legacy combat runtime.

## Core Classes

- `core/character.js`
  - `CombatCharacter`: minimal combat model (hp, stats, team, statuses).
- `core/combatManager.js`
  - owns combat state (round/turn)
  - resolves actions (`resolveAttack`, `applyHeal`)
  - emits all combat events
- `core/skill.js`
  - `ActiveSkill`
  - `PassiveSkill` (registers event listeners)
- `core/combatEventBus.js`
  - pub/sub event bus for combat events
- `core/combatEvents.js`
  - canonical event names

## Legacy Bridge

- `adapters/createLegacyCombatAdapter.js`
  - wraps existing `combat/legacy/*` system
  - emits manager lifecycle events while old logic still runs

This lets us migrate incrementally without breaking current gameplay.

## Migration Rule

When adding/changing combat behavior:

1. Define or reuse a combat event.
2. Implement effect logic in a skill/passive listener.
3. Avoid adding new rule branches in `combat/legacy/combatFlow.js`.
4. Keep `combatFlow.js` as a compatibility layer only.
