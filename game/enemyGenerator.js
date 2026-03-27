import { ENEMY_TYPES } from "../entity/enemy_class/index.js";
import { EnemyCharacter } from "../entity/character/character.js";

const EARLY_GAME_SCALE_BY_LEVEL = {
    1: { hp: 0.62, stat: 0.68, finesse: 0.7 },
    2: { hp: 0.7, stat: 0.75, finesse: 0.76 },
    3: { hp: 0.78, stat: 0.82, finesse: 0.82 },
    4: { hp: 0.87, stat: 0.9, finesse: 0.9 },
    5: { hp: 0.95, stat: 0.96, finesse: 0.96 }
};

const ENEMY_CURVE_CONFIG = {
    base: {
        hpLinear: 0.15,
        hpQuadratic: 0.02,
        statLinear: 0.1,
        statQuadratic: 0.01,
        finesseLinear: 0.04
    },
    lateGame: {
        startLevel: 20,
        hpLinear: 0.05,
        hpQuadratic: 0.003,
        statLinear: 0.055,
        statQuadratic: 0.0035,
        finesseLinear: 0.03,
        finesseQuadratic: 0.0015
    }
};

function getScaledValue(baseValue, scale, floorValue) {
    return Math.max(floorValue, Math.floor(baseValue * scale));
}

function getLateGameMultiplier(level, linearGrowth, quadraticGrowth = 0) {
    const overLevel = Math.max(0, level - ENEMY_CURVE_CONFIG.lateGame.startLevel);
    if (overLevel === 0) return 1;
    return 1 + (overLevel * linearGrowth) + (overLevel * overLevel * quadraticGrowth);
}

function isEnemyAvailableAtLevel(template, level) {
    if (!template || !Array.isArray(template.levels) || template.levels.length === 0) return true;
    if (template.levels.includes("all")) return true;
    return template.levels.some(entry => Number(entry) === Number(level));
}

export function createEnemy(level) {
    const eligibleTemplates = ENEMY_TYPES.filter(template => isEnemyAvailableAtLevel(template, level));
    const sourcePool = eligibleTemplates.length > 0 ? eligibleTemplates : ENEMY_TYPES;
    const template = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    const hpScale = (1 + (level * ENEMY_CURVE_CONFIG.base.hpLinear) + (level * level * ENEMY_CURVE_CONFIG.base.hpQuadratic))
        * getLateGameMultiplier(level, ENEMY_CURVE_CONFIG.lateGame.hpLinear, ENEMY_CURVE_CONFIG.lateGame.hpQuadratic);
    const statScale = (1 + (level * ENEMY_CURVE_CONFIG.base.statLinear) + (level * level * ENEMY_CURVE_CONFIG.base.statQuadratic))
        * getLateGameMultiplier(level, ENEMY_CURVE_CONFIG.lateGame.statLinear, ENEMY_CURVE_CONFIG.lateGame.statQuadratic);
    const finesseScale = (1 + (level * ENEMY_CURVE_CONFIG.base.finesseLinear))
        * getLateGameMultiplier(level, ENEMY_CURVE_CONFIG.lateGame.finesseLinear, ENEMY_CURVE_CONFIG.lateGame.finesseQuadratic);
    const earlyGameScale = EARLY_GAME_SCALE_BY_LEVEL[level] || { hp: 1, stat: 1, finesse: 1 };

    return new EnemyCharacter({
        name: `Lv.${level} ${template.name}`,
        type: template.type,
        img: template.img,
        size: template.size || "m",
        desc: template.desc || "",
        maxHp: getScaledValue(template.hp, hpScale * earlyGameScale.hp, 10),
        hp: getScaledValue(template.hp, hpScale * earlyGameScale.hp, 10),
        atk: getScaledValue(template.atk, statScale * earlyGameScale.stat, 2),
        def: getScaledValue(template.def, statScale * earlyGameScale.stat, 0),
        crit: getScaledValue(template.crit, finesseScale * earlyGameScale.finesse, 0),
        dodge: getScaledValue(template.dodge, finesseScale * earlyGameScale.finesse, 0),
        aim: getScaledValue(template.aim, finesseScale * earlyGameScale.finesse, 0),
        exp: getScaledValue(template.exp || 15, statScale * earlyGameScale.stat, 5)
    });
}

