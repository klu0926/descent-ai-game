export class SkillTree {
    constructor({
        maxLevel = 20,
        sections = [],
        nodes = []
    } = {}) {
        this.maxLevel = Number.isFinite(Number(maxLevel)) ? Math.max(1, Math.floor(Number(maxLevel))) : 20;
        this.sections = Array.isArray(sections) ? sections : [];
        this.nodes = Array.isArray(nodes) ? nodes : [];
        this.nodesById = new Map(this.nodes.map(node => [node.id, node]));
    }

    getSections() {
        return this.sections;
    }

    getNodes() {
        return this.nodes;
    }

    getNodeById(skillId) {
        return this.nodesById.get(skillId) || null;
    }

    getTotalSkillSpent(getSkillRank) {
        if (typeof getSkillRank !== "function") return 0;
        return this.nodes.reduce((sum, node) => sum + (getSkillRank(node.id) || 0), 0);
    }

    getSectionPointRequirement(sectionId) {
        const section = this.sections.find(entry => entry.id === sectionId);
        if (!section) return Number.MAX_SAFE_INTEGER;
        return section.requiredTreePoints || 0;
    }

    isSectionUnlocked(sectionId, getSkillRank) {
        const totalSpent = this.getTotalSkillSpent(getSkillRank);
        return totalSpent >= this.getSectionPointRequirement(sectionId);
    }

    canSpendSkillPoint({ skillId, playerInfo, getSkillRank }) {
        const node = this.getNodeById(skillId);
        if (!node) return false;
        if (!playerInfo || playerInfo.skillPoints <= 0) return false;
        if (!this.isSectionUnlocked(node.section, getSkillRank)) return false;
        if ((getSkillRank(node.id) || 0) >= node.maxRank) return false;
        return true;
    }

    spendSkillPoint({ skillId, playerInfo, classRanks, getSkillRank }) {
        if (!this.canSpendSkillPoint({ skillId, playerInfo, getSkillRank })) return false;
        classRanks[skillId] = (getSkillRank(skillId) || 0) + 1;
        playerInfo.skillPoints -= 1;
        return true;
    }
}

