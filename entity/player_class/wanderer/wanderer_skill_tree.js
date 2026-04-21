import { SkillTree } from "../skillTree.js";
import * as PASSIVE_SKILLS from "../../../skills/p_skill/index.js";
import * as ACTIVE_SKILLS from "../../../skills/a_skill/index.js";

const WANDERER_SECTION_DEFS = [
    {
        id: 1,
        name: "Survival Instincts",
        pointCap: 10,
        requiredTreePoints: 0,
        pointsToNext: 5,
        skillIds: []
    },
    {
        id: 2,
        name: "Adaptive Combat",
        pointCap: 10,
        requiredTreePoints: 5,
        pointsToNext: 5,
        skillIds: []
    },
    {
        id: 3,
        name: "Master of Survival",
        pointCap: 10,
        requiredTreePoints: 10,
        pointsToNext: 5,
        skillIds: []
    },
    {
        id: 4,
        name: "Late Mastery",
        pointCap: 10,
        requiredTreePoints: 15,
        pointsToNext: 0,
        skillIds: []
    }
];

function buildSectionsAndNodes() {
    const allSkillInstances = [
        ...Object.values(PASSIVE_SKILLS || {}),
        ...Object.values(ACTIVE_SKILLS || {})
    ].filter(skill => (
        skill
        && typeof skill === "object"
        && typeof skill.id === "string"
        && typeof skill.name === "string"
        && (skill.skillType === "passive" || skill.skillType === "buff" || skill.skillType === "debuff" || skill.skillType === "active")
    ));

    const sectionIds = new Set(WANDERER_SECTION_DEFS.map(section => Number(section.id)));
    const nodes = allSkillInstances.map(skill => {
        const rawSection = Number.parseInt(String(skill.section || "1"), 10);
        const section = sectionIds.has(rawSection) ? rawSection : 1;
        // Preserve skill instance prototype methods (createEventHandlers, onActivate, etc.).
        const clonedSkill = Object.assign(
            Object.create(Object.getPrototypeOf(skill)),
            skill
        );
        clonedSkill.section = section;
        return clonedSkill;
    });

    const skillIdsBySection = new Map(
        WANDERER_SECTION_DEFS.map(section => [Number(section.id), []])
    );
    nodes.forEach(node => {
        if (!node || !node.id) return;
        const key = Number(node.section);
        if (!skillIdsBySection.has(key)) return;
        skillIdsBySection.get(key).push(node.id);
    });

    const sections = WANDERER_SECTION_DEFS.map(section => ({
        id: section.id,
        name: section.name,
        pointCap: section.pointCap,
        requiredTreePoints: section.requiredTreePoints,
        pointsToNext: section.pointsToNext,
        skillIds: skillIdsBySection.get(Number(section.id)) || []
    }));

    return { sections, nodes };
}

export class WandererSkillTree extends SkillTree {
    constructor() {
        const { sections, nodes } = buildSectionsAndNodes();
        super({
            maxLevel: 20,
            sections,
            nodes
        });
    }
}

export const WANDERER_SKILL_TREE = new WandererSkillTree();
