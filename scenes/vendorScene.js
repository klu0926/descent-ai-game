import { BaseScene } from "./baseScene.js";

export class VendorScene extends BaseScene {
    constructor({
        vendorItems = [],
        background = "",
        ...rest
    } = {}) {
        super({
            ...rest,
            type: "vendor"
        });
        this.vendorItems = Array.isArray(vendorItems) ? vendorItems : [];
        this.background = String(background || "").trim();
    }

    async start(context = {}) {
        if (typeof context.onVendorSceneStart === "function") {
            return context.onVendorSceneStart({
                scene: this
            });
        }
        return null;
    }
}

