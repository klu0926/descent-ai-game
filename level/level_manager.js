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
        round: toMinInt(initialState.round, 1, 1),
        turn: toMinInt(initialState.turn, 0, 0)
    };

    function getState() {
        return { ...state };
    }

    function getLevel() {
        return state.level;
    }

    function getRound() {
        return state.round;
    }

    function getTurn() {
        return state.turn;
    }

    function setLevel(level) {
        state.level = toMinInt(level, state.level, 1);
    }

    function setRound(round) {
        state.round = toMinInt(round, state.round, 1);
    }

    function setTurn(turn) {
        state.turn = toMinInt(turn, state.turn, 0);
    }

    function setProgress({ level, round, turn } = {}) {
        if (typeof level !== "undefined") setLevel(level);
        if (typeof round !== "undefined") setRound(round);
        if (typeof turn !== "undefined") setTurn(turn);
    }

    function startLevel(level) {
        const nextLevel = toMinInt(level, state.level, 1);
        state.level = nextLevel;
        state.round = 1;
        state.turn = 0;
    }

    function syncToCurrentGame(currentGameStats) {
        if (!currentGameStats || typeof currentGameStats !== "object") return;
        currentGameStats.currentLevel = state.level;
        currentGameStats.currentRound = state.round;
        currentGameStats.currentTurn = state.turn;
    }

    return {
        getState,
        getLevel,
        getRound,
        getTurn,
        setLevel,
        setRound,
        setTurn,
        setProgress,
        startLevel,
        syncToCurrentGame
    };
}
