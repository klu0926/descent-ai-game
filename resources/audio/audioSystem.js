const DEFAULT_SOUND_EFFECT_FILES = {
    block: [
        "resources/audio/sounds/block/block (1).mp3",
        "resources/audio/sounds/block/block (2).mp3"
    ],
    hit: [
        "resources/audio/sounds/hit/hit (1).mp3",
        "resources/audio/sounds/hit/hit (2).mp3",
        "resources/audio/sounds/hit/hit (3).mp3",
        "resources/audio/sounds/hit/hit (4).mp3",
        "resources/audio/sounds/hit/hit (5).mp3"
    ],
    slash: [
        "resources/audio/sounds/slash/slash (1).mp3",
        "resources/audio/sounds/slash/slash (2).mp3",
        "resources/audio/sounds/slash/slash (3).mp3",
        "resources/audio/sounds/slash/slash (4).mp3"
    ],
    swoosh: ["resources/audio/sounds/swoosh/swoosh.mp3"]
};

export function createAudioSystem(soundEffectFiles = DEFAULT_SOUND_EFFECT_FILES) {
    let audioCtx = null;
    let volume = 0;
    const audioBuffers = new Map();

    function init() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
    }

    function setVolume(nextVolume) {
        volume = Math.max(0, Number(nextVolume) || 0);
    }

    function getVolume() {
        return volume;
    }

    async function loadAudioBuffer(src) {
        if (!audioCtx) return null;
        if (audioBuffers.has(src)) return audioBuffers.get(src);

        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            audioBuffers.set(src, decoded);
            return decoded;
        } catch (err) {
            console.log(`Failed to load sound: ${src}`, err);
            return null;
        }
    }

    function playBufferedSound(type) {
        if (!audioCtx || volume <= 0) return false;
        const files = soundEffectFiles[type];
        if (!files || files.length === 0) return false;

        const src = files[Math.floor(Math.random() * files.length)];
        loadAudioBuffer(src).then(buffer => {
            if (!buffer || !audioCtx || volume <= 0) return;
            const source = audioCtx.createBufferSource();
            const gainNode = audioCtx.createGain();
            source.buffer = buffer;
            gainNode.gain.value = volume;
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            source.start();
        });
        return true;
    }

    function play(type) {
        if (!audioCtx || volume <= 0) return;
        if (playBufferedSound(type)) return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === "hit") {
            osc.type = "square";
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            gainNode.gain.setValueAtTime(0.1 * volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.3 * volume, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === "crit") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
            gainNode.gain.setValueAtTime(0.15 * volume, now);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * volume), now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === "dodge") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gainNode.gain.setValueAtTime(0.05 * volume, now);
            gainNode.gain.linearRampToValueAtTime(0.01 * volume, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === "heal") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.2);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.05 * volume, now + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === "loot") {
            osc.type = "square";
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gainNode.gain.setValueAtTime(0.05 * volume, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === "metalBlock") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
            gainNode.gain.setValueAtTime(0.08 * volume, now);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * volume), now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === "victory") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            osc.frequency.setValueAtTime(880, now + 0.3);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.4 * volume, now + 0.2);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        } else if (type === "pick") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
            gainNode.gain.setValueAtTime(0.2 * volume, now);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.01 * volume), now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    }

    return {
        init,
        play,
        setVolume,
        getVolume
    };
}
