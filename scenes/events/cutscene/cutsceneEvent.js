import { Event } from "../baseEvent.js";

function toNonNegativeInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
}

function waitMs(ms) {
    const safeMs = Math.max(0, toNonNegativeInt(ms, 0));
    return new Promise(resolve => setTimeout(resolve, safeMs));
}

export class CutsceneEvent extends Event {
    constructor({
        id = "",
        name = "Cutscene",
        description = "",
        videoSrc = "",
        playbackRate = 1,
        blackLeadMs = 850,
        fadeOutMs = 720,
        minShowMs = 300,
        skippable = false,
        enabled = true,
        metadata = {}
    } = {}) {
        super({
            id,
            type: Event.TYPES.CUTSCENE,
            name,
            description,
            skippable,
            enabled,
            metadata
        });
        this.videoSrc = String(videoSrc || "");
        this.playbackRate = Number.isFinite(Number(playbackRate)) && Number(playbackRate) > 0 ? Number(playbackRate) : 1;
        this.blackLeadMs = toNonNegativeInt(blackLeadMs, 850);
        this.fadeOutMs = toNonNegativeInt(fadeOutMs, 720);
        this.minShowMs = toNonNegativeInt(minShowMs, 300);
    }

    async execute(context = {}) {
        const overlayEl = context.overlayEl || null;
        const videoEl = context.videoEl || null;
        const runWait = typeof context.waitMs === "function" ? context.waitMs : waitMs;

        if (!overlayEl || !videoEl) {
            await runWait(this.minShowMs);
            return { status: "no-video-elements" };
        }

        overlayEl.classList.remove("hidden");
        overlayEl.classList.remove("intro-cinematic-show-black", "intro-cinematic-fadeout", "intro-cinematic-show-video");
        void overlayEl.offsetWidth;
        overlayEl.classList.add("intro-cinematic-show-video");

        let videoEnded = false;
        const onEnded = () => {
            videoEnded = true;
            videoEl.pause();
        };
        videoEl.addEventListener("ended", onEnded, { once: true });
        videoEl.controls = false;
        videoEl.playbackRate = this.playbackRate;
        videoEl.currentTime = 0;
        if (this.videoSrc) videoEl.src = this.videoSrc;

        try {
            await videoEl.play();
        } catch (_) {
            videoEnded = true;
        }

        const currentPlaybackRate = Number.isFinite(videoEl.playbackRate) && videoEl.playbackRate > 0 ? videoEl.playbackRate : 1;
        const maxVideoMs = Number.isFinite(videoEl.duration) && videoEl.duration > 0
            ? Math.ceil((videoEl.duration / currentPlaybackRate) * 1000) + 650
            : 8500;
        const startedAt = Date.now();

        while (!videoEnded && (Date.now() - startedAt) < maxVideoMs) {
            const hasDuration = Number.isFinite(videoEl.duration) && videoEl.duration > 0;
            if (hasDuration) {
                const remainingMs = ((videoEl.duration - videoEl.currentTime) / currentPlaybackRate) * 1000;
                if (remainingMs <= this.blackLeadMs) break;
            }
            await runWait(50);
        }

        overlayEl.classList.add("intro-cinematic-show-black");
        await runWait(this.blackLeadMs);

        videoEl.pause();
        overlayEl.classList.add("intro-cinematic-fadeout");
        await runWait(this.fadeOutMs);

        videoEl.pause();
        videoEl.currentTime = 0;
        overlayEl.classList.add("hidden");
        overlayEl.classList.remove("intro-cinematic-show-video", "intro-cinematic-show-black", "intro-cinematic-fadeout");
        return { status: "played" };
    }
}
