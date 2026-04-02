import { PlayerCharacter } from "../entity/character/character.js";
import { getExpNeeded } from "./levelSystem.js";
import { createLevelManager } from "../level/level_manager.js";

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
    round: 1,
    turn: 0
});

export const CURRENT_GAME_STATS = {
    playerInfo: new PlayerCharacter({
        lvl: 1,
        exp: 0,
        maxExp: getExpNeeded(1),
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
        skillTreeRanks: {}
    }),
    currentLevel: LEVEL_MANAGER.getLevel(),
    currentRound: LEVEL_MANAGER.getRound(),
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
    volIndex: 3
};

LEVEL_MANAGER.syncToCurrentGame(CURRENT_GAME_STATS);
