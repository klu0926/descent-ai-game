import { PassiveSkill } from "../../../passive_skill.js";

function scavengersLuckCallback({ rank, runtime }) {
    const { currentGameStats, playerInfo, getSkillRank, createSmallPotion, floatText } = runtime;
    if (!currentGameStats || !playerInfo) return;
    if (currentGameStats.pendingScavengerPotionReward) return;

    const predatorsRecoveryRank = getSkillRank("predators_recovery");
    let chance = rank * 0.05;
    if (playerInfo.hp <= Math.floor(playerInfo.maxHp * 0.3)) {
        chance += predatorsRecoveryRank * 0.02;
    }
    chance = Math.min(0.65, chance);
    if (Math.random() >= chance) return;

    currentGameStats.pendingScavengerPotionReward = createSmallPotion();
    floatText("player", "Scavenger's Luck!", "info");
}

export class ScavengersLuckSkill extends PassiveSkill {
    constructor() {
        super({
            id: "scavengers_luck",
            name: "Scavenger's Luck",
            section: 1,
            maxRank: 5,
            implemented: true,
            effectTypes: ["loot"],
            desc: "Killing enemies has up to 25% chance to drop a small potion that restores HP.",
            levelData: [
                "Enemy kills can have 5% chance to drop a small potion.",
                "Enemy kills can have 10% chance to drop a small potion.",
                "Enemy kills can have 15% chance to drop a small potion.",
                "Enemy kills can have 20% chance to drop a small potion.",
                "Enemy kills can have 25% chance to drop a small potion.",
            ],
            image: "entity/player_class/wanderer/wanderer_images/skills_icon/scavengers_luck.png",
            listenEvents: ["BATTLE_WON"],
            callbackFunc: scavengersLuckCallback
        });
    }
}

export const SCAVENGERS_LUCK_SKILL = new ScavengersLuckSkill();


