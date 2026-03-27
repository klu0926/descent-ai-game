import { SmallPotion } from "./small_potion/small_potion.js";

export const SMALL_POTION = new SmallPotion();
export function createSmallPotion() {
    return new SmallPotion();
}

export const CONSUMABLES = {
    small_potion: SMALL_POTION
};

