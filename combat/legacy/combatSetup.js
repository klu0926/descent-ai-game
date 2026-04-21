import { createCombatBindings } from "./combatBindings.js";
import { createLegacyCombatAdapter } from "../adapters/createLegacyCombatAdapter.js";

export function createCombatSystem(ctx) {
    const legacySystem = createCombatBindings(ctx);
    return createLegacyCombatAdapter({ legacySystem });
}
