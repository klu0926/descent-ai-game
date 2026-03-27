import { Skill } from "./skill.js";
import { createPassiveEventHandler } from "./passive_event_hook.js";

export class PassiveSkill extends Skill {
    constructor(data = {}) {
        super(data);
        this.skillType = "passive";
        this.callbackFunc = typeof data.callbackFunc === "function" ? data.callbackFunc : null;
        this.listenEvents = Array.isArray(data.listenEvents) ? data.listenEvents : [];
    }

    executeCallback(context = {}) {
        if (typeof this.callbackFunc !== "function") return false;
        this.callbackFunc(context);
        return true;
    }

    createEventHandlers({ rank, runtime }) {
        if (!Array.isArray(this.listenEvents) || this.listenEvents.length === 0) return {};
        const handlers = {};

        this.listenEvents.forEach(eventType => {
            if (!eventType) return;
            const resolvedEvent = (runtime && runtime.GAME_EVENTS && runtime.GAME_EVENTS[eventType])
                ? runtime.GAME_EVENTS[eventType]
                : eventType;
            if (!resolvedEvent) return;

            handlers[resolvedEvent] = createPassiveEventHandler({
                skill: this,
                eventName: resolvedEvent,
                rank,
                runtime
            });
        });

        return handlers;
    }
}
