import { BaseScene } from "./baseScene.js";

export class CutsceneScene extends BaseScene {
    constructor({
        videoPath = "",
        background = "",
        ...rest
    } = {}) {
        super({
            ...rest,
            type: "cutscene"
        });
        this.videoPath = String(videoPath || "").trim();
        this.background = String(background || "").trim();
    }

    async start(context = {}) {
        if (typeof context.onCutsceneSceneStart === "function") {
            return context.onCutsceneSceneStart({
                scene: this
            });
        }
        return null;
    }
}

