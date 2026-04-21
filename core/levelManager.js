function toInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.trunc(parsed);
}

function toMinInt(value, fallback, minValue) {
    return Math.max(minValue, toInt(value, fallback));
}

export function createLevelManager(initialState = {}) {
    const state = {
        level: toMinInt(initialState.level, 1, 1),
        scene: toMinInt(initialState.scene ?? initialState.round, 1, 1),
        turn: toMinInt(initialState.turn, 0, 0)
    };

    function getState() {
        return { ...state };
    }

    function getLevel() {
        return state.level;
    }

    function getScene() {
        return state.scene;
    }

    function getRound() {
        return state.scene;
    }

    function getTurn() {
        return state.turn;
    }

    function setLevel(level) {
        state.level = toMinInt(level, state.level, 1);
    }

    function setScene(scene) {
        state.scene = toMinInt(scene, state.scene, 1);
    }

    function setRound(round) {
        state.scene = toMinInt(round, state.scene, 1);
    }

    function setTurn(turn) {
        state.turn = toMinInt(turn, state.turn, 0);
    }

    function setProgress({ level, scene, round, turn } = {}) {
        if (typeof level !== "undefined") setLevel(level);
        if (typeof scene !== "undefined") setScene(scene);
        if (typeof round !== "undefined") setRound(round);
        if (typeof turn !== "undefined") setTurn(turn);
    }

    function startLevel(level) {
        const nextLevel = toMinInt(level, state.level, 1);
        state.level = nextLevel;
        state.scene = 1;
        state.turn = 0;
    }

    function syncToCurrentGame(currentGameStats) {
        if (!currentGameStats || typeof currentGameStats !== "object") return;
        currentGameStats.currentLevel = state.level;
        currentGameStats.currentScene = state.scene;
        currentGameStats.currentTurn = state.turn;
    }

    return {
        getState,
        getLevel,
        getScene,
        getRound,
        getTurn,
        setLevel,
        setScene,
        setRound,
        setTurn,
        setProgress,
        startLevel,
        syncToCurrentGame
    };
}
