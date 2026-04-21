import { hasPassiveTag } from "../../item.js";
import { ConsumableItem } from "../consumable_item.js";

export class SmallPotion extends ConsumableItem {
    constructor() {
        super({
            id: "small_potion",
            consumableType: "healing",
            image: "items/consumable/small_potion/small_potion.png",
            temp_icon: "🧪",
            name: "Small Potion",
            price: 100,
            healAmount: 0,
            healPercent: 0.25,
            effectMode: "once",
            effectTurns: 1,
            effectRounds: 1,
            stats: {},
            passives: [],
            itemUseEventTriggers: [
                "combat:heal_item_used"
            ],
            storyDesc: "A grimy vial swirls with metallic dark fluid, reeking of ash and rot. Cursed healing tastes wicked,",
            functionDesc: "Restores 25% HP."
        });
    
        this.implemented = true;
}

    resolveConsumableEffects(context = {}) {
        const activePassives = Array.isArray(context.activePassives)
            ? context.activePassives
            : [
                ...(Array.isArray(context.activeSkills) ? context.activeSkills : []),
                ...(Array.isArray(context.activeStatuses) ? context.activeStatuses : [])
            ];
        const getSkillRank = typeof context.getSkillRank === "function" ? context.getSkillRank : null;

        let healMultiplier = 1;
        const notes = [];
        const meta = {};

        const improvisedSkill = activePassives.find(skill => (
            skill
            && skill.id === "improvised_medicine"
            && hasPassiveTag(skill, "potion")
        ));
        let improvisedRank = 0;
        if (improvisedSkill && Number.isFinite(improvisedSkill.rank)) improvisedRank = improvisedSkill.rank;
        if (getSkillRank) improvisedRank = Math.max(improvisedRank, Math.max(0, getSkillRank("improvised_medicine")));

        if (improvisedRank > 0) {
            const bonusRate = improvisedRank === 1 ? 0.1 : (improvisedRank === 2 ? 0.2 : 0.3);
            healMultiplier *= (1 + bonusRate);
            notes.push({
                source: "Improvised Medicine",
                text: `Potion heal ${Math.round(bonusRate * 100)}% more.`,
                kind: "buff"
            });
            meta.improvisedMedicineRank = improvisedRank;
        }

        activePassives.forEach(status => {
            if (!status || !Array.isArray(status.effectTypes)) return;
            if (!hasPassiveTag(status, "potion")) return;
            if (status.id === "improvised_medicine") return;
            const modifier = status.modifiers && Number.isFinite(status.modifiers.potionHealMultiplier)
                ? status.modifiers.potionHealMultiplier
                : 1;
            if (modifier !== 1) {
                healMultiplier *= modifier;
            }
            const noteText = status.note
                || status.desc
                || (modifier >= 1
                    ? `Potion heal ${Math.round((modifier - 1) * 100)}% more.`
                    : `Potion heal ${Math.round((1 - modifier) * 100)}% less.`);
            notes.push({
                source: status.name || "Status Effect",
                text: noteText,
                kind: status.kind === "debuff" ? "debuff" : "buff"
            });
        });

        return {
            healMultiplier,
            notes,
            meta
        };
    }
}
