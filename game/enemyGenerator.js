import { ENEMY_TYPES } from "../content/enemies/index.js";
import { EnemyCharacter } from "../entity/character/character.js";

function getEnemyIdFromTemplate(template) {
    if (!template || typeof template.img !== "string") return "";
    const match = template.img.match(/entity\/enemy_class\/([^/]+)\//i);
    if (!match || !match[1]) return "";
    return match[1].toLowerCase();
}

function createEnemyFromTemplate(template) {
    return new EnemyCharacter({
        name: `${template.name}`,
        type: template.type,
        img: template.img,
        size: template.size || "m",
        desc: template.desc || "",
        maxHp: Math.max(10, Math.floor(Number(template.hp) || 0)),
        hp: Math.max(10, Math.floor(Number(template.hp) || 0)),
        atk: Math.max(1, Math.floor(Number(template.atk) || 0)),
        def: Math.max(0, Math.floor(Number(template.def) || 0)),
        crit: Math.max(0, Math.floor(Number(template.crit) || 0)),
        dodge: Math.max(0, Math.floor(Number(template.dodge) || 0)),
        aim: Math.max(0, Math.floor(Number(template.aim) || 0)),
        essence: Math.max(0, Math.floor(Number(template.essence) || 1)),
        canAttack: typeof template.canAttack === "boolean" ? template.canAttack : true,
        activeSkills: Array.isArray(template.activeSkills) ? template.activeSkills : [],
        passiveSkills: Array.isArray(template.passiveSkills) ? template.passiveSkills : [],
        activeStatuses: Array.isArray(template.activeStatuses)
            ? template.activeStatuses
            : (Array.isArray(template.statuses) ? template.statuses : [])
    });
}

export function createEnemy() {
    const template = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    return createEnemyFromTemplate(template);
}

export function createEnemyFromId(enemyId) {
    const normalizedEnemyId = String(enemyId || "").trim().toLowerCase();
    if (!normalizedEnemyId) return createEnemy();

    const byImageFolder = ENEMY_TYPES.find(template => getEnemyIdFromTemplate(template) === normalizedEnemyId);
    const byName = ENEMY_TYPES.find(template => String(template.name || "").trim().toLowerCase() === normalizedEnemyId);
    const template = byImageFolder || byName;
    if (!template) return createEnemy();
    return createEnemyFromTemplate(template);
}

