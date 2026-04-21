import { Event } from "../baseEvent.js";

export class VendorEvent extends Event {
    constructor({
        id = "",
        name = "Vendor",
        description = "",
        vendorId = "",
        inventory = [],
        skippable = true,
        enabled = true,
        metadata = {}
    } = {}) {
        super({
            id,
            type: Event.TYPES.VENDOR,
            name,
            description,
            skippable,
            enabled,
            metadata
        });
        this.vendorId = String(vendorId || "");
        this.inventory = Array.isArray(inventory) ? inventory : [];
    }

    async execute(context = {}) {
        void context;
        // Placeholder for future vendor UI flow.
        return { status: "pending-implementation" };
    }
}
