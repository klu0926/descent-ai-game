# Project Architecture

This project now uses a simple domain-first structure.

## Main Folders

- `core/`
  - Shared runtime systems:
  - `eventBus.js`
  - `gameLoop.js`
  - `gameState.js`
  - `levelManager.js`
  - `randomSystem.js`

- `combat/`
  - Combat engine and migration bridge:
  - `core/` new combat foundation
  - `legacy/` old combat flow kept for safe migration

- `scenes/`
  - Scene orchestration classes and scene event classes.

- `content/`
  - Game data entrypoints:
  - `levels/level.js`
  - `classes/index.js`
  - `enemies/index.js`
  - `enemies/enemyTypeData.js`
  - `items/index.js`

- `resources/`
  - Static media assets (audio, cutscene video, images).
  - Treat this as the project asset root for new media.

- `UI/`
  - Frontend presentation and UI controllers.

- `editor/`
  - Local content editor and API server.

## Compatibility Shims

To avoid breaking the game while migrating:

- `game/gameLoop.js` re-exports from `core/gameLoop.js`
- `game/current_game_stats.js` re-exports from `core/gameState.js`
- `game/randomSystem.js` re-exports from `core/randomSystem.js`
- `event/eventBus.js` re-exports from `core/eventBus.js`
- `level/level.js` re-exports from `content/levels/level.js`

## Skill Direction

- New passive work should go in `skills/` and `combat/core` event-driven systems.
