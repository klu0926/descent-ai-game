import { Item } from "../item.js";

export const GEAR_TYPES = ["weapon", "armor", "accessory"];

export const GEAR_SLOT_TYPES = [
    "helmet",
    "body",
    "shoes",
    "hands",
    "weapon_1",
    "weapon_2",
    "relic_1",
    "relic_2"
];

export class Gear extends Item {
    constructor({
        id,
        gearType = "armor",
        slotType = "body",
        allowedSlots = [],
        image = "",
        temp_icon = "",
        icon = "",
        name = "",
        price = 0,
        stats = {},
        passives = [],
        desc = "",
        storyDesc = "",
        functionDesc = ""
    }) {
        const normalizedStoryDesc = String(storyDesc || desc || "");
        super({
            id,
            rewardType: "gear",
            type: gearType,
            typeTag: "gear",
            image,
            temp_icon,
            icon,
            name,
            price,
            stats,
            passives,
            storyDesc: normalizedStoryDesc,
            desc: normalizedStoryDesc,
            functionDesc
        });

        this.gearType = gearType;
        this.slotType = slotType;
        this.allowedSlots = Array.isArray(allowedSlots)
            ? allowedSlots.filter(slot => GEAR_SLOT_TYPES.includes(slot))
            : [];
    }
}
