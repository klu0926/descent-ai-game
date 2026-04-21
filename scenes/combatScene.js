import { BaseScene } from "./baseScene.js";

export class CombatScene extends BaseScene {
    constructor({
        enemyId = "",
        background = "",
        ...rest
    } = {}) {
        super({
            ...rest,
            type: "fight"
        });
        this.enemyId = String(enemyId || "").trim();
        this.background = String(background || "").trim();
    }

    async start(context = {}) {
        if (typeof context.onCombatSceneStart === "function") {
            return context.onCombatSceneStart({
                scene: this
            });
        }
        return null;
    }
}

