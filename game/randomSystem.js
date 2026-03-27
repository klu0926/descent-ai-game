export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function rollChance(chance, randomFn = Math.random) {
    return randomFn() < chance;
}

export function rollDamage(maxVal, randomFn = Math.random) {
    return Math.floor(randomFn() * maxVal) + 1;
}
