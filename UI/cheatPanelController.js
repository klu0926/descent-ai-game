import { toNonNegativeInt as toNonNegativeIntFromModule } from "../game/playerSystem.js";
import { fillCheatFormWithCurrentStats as fillCheatFormFromUI } from "./cheatPanelUI.js";
import {
    closeCheatPanel as closeCheatPanelFromUI,
    openCheatPanel as openCheatPanelFromUI
} from "./panelControllers.js";

export function createCheatPanelController({
    cheatOverlay,
    classOverlay,
    pauseOverlay,
    currentGameStats,
    playerInfo,
    cheatInputs,
    clearScreenSpaceEffects,
    setPauseState,
    recalculateStats,
    updatePlayerUI,
    floatText,
    getClassDefaultStats,
    createInitialCheatOverrides
}) {
    const {
        cheatHpInput,
        cheatMaxHpInput,
        cheatAtkInput,
        cheatDefInput,
        cheatCritInput,
        cheatDodgeInput,
        cheatAimInput,
        cheatGodModeInput,
        cheatReverseSkillInput
    } = cheatInputs;

    function fillCheatFormWithCurrentStats() {
        fillCheatFormFromUI({
            cheatHpInput,
            cheatMaxHpInput,
            cheatAtkInput,
            cheatDefInput,
            cheatCritInput,
            cheatDodgeInput,
            cheatAimInput,
            cheatGodModeInput,
            cheatReverseSkillInput,
            playerInfo,
            cheatOverrides: currentGameStats.cheatOverrides
        });
    }

    function openCheatPanel() {
        openCheatPanelFromUI({
            cheatOverlay,
            classOverlay,
            currentGameStats,
            clearScreenSpaceEffects,
            setPauseState,
            pauseOverlay,
            fillCheatFormWithCurrentStats
        });
    }

    function closeCheatPanel() {
        closeCheatPanelFromUI({
            cheatOverlay,
            currentGameStats,
            setPauseState,
            pauseOverlay
        });
    }

    function saveCheatStats() {
        const enteredMaxHpRaw = Math.max(1, toNonNegativeIntFromModule(cheatMaxHpInput ? cheatMaxHpInput.value : "", playerInfo.maxHp));
        const enteredHpRaw = Math.max(0, toNonNegativeIntFromModule(cheatHpInput ? cheatHpInput.value : "", playerInfo.hp));
        const maxHpChanged = enteredMaxHpRaw !== playerInfo.maxHp;
        const hpChanged = enteredHpRaw !== playerInfo.hp;
        let enteredMaxHp = enteredMaxHpRaw;
        let enteredHp = enteredHpRaw;

        // Rule 1: if HP is set above Max HP, raise Max HP too (when HP is the edited value).
        if (hpChanged && !maxHpChanged && enteredHp > enteredMaxHp) {
            enteredMaxHp = enteredHp;
        }

        // Rule 2: if Max HP is lowered below HP, clamp HP down to the new Max HP.
        if (maxHpChanged && enteredHp > enteredMaxHp) {
            enteredHp = enteredMaxHp;
        }

        currentGameStats.cheatOverrides.maxHp = enteredMaxHp;
        currentGameStats.cheatOverrides.atk = toNonNegativeIntFromModule(cheatAtkInput ? cheatAtkInput.value : "", playerInfo.atk);
        currentGameStats.cheatOverrides.def = toNonNegativeIntFromModule(cheatDefInput ? cheatDefInput.value : "", playerInfo.def);
        currentGameStats.cheatOverrides.crit = toNonNegativeIntFromModule(cheatCritInput ? cheatCritInput.value : "", playerInfo.crit);
        currentGameStats.cheatOverrides.dodge = toNonNegativeIntFromModule(cheatDodgeInput ? cheatDodgeInput.value : "", playerInfo.dodge);
        currentGameStats.cheatOverrides.aim = toNonNegativeIntFromModule(cheatAimInput ? cheatAimInput.value : "", playerInfo.aim);
        currentGameStats.cheatOverrides.godMode = cheatGodModeInput ? Boolean(cheatGodModeInput.checked) : true;
        currentGameStats.cheatOverrides.allowReverseSkillPoint = cheatReverseSkillInput ? Boolean(cheatReverseSkillInput.checked) : true;

        recalculateStats();
        playerInfo.hp = Math.min(playerInfo.maxHp, Math.max(0, enteredHp));
        updatePlayerUI();
        floatText("player", "Cheat stats saved", "system");
        fillCheatFormWithCurrentStats();
        closeCheatPanel();
    }

    function resetCheatToClassDefault() {
        const defaults = getClassDefaultStats();

        currentGameStats.cheatOverrides = createInitialCheatOverrides();
        playerInfo.baseHp = defaults.hp;
        playerInfo.baseAtk = defaults.atk;
        playerInfo.baseDef = defaults.def;
        playerInfo.baseCrit = defaults.crit;
        playerInfo.baseDodge = defaults.dodge;
        playerInfo.baseAim = defaults.aim;
        recalculateStats();
        playerInfo.hp = playerInfo.maxHp;
        updatePlayerUI();
        floatText("player", "Stats reset", "system");
        fillCheatFormWithCurrentStats();
    }

    return {
        openCheatPanel,
        closeCheatPanel,
        saveCheatStats,
        resetCheatToClassDefault,
        fillCheatFormWithCurrentStats
    };
}
