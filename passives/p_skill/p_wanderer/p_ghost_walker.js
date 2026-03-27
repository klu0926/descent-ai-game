import { Passive } from "../../passive.js";

export class p_ghost_walker extends Passive {
    constructor() {
        super({
            id: "ghost_walker",
            name: "Ghost Walker",
            desc: "After dodging, become harder to hit for a short duration.",
            kind: "skill",
            mode: "action",
            effectTypes: ["action", "dodge", "survival"],
            durationTurns: 0,
            sourceType: "skill",
            sourceId: "ghost_walker",
            target: "player",
            trigger: {
                event: "PLAYER_DODGE"
            },
            modifiers: {
                dodgeBuffTurns: 2,
                dodgeFlatPerRank: 3
            },
            meta: {
                maxRank: 3
            }
        });
    }
}

export const P_GHOST_WALKER = new p_ghost_walker();
