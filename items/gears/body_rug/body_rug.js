import { Gear } from "../gear.js";

export class BodyRug extends Gear {
    constructor() {
        super({
            id: "body_rug",
            name: "body rug",
            gearType: "armor",
            slotType: "body",
            image: "items/gear_images/body_rug.png",
            temp_icon: "🦺",
            price: 20,
            storyDesc: "a dirty rug",
            functionDesc: "Def +3",
            stats: {
                hp: 0,
                atk: 0,
                def: 2,
                crit: 0,
                dodge: 0,
                aim: 0
            },
            passives: []
        });
        this.implemented = false;
    }
}

export const BODY_RUG = new BodyRug();

export function createBodyRug() {
    return new BodyRug();
}
