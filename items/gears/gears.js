import { BodyRug } from "./body_rug/body_rug.js";

export const BODY_RUG = new BodyRug();
export function createBodyRug() { return new BodyRug(); }

export const GEARS = {
    body_rug: BODY_RUG
};
