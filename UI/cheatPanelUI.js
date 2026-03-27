export function fillCheatFormWithCurrentStats({
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
    cheatOverrides
}) {
    if (!cheatHpInput || !cheatMaxHpInput || !cheatAtkInput || !cheatDefInput || !cheatCritInput || !cheatDodgeInput || !cheatAimInput) return;
    cheatHpInput.value = `${playerInfo.hp}`;
    cheatMaxHpInput.value = `${Number.isFinite(cheatOverrides.maxHp) ? cheatOverrides.maxHp : playerInfo.maxHp}`;
    cheatAtkInput.value = `${Number.isFinite(cheatOverrides.atk) ? cheatOverrides.atk : playerInfo.atk}`;
    cheatDefInput.value = `${Number.isFinite(cheatOverrides.def) ? cheatOverrides.def : playerInfo.def}`;
    cheatCritInput.value = `${Number.isFinite(cheatOverrides.crit) ? cheatOverrides.crit : playerInfo.crit}`;
    cheatDodgeInput.value = `${Number.isFinite(cheatOverrides.dodge) ? cheatOverrides.dodge : playerInfo.dodge}`;
    cheatAimInput.value = `${Number.isFinite(cheatOverrides.aim) ? cheatOverrides.aim : playerInfo.aim}`;
    if (cheatGodModeInput) cheatGodModeInput.checked = Boolean(cheatOverrides.godMode);
    if (cheatReverseSkillInput) cheatReverseSkillInput.checked = Boolean(cheatOverrides.allowReverseSkillPoint);
}
