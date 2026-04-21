import { PlayerCharacter } from "../entity/character/character.js";
import { createLevelManager } from "./levelManager.js";

export function createInitialBattleState() {
    return {
        survivalUsed: false,
        turnCount: 0,
        currentTurnNumber: 0,
        turnOwner: "player",
        playerTurnCount: 0,
        enemyTurnCount: 0,
        dodgeCounterWindow: 0,
        skillTreeDodgeBuffTurns: 0,
        trapReady: false,
        attackHitsForTrap: 0,
        trapCritArmed: false,
        relentlessCounterCooldown: 0,
        potionAtkBuffTurns: 0,
        healingScrollRegenTurns: 0
    };
}

export function createInitialCheatOverrides() {
    return {
        maxHp: null,
        atk: null,
        def: null,
        crit: null,
        dodge: null,
        aim: null,
        godMode: true,
        allowReverseSkillPoint: true
    };
}

export const LEVEL_MANAGER = createLevelManager({
    level: 1,
    scene: 1,
    turn: 0
});

export const CURRENT_GAME_STATS = {
    playerInfo: new PlayerCharacter({
        baseHp: 100,
        baseAtk: 10,
        baseDef: 5,
        baseCrit: 0,
        baseDodge: 5,
        baseAim: 0,
        inventory: [],
        consumables: [],
        gearSlots: {},
        skillPoints: 0,
        skillTreeRanks: {},
        essence: 0
    }),
    currentLevel: LEVEL_MANAGER.getLevel(),
    currentScene: LEVEL_MANAGER.getScene(),
    currentRound: 0,
    currentTurn: LEVEL_MANAGER.getTurn(),
    levelManager: LEVEL_MANAGER,
    currentEnemy: null,
    isPlayerTurn: true,
    isAnimating: false,
    isPaused: false,
    battleState: createInitialBattleState(),
    hasActiveClassSelection: false,
    pendingScavengerPotionReward: null,
    cheatPanelOpenedFromPausedState: false,
    avatarBlurPulsesStarted: false,
    cheatOverrides: createInitialCheatOverrides(),
    activePassiveSkills: [],
    effectState: {
        player: {
            activeSkills: [],
            activeStatuses: [],
            activePassives: []
        },
        enemy: {
            activeSkills: [],
            activeStatuses: [],
            activePassives: []
        }
    },
    selectedClassId: null,
    skillTreeOpenedFromPausedState: false,
    isCutsceneEventActive: false,
    skipCutsceneRequested: false,
    skipNextCutsceneTransition: false,
    volIndex: 3
};

LEVEL_MANAGER.syncToCurrentGame(CURRENT_GAME_STATS);
