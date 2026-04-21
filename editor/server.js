const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");
const { createTinyPngApi } = require("./api/tinyPng");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = 8787;
const CHILD_ENV_FLAG = "ENEMY_EDITOR_CHILD";
const DISABLE_WATCH_FLAG = "--no-watch";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENEMY_ROOT = path.join(PROJECT_ROOT, "entity", "enemy_class");
const PLAYER_CLASS_ROOT = path.join(PROJECT_ROOT, "entity", "player_class");
const WANDERER_DATA_FILE = path.join(PLAYER_CLASS_ROOT, "wanderer", "wanderer_data.js");
const INDEX_FILE = path.join(ENEMY_ROOT, "index.js");
const ENEMY_TYPE_DATA_FILE = path.join(ENEMY_ROOT, "enemy_type_data.js");
const LEVEL_DATA_FILE = path.join(PROJECT_ROOT, "content", "levels", "level.js");
const CUTSCENE_VIDEO_ROOTS = [
    path.join(PROJECT_ROOT, "resources", "cutscene", "cutscene_video"),
    path.join(PROJECT_ROOT, "scenes", "cutscene", "cutscene_video"),
    path.join(PROJECT_ROOT, "event", "cutscene", "cutscene_video")
];
const ITEMS_ROOT = path.join(PROJECT_ROOT, "items");
const ITEM_CLASS_ROOT = path.join(ITEMS_ROOT, "consumable");
const GEAR_CLASS_ROOT = path.join(ITEMS_ROOT, "gears");
const ITEMS_IMAGE_DIR = path.join(ITEMS_ROOT, "items_images");
const GEARS_IMAGE_DIR = path.join(ITEMS_ROOT, "gear_images");
const GAME_DATA_FILE = path.join(PROJECT_ROOT, "data", "data.js");
const EVENT_REGISTRY_FILE = path.join(PROJECT_ROOT, "data", "events.json");
const SKILLS_ROOT = path.join(PROJECT_ROOT, "skills");
const PASSIVE_SKILL_ROOT = path.join(SKILLS_ROOT, "p_skill");
const ACTIVE_SKILL_ROOT = path.join(SKILLS_ROOT, "a_skill");
const SKILL_ICON_ROOT = path.join(PROJECT_ROOT, "resources", "images", "skill_icons");
const PUBLIC_ROOT = path.join(__dirname, "public");
const EDITOR_ENV_FILE = path.join(__dirname, '.env');
const tinyPngApi = createTinyPngApi({ editorEnvFile: EDITOR_ENV_FILE });
const IS_WATCH_SUPERVISOR = !process.env[CHILD_ENV_FLAG] && !process.argv.includes(DISABLE_WATCH_FLAG);
const LIVE_RELOAD_EXTENSIONS = new Set([".css", ".js", ".html"]);

const liveReloadClients = new Set();
let liveReloadKeepAliveTimer = null;
let liveReloadWatcher = null;

const FIELD_ORDER = ["name", "img", "type", "size", "hp", "atk", "def", "crit", "dodge", "aim", "essence", "canAttack", "desc"];
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const ITEM_TYPE_OPTIONS = ["consumable", "material", "quest", "misc"];
const CONSUMABLE_TYPE_OPTIONS = ["healing", "buff", "utility", "none"];
const GEAR_TYPE_OPTIONS = ["weapon", "armor", "accessory"];
const GEAR_SLOT_OPTIONS = ["helmet", "body", "shoes", "hands", "weapon", "relic"];
const SKILL_TYPE_OPTIONS = ["passive", "buff", "debuff", "active"];
const SKILL_TARGET_OPTIONS = ["enemy", "player", "self", "ally", "all_enemies", "all_allies", "none"];
const SKILL_MODE_OPTIONS = ["on_use", "action", "passive", "instant", "toggle"];
const SUPPORTED_PASSIVE_EFFECT_TYPES = new Set([
    "counter_threshold_flag",
    "set_turns_on_event",
    "arm_flag_if_flag",
    "add_hp",
    "add_hp_percent",
    "reduce_hp",
    "reduce_hp_percent",
    "heal",
    "heal_percent_max_hp",
    "damage_enemy_flat",
    "dodge",
    "damage_enemy_percent_max_hp",
    "counter_attack",
    "add_atk",
    "reduce_atk",
    "add_defence",
    "add_def",
    "reduce_def",
    "add_crit",
    "reduce_crit",
    "add_dodge",
    "reduce_dodge",
    "add_aim",
    "reduce_aim",
    "set_flag",
    "clear_flag",
    "add_counter"
]);
const DEFAULT_EVENT_REGISTRY = Object.freeze({
    events: [
        { id: "loop_started", name: "LOOP_STARTED", eventName: "game:loop_started", scope: "game", description: "Game loop started.", core: true },
        { id: "loop_stopped", name: "LOOP_STOPPED", eventName: "game:loop_stopped", scope: "game", description: "Game loop stopped.", core: true },
        { id: "loop_skipped", name: "LOOP_SKIPPED", eventName: "game:loop_skipped", scope: "game", description: "Game loop tick skipped.", core: true },
        { id: "turn_tick", name: "TURN_TICK", eventName: "game:turn_tick", scope: "game", description: "Main turn tick.", core: true },
        { id: "player_hit", name: "PLAYER_HIT", eventName: "combat:player_hit", scope: "game", description: "Player took damage.", core: true },
        { id: "heal_item_used", name: "HEAL_ITEM_USED", eventName: "combat:heal_item_used", scope: "game", description: "A healing consumable was used by the player.", core: true },
        { id: "player_dodge", name: "PLAYER_DODGE", eventName: "combat:player_dodge", scope: "game", description: "Player dodged an attack.", core: true },
        { id: "player_block", name: "PLAYER_BLOCK", eventName: "combat:player_block", scope: "game", description: "Player blocked an attack.", core: true },
        { id: "player_attack", name: "PLAYER_ATTACK", eventName: "combat:player_attack", scope: "game", description: "Player initiated an attack.", core: true },
        { id: "enemy_hit", name: "ENEMY_HIT", eventName: "combat:enemy_hit", scope: "game", description: "Enemy took damage.", core: true },
        { id: "enemy_dodge", name: "ENEMY_DODGE", eventName: "combat:enemy_dodge", scope: "game", description: "Enemy dodged an attack.", core: true },
        { id: "enemy_block", name: "ENEMY_BLOCK", eventName: "combat:enemy_block", scope: "game", description: "Enemy blocked an attack.", core: true },
        { id: "enemy_attack", name: "ENEMY_ATTACK", eventName: "combat:enemy_attack", scope: "game", description: "Enemy initiated an attack.", core: true },
        { id: "player_turn_start", name: "PLAYER_TURN_START", eventName: "combat:player_turn_start", scope: "game", description: "Player turn started.", core: true },
        { id: "enemy_turn_start", name: "ENEMY_TURN_START", eventName: "combat:enemy_turn_start", scope: "game", description: "Enemy turn started.", core: true },
        { id: "level_started", name: "LEVEL_STARTED", eventName: "game:level_started", scope: "game", description: "Level started.", core: true },
        { id: "battle_won", name: "BATTLE_WON", eventName: "game:battle_won", scope: "game", description: "Battle won.", core: true },
        { id: "battle_lost", name: "BATTLE_LOST", eventName: "game:battle_lost", scope: "game", description: "Battle lost.", core: true },
        { id: "combat_started", name: "COMBAT_STARTED", eventName: "combat:started", scope: "combat", description: "Combat started.", core: true },
        { id: "combat_ended", name: "COMBAT_ENDED", eventName: "combat:ended", scope: "combat", description: "Combat ended.", core: true },
        { id: "round_started", name: "ROUND_STARTED", eventName: "combat:round_started", scope: "combat", description: "Round started.", core: true },
        { id: "round_ended", name: "ROUND_ENDED", eventName: "combat:round_ended", scope: "combat", description: "Round ended.", core: true },
        { id: "turn_started", name: "TURN_STARTED", eventName: "combat:turn_started", scope: "combat", description: "Combat turn started.", core: true },
        { id: "turn_ended", name: "TURN_ENDED", eventName: "combat:turn_ended", scope: "combat", description: "Combat turn ended.", core: true },
        { id: "action_declared", name: "ACTION_DECLARED", eventName: "combat:action_declared", scope: "combat", description: "Action declared.", core: true },
        { id: "action_resolved", name: "ACTION_RESOLVED", eventName: "combat:action_resolved", scope: "combat", description: "Action resolved.", core: true },
        { id: "damage_applied", name: "DAMAGE_APPLIED", eventName: "combat:damage_applied", scope: "combat", description: "Damage applied.", core: true },
        { id: "heal_applied", name: "HEAL_APPLIED", eventName: "combat:heal_applied", scope: "combat", description: "Heal applied.", core: true },
        { id: "character_defeated", name: "CHARACTER_DEFEATED", eventName: "combat:character_defeated", scope: "combat", description: "Character defeated.", core: true },
        { id: "status_applied", name: "STATUS_APPLIED", eventName: "combat:status_applied", scope: "combat", description: "Status applied.", core: true },
        { id: "status_expired", name: "STATUS_EXPIRED", eventName: "combat:status_expired", scope: "combat", description: "Status expired.", core: true }
    ]
});

function normalizeGearSlotType(value, fallback = "body") {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return fallback;
    if (raw === "weapon_1" || raw === "weapon_2" || raw === "weapon") return "weapon";
    if (raw === "relic_1" || raw === "relic_2" || raw === "relic") return "relic";
    if (GEAR_SLOT_OPTIONS.includes(raw)) return raw;
    return fallback;
}

function inferGearTypeFromSlotType(slotType) {
    const slot = normalizeGearSlotType(slotType, "body");
    if (slot === "weapon") return "weapon";
    if (slot === "relic") return "accessory";
    return "armor";
}

function escapePowerShellSingleQuoted(value) {
    return String(value || "").replace(/'/g, "''");
}

function runPowerShellCommand(commandText) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "powershell",
            ["-NoProfile", "-NonInteractive", "-Command", commandText],
            { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
        );
        let stderr = "";
        child.stderr.on("data", chunk => {
            stderr += String(chunk || "");
        });
        child.on("error", reject);
        child.on("close", code => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error((stderr || `PowerShell exited with code ${code}`).trim()));
        });
    });
}

function openFileLocationInExplorer(filePath) {
    const normalized = path.normalize(String(filePath || ""));
    if (!normalized) throw new Error("Invalid file path.");
    const escapedPath = escapePowerShellSingleQuoted(normalized);
    const commandText = [
        "$ErrorActionPreference = 'Stop'",
        `$target = '${escapedPath}'`,
        "if (-not (Test-Path -LiteralPath $target)) { throw 'File not found.' }",
        "Start-Process -FilePath 'explorer.exe' -ArgumentList ('/select,\"' + $target + '\"') -ErrorAction Stop"
    ].join("; ");
    return runPowerShellCommand(commandText);
}

function sanitizeId(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized;
}

function makeConstName(enemyId) {
    const safeId = sanitizeId(enemyId) || "enemy";
    return `${safeId.toUpperCase()}_ENEMY`;
}

function getEnemyFilePath(enemyId) {
    const safeId = sanitizeId(enemyId);
    if (!safeId) return "";
    return path.join(ENEMY_ROOT, safeId, `${safeId}_data.js`);
}

function getUniqueEnemyId(baseId) {
    const sanitizedBase = sanitizeId(baseId) || "enemy";
    let candidate = sanitizedBase;
    let index = 0;
    while (fs.existsSync(getEnemyFilePath(candidate))) {
        index += 1;
        candidate = `${sanitizedBase}_${index}`;
    }
    return candidate;
}

function getUniqueEnemyIdWithIgnore(baseId, ignoreId) {
    const sanitizedBase = sanitizeId(baseId) || "enemy";
    let candidate = sanitizedBase;
    let index = 0;
    while (fs.existsSync(getEnemyFilePath(candidate)) && candidate !== ignoreId) {
        index += 1;
        candidate = `${sanitizedBase}_${index}`;
    }
    return candidate;
}

async function movePathSafe(fromPath, toPath) {
    try {
        await fsp.rename(fromPath, toPath);
        return;
    } catch (error) {
        if (error && (error.code === "EXDEV" || error.code === "EPERM")) {
            await fsp.cp(fromPath, toPath, { recursive: true, force: true });
            await fsp.rm(fromPath, { recursive: true, force: true });
            return;
        }
        throw error;
    }
}

function getDefaultEnemyRecord(enemyId) {
    return {
        name: "New Enemy",
        img: `entity/enemy_class/${enemyId}/${enemyId}_images/${enemyId}.png`,
        type: "monster",
        size: "m",
        hp: 50,
        atk: 8,
        def: 4,
        crit: 2,
        dodge: 2,
        aim: 2,
        essence: 1,
        canAttack: true,
        desc: "Describe this enemy."
    };
}

function parseStatsObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const normalized = {};
    Object.entries(input).forEach(([key, value]) => {
        const statKey = String(key || "").trim();
        const statValue = Number(value);
        if (!statKey || !Number.isFinite(statValue)) return;
        normalized[statKey] = Math.floor(statValue);
    });
    return normalized;
}

function parsePassivesArray(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map(entry => String(entry || "").trim())
        .filter(Boolean);
}

function parseEventTriggersArray(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map(entry => String(entry || "").trim())
        .filter(Boolean);
}

function parsePriceValue(input, fallback = 0) {
    const parsed = Number.parseInt(String(input ?? "").trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    const safeFallback = Number.parseInt(String(fallback ?? "").trim(), 10);
    return Number.isFinite(safeFallback) && safeFallback >= 0 ? safeFallback : 0;
}

function parseFractionValue(input, fallback = 0) {
    const parsed = Number.parseFloat(String(input ?? "").trim());
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
    const safeFallback = Number.parseFloat(String(fallback ?? "").trim());
    return Number.isFinite(safeFallback) ? Math.max(0, Math.min(1, safeFallback)) : 0;
}

function parseDurationMode(input, fallback = "once") {
    const normalized = String(input || fallback || "once").trim().toLowerCase();
    if (normalized === "turn" || normalized === "scene" || normalized === "once") return normalized;
    return "once";
}

function parseImplementedFlag(input, fallback = false) {
    if (typeof input === "boolean") return input;
    if (input === 1 || input === "1") return true;
    if (input === 0 || input === "0") return false;
    const normalized = String(input || "").trim().toLowerCase();
    if (normalized === "true" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "no") return false;
    return Boolean(fallback);
}

function buildUniqueRecordId(baseId, existingIds, fallbackPrefix = "record") {
    const root = sanitizeId(baseId) || fallbackPrefix;
    let candidate = root;
    let suffix = 0;
    while (existingIds.has(candidate)) {
        suffix += 1;
        candidate = `${root}_${suffix}`;
    }
    return candidate;
}

function parseGameDataForSeed() {
    if (!fs.existsSync(GAME_DATA_FILE)) {
        return { WEAPON_TYPES: [], ARMOR_TYPES: [], ACCESSORY_TYPES: [] };
    }
    const raw = fs.readFileSync(GAME_DATA_FILE, "utf8");
    const executable = raw.replace(/export\s+const\s+/g, "const ");
    const parsed = Function(
        `"use strict"; ${executable}\nreturn { WEAPON_TYPES, ARMOR_TYPES, ACCESSORY_TYPES };`
    )();
    return {
        WEAPON_TYPES: Array.isArray(parsed.WEAPON_TYPES) ? parsed.WEAPON_TYPES : [],
        ARMOR_TYPES: Array.isArray(parsed.ARMOR_TYPES) ? parsed.ARMOR_TYPES : [],
        ACCESSORY_TYPES: Array.isArray(parsed.ACCESSORY_TYPES) ? parsed.ACCESSORY_TYPES : []
    };
}

function createSeedGearRecords() {
    const pools = parseGameDataForSeed();
    const byType = [
        { gearType: "weapon", slotType: "weapon", entries: pools.WEAPON_TYPES },
        { gearType: "armor", slotType: "body", entries: pools.ARMOR_TYPES },
        { gearType: "accessory", slotType: "relic", entries: pools.ACCESSORY_TYPES }
    ];
    const usedIds = new Set();
    const now = new Date().toISOString();
    const records = [];

    byType.forEach(group => {
        group.entries.forEach((entry, index) => {
            const safeName = String(entry && entry.name || `${group.gearType}_${index + 1}`).trim();
            const baseId = `${group.gearType}_${safeName}`;
            const id = buildUniqueRecordId(baseId, usedIds, group.gearType);
            usedIds.add(id);
            const statKey = String(entry && entry.stat || "").trim();
            const statValue = Number(entry && entry.val);
            const stats = {};
            if (statKey && Number.isFinite(statValue)) stats[statKey] = Math.floor(statValue);
            records.push({
                id,
                name: safeName,
                gearType: group.gearType,
                slotType: group.slotType,
                image: String(entry && entry.image || "").trim(),
                temp_icon: String(entry && (entry.temp_icon || entry.icon) || "").trim(),
                price: 100,
                implemented: false,
                storyDesc: "",
                functionDesc: "",
                stats,
                passives: [],
                source: "seed",
                createdAt: now,
                updatedAt: now
            });
        });
    });
    return records;
}

async function ensureItemStores() {
    await fsp.mkdir(ITEM_CLASS_ROOT, { recursive: true });
    await fsp.mkdir(GEAR_CLASS_ROOT, { recursive: true });
    await fsp.mkdir(ITEMS_IMAGE_DIR, { recursive: true });
    await fsp.mkdir(GEARS_IMAGE_DIR, { recursive: true });
}

function getImageDirByKind(kind) {
    return kind === "gear" ? GEARS_IMAGE_DIR : ITEMS_IMAGE_DIR;
}

function buildImagePathByKind(kind, fileName) {
    const folder = kind === "gear" ? "gear_images" : "items_images";
    return `items/${folder}/${fileName}`;
}

function getImageSizeBytesFromRecord(record) {
    const imgPath = record && typeof record === "object" ? String(record.image || "").trim() : "";
    const absolute = resolveProjectFilePath(imgPath);
    if (!absolute || !fs.existsSync(absolute)) return 0;
    try {
        const stat = fs.statSync(absolute);
        return stat && stat.isFile() ? Number(stat.size) || 0 : 0;
    } catch (_) {
        return 0;
    }
}

function resolveImageExtensionFromRecord(record) {
    const imgPath = String(record && record.image || "").trim().replace(/\\/g, "/");
    const ext = path.posix.extname(imgPath).toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : ".png";
}

async function loadRecordsByKind(kind) {
    await ensureItemStores();
    const root = kind === "gear" ? GEAR_CLASS_ROOT : ITEM_CLASS_ROOT;
    const records = [];
    const skipFiles = kind === "gear"
        ? new Set(["gear.js", "gears.js"])
        : new Set(["consumable.js", "consumable_item.js"]);

    async function walk(dirPath) {
        const entries = await fsp.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }
            if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".js") continue;
            if (skipFiles.has(entry.name)) continue;
            const parsed = await readClassRecordFile(kind, fullPath);
            if (parsed) records.push(parsed);
        }
    }

    await walk(root);
    return records;
}

async function getAllSellableItemIds() {
    const [items, gears] = await Promise.all([
        loadRecordsByKind("item"),
        loadRecordsByKind("gear")
    ]);
    const ids = new Set();
    [...items, ...gears].forEach(entry => {
        const id = sanitizeId(entry && entry.id);
        if (id) ids.add(id);
    });
    return ids;
}

function normalizeItemRecord(payload, existing = null) {
    const source = payload && typeof payload === "object" ? payload : {};
    const base = existing || {};
    const now = new Date().toISOString();
    const rawPrice = Object.prototype.hasOwnProperty.call(source, "price")
        ? source.price
        : base.price;
    const itemType = ITEM_TYPE_OPTIONS.includes(String(source.itemType || base.itemType || "").trim())
        ? String(source.itemType || base.itemType).trim()
        : "consumable";
    const parsedTriggers = parseEventTriggersArray(source.itemUseEventTriggers || base.itemUseEventTriggers);
    const itemUseEventTriggers = (itemType === "consumable" && parsedTriggers.length === 0)
        ? ["combat:heal_item_used"]
        : parsedTriggers;
    return {
        id: sanitizeId(source.id || base.id || source.name || "item"),
        name: String(source.name || base.name || "New Item").trim(),
        itemType,
        consumableType: CONSUMABLE_TYPE_OPTIONS.includes(String(source.consumableType || base.consumableType || "").trim())
            ? String(source.consumableType || base.consumableType).trim()
            : "none",
        image: String(source.image || base.image || "").trim(),
        temp_icon: String(source.temp_icon || base.temp_icon || "").trim(),
        price: parsePriceValue(rawPrice, 100),
        implemented: parseImplementedFlag(source.implemented, base.implemented),
        storyDesc: String(source.storyDesc || base.storyDesc || "").trim(),
        functionDesc: String(source.functionDesc || base.functionDesc || "").trim(),
        stats: parseStatsObject(source.stats || base.stats),
        healAmount: parsePriceValue(
            Object.prototype.hasOwnProperty.call(source, "healAmount") ? source.healAmount : base.healAmount,
            0
        ),
        healPercent: parseFractionValue(
            Object.prototype.hasOwnProperty.call(source, "healPercent") ? source.healPercent : base.healPercent,
            0
        ),
        effectMode: parseDurationMode(
            Object.prototype.hasOwnProperty.call(source, "effectMode") ? source.effectMode : base.effectMode,
            "once"
        ),
        effectTurns: parsePriceValue(
            Object.prototype.hasOwnProperty.call(source, "effectTurns") ? source.effectTurns : base.effectTurns,
            1
        ) || 1,
        effectRounds: parsePriceValue(
            Object.prototype.hasOwnProperty.call(source, "effectRounds") ? source.effectRounds : base.effectRounds,
            1
        ) || 1,
        passives: parsePassivesArray(source.passives || base.passives),
        itemUseEventTriggers,
        source: String(base.source || source.source || "custom").trim() || "custom",
        createdAt: String(base.createdAt || now),
        updatedAt: now
    };
}

function normalizeGearRecord(payload, existing = null) {
    const source = payload && typeof payload === "object" ? payload : {};
    const base = existing || {};
    const now = new Date().toISOString();
    const rawPrice = Object.prototype.hasOwnProperty.call(source, "price")
        ? source.price
        : base.price;
    const normalizedSlotType = normalizeGearSlotType(source.slotType || base.slotType, "body");
    const requestedGearType = String(source.gearType || base.gearType || "").trim();
    const normalizedGearType = GEAR_TYPE_OPTIONS.includes(requestedGearType)
        ? requestedGearType
        : inferGearTypeFromSlotType(normalizedSlotType);

    return {
        id: sanitizeId(source.id || base.id || source.name || "gear"),
        name: String(source.name || base.name || "New Gear").trim(),
        gearType: normalizedGearType,
        slotType: normalizedSlotType,
        image: String(source.image || base.image || "").trim(),
        temp_icon: String(source.temp_icon || base.temp_icon || "").trim(),
        price: parsePriceValue(rawPrice, 100),
        implemented: parseImplementedFlag(source.implemented, base.implemented),
        storyDesc: String(source.storyDesc || base.storyDesc || "").trim(),
        functionDesc: String(source.functionDesc || base.functionDesc || "").trim(),
        stats: parseStatsObject(source.stats || base.stats),
        passives: parsePassivesArray(source.passives || base.passives),
        source: String(base.source || source.source || "custom").trim() || "custom",
        createdAt: String(base.createdAt || now),
        updatedAt: now
    };
}

function parseBalancedLiteral(content, startIndex) {
    const opening = content[startIndex];
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = startIndex; i < content.length; i += 1) {
        const ch = content[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === "\\") {
            escaped = true;
            continue;
        }
        if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
        else if (!inSingle && !inTemplate && ch === "\"") inDouble = !inDouble;
        else if (!inSingle && !inDouble && ch === "`") inTemplate = !inTemplate;
        if (inSingle || inDouble || inTemplate) continue;

        if (ch === opening) depth += 1;
        else if (ch === closing) {
            depth -= 1;
            if (depth === 0) return content.slice(startIndex, i + 1);
        }
    }

    throw new Error("Unable to parse literal boundaries.");
}

function parseExportLiteral(content, exportName) {
    const marker = `export const ${exportName}`;
    const markerIndex = content.indexOf(marker);
    if (markerIndex < 0) throw new Error(`Missing export '${exportName}'.`);
    const eqIndex = content.indexOf("=", markerIndex);
    if (eqIndex < 0) throw new Error(`Invalid export '${exportName}'.`);
    let start = eqIndex + 1;
    while (start < content.length && /\s/.test(content[start])) start += 1;
    if (content[start] !== "{" && content[start] !== "[") {
        throw new Error(`Export '${exportName}' is not a literal.`);
    }
    const literal = parseBalancedLiteral(content, start);
    return Function(`"use strict"; return (${literal});`)();
}

function toJsLiteral(value, indent = 12) {
    const spaces = " ".repeat(indent);
    const nextSpaces = " ".repeat(indent + 4);
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        return `[\n${value.map(item => `${nextSpaces}${toJsLiteral(item, indent + 4)}`).join(",\n")}\n${spaces}]`;
    }
    if (typeof value === "object") {
        const entries = Object.entries(value);
        if (entries.length === 0) return "{}";
        return `{\n${entries.map(([k, v]) => `${nextSpaces}${k}: ${toJsLiteral(v, indent + 4)}`).join(",\n")}\n${spaces}}`;
    }
    return JSON.stringify(String(value));
}

function extractSuperObjectLiteral(content) {
    const superIndex = content.indexOf("super(");
    if (superIndex < 0) throw new Error("Missing super(...) call.");
    const objectStart = content.indexOf("{", superIndex);
    if (objectStart < 0) throw new Error("Missing super config object.");
    const literal = parseBalancedLiteral(content, objectStart);
    return { literal, start: objectStart, end: objectStart + literal.length };
}

function evaluateObjectLiteral(literal) {
    return Function(`"use strict"; return (${literal});`)();
}

function parseImplementedFromClass(content) {
    const match = content.match(/this\.implemented\s*=\s*(true|false)\s*;/);
    if (!match) return false;
    return match[1] === "true";
}

async function readClassRecordFile(kind, filePath) {
    const content = await fsp.readFile(filePath, "utf8");
    const { literal } = extractSuperObjectLiteral(content);
    let config;
    try {
        config = evaluateObjectLiteral(literal);
    } catch (_) {
        return null;
    }
    const implemented = parseImplementedFromClass(content);
    if (kind === "gear") {
        const normalized = normalizeGearRecord({ ...config, implemented }, null);
        normalized.__filePath = filePath;
        return normalized;
    }
    const normalized = normalizeItemRecord({ ...config, itemType: "consumable", implemented }, null);
    normalized.__filePath = filePath;
    return normalized;
}

function buildConstructorObjectLiteral(kind, record) {
    if (kind === "gear") {
        const payload = {
            id: record.id,
            name: record.name,
            gearType: record.gearType,
            slotType: record.slotType,
            image: record.image,
            temp_icon: record.temp_icon,
            price: record.price,
            storyDesc: record.storyDesc,
            functionDesc: record.functionDesc,
            stats: record.stats || {},
            passives: record.passives || []
        };
        return toJsLiteral(payload, 8);
    }
    const payload = {
        id: record.id,
        consumableType: record.consumableType,
        image: record.image,
        temp_icon: record.temp_icon,
        name: record.name,
        price: record.price,
        healAmount: record.healAmount,
        healPercent: record.healPercent,
        effectMode: record.effectMode,
        effectTurns: record.effectTurns,
        effectRounds: record.effectRounds,
        stats: record.stats || {},
        passives: record.passives || [],
        itemUseEventTriggers: record.itemUseEventTriggers || [],
        storyDesc: record.storyDesc,
        functionDesc: record.functionDesc
    };
    return toJsLiteral(payload, 8);
}

async function writeClassRecordFile(kind, filePath, record) {
    const content = await fsp.readFile(filePath, "utf8");
    const { start, end } = extractSuperObjectLiteral(content);
    const literal = buildConstructorObjectLiteral(kind, record);
    let nextContent = `${content.slice(0, start)}${literal}${content.slice(end)}`;
    if (/this\.implemented\s*=/.test(nextContent)) {
        nextContent = nextContent.replace(/this\.implemented\s*=\s*(true|false)\s*;/, `this.implemented = ${Boolean(record.implemented)};`);
    } else {
        nextContent = nextContent.replace(/(\s*super\([\s\S]*?\);\s*)/, `$1\n        this.implemented = ${Boolean(record.implemented)};\n`);
    }
    await fsp.writeFile(filePath, nextContent, "utf8");
}

function buildClassFileTemplate(kind, record) {
    const className = toPascalCase(record.id);
    const ctorLiteral = buildConstructorObjectLiteral(kind, record);
    if (kind === "gear") {
        return `import { Gear } from "../gear.js";

export class ${className} extends Gear {
    constructor() {
        super(${ctorLiteral});
        this.implemented = ${Boolean(record.implemented)};
    }
}

export const ${record.id.toUpperCase()} = new ${className}();

export function create${className}() {
    return new ${className}();
}
`;
    }
    return `import { ConsumableItem } from "../consumable_item.js";

export class ${className} extends ConsumableItem {
    constructor() {
        super(${ctorLiteral});
        this.implemented = ${Boolean(record.implemented)};
    }
}

export const ${record.id.toUpperCase()} = new ${className}();

export function create${className}() {
    return new ${className}();
}
`;
}

async function createClassRecordFile(kind, record) {
    const dir = kind === "gear"
        ? path.join(GEAR_CLASS_ROOT, record.id)
        : path.join(ITEM_CLASS_ROOT, record.id);
    await fsp.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${record.id}.js`);
    const template = buildClassFileTemplate(kind, record);
    await fsp.writeFile(filePath, template, "utf8");
    return filePath;
}

async function refreshClassRegistry(kind) {
    if (kind === "item") {
        const records = await loadRecordsByKind("item");
        const imports = records
            .map(record => `import { ${toPascalCase(record.id)} } from "./${record.id}/${record.id}.js";`)
            .join("\n");
        const consts = records
            .map(record => `export const ${record.id.toUpperCase()} = new ${toPascalCase(record.id)}();`)
            .join("\n");
        const creators = records
            .map(record => `export function create${toPascalCase(record.id)}() { return new ${toPascalCase(record.id)}(); }`)
            .join("\n");
        const mapBody = records
            .map(record => `    ${record.id}: ${record.id.toUpperCase()}`)
            .join(",\n");
        const output = `${imports}

${consts}
${creators}

export const CONSUMABLES = {
${mapBody}
};
`;
        await fsp.writeFile(path.join(ITEM_CLASS_ROOT, "consumable.js"), output, "utf8");
        return;
    }

    const records = await loadRecordsByKind("gear");
    const imports = records
        .map(record => `import { ${toPascalCase(record.id)} } from "./${record.id}/${record.id}.js";`)
        .join("\n");
    const consts = records
        .map(record => `export const ${record.id.toUpperCase()} = new ${toPascalCase(record.id)}();`)
        .join("\n");
    const creators = records
        .map(record => `export function create${toPascalCase(record.id)}() { return new ${toPascalCase(record.id)}(); }`)
        .join("\n");
    const mapBody = records
        .map(record => `    ${record.id}: ${record.id.toUpperCase()}`)
        .join(",\n");
    const output = `${imports}

${consts}
${creators}

export const GEARS = {
${mapBody}
};
`;
    await fsp.writeFile(path.join(GEAR_CLASS_ROOT, "gears.js"), output, "utf8");
}

function parseAssignedLiteral(content, assignmentMarker) {
    const markerIndex = content.indexOf(assignmentMarker);
    if (markerIndex < 0) throw new Error(`Missing assignment '${assignmentMarker}'.`);
    const eqIndex = content.indexOf("=", markerIndex);
    if (eqIndex < 0) throw new Error(`Missing '=' for '${assignmentMarker}'.`);
    const startIndex = content.slice(eqIndex + 1).search(/[{\["'`]|true|false|null|-?\d/);
    if (startIndex < 0) throw new Error(`Missing literal for '${assignmentMarker}'.`);
    const literalStart = eqIndex + 1 + startIndex;
    const firstChar = content[literalStart];
    if (firstChar === "{" || firstChar === "[") {
        return parseBalancedLiteral(content, literalStart);
    }
    const semiIndex = content.indexOf(";", literalStart);
    if (semiIndex < 0) throw new Error(`Missing ';' for '${assignmentMarker}'.`);
    return content.slice(literalStart, semiIndex).trim();
}

function readWandererClassData() {
    const content = fs.readFileSync(WANDERER_DATA_FILE, "utf8");
    const evalLiteral = literal => Function(`"use strict"; return (${literal});`)();

    const name = evalLiteral(parseAssignedLiteral(content, "this.name"));
    const portrait = evalLiteral(parseAssignedLiteral(content, "this.portrait"));
    const skillCardPortrait = evalLiteral(parseAssignedLiteral(content, "this.skillCardPortrait"));
    const sprites = evalLiteral(parseAssignedLiteral(content, "this.sprites"));
    const description = evalLiteral(parseAssignedLiteral(content, "this.description"));
    const locked = evalLiteral(parseAssignedLiteral(content, "this.locked"));
    const gold = evalLiteral(parseAssignedLiteral(content, "this.gold"));
    let inventory = [];
    try {
        inventory = evalLiteral(parseAssignedLiteral(content, "this.inventory"));
    } catch (_) {
        inventory = [];
    }
    let passiveSkills = [];
    try {
        passiveSkills = evalLiteral(parseAssignedLiteral(content, "this.passiveSkills"));
    } catch (_) {
        passiveSkills = [];
    }
    const baseStats = evalLiteral(parseAssignedLiteral(content, "this.baseStats"));

    return {
        id: "wanderer",
        name,
        portrait,
        skillCardPortrait,
        sprites,
        description,
        locked: Boolean(locked),
        gold: toIntStat(gold, 0),
        inventory: Array.isArray(inventory) ? inventory.map(entry => sanitizeId(entry)).filter(Boolean) : [],
        passiveSkills: Array.isArray(passiveSkills) ? passiveSkills.map(entry => sanitizeId(entry)).filter(Boolean) : [],
        baseStats
    };
}

function replaceAssignment(content, assignmentMarker, nextLiteral) {
    const markerIndex = content.indexOf(assignmentMarker);
    if (markerIndex < 0) throw new Error(`Missing assignment '${assignmentMarker}'.`);
    const eqIndex = content.indexOf("=", markerIndex);
    if (eqIndex < 0) throw new Error(`Missing '=' for '${assignmentMarker}'.`);
    const semiIndex = content.indexOf(";", eqIndex);
    if (semiIndex < 0) throw new Error(`Missing ';' for '${assignmentMarker}'.`);
    return `${content.slice(0, eqIndex + 1)} ${nextLiteral}${content.slice(semiIndex)}`;
}

function toIntStat(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.trunc(parsed);
}

function normalizeWandererPatch(payload = {}, current = null) {
    const source = payload && typeof payload === "object" ? payload : {};
    const existing = current || readWandererClassData();
    const nextBase = { ...(existing.baseStats || {}) };

    if (source.baseStats && typeof source.baseStats === "object") {
        ["hp", "atk", "def", "crit", "dodge", "aim"].forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source.baseStats, key)) {
                nextBase[key] = toIntStat(source.baseStats[key], nextBase[key] || 0);
            }
        });
    }
    return {
        ...existing,
        name: Object.prototype.hasOwnProperty.call(source, "name") ? String(source.name || existing.name) : existing.name,
        description: Object.prototype.hasOwnProperty.call(source, "description") ? String(source.description || existing.description) : existing.description,
        locked: Object.prototype.hasOwnProperty.call(source, "locked") ? Boolean(source.locked) : Boolean(existing.locked),
        gold: Object.prototype.hasOwnProperty.call(source, "gold") ? toIntStat(source.gold, existing.gold || 0) : (existing.gold || 0),
        inventory: Object.prototype.hasOwnProperty.call(source, "inventory") && Array.isArray(source.inventory)
            ? source.inventory.map(entry => sanitizeId(entry)).filter(Boolean)
            : (Array.isArray(existing.inventory) ? existing.inventory.map(entry => sanitizeId(entry)).filter(Boolean) : []),
        passiveSkills: Object.prototype.hasOwnProperty.call(source, "passiveSkills") && Array.isArray(source.passiveSkills)
            ? source.passiveSkills.map(entry => sanitizeId(entry)).filter(Boolean)
            : (Array.isArray(existing.passiveSkills) ? existing.passiveSkills.map(entry => sanitizeId(entry)).filter(Boolean) : []),
        portrait: Object.prototype.hasOwnProperty.call(source, "portrait") ? String(source.portrait || existing.portrait) : existing.portrait,
        skillCardPortrait: Object.prototype.hasOwnProperty.call(source, "skillCardPortrait") ? String(source.skillCardPortrait || existing.skillCardPortrait) : existing.skillCardPortrait,
        sprites: {
            attack: source.sprites && Object.prototype.hasOwnProperty.call(source.sprites, "attack")
                ? String(source.sprites.attack || existing.sprites.attack)
                : existing.sprites.attack,
            block: source.sprites && Object.prototype.hasOwnProperty.call(source.sprites, "block")
                ? String(source.sprites.block || existing.sprites.block)
                : existing.sprites.block
        },
        baseStats: nextBase
    };
}

function writeWandererClassData(nextData) {
    const content = fs.readFileSync(WANDERER_DATA_FILE, "utf8");
    let updated = content;
    updated = replaceAssignment(updated, "this.name", JSON.stringify(String(nextData.name || "Wanderer")));
    updated = replaceAssignment(updated, "this.portrait", JSON.stringify(String(nextData.portrait || "")));
    updated = replaceAssignment(updated, "this.skillCardPortrait", JSON.stringify(String(nextData.skillCardPortrait || "")));
    updated = replaceAssignment(updated, "this.sprites", JSON.stringify(nextData.sprites || {}, null, 8));
    updated = replaceAssignment(updated, "this.description", JSON.stringify(String(nextData.description || "")));
    updated = replaceAssignment(updated, "this.locked", nextData.locked ? "true" : "false");
    updated = replaceAssignment(updated, "this.gold", `${toIntStat(nextData.gold, 0)}`);
    updated = replaceAssignment(updated, "this.inventory", JSON.stringify(Array.isArray(nextData.inventory) ? nextData.inventory : [], null, 8));
    updated = replaceAssignment(updated, "this.passiveSkills", JSON.stringify(Array.isArray(nextData.passiveSkills) ? nextData.passiveSkills : [], null, 8));
    updated = replaceAssignment(updated, "this.baseStats", JSON.stringify(nextData.baseStats || {}, null, 8));
    fs.writeFileSync(WANDERER_DATA_FILE, updated, "utf8");
}

function resolvePlayerImageUploadTarget(target) {
    const normalized = String(target || "").trim();
    const root = path.join(PLAYER_CLASS_ROOT, "wanderer", "wanderer_images");
    if (normalized === "portrait") {
        return { key: "portrait", dir: root, fileBase: "portrait" };
    }
    if (normalized === "skillCardPortrait") {
        return { key: "skillCardPortrait", dir: root, fileBase: "skill_card_portrait" };
    }
    if (normalized === "attack") {
        return { key: "attack", dir: root, fileBase: "attack" };
    }
    if (normalized === "block") {
        return { key: "block", dir: root, fileBase: "block" };
    }
    return null;
}

function parseExportNumber(content, exportName, fallback = 1) {
    const marker = `export const ${exportName}`;
    const markerIndex = content.indexOf(marker);
    if (markerIndex < 0) return fallback;
    const eqIndex = content.indexOf("=", markerIndex);
    if (eqIndex < 0) return fallback;
    const semiIndex = content.indexOf(";", eqIndex);
    const rawValue = content.slice(eqIndex + 1, semiIndex >= 0 ? semiIndex : undefined).trim();
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeLevelNumber(input, fallback = 1) {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function normalizeLevelRound(scene, fallbackBackground = "") {
    const source = scene && typeof scene === "object" ? scene : {};
    const rawType = String(source.type || "fight").trim().toLowerCase();
    const normalizedType = rawType === "cutscene" || rawType === "vendor" || rawType === "fight"
        ? rawType
        : (rawType === "event" ? "cutscene" : "fight");
    const enemyValue = source.enemy === null || typeof source.enemy === "undefined"
        ? null
        : String(source.enemy);
    const cutsceneVideoValue = source.cutsceneVideo === null || typeof source.cutsceneVideo === "undefined"
        ? null
        : String(source.cutsceneVideo).trim().replace(/\\/g, "/").replace(/^\/+/, "");
    const vendorItemsRaw = Array.isArray(source.vendorItems) ? source.vendorItems : [];
    const vendorItems = Array.from(new Set(
        vendorItemsRaw
            .map(entry => sanitizeId(entry))
            .filter(Boolean)
    ));
    const backgroundPath = String(source.background || fallbackBackground);
    const parsedBackgroundName = path.posix.parse(backgroundPath).name;
    const backgroundImageName = String(source.backgroundImageName || parsedBackgroundName || "").trim();
    const normalized = {
        enemy: enemyValue,
        cutsceneVideo: cutsceneVideoValue || null,
        vendorItems,
        background: backgroundPath,
        backgroundImageName,
        type: normalizedType
    };
    if (normalizedType === "vendor") {
        normalized.enemy = null;
        normalized.cutsceneVideo = null;
    } else if (normalizedType === "cutscene") {
        normalized.enemy = null;
        normalized.vendorItems = [];
    } else {
        normalized.vendorItems = [];
        normalized.cutsceneVideo = null;
    }
    return normalized;
}

async function listCutsceneVideos() {
    const allowedExtensions = new Set([".webm", ".mp4", ".mov", ".m4v", ".ogv"]);
    const existingRoots = CUTSCENE_VIDEO_ROOTS.filter(root => fs.existsSync(root));
    if (existingRoots.length <= 0) return [];

    const outputByPath = new Map();
    const walk = async dirPath => {
        let entries = [];
        try {
            entries = await fsp.readdir(dirPath, { withFileTypes: true });
        } catch (_) {
            return;
        }
        for (const entry of entries) {
            const absPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await walk(absPath);
                continue;
            }
            const ext = String(path.extname(entry.name || "")).toLowerCase();
            if (!allowedExtensions.has(ext)) continue;
            const relPath = path.relative(PROJECT_ROOT, absPath).replace(/\\/g, "/");
            if (!outputByPath.has(relPath)) {
                outputByPath.set(relPath, {
                    id: relPath,
                    name: path.posix.basename(relPath),
                    path: relPath
                });
            }
        }
    };
    for (const root of existingRoots) {
        await walk(root);
    }
    return Array.from(outputByPath.values())
        .sort((a, b) => String(a.path || "").localeCompare(String(b.path || "")));
}

function normalizeLevelRecord(level) {
    const source = level && typeof level === "object" ? level : {};
    const id = toSafeLevelNumber(source.id, 1);
    const name = String(source.name || `Level ${id}`);
    const fileExistsInProject = relativePath => {
        const rel = String(relativePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
        if (!rel) return false;
        const abs = path.normalize(path.join(PROJECT_ROOT, rel));
        if (!abs.startsWith(PROJECT_ROOT)) return false;
        if (!fs.existsSync(abs)) return false;
        try {
            return fs.statSync(abs).isFile();
        } catch (_) {
            return false;
        }
    };
    const backgroundImagesRaw = Array.isArray(source.backgroundImages) ? source.backgroundImages : [];
    const backgroundImages = backgroundImagesRaw
        .map(entry => String(entry))
        .filter(Boolean)
        .filter(fileExistsInProject);
    const fallbackBackground = backgroundImages[0] || "";
    const scenesRaw = Array.isArray(source.scenes)
        ? source.scenes
        : (Array.isArray(source.rounds) ? source.rounds : []);
    const scenes = scenesRaw.length > 0
        ? scenesRaw.map(scene => normalizeLevelRound(scene, fallbackBackground))
        : [normalizeLevelRound({}, fallbackBackground)];
    return {
        id,
        name,
        backgroundImages,
        scenes
    };
}

function sanitizeFilename(input) {
    const raw = String(input || "").trim();
    if (!raw) return "upload.png";
    const normalized = path.basename(raw).replace(/[^\w.\- ]+/g, "_").trim();
    if (!normalized) return "upload.png";
    if (!path.extname(normalized)) return `${normalized}.png`;
    return normalized;
}

function sanitizeImageBaseName(input, fallback) {
    const raw = String(input || "").trim();
    const safeRaw = sanitizeFilename(raw);
    const parsed = path.posix.parse(safeRaw);
    const base = String(parsed.name || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (base) return base;
    return String(fallback || "background").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function ensureUniqueFileName({ dirPath, preferredBaseName, extension }) {
    const safeExt = String(extension || ".png");
    let candidateBase = String(preferredBaseName || "background");
    let index = 0;
    while (true) {
        const candidateName = `${candidateBase}${safeExt}`;
        const candidatePath = path.join(dirPath, candidateName);
        if (!fs.existsSync(candidatePath)) {
            return candidateName;
        }
        index += 1;
        candidateBase = `${preferredBaseName}_${index}`;
    }
}

function normalizeProjectRelativeFilePath(input) {
    return String(input || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveProjectFilePath(relativePath) {
    const normalizedRelative = normalizeProjectRelativeFilePath(relativePath);
    if (!normalizedRelative) return null;
    const absolutePath = path.normalize(path.join(PROJECT_ROOT, normalizedRelative));
    if (!absolutePath.startsWith(PROJECT_ROOT)) return null;
    return absolutePath;
}

function fileExistsInProject(relativePath) {
    const absolutePath = resolveProjectFilePath(relativePath);
    if (!absolutePath) return false;
    if (!fs.existsSync(absolutePath)) return false;
    try {
        return fs.statSync(absolutePath).isFile();
    } catch (_) {
        return false;
    }
}

function getLevelBackgroundUsage(levels, backgroundPath) {
    const normalizedPath = normalizeProjectRelativeFilePath(backgroundPath);
    const usage = [];
    (Array.isArray(levels) ? levels : []).forEach(level => {
        const scenes = Array.isArray(level.scenes) ? level.scenes : [];
        scenes.forEach((scene, sceneIndex) => {
            if (normalizeProjectRelativeFilePath(scene && scene.background) === normalizedPath) {
                usage.push({
                    levelId: toSafeLevelNumber(level && level.id, 1),
                    scene: sceneIndex + 1
                });
            }
        });
    });
    return usage;
}

function listLevelBackgrounds(levels) {
    const byPath = new Map();
    const ensureEntry = (levelId, backgroundPath) => {
        const normalizedPath = normalizeProjectRelativeFilePath(backgroundPath);
        if (!normalizedPath) return null;
        if (!fileExistsInProject(normalizedPath)) return null;
        const absolutePath = resolveProjectFilePath(normalizedPath);
        if (!absolutePath) return null;
        let fileStat = null;
        try {
            fileStat = fs.statSync(absolutePath);
        } catch (_) {
            return null;
        }
        if (!byPath.has(normalizedPath)) {
            byPath.set(normalizedPath, {
                background: normalizedPath,
                fileName: path.posix.basename(normalizedPath),
                backgroundImageName: path.posix.parse(normalizedPath).name,
                sizeBytes: Number(fileStat && fileStat.size) || 0,
                updatedAtMs: Number(fileStat && fileStat.mtimeMs) || 0,
                levels: new Set(),
                usedBy: []
            });
        }
        const entry = byPath.get(normalizedPath);
        entry.levels.add(levelId);
        return entry;
    };

    (Array.isArray(levels) ? levels : []).forEach(level => {
        const levelId = toSafeLevelNumber(level && level.id, 1);
        const backgroundImages = Array.isArray(level.backgroundImages) ? level.backgroundImages : [];
        backgroundImages.forEach(backgroundPath => {
            ensureEntry(levelId, backgroundPath);
        });
        const scenes = Array.isArray(level.scenes) ? level.scenes : [];
        scenes.forEach((scene, sceneIndex) => {
            const entry = ensureEntry(levelId, scene && scene.background);
            if (!entry) return;
            entry.usedBy.push({
                levelId,
                scene: sceneIndex + 1
            });
            if (scene && String(scene.backgroundImageName || "").trim()) {
                entry.backgroundImageName = String(scene.backgroundImageName).trim();
            }
        });
    });

    return Array.from(byPath.values()).map(entry => ({
        background: entry.background,
        fileName: entry.fileName,
        backgroundImageName: entry.backgroundImageName,
        sizeBytes: entry.sizeBytes,
        updatedAtMs: entry.updatedAtMs,
        updatedAt: entry.updatedAtMs > 0 ? new Date(entry.updatedAtMs).toISOString() : null,
        levels: Array.from(entry.levels).sort((a, b) => a - b),
        usedBy: entry.usedBy
    }));
}

function replaceBackgroundPathInLevels(levels, oldBackgroundPath, newBackgroundPath, nextBackgroundImageName) {
    const normalizedOldPath = normalizeProjectRelativeFilePath(oldBackgroundPath);
    const normalizedNewPath = normalizeProjectRelativeFilePath(newBackgroundPath);
    const nextName = String(nextBackgroundImageName || "").trim();
    (Array.isArray(levels) ? levels : []).forEach(level => {
        if (!Array.isArray(level.backgroundImages)) level.backgroundImages = [];
        level.backgroundImages = level.backgroundImages.map(backgroundPath => (
            normalizeProjectRelativeFilePath(backgroundPath) === normalizedOldPath
                ? normalizedNewPath
                : normalizeProjectRelativeFilePath(backgroundPath)
        ));
        level.backgroundImages = Array.from(new Set(level.backgroundImages.filter(Boolean)));
        const scenes = Array.isArray(level.scenes) ? level.scenes : [];
        scenes.forEach(scene => {
            if (!scene || typeof scene !== "object") return;
            if (normalizeProjectRelativeFilePath(scene.background) === normalizedOldPath) {
                scene.background = normalizedNewPath;
                if (nextName) scene.backgroundImageName = nextName;
            }
        });
    });
}

function formatLevelModule(levels, defaultLevelId) {
    const renderedLevels = JSON.stringify(levels, null, 4);
    const safeDefault = toSafeLevelNumber(defaultLevelId, 1);
    return `export const LEVELS = ${renderedLevels};\n\nexport const DEFAULT_LEVEL_ID = ${safeDefault};\n\nexport function getLevelById(levelId) {\n    return LEVELS.find(level => level.id === levelId) ?? null;\n}\n`;
}

async function readLevelsData() {
    const content = await fsp.readFile(LEVEL_DATA_FILE, "utf8");
    const rawLevels = parseExportLiteral(content, "LEVELS");
    const rawDefaultLevelId = parseExportNumber(content, "DEFAULT_LEVEL_ID", 1);
    const levels = Array.isArray(rawLevels) ? rawLevels.map(normalizeLevelRecord) : [];
    return {
        levels,
        defaultLevelId: toSafeLevelNumber(rawDefaultLevelId, levels[0] ? levels[0].id : 1),
        filePath: LEVEL_DATA_FILE
    };
}

async function writeLevelsData(levels, defaultLevelId) {
    await fsp.writeFile(LEVEL_DATA_FILE, formatLevelModule(levels, defaultLevelId), "utf8");
}

async function readEnemyTypeData() {
    const fallback = {
        enemyTypeOptions: ["monster", "warrior", "mage", "archer", "rogue", "paladin", "spirit", "hunter"],
        enemySizeToPx: { s: 150, m: 220, l: 300, xl: 400, "2xl": 600 },
        enemySizeOptions: ["s", "m", "l", "xl", "2xl"]
    };

    try {
        const content = await fsp.readFile(ENEMY_TYPE_DATA_FILE, "utf8");
        const enemyTypeOptions = parseExportLiteral(content, "ENEMY_TYPE_OPTIONS");
        const enemySizeToPx = parseExportLiteral(content, "ENEMY_SIZE_TO_PX");
        const rawEnemySizeOptions = parseExportLiteral(content, "ENEMY_SIZE_OPTIONS");
        const enemySizeOptions = Array.isArray(rawEnemySizeOptions)
            ? rawEnemySizeOptions
            : Object.keys(enemySizeToPx);
        return {
            enemyTypeOptions: Array.isArray(enemyTypeOptions) ? enemyTypeOptions : fallback.enemyTypeOptions,
            enemySizeToPx: enemySizeToPx && typeof enemySizeToPx === "object" ? enemySizeToPx : fallback.enemySizeToPx,
            enemySizeOptions: Array.isArray(enemySizeOptions) ? enemySizeOptions : fallback.enemySizeOptions
        };
    } catch (error) {
        return fallback;
    }
}

function parseObjectLiteralFromModule(content) {
    const eqIndex = content.indexOf("=");
    if (eqIndex < 0) throw new Error("Unable to find exported object assignment.");

    const start = content.indexOf("{", eqIndex);
    if (start < 0) throw new Error("Unable to find object literal start.");

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = start; i < content.length; i += 1) {
        const ch = content[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === "\\") {
            escaped = true;
            continue;
        }

        if (!inDouble && !inTemplate && ch === "'" && !escaped) inSingle = !inSingle;
        else if (!inSingle && !inTemplate && ch === "\"" && !escaped) inDouble = !inDouble;
        else if (!inSingle && !inDouble && ch === "`" && !escaped) inTemplate = !inTemplate;

        if (inSingle || inDouble || inTemplate) continue;

        if (ch === "{") depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                return content.slice(start, i + 1);
            }
        }
    }

    throw new Error("Unable to parse object literal boundaries.");
}

function parseEnemyModule(content) {
    const constMatch = content.match(/export\s+const\s+([A-Z0-9_]+)\s*=/);
    if (!constMatch) throw new Error("Unable to parse export constant name.");
    const constName = constMatch[1];
    const literal = parseObjectLiteralFromModule(content);
    const data = Function(`"use strict"; return (${literal});`)();
    return { constName, data };
}

function normalizeEnemyPayload(enemyId, payload, existing = null, metadata = null) {
    const base = existing ? { ...existing } : getDefaultEnemyRecord(enemyId);
    const merged = { ...base, ...(payload || {}) };
    const normalized = {};

    FIELD_ORDER.forEach(key => {
        if (!(key in merged)) return;
        if (["hp", "atk", "def", "crit", "dodge", "aim", "essence"].includes(key)) {
            const parsed = Number(merged[key]);
            normalized[key] = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
            return;
        }
        if (key === "canAttack") {
            normalized[key] = Boolean(merged[key]);
            return;
        }
        normalized[key] = String(merged[key] ?? "");
    });

    if (metadata && Array.isArray(metadata.enemyTypeOptions) && metadata.enemyTypeOptions.length > 0) {
        if (!metadata.enemyTypeOptions.includes(normalized.type)) {
            normalized.type = metadata.enemyTypeOptions[0];
        }
    }
    if (metadata && Array.isArray(metadata.enemySizeOptions) && metadata.enemySizeOptions.length > 0) {
        if (!metadata.enemySizeOptions.includes(normalized.size)) {
            normalized.size = metadata.enemySizeOptions.includes("m") ? "m" : metadata.enemySizeOptions[0];
        }
    }

    return normalized;
}

function formatEnemyModule(constName, data) {
    const lines = [
        `export const ${constName} = {`
    ];
    FIELD_ORDER.forEach(key => {
        if (!(key in data)) return;
        const value = data[key];
        const rendered = typeof value === "number" ? `${value}` : JSON.stringify(value);
        lines.push(`    ${key}: ${rendered},`);
    });
    lines.push("};", "");
    return `${lines.join("\n")}`;
}

async function readEnemyById(enemyId) {
    const filePath = getEnemyFilePath(enemyId);
    const content = await fsp.readFile(filePath, "utf8");
    const parsed = parseEnemyModule(content);
    return {
        id: enemyId,
        constName: parsed.constName,
        filePath,
        data: parsed.data
    };
}

async function listEnemies() {
    const entries = await fsp.readdir(ENEMY_ROOT, { withFileTypes: true });
    const ids = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => fs.existsSync(getEnemyFilePath(name)));

    const enemies = [];
    for (const id of ids) {
        try {
            enemies.push(await readEnemyById(id));
        } catch (error) {
            enemies.push({
                id,
                constName: makeConstName(id),
                filePath: getEnemyFilePath(id),
                parseError: error.message,
                data: {}
            });
        }
    }
    enemies.sort((a, b) => a.id.localeCompare(b.id));
    return enemies;
}

async function updateIndexFile() {
    const enemies = await listEnemies();
    const importLines = enemies.map(enemy => `import { ${enemy.constName} } from "./${enemy.id}/${enemy.id}_data.js";`);
    const exportLines = enemies.map(enemy => `    ${enemy.constName}`);

    const nextContent = [
        ...importLines,
        "",
        "export const ENEMY_TYPES = [",
        `${exportLines.join(",\n")}`,
        "];",
        ""
    ].join("\n");

    await fsp.writeFile(INDEX_FILE, nextContent, "utf8");
}

async function readRequestBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error("Invalid JSON body.");
    }
}

function normalizeEventRegistryEntry(input, existing = null) {
    const source = input && typeof input === "object" ? input : {};
    const base = existing && typeof existing === "object" ? existing : {};
    const eventName = String(source.eventName || base.eventName || "").trim();
    const fallbackId = eventName.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().replace(/^_+|_+$/g, "");
    const id = sanitizeId(source.id || base.id || fallbackId || source.name || "event");
    const name = String(source.name || base.name || id.toUpperCase()).trim();
    const scopeRaw = String(source.scope || base.scope || "custom").trim().toLowerCase();
    const scope = scopeRaw || "custom";
    const description = String(source.description || base.description || "").trim();
    const core = Boolean(base.core);
    return { id, name, eventName, scope, description, core };
}

async function ensureEventRegistryFile() {
    const dirPath = path.dirname(EVENT_REGISTRY_FILE);
    await fsp.mkdir(dirPath, { recursive: true });
    if (!fs.existsSync(EVENT_REGISTRY_FILE)) {
        await fsp.writeFile(EVENT_REGISTRY_FILE, `${JSON.stringify(DEFAULT_EVENT_REGISTRY, null, 2)}\n`, "utf8");
    }
}

async function readEventRegistry() {
    await ensureEventRegistryFile();
    const raw = await fsp.readFile(EVENT_REGISTRY_FILE, "utf8");
    let parsed = {};
    try {
        parsed = JSON.parse(raw);
    } catch (_) {
        parsed = {};
    }
    const events = Array.isArray(parsed.events) ? parsed.events : [];
    const normalized = [];
    const seenIds = new Set();
    for (const entry of events) {
        const next = normalizeEventRegistryEntry(entry);
        if (!next.id || !next.eventName) continue;
        if (seenIds.has(next.id)) continue;
        seenIds.add(next.id);
        next.core = Boolean(entry && entry.core);
        normalized.push(next);
    }
    if (normalized.length === 0) {
        return DEFAULT_EVENT_REGISTRY.events.map(entry => ({ ...entry }));
    }
    const seenEventNames = new Set(normalized.map(entry => String(entry.eventName || "").trim()));
    DEFAULT_EVENT_REGISTRY.events.forEach(coreEntry => {
        const coreEventName = String(coreEntry.eventName || "").trim();
        if (!coreEventName || seenEventNames.has(coreEventName)) return;
        normalized.push({ ...coreEntry });
        seenEventNames.add(coreEventName);
    });
    return normalized;
}

async function writeEventRegistry(events) {
    const payload = {
        events: events.map(entry => ({
            id: String(entry.id || "").trim(),
            name: String(entry.name || "").trim(),
            eventName: String(entry.eventName || "").trim(),
            scope: String(entry.scope || "custom").trim(),
            description: String(entry.description || "").trim(),
            core: Boolean(entry.core)
        }))
    };
    await ensureEventRegistryFile();
    await fsp.writeFile(EVENT_REGISTRY_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function toSkillConstName(skillId, skillType) {
    const safe = sanitizeId(skillId || "skill").toUpperCase();
    const prefix = skillType === "active"
        ? "A"
        : (skillType === "buff" ? "B" : (skillType === "debuff" ? "D" : "P"));
    return `${prefix}_${safe}`;
}

function toSkillClassName(skillId, skillType) {
    const safe = sanitizeId(skillId || "skill");
    const prefix = skillType === "active"
        ? "a_"
        : (skillType === "buff" ? "b_" : (skillType === "debuff" ? "d_" : "p_"));
    return `${prefix}${safe}`;
}

function getSkillFilePath(skillType, skillId) {
    const safeId = sanitizeId(skillId);
    if (!safeId) return "";
    const root = skillType === "active" ? ACTIVE_SKILL_ROOT : PASSIVE_SKILL_ROOT;
    const filePrefix = skillType === "active"
        ? "a"
        : (skillType === "buff" ? "b" : (skillType === "debuff" ? "d" : "p"));
    return path.join(root, `${filePrefix}_${safeId}.js`);
}

function getUniqueSkillId(baseId, skillType, existingSkills = []) {
    const sanitizedBase = sanitizeId(baseId) || "skill";
    const used = new Set(
        (Array.isArray(existingSkills) ? existingSkills : [])
            .filter(entry => entry && entry.skillType === skillType)
            .map(entry => sanitizeId(entry.id))
            .filter(Boolean)
    );
    let candidate = sanitizedBase;
    let index = 1;
    while (used.has(candidate)) {
        index += 1;
        candidate = `${sanitizedBase}_${index}`;
    }
    return candidate;
}

async function ensureSkillStores() {
    await fsp.mkdir(PASSIVE_SKILL_ROOT, { recursive: true });
    await fsp.mkdir(ACTIVE_SKILL_ROOT, { recursive: true });
    const passiveSkillRecordFile = path.join(PASSIVE_SKILL_ROOT, "passiveSkillRecord.js");
    const buffSkillRecordFile = path.join(PASSIVE_SKILL_ROOT, "buffSkillRecord.js");
    const debuffSkillRecordFile = path.join(PASSIVE_SKILL_ROOT, "debuffSkillRecord.js");
    if (fs.existsSync(passiveSkillRecordFile)) {
        if (!fs.existsSync(buffSkillRecordFile)) {
            const buffContent = [
                "import { PassiveSkillRecord } from \"./passiveSkillRecord.js\";",
                "",
                "export class BuffSkillRecord extends PassiveSkillRecord {",
                "    constructor(config = {}) {",
                "        super(config);",
                "        this.skillType = \"buff\";",
                "    }",
                "}",
                ""
            ].join("\n");
            await fsp.writeFile(buffSkillRecordFile, buffContent, "utf8");
        }
        if (!fs.existsSync(debuffSkillRecordFile)) {
            const debuffContent = [
                "import { PassiveSkillRecord } from \"./passiveSkillRecord.js\";",
                "",
                "export class DebuffSkillRecord extends PassiveSkillRecord {",
                "    constructor(config = {}) {",
                "        super(config);",
                "        this.skillType = \"debuff\";",
                "    }",
                "}",
                ""
            ].join("\n");
            await fsp.writeFile(debuffSkillRecordFile, debuffContent, "utf8");
        }
    }
    const activeSkillRecordFile = path.join(ACTIVE_SKILL_ROOT, "activeSkillRecord.js");
    if (!fs.existsSync(activeSkillRecordFile)) {
        const content = [
            "import { Skill } from \"../skill.js\";",
            "",
            "export class ActiveSkillRecord extends Skill {",
            "    constructor(config = {}) {",
            "        super(config);",
            "        Object.assign(this, config);",
            "        this.skillType = \"active\";",
            "    }",
            "}",
            ""
        ].join("\n");
        await fsp.writeFile(activeSkillRecordFile, content, "utf8");
    }
}

function parseLiteralObjectFromCode(content) {
    const match = String(content || "").match(/super\(\s*({[\s\S]*?})\s*\)\s*;/);
    if (!match || !match[1]) return null;
    try {
        return Function(`"use strict"; return (${match[1]});`)();
    } catch (_) {
        return null;
    }
}

function normalizeSkillRecord(input, typeHint = "passive", existing = null) {
    const source = input && typeof input === "object" ? input : {};
    const base = existing && typeof existing === "object" ? existing : {};
    const skillType = SKILL_TYPE_OPTIONS.includes(String(source.skillType || base.skillType || typeHint).trim().toLowerCase())
        ? String(source.skillType || base.skillType || typeHint).trim().toLowerCase()
        : typeHint;
    const id = sanitizeId(source.id || base.id || source.name || "skill");
    const sourceTrigger = source.trigger && typeof source.trigger === "object" ? source.trigger : {};
    const baseTrigger = base.trigger && typeof base.trigger === "object" ? base.trigger : {};
    const eventName = String(source.triggerEvent || sourceTrigger.event || baseTrigger.event || "").trim();
    const trigger = {
        ...baseTrigger,
        ...sourceTrigger
    };
    if (eventName) trigger.event = eventName;
    else if (Object.prototype.hasOwnProperty.call(trigger, "event")) delete trigger.event;
    const effectTypes = Array.isArray(source.effectTypes)
        ? source.effectTypes
        : String(source.effectTypes || "").split(",").map(entry => entry.trim()).filter(Boolean);
    const levelData = Array.isArray(source.levelData) ? source.levelData : (Array.isArray(base.levelData) ? base.levelData : []);
    const effects = Array.isArray(source.effects)
        ? source.effects
            .filter(entry => entry && typeof entry === "object")
            .map(entry => {
                const next = { ...entry };
                if (Object.prototype.hasOwnProperty.call(next, "once")) delete next.once;
                return next;
            })
        : (Array.isArray(base.effects)
            ? base.effects
                .filter(entry => entry && typeof entry === "object")
                .map(entry => {
                    const next = { ...entry };
                    if (Object.prototype.hasOwnProperty.call(next, "once")) delete next.once;
                    return next;
                })
            : []);
    const scaling = Array.isArray(source.scaling)
        ? source.scaling.filter(entry => entry && typeof entry === "object").map(entry => ({ ...entry }))
        : (Array.isArray(base.scaling) ? base.scaling.filter(entry => entry && typeof entry === "object").map(entry => ({ ...entry })) : []);
    const maxRank = Math.max(1, Number.parseInt(source.maxRank ?? base.maxRank ?? ((base.meta && base.meta.maxRank) || 1), 10) || 1);
    const normalizedRecord = {
        id,
        name: String(source.name || base.name || id).trim(),
        desc: String(source.desc || base.desc || "").trim(),
        kind: String(source.kind || base.kind || "skill").trim(),
        skillType,
        effectTypes: effectTypes.length > 0 ? effectTypes : ["generic"],
        durationTurns: Number.parseInt(source.durationTurns ?? base.durationTurns ?? 0, 10) || 0,
        target: String(source.target || base.target || "enemy").trim(),
        section: Number.parseInt(source.section ?? base.section ?? 1, 10) || 1,
        maxRank,
        implemented: Boolean(source.implemented ?? base.implemented ?? false),
        levelData,
        image: String(source.image || base.image || "").trim(),
        trigger,
        effects,
        scaling,
        modifiers: source.modifiers && typeof source.modifiers === "object"
            ? source.modifiers
            : (base.modifiers && typeof base.modifiers === "object" ? base.modifiers : {}),
        meta: { ...(base.meta && typeof base.meta === "object" ? base.meta : {}), maxRank }
    };
    return withLegacySkillEffects(normalizedRecord);
}

function withLegacySkillEffects(record) {
    if (!record || typeof record !== "object") return record;
    if (Array.isArray(record.effects) && record.effects.length > 0) return record;
    const next = { ...record };
    if (next.id === "hidden_snare") {
        next.effects = [{
            type: "counter_threshold_flag",
            onEvent: "ENEMY_HIT",
            sourceEquals: "basic_attack",
            counterKey: "attackHitsForTrap",
            step: 1,
            thresholdFromModifier: "requiredHits",
            threshold: Number(next.trigger && next.trigger.requiredHits) || 5,
            resetTo: 0,
            readyFlagKey: "trapReady",
            readyFlagValue: true,
            floatText: "Trap ready",
            floatTextTarget: "player",
            floatTextKind: "info"
        }];
        return next;
    }
    if (next.id === "evasive_instinct" || next.id === "ghost_walker") {
        next.effects = [{
            type: "set_turns_on_event",
            onEvent: "PLAYER_DODGE",
            stateKey: "skillTreeDodgeBuffTurns",
            turnsFromModifier: "dodgeBuffTurns",
            turns: 2
        }];
        return next;
    }
    if (next.id === "opportunistic_trap") {
        next.effects = [{
            type: "arm_flag_if_flag",
            onEvent: "PLAYER_DODGE",
            requiredFlagKey: "trapReady",
            minRank: 2,
            flagKey: "trapCritArmed",
            flagValue: true
        }];
        return next;
    }
    return next;
}

function validateSkillRecordOrThrow(record) {
    if (!record || typeof record !== "object") throw new Error("Invalid skill payload.");
    if (!SKILL_TYPE_OPTIONS.includes(String(record.skillType || "").trim().toLowerCase())) {
        throw new Error("Invalid skillType.");
    }
    if (!String(record.name || "").trim()) throw new Error("Skill name is required.");
    if (!String(record.id || "").trim()) throw new Error("Skill id is required.");

    const isPassiveLike = record.skillType === "passive" || record.skillType === "buff" || record.skillType === "debuff";
    if (!isPassiveLike) return;

    const trigger = record.trigger && typeof record.trigger === "object" ? record.trigger : {};
    const autoApplied = Boolean(trigger.autoApplied);
    const triggerEvent = String(trigger.event || "").trim();
    if (!autoApplied && !triggerEvent) {
        throw new Error("Passive skills require a trigger event when auto applied is off.");
    }

    const effects = Array.isArray(record.effects) ? record.effects : [];
    if (effects.length <= 0) return;
    for (const effect of effects) {
        const type = String(effect && effect.type || "").trim().toLowerCase();
        if (!type) throw new Error("Passive effect type is required.");
        if (!SUPPORTED_PASSIVE_EFFECT_TYPES.has(type)) {
            throw new Error(`Unsupported passive effect type '${type}'.`);
        }
        const valueType = String(effect && effect.valueType || "int").trim().toLowerCase();
        if (valueType !== "int" && valueType !== "%") {
            throw new Error("Effect value type must be 'int' or '%'.");
        }
        const chance = Number(effect && effect.chance);
        if (Number.isFinite(chance) && (chance < 0 || chance > 100)) {
            throw new Error("Effect chance must be between 0 and 100.");
        }
    }
}

async function readSkillRecordFile(filePath, skillType) {
    const content = await fsp.readFile(filePath, "utf8");
    const parsed = parseLiteralObjectFromCode(content);
    if (!parsed || typeof parsed !== "object") return null;
    const normalized = normalizeSkillRecord(parsed, skillType, parsed);
    if (!normalized.id) return null;
    normalized.__filePath = filePath;
    return normalized;
}

function inferPassiveLikeSkillTypeFromFileName(fileName) {
    const raw = String(fileName || "").trim().toLowerCase();
    if (raw.startsWith("b_")) return "buff";
    if (raw.startsWith("d_")) return "debuff";
    return "passive";
}

async function loadSkillsByType(skillType) {
    await ensureSkillStores();
    const root = skillType === "active" ? ACTIVE_SKILL_ROOT : PASSIVE_SKILL_ROOT;
    const entries = await fsp.readdir(root, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (path.extname(entry.name).toLowerCase() !== ".js") continue;
        if (entry.name === "index.js") continue;
        if (entry.name === "passiveSkillRecord.js" || entry.name === "buffSkillRecord.js" || entry.name === "debuffSkillRecord.js" || entry.name === "activeSkillRecord.js") continue;
        const typeHint = root === ACTIVE_SKILL_ROOT
            ? "active"
            : inferPassiveLikeSkillTypeFromFileName(entry.name);
        const record = await readSkillRecordFile(path.join(root, entry.name), typeHint);
        if (record) records.push(record);
    }
    if (skillType === "active") {
        return records.filter(entry => entry && entry.skillType === "active");
    }
    if (skillType === "buff") {
        return records.filter(entry => entry && entry.skillType === "buff");
    }
    if (skillType === "debuff") {
        return records.filter(entry => entry && entry.skillType === "debuff");
    }
    if (skillType === "passive") {
        return records.filter(entry => entry && (entry.skillType === "passive" || entry.skillType === "buff" || entry.skillType === "debuff"));
    }
    return records;
}

async function loadAllSkills() {
    const [passiveLike, active] = await Promise.all([
        loadSkillsByType("passive"),
        loadSkillsByType("active")
    ]);
    return [...passiveLike, ...active];
}

async function listSkillIconPaths() {
    if (!fs.existsSync(SKILL_ICON_ROOT)) return [];
    const entries = await fsp.readdir(SKILL_ICON_ROOT, { withFileTypes: true });
    const icons = entries
        .filter(entry => entry.isFile())
        .filter(entry => ALLOWED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => `/${path.posix.join("api", "skill-icons", encodeURIComponent(entry.name))}`);
    icons.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return icons;
}

function formatSkillFileContent(record) {
    const skillType = record.skillType === "active"
        ? "active"
        : (record.skillType === "buff" ? "buff" : (record.skillType === "debuff" ? "debuff" : "passive"));
    const className = toSkillClassName(record.id, skillType);
    const constName = toSkillConstName(record.id, skillType);
    const baseImport = "Skill";
    const importPath = "../skill.js";
    const payload = {
        id: record.id,
        name: record.name,
        desc: record.desc,
        skillType,
        kind: record.kind,
        effectTypes: Array.isArray(record.effectTypes) ? record.effectTypes : ["generic"],
        durationTurns: Number(record.durationTurns) || 0,
        target: record.target,
        section: Number(record.section) || 0,
        maxRank: Number(record.maxRank) || 1,
        implemented: Boolean(record.implemented),
        levelData: Array.isArray(record.levelData) ? record.levelData : [],
        image: record.image || "",
        trigger: record.trigger && Object.keys(record.trigger).length > 0 ? record.trigger : undefined,
        effects: Array.isArray(record.effects) && record.effects.length > 0 ? record.effects : undefined,
        scaling: Array.isArray(record.scaling) && record.scaling.length > 0 ? record.scaling : undefined,
        modifiers: record.modifiers && Object.keys(record.modifiers).length > 0 ? record.modifiers : undefined,
        meta: { ...(record.meta || {}), maxRank: Number(record.maxRank) || 1 }
    };
    const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value !== "undefined"));
    return [
        `import { ${baseImport} } from "${importPath}";`,
        "",
        `export class ${className} extends ${baseImport} {`,
        "    constructor() {",
        `        super(${JSON.stringify(clean, null, 12).split("\n").join("\n        ")});`,
        "    }",
        "}",
        "",
        `export const ${constName} = new ${className}();`,
        ""
    ].join("\n");
}

async function writeSkillRecord(record) {
    const filePath = getSkillFilePath(record.skillType, record.id);
    if (!filePath) throw new Error("Invalid skill id.");
    await ensureSkillStores();
    await fsp.writeFile(filePath, formatSkillFileContent(record), "utf8");
    return filePath;
}

async function refreshSkillIndex(skillType) {
    const isPassiveLikeType = skillType === "passive" || skillType === "buff" || skillType === "debuff";
    const records = await loadSkillsByType(isPassiveLikeType ? "passive" : skillType);
    records.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const lines = [];
    if (isPassiveLikeType) {
        records.forEach(skill => {
            const id = sanitizeId(skill.id);
            const skillTypeForFile = skill && skill.skillType ? String(skill.skillType) : "passive";
            const filePrefix = skillTypeForFile === "buff" ? "b" : (skillTypeForFile === "debuff" ? "d" : "p");
            const fileBase = `${filePrefix}_${id}`;
            const constName = toSkillConstName(id, skillTypeForFile);
            const className = toSkillClassName(id, skillTypeForFile);
            const aliasName = `${id.toUpperCase()}_SKILL`;
            lines.push(`export { ${constName}, ${className} } from "./${fileBase}.js";`);
            lines.push(`export { ${constName} as ${aliasName} } from "./${fileBase}.js";`);
        });
    } else {
        records.forEach(skill => {
            const id = sanitizeId(skill.id);
            const fileBase = `a_${id}`;
            const constName = toSkillConstName(id, "active");
            const className = toSkillClassName(id, "active");
            lines.push(`export { ${constName}, ${className} } from "./${fileBase}.js";`);
        });
    }
    const root = skillType === "active" ? ACTIVE_SKILL_ROOT : PASSIVE_SKILL_ROOT;
    await fsp.writeFile(path.join(root, "index.js"), `${lines.join("\n")}\n`, "utf8");
}

function sendJson(res, statusCode, payload) {
    if (!res || res.writableEnded) return;
    const body = JSON.stringify(payload ?? {});
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function sendText(res, statusCode, text) {
    if (!res || res.writableEnded) return;
    const body = String(text ?? "");
    res.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function getContentTypeByExt(ext) {
    const normalized = String(ext || "").toLowerCase();
    switch (normalized) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".txt": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
    }
}

async function serveStatic(req, res, pathname) {
    const safePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.normalize(path.join(PUBLIC_ROOT, safePath));
    if (!filePath.startsWith(PUBLIC_ROOT)) {
        sendText(res, 403, "Forbidden");
        return true;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = getContentTypeByExt(ext);

    const content = await fsp.readFile(filePath);
    res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
        "Cache-Control": "no-store"
    });
    res.end(content);
    return true;
}

function notifyLiveReload() {
    liveReloadClients.forEach(client => {
        try {
            client.write("event: reload\n");
            client.write("data: reload\n\n");
        } catch (_) {}
    });
}

function setupLiveReloadWatcher() {
    if (liveReloadWatcher || !fs.existsSync(PUBLIC_ROOT)) return;
    try {
        liveReloadWatcher = fs.watch(PUBLIC_ROOT, { recursive: true }, (_eventType, filename) => {
            const ext = path.extname(String(filename || "")).toLowerCase();
            if (!LIVE_RELOAD_EXTENSIONS.has(ext)) return;
            notifyLiveReload();
        });
    } catch (error) {
        console.warn(`[live-reload] disabled: ${error.message}`);
    }
}

function handleLiveReloadStream(req, res) {
    setupLiveReloadWatcher();
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive"
    });
    res.write("event: connected\n");
    res.write("data: ok\n\n");
    liveReloadClients.add(res);
    if (!liveReloadKeepAliveTimer) {
        liveReloadKeepAliveTimer = setInterval(() => {
            liveReloadClients.forEach(client => {
                try { client.write(": ping\n\n"); } catch (_) {}
            });
        }, 20000);
    }
    req.on("close", () => {
        liveReloadClients.delete(res);
        if (liveReloadClients.size === 0 && liveReloadKeepAliveTimer) {
            clearInterval(liveReloadKeepAliveTimer);
            liveReloadKeepAliveTimer = null;
        }
    });
}

function startWatchSupervisor() {
    const watchTargets = [__filename, PUBLIC_ROOT, ENEMY_ROOT, ENEMY_TYPE_DATA_FILE, LEVEL_DATA_FILE];
    const watchers = [];
    let child = null;
    let restartTimer = null;
    let stopping = false;

    const formatSource = sourcePath => path.relative(PROJECT_ROOT, sourcePath).replace(/\\/g, "/");

    const launchChild = reason => {
        if (stopping) return;
        if (reason) console.log(`[watch] restarting (${reason})`);
        child = spawn(process.execPath, [__filename], {
            cwd: PROJECT_ROOT,
            stdio: "inherit",
            env: {
                ...process.env,
                [CHILD_ENV_FLAG]: "1"
            }
        });
        child.on("exit", (code, signal) => {
            if (stopping || signal === "SIGTERM") return;
            const detail = signal ? `signal ${signal}` : `code ${code}`;
            console.log(`[watch] editor process exited (${detail}), relaunching...`);
            launchChild("child exit");
        });
    };

    const restartChild = sourcePath => {
        if (stopping) return;
        const reason = formatSource(sourcePath);
        if (!child || child.killed) {
            launchChild(reason);
            return;
        }
        child.once("exit", () => {
            if (!stopping) launchChild(reason);
        });
        child.kill("SIGTERM");
    };

    const scheduleRestart = sourcePath => {
        if (stopping) return;
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(() => restartChild(sourcePath), 120);
    };

    const addWatch = targetPath => {
        if (!fs.existsSync(targetPath)) return;
        const stat = fs.statSync(targetPath);
        const options = stat.isDirectory() ? { recursive: true } : {};
        try {
            const watcher = fs.watch(targetPath, options, (eventType, filename) => {
                if (!filename && eventType !== "change" && eventType !== "rename") return;
                const changedPath = (stat.isDirectory() && filename)
                    ? path.join(targetPath, String(filename))
                    : targetPath;
                scheduleRestart(changedPath);
            });
            watchers.push(watcher);
        } catch (error) {
            console.warn(`[watch] failed to watch ${targetPath}: ${error.message}`);
        }
    };

    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        if (restartTimer) clearTimeout(restartTimer);
        watchers.forEach(watcher => {
            try { watcher.close(); } catch (_) {}
        });
        if (child && !child.killed) child.kill("SIGTERM");
        setTimeout(() => process.exit(0), 50);
    };

    watchTargets.forEach(addWatch);
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    console.log("[watch] enabled (use --no-watch to disable)");
    launchChild("startup");
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const { pathname } = url;

        if (req.method === "GET" && pathname === "/api/enemies") {
            const enemies = await listEnemies();
            sendJson(res, 200, {
                enemies: enemies.map(enemy => ({
                    imageSizeBytes: (() => {
                        const imgPath = enemy && enemy.data ? String(enemy.data.img || "").trim() : "";
                        const absolute = resolveProjectFilePath(imgPath);
                        if (!absolute || !fs.existsSync(absolute)) return 0;
                        try {
                            const stat = fs.statSync(absolute);
                            return stat && stat.isFile() ? Number(stat.size) || 0 : 0;
                        } catch (_) {
                            return 0;
                        }
                    })(),
                    id: enemy.id,
                    constName: enemy.constName,
                    filePath: path.relative(PROJECT_ROOT, enemy.filePath).replace(/\\/g, "/"),
                    parseError: enemy.parseError || null,
                    ...enemy.data
                }))
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/events") {
            const events = await readEventRegistry();
            sendJson(res, 200, { events });
            return;
        }

        if (req.method === "GET" && pathname === "/api/skill-icons") {
            const icons = await listSkillIconPaths();
            sendJson(res, 200, { icons });
            return;
        }

        if (req.method === "GET" && /^\/api\/skill-icons\/[^/]+$/.test(pathname)) {
            const fileName = decodeURIComponent(String(pathname.split("/").pop() || ""));
            const normalizedName = path.basename(fileName);
            const filePath = path.join(SKILL_ICON_ROOT, normalizedName);
            if (!filePath.startsWith(SKILL_ICON_ROOT)) return sendText(res, 403, "Forbidden");
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, "Not Found");
            const ext = path.extname(filePath).toLowerCase();
            if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return sendText(res, 415, "Unsupported Media Type");
            const content = await fsp.readFile(filePath);
            res.writeHead(200, {
                "Content-Type": getContentTypeByExt(ext),
                "Content-Length": content.length,
                "Cache-Control": "no-store"
            });
            res.end(content);
            return;
        }

        if (req.method === "GET" && pathname === "/api/skills") {
            const [skills, events] = await Promise.all([
                loadAllSkills(),
                readEventRegistry()
            ]);
            sendJson(res, 200, {
                skills,
                metadata: {
                    skillTypeOptions: SKILL_TYPE_OPTIONS,
                    targetOptions: SKILL_TARGET_OPTIONS,
                    modeOptions: SKILL_MODE_OPTIONS,
                    triggerEventOptions: events.map(entry => String(entry.eventName || "").trim()).filter(Boolean)
                }
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/skills") {
            const payload = await readRequestBody(req);
            const skillType = String(payload && payload.skillType || "passive").trim().toLowerCase();
            if (!SKILL_TYPE_OPTIONS.includes(skillType)) return sendJson(res, 400, { error: "Invalid skillType." });
            const existing = await loadAllSkills();
            const next = normalizeSkillRecord(payload, skillType, null);
            const baseId = sanitizeId(payload && (payload.name || payload.id) || next.name || "skill");
            next.id = getUniqueSkillId(baseId, skillType, existing);
            if (!next.name) next.name = next.id;
            try {
                validateSkillRecordOrThrow(next);
            } catch (error) {
                return sendJson(res, 400, { error: error.message || "Invalid skill payload." });
            }
            const filePath = await writeSkillRecord(next);
            await refreshSkillIndex(skillType);
            sendJson(res, 201, {
                ok: true,
                skill: { ...next, __filePath: path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/") }
            });
            return;
        }

        if (req.method === "PUT" && /^\/api\/skills\/(passive|buff|debuff|active)\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/skills\/(passive|buff|debuff|active)\/([^/]+)$/);
            const skillType = String(match && match[1] || "").trim().toLowerCase();
            const id = sanitizeId(decodeURIComponent(match && match[2] || ""));
            if (!id || !SKILL_TYPE_OPTIONS.includes(skillType)) return sendJson(res, 400, { error: "Invalid skill path." });
            const payload = await readRequestBody(req);
            const list = await loadSkillsByType(skillType);
            const found = list.find(entry => entry.id === id);
            if (!found) return sendJson(res, 404, { error: `Skill '${id}' not found.` });
            const requestedType = SKILL_TYPE_OPTIONS.includes(String(payload && payload.skillType || "").trim().toLowerCase())
                ? String(payload.skillType).trim().toLowerCase()
                : skillType;
            const next = normalizeSkillRecord({ ...found, ...payload, skillType: requestedType }, requestedType, found);
            if (!next.id) return sendJson(res, 400, { error: "Invalid skill id." });
            const targetList = requestedType === skillType ? list : await loadSkillsByType(requestedType);
            if ((next.id !== id || requestedType !== skillType) && targetList.some(entry => entry.id === next.id)) {
                return sendJson(res, 409, { error: `Skill '${next.id}' already exists in ${requestedType}.` });
            }
            try {
                validateSkillRecordOrThrow(next);
            } catch (error) {
                return sendJson(res, 400, { error: error.message || "Invalid skill payload." });
            }
            const oldPath = getSkillFilePath(skillType, id);
            const movedType = requestedType !== skillType;
            if ((next.id !== id || movedType) && oldPath && fs.existsSync(oldPath)) {
                await fsp.unlink(oldPath).catch(() => {});
            }
            const filePath = await writeSkillRecord(next);
            if (movedType) {
                await Promise.all([
                    refreshSkillIndex(skillType),
                    refreshSkillIndex(requestedType)
                ]);
            } else {
                await refreshSkillIndex(skillType);
            }
            sendJson(res, 200, {
                ok: true,
                renamed: next.id !== id,
                movedType,
                oldType: skillType,
                skillType: requestedType,
                oldId: id,
                skill: { ...next, __filePath: path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/") }
            });
            return;
        }

        if (req.method === "DELETE" && /^\/api\/skills\/(passive|buff|debuff|active)\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/skills\/(passive|buff|debuff|active)\/([^/]+)$/);
            const skillType = String(match && match[1] || "").trim().toLowerCase();
            const id = sanitizeId(decodeURIComponent(match && match[2] || ""));
            if (!id || !SKILL_TYPE_OPTIONS.includes(skillType)) return sendJson(res, 400, { error: "Invalid skill path." });
            const list = await loadSkillsByType(skillType);
            const found = list.find(entry => entry.id === id);
            if (!found) return sendJson(res, 404, { error: `Skill '${id}' not found.` });
            const filePath = getSkillFilePath(skillType, id);
            if (filePath && fs.existsSync(filePath)) {
                await fsp.unlink(filePath);
            }
            await refreshSkillIndex(skillType);
            sendJson(res, 200, { ok: true, id, skillType, deleted: true });
            return;
        }

        if (req.method === "POST" && pathname === "/api/events") {
            const payload = await readRequestBody(req);
            const events = await readEventRegistry();
            const next = normalizeEventRegistryEntry(payload, null);
            if (!next.id) return sendJson(res, 400, { error: "Invalid event id." });
            if (!next.eventName) return sendJson(res, 400, { error: "Event name is required." });
            if (events.some(entry => entry.id === next.id)) {
                return sendJson(res, 409, { error: `Event id '${next.id}' already exists.` });
            }
            if (events.some(entry => entry.eventName === next.eventName)) {
                return sendJson(res, 409, { error: `Event name '${next.eventName}' already exists.` });
            }
            next.core = false;
            events.push(next);
            await writeEventRegistry(events);
            sendJson(res, 201, { ok: true, event: next });
            return;
        }

        if (req.method === "PUT" && /^\/api\/events\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/events/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid event id." });
            const payload = await readRequestBody(req);
            const events = await readEventRegistry();
            const index = events.findIndex(entry => entry.id === id);
            if (index < 0) return sendJson(res, 404, { error: `Event '${id}' not found.` });
            const current = events[index];
            if (current.core) return sendJson(res, 403, { error: "Core events are read-only." });
            const requestedId = sanitizeId(payload && payload.id || id) || id;
            const next = normalizeEventRegistryEntry({ ...current, ...payload, id: requestedId }, current);
            if (!next.eventName) return sendJson(res, 400, { error: "Event name is required." });
            if (events.some((entry, i) => i !== index && entry.id === next.id)) {
                return sendJson(res, 409, { error: `Event id '${next.id}' already exists.` });
            }
            if (events.some((entry, i) => i !== index && entry.eventName === next.eventName)) {
                return sendJson(res, 409, { error: `Event name '${next.eventName}' already exists.` });
            }
            events[index] = { ...next, core: false };
            await writeEventRegistry(events);
            sendJson(res, 200, { ok: true, event: events[index], oldId: id, renamed: id !== next.id });
            return;
        }

        if (req.method === "DELETE" && /^\/api\/events\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/events/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid event id." });
            const events = await readEventRegistry();
            const index = events.findIndex(entry => entry.id === id);
            if (index < 0) return sendJson(res, 404, { error: `Event '${id}' not found.` });
            if (events[index].core) return sendJson(res, 403, { error: "Core events cannot be deleted." });
            events.splice(index, 1);
            await writeEventRegistry(events);
            sendJson(res, 200, { ok: true, id, deleted: true });
            return;
        }

        if (req.method === "GET" && pathname === "/api/player/wanderer") {
            const data = readWandererClassData();
            return sendJson(res, 200, { playerClass: data });
        }

        if (req.method === "PUT" && pathname === "/api/player/wanderer") {
            const payload = await readRequestBody(req);
            const current = readWandererClassData();
            const next = normalizeWandererPatch(payload, current);
            writeWandererClassData(next);
            return sendJson(res, 200, { ok: true, playerClass: next });
        }

        if (req.method === "POST" && pathname === "/api/player/wanderer/image") {
            const payload = await readRequestBody(req);
            const target = resolvePlayerImageUploadTarget(payload && payload.target);
            if (!target) return sendJson(res, 400, { error: "Invalid image target." });
            if (!tinyPngApi.isEnabled()) {
                return sendJson(res, 400, { error: "TinyPNG API key is required for player image upload." });
            }

            const dataBase64 = String(payload && payload.dataBase64 || "");
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const originalName = sanitizeFilename(payload.filename || `${target.fileBase}.png`);
            const extension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            await fsp.mkdir(target.dir, { recursive: true });
            const fileName = `${target.fileBase}${extension}`;
            const targetPath = path.join(target.dir, fileName);
            const binary = Buffer.from(dataBase64, "base64");
            const compressedResult = await tinyPngApi.compressImageWithTinify(binary, extension);
            if (!compressedResult || compressedResult.reason === "missing_api_key") {
                return sendJson(res, 400, { error: "TinyPNG compression failed: missing API key." });
            }
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextRelative = path.relative(PROJECT_ROOT, targetPath).replace(/\\/g, "/");
            const current = readWandererClassData();
            const patch = {};
            if (target.key === "attack" || target.key === "block") {
                patch.sprites = { ...current.sprites, [target.key]: nextRelative };
            } else {
                patch[target.key] = nextRelative;
            }
            const next = normalizeWandererPatch(patch, current);
            writeWandererClassData(next);

            return sendJson(res, 200, {
                ok: true,
                target: target.key,
                image: nextRelative,
                imageSizeBytes: compressedResult.buffer.length,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts
                }
            });
        }

        if (req.method === "GET" && pathname === "/api/items-metadata") {
            sendJson(res, 200, {
                itemTypeOptions: ITEM_TYPE_OPTIONS,
                consumableTypeOptions: CONSUMABLE_TYPE_OPTIONS,
                gearTypeOptions: GEAR_TYPE_OPTIONS,
                gearSlotOptions: GEAR_SLOT_OPTIONS
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/items-gears") {
            const items = await loadRecordsByKind("item");
            const gears = await loadRecordsByKind("gear");
            sendJson(res, 200, {
                items: items.map(item => ({ ...item, imageSizeBytes: getImageSizeBytesFromRecord(item) })),
                gears: gears.map(gear => ({ ...gear, imageSizeBytes: getImageSizeBytesFromRecord(gear) })),
                metadata: {
                    itemTypeOptions: ITEM_TYPE_OPTIONS,
                    consumableTypeOptions: CONSUMABLE_TYPE_OPTIONS,
                    gearTypeOptions: GEAR_TYPE_OPTIONS,
                    gearSlotOptions: GEAR_SLOT_OPTIONS
                }
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/items") {
            const items = await loadRecordsByKind("item");
            sendJson(res, 200, { items: items.map(item => ({ ...item, imageSizeBytes: getImageSizeBytesFromRecord(item) })) });
            return;
        }

        if (req.method === "GET" && pathname === "/api/gears") {
            const gears = await loadRecordsByKind("gear");
            sendJson(res, 200, { gears: gears.map(gear => ({ ...gear, imageSizeBytes: getImageSizeBytesFromRecord(gear) })) });
            return;
        }

        if (req.method === "GET" && /^\/api\/(items|gears)\/[^/]+\/image$/.test(pathname)) {
            const match = pathname.match(/^\/api\/(items|gears)\/([^/]+)\/image$/);
            const kind = match && match[1] === "gears" ? "gear" : "item";
            const id = sanitizeId(decodeURIComponent(match && match[2] || ""));
            if (!id) return sendJson(res, 400, { error: `Invalid ${kind} id.` });
            const records = await loadRecordsByKind(kind);
            const record = records.find(entry => String(entry && entry.id || "") === id);
            if (!record) return sendJson(res, 404, { error: `${kind} '${id}' not found.` });

            const relativeProjectPath = String(record.image || "").replace(/\\/g, "/").replace(/^\/+/, "");
            if (!relativeProjectPath) {
                sendText(res, 404, "Not Found");
                return;
            }
            const filePath = resolveProjectFilePath(relativeProjectPath);
            if (!filePath) {
                sendText(res, 403, "Forbidden");
                return;
            }
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                sendText(res, 404, "Not Found");
                return;
            }
            const content = await fsp.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentTypeByExt(ext);
            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": content.length,
                "Cache-Control": "no-store"
            });
            res.end(content);
            return;
        }

        if (req.method === "POST" && pathname === "/api/items") {
            const payload = await readRequestBody(req);
            const current = await loadRecordsByKind("item");
            const normalized = normalizeItemRecord(payload, null);
            const idSet = new Set(current.map(entry => String(entry && entry.id || "")));
            normalized.id = buildUniqueRecordId(normalized.id || normalized.name, idSet, "item");
            normalized.__filePath = await createClassRecordFile("item", normalized);
            await refreshClassRegistry("item");
            sendJson(res, 201, { ok: true, id: normalized.id, item: normalized });
            return;
        }

        if (req.method === "POST" && pathname === "/api/gears") {
            const payload = await readRequestBody(req);
            const current = await loadRecordsByKind("gear");
            const normalized = normalizeGearRecord(payload, null);
            const idSet = new Set(current.map(entry => String(entry && entry.id || "")));
            normalized.id = buildUniqueRecordId(normalized.id || normalized.name, idSet, "gear");
            normalized.__filePath = await createClassRecordFile("gear", normalized);
            await refreshClassRegistry("gear");
            sendJson(res, 201, { ok: true, id: normalized.id, gear: normalized });
            return;
        }

        if (req.method === "POST" && /^\/api\/(items|gears)\/[^/]+\/image$/.test(pathname)) {
            await ensureItemStores();
            const match = pathname.match(/^\/api\/(items|gears)\/([^/]+)\/image$/);
            const kind = match && match[1] === "gears" ? "gear" : "item";
            const id = sanitizeId(decodeURIComponent(match && match[2] || ""));
            if (!id) return sendJson(res, 400, { error: `Invalid ${kind} id.` });

            const payload = await readRequestBody(req);
            const dataBase64 = String(payload && payload.dataBase64 || "");
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const originalName = sanitizeFilename(payload.filename || `${id}.png`);
            const extension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const records = await loadRecordsByKind(kind);
            const index = records.findIndex(entry => String(entry && entry.id || "") === id);
            if (index < 0) return sendJson(res, 404, { error: `${kind} '${id}' not found.` });
            const record = records[index];

            const imageDir = getImageDirByKind(kind);
            await fsp.mkdir(imageDir, { recursive: true });
            const fileName = `${id}${extension}`;
            const targetPath = path.join(imageDir, fileName);

            const imageEntries = await fsp.readdir(imageDir, { withFileTypes: true });
            for (const entry of imageEntries) {
                if (!entry.isFile()) continue;
                const entryExt = path.extname(entry.name).toLowerCase();
                if (!ALLOWED_IMAGE_EXTENSIONS.has(entryExt)) continue;
                if (entry.name === fileName) continue;
                if (entry.name.startsWith(`${id}.`)) {
                    await fsp.unlink(path.join(imageDir, entry.name)).catch(() => {});
                }
            }

            const binary = Buffer.from(dataBase64, "base64");
            const compressedResult = await tinyPngApi.compressImageWithTinify(binary, extension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            record.image = buildImagePathByKind(kind, fileName);
            record.updatedAt = new Date().toISOString();
            records[index] = record;
            if (!record.__filePath) return sendJson(res, 500, { error: "Missing class file path." });
            await writeClassRecordFile(kind, record.__filePath, record);

            sendJson(res, 200, {
                ok: true,
                id,
                image: record.image,
                imageSizeBytes: compressedResult.buffer.length,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts
                }
            });
            return;
        }

        if (req.method === "PUT" && /^\/api\/items\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/items/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid item id." });
            const payload = await readRequestBody(req);
            const current = await loadRecordsByKind("item");
            const index = current.findIndex(entry => String(entry && entry.id || "") === id);
            if (index < 0) return sendJson(res, 404, { error: `Item '${id}' not found.` });

            const existing = current[index];
            const requestedId = sanitizeId(payload && payload.id);
            let nextId = id;
            if (requestedId && requestedId !== id) {
                const idSet = new Set(current.map(entry => String(entry && entry.id || "")));
                idSet.delete(id);
                nextId = buildUniqueRecordId(requestedId, idSet, "item");
            }

            if (nextId !== id) {
                const oldExt = resolveImageExtensionFromRecord(existing);
                const oldFilePath = path.join(getImageDirByKind("item"), `${id}${oldExt}`);
                const nextFilePath = path.join(getImageDirByKind("item"), `${nextId}${oldExt}`);
                if (fs.existsSync(oldFilePath)) {
                    if (fs.existsSync(nextFilePath)) await fsp.unlink(nextFilePath).catch(() => {});
                    await movePathSafe(oldFilePath, nextFilePath);
                    existing.image = buildImagePathByKind("item", `${nextId}${oldExt}`);
                }
            }

            const normalized = normalizeItemRecord({ ...existing, ...payload, id: nextId }, existing);
            normalized.__filePath = existing.__filePath;
            if (nextId !== id && existing.__filePath) {
                const nextDir = path.join(ITEM_CLASS_ROOT, nextId);
                await fsp.mkdir(nextDir, { recursive: true });
                const nextFilePath = path.join(nextDir, `${nextId}.js`);
                await movePathSafe(existing.__filePath, nextFilePath);
                normalized.__filePath = nextFilePath;
            }
            if (!normalized.__filePath) return sendJson(res, 500, { error: "Missing class file path." });
            await writeClassRecordFile("item", normalized.__filePath, normalized);
            await refreshClassRegistry("item");
            sendJson(res, 200, { ok: true, id: nextId, oldId: id, renamed: nextId !== id, item: { ...normalized, imageSizeBytes: getImageSizeBytesFromRecord(normalized) } });
            return;
        }

        if (req.method === "PUT" && /^\/api\/gears\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/gears/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid gear id." });
            const payload = await readRequestBody(req);
            const current = await loadRecordsByKind("gear");
            const index = current.findIndex(entry => String(entry && entry.id || "") === id);
            if (index < 0) return sendJson(res, 404, { error: `Gear '${id}' not found.` });

            const existing = current[index];
            const requestedId = sanitizeId(payload && payload.id);
            let nextId = id;
            if (requestedId && requestedId !== id) {
                const idSet = new Set(current.map(entry => String(entry && entry.id || "")));
                idSet.delete(id);
                nextId = buildUniqueRecordId(requestedId, idSet, "gear");
            }

            if (nextId !== id) {
                const oldExt = resolveImageExtensionFromRecord(existing);
                const oldFilePath = path.join(getImageDirByKind("gear"), `${id}${oldExt}`);
                const nextFilePath = path.join(getImageDirByKind("gear"), `${nextId}${oldExt}`);
                if (fs.existsSync(oldFilePath)) {
                    if (fs.existsSync(nextFilePath)) await fsp.unlink(nextFilePath).catch(() => {});
                    await movePathSafe(oldFilePath, nextFilePath);
                    existing.image = buildImagePathByKind("gear", `${nextId}${oldExt}`);
                }
            }

            const normalized = normalizeGearRecord({ ...existing, ...payload, id: nextId }, existing);
            normalized.__filePath = existing.__filePath;
            if (nextId !== id && existing.__filePath) {
                const nextDir = path.join(GEAR_CLASS_ROOT, nextId);
                await fsp.mkdir(nextDir, { recursive: true });
                const nextFilePath = path.join(nextDir, `${nextId}.js`);
                await movePathSafe(existing.__filePath, nextFilePath);
                normalized.__filePath = nextFilePath;
            }
            if (!normalized.__filePath) return sendJson(res, 500, { error: "Missing class file path." });
            await writeClassRecordFile("gear", normalized.__filePath, normalized);
            await refreshClassRegistry("gear");
            sendJson(res, 200, { ok: true, id: nextId, oldId: id, renamed: nextId !== id, gear: { ...normalized, imageSizeBytes: getImageSizeBytesFromRecord(normalized) } });
            return;
        }

        if (req.method === "DELETE" && /^\/api\/items\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/items/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid item id." });
            const current = await loadRecordsByKind("item");
            const existing = current.find(entry => String(entry && entry.id || "") === id);
            if (!existing) return sendJson(res, 404, { error: `Item '${id}' not found.` });
            const ext = resolveImageExtensionFromRecord(existing);
            const imagePath = path.join(getImageDirByKind("item"), `${id}${ext}`);
            if (fs.existsSync(imagePath)) await fsp.unlink(imagePath).catch(() => {});
            if (existing.__filePath && fs.existsSync(existing.__filePath)) await fsp.unlink(existing.__filePath).catch(() => {});
            await refreshClassRegistry("item");
            sendJson(res, 200, { ok: true, id, deleted: true });
            return;
        }

        if (req.method === "DELETE" && /^\/api\/gears\/[^/]+$/.test(pathname)) {
            const id = sanitizeId(decodeURIComponent(pathname.replace("/api/gears/", "")));
            if (!id) return sendJson(res, 400, { error: "Invalid gear id." });
            const current = await loadRecordsByKind("gear");
            const existing = current.find(entry => String(entry && entry.id || "") === id);
            if (!existing) return sendJson(res, 404, { error: `Gear '${id}' not found.` });
            const ext = resolveImageExtensionFromRecord(existing);
            const imagePath = path.join(getImageDirByKind("gear"), `${id}${ext}`);
            if (fs.existsSync(imagePath)) await fsp.unlink(imagePath).catch(() => {});
            if (existing.__filePath && fs.existsSync(existing.__filePath)) await fsp.unlink(existing.__filePath).catch(() => {});
            await refreshClassRegistry("gear");
            sendJson(res, 200, { ok: true, id, deleted: true });
            return;
        }

        if (req.method === "GET" && pathname === "/api/levels") {
            const levelData = await readLevelsData();
            sendJson(res, 200, {
                levels: levelData.levels,
                defaultLevelId: levelData.defaultLevelId,
                filePath: path.relative(PROJECT_ROOT, levelData.filePath).replace(/\\/g, "/")
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/cutscene-videos") {
            const videos = await listCutsceneVideos();
            sendJson(res, 200, { videos });
            return;
        }

        if (req.method === "GET" && pathname === "/api/level-backgrounds") {
            const levelData = await readLevelsData();
            const backgrounds = listLevelBackgrounds(levelData.levels);
            sendJson(res, 200, {
                backgrounds
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/level-backgrounds") {
            const payload = await readRequestBody(req);
            const levelId = toSafeLevelNumber(payload && payload.levelId, NaN);
            const dataBase64 = String(payload && payload.dataBase64 || "");
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });

            const originalName = sanitizeFilename(payload.filename || `level_${levelId}_background.png`);
            const sourceExtension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(sourceExtension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const targetRelativeDir = `level/level_background/level_${levelId}`;
            const targetDir = resolveProjectFilePath(targetRelativeDir);
            if (!targetDir) return sendJson(res, 403, { error: "Invalid background target directory." });
            await fsp.mkdir(targetDir, { recursive: true });

            const preferredBaseName = sanitizeImageBaseName(
                payload && payload.backgroundImageName,
                path.posix.parse(originalName).name || `level_${levelId}_background`
            );
            const fileName = ensureUniqueFileName({
                dirPath: targetDir,
                preferredBaseName,
                extension: sourceExtension
            });
            const targetPath = path.join(targetDir, fileName);
            const binary = Buffer.from(dataBase64, "base64");
            const normalizedResult = await tinyPngApi.normalizeBackgroundImageDimensions(binary, sourceExtension);
            const compressedResult = await tinyPngApi.compressLevelImageWithTarget(normalizedResult.buffer, sourceExtension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextBackground = path.posix.join(targetRelativeDir, fileName);
            if (!Array.isArray(levelEntry.backgroundImages)) levelEntry.backgroundImages = [];
            if (!levelEntry.backgroundImages.includes(nextBackground)) {
                levelEntry.backgroundImages.push(nextBackground);
            }
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);

            sendJson(res, 201, {
                ok: true,
                levelId,
                background: nextBackground,
                backgroundImageName: path.posix.parse(fileName).name,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts,
                    reductionPercent: compressedResult.reductionPercent,
                    targetReductionPercent: compressedResult.targetReductionPercent
                },
                normalizedDimensions: {
                    width: tinyPngApi.backgroundTargetWidth,
                    height: tinyPngApi.backgroundTargetHeight,
                    applied: normalizedResult.normalized,
                    reason: normalizedResult.reason
                }
            });
            return;
        }

        if (req.method === "PUT" && pathname === "/api/level-backgrounds/rename") {
            const payload = await readRequestBody(req);
            const currentBackground = normalizeProjectRelativeFilePath(payload && payload.background);
            if (!currentBackground) return sendJson(res, 400, { error: "Missing background path." });
            const currentAbsolute = resolveProjectFilePath(currentBackground);
            if (!currentAbsolute || !fs.existsSync(currentAbsolute) || !fs.statSync(currentAbsolute).isFile()) {
                return sendJson(res, 404, { error: "Background image not found." });
            }
            const nextBaseName = sanitizeImageBaseName(
                payload && payload.backgroundImageName,
                path.posix.parse(currentBackground).name || "background"
            );
            const ext = path.posix.extname(currentBackground) || ".png";
            const dirRelative = path.posix.dirname(currentBackground);
            const targetDir = resolveProjectFilePath(dirRelative);
            if (!targetDir) return sendJson(res, 403, { error: "Invalid background directory." });
            const desiredFileName = `${nextBaseName}${ext}`;
            const desiredRelativePath = path.posix.join(dirRelative, desiredFileName).replace(/^\.\/+/, "");
            let nextRelativePath = desiredRelativePath;
            if (normalizeProjectRelativeFilePath(desiredRelativePath) !== currentBackground) {
                const uniqueFileName = ensureUniqueFileName({
                    dirPath: targetDir,
                    preferredBaseName: nextBaseName,
                    extension: ext
                });
                nextRelativePath = path.posix.join(dirRelative, uniqueFileName).replace(/^\.\/+/, "");
                const nextAbsolute = resolveProjectFilePath(nextRelativePath);
                if (!nextAbsolute) return sendJson(res, 403, { error: "Invalid rename target." });
                await movePathSafe(currentAbsolute, nextAbsolute);
            }

            const levelData = await readLevelsData();
            replaceBackgroundPathInLevels(levelData.levels, currentBackground, nextRelativePath, nextBaseName);
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            sendJson(res, 200, {
                ok: true,
                background: nextRelativePath,
                backgroundImageName: nextBaseName
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/level-backgrounds/replace") {
            const payload = await readRequestBody(req);
            const targetBackground = normalizeProjectRelativeFilePath(payload && payload.background);
            const dataBase64 = String(payload && payload.dataBase64 || "");
            if (!targetBackground) return sendJson(res, 400, { error: "Missing background path." });
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });
            const targetAbsolute = resolveProjectFilePath(targetBackground);
            if (!targetAbsolute || !fs.existsSync(targetAbsolute) || !fs.statSync(targetAbsolute).isFile()) {
                return sendJson(res, 404, { error: "Background image not found." });
            }

            const originalName = sanitizeFilename(payload.filename || path.posix.basename(targetBackground));
            const sourceExtension = path.extname(originalName).toLowerCase() || path.extname(targetAbsolute).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(sourceExtension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const binary = Buffer.from(dataBase64, "base64");
            const normalizedResult = await tinyPngApi.normalizeBackgroundImageDimensions(binary, sourceExtension);
            const compressedResult = await tinyPngApi.compressLevelImageWithTarget(normalizedResult.buffer, sourceExtension);
            await fsp.writeFile(targetAbsolute, compressedResult.buffer);
            sendJson(res, 200, {
                ok: true,
                background: targetBackground,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts,
                    reductionPercent: compressedResult.reductionPercent,
                    targetReductionPercent: compressedResult.targetReductionPercent
                },
                normalizedDimensions: {
                    width: tinyPngApi.backgroundTargetWidth,
                    height: tinyPngApi.backgroundTargetHeight,
                    applied: normalizedResult.normalized,
                    reason: normalizedResult.reason
                }
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/open-in-folder") {
            const payload = await readRequestBody(req);
            const relativePath = normalizeProjectRelativeFilePath(payload && payload.path);
            if (!relativePath) return sendJson(res, 400, { error: "Missing path." });
            const absolutePath = resolveProjectFilePath(relativePath);
            if (!absolutePath) return sendJson(res, 403, { error: "Invalid path." });
            if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
                return sendJson(res, 404, { error: "File not found." });
            }
            await openFileLocationInExplorer(absolutePath);
            return sendJson(res, 200, { ok: true, path: relativePath });
        }

        if (req.method === "DELETE" && pathname === "/api/level-backgrounds") {
            const payload = await readRequestBody(req);
            const targetBackground = normalizeProjectRelativeFilePath(payload && payload.background);
            if (!targetBackground) return sendJson(res, 400, { error: "Missing background path." });

            const levelData = await readLevelsData();
            const usage = getLevelBackgroundUsage(levelData.levels, targetBackground);
            if (usage.length > 0) {
                return sendJson(res, 409, {
                    error: "Background is in use by one or more scenes.",
                    usage
                });
            }

            const targetAbsolute = resolveProjectFilePath(targetBackground);
            if (!targetAbsolute || !targetAbsolute.startsWith(PROJECT_ROOT)) {
                return sendJson(res, 403, { error: "Invalid background path." });
            }
            if (fs.existsSync(targetAbsolute) && fs.statSync(targetAbsolute).isFile()) {
                await fsp.unlink(targetAbsolute);
            }

            levelData.levels.forEach(level => {
                if (!Array.isArray(level.backgroundImages)) level.backgroundImages = [];
                level.backgroundImages = level.backgroundImages
                    .map(backgroundPath => normalizeProjectRelativeFilePath(backgroundPath))
                    .filter(backgroundPath => backgroundPath && backgroundPath !== targetBackground);
            });
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            sendJson(res, 200, { ok: true, background: targetBackground, deleted: true });
            return;
        }

        if (req.method === "GET" && pathname === "/__live_reload") {
            handleLiveReloadStream(req, res);
            return;
        }

        if (req.method === "GET" && pathname.startsWith("/project/")) {
            const relativeProjectPath = pathname.replace(/^\/project\//, "");
            const filePath = path.normalize(path.join(PROJECT_ROOT, relativeProjectPath));
            if (!filePath.startsWith(PROJECT_ROOT)) {
                sendText(res, 403, "Forbidden");
                return;
            }
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                sendText(res, 404, "Not Found");
                return;
            }
            const content = await fsp.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentTypeByExt(ext);
            res.writeHead(200, { "Content-Type": contentType, "Content-Length": content.length });
            res.end(content);
            return;
        }

        if (req.method === "GET" && pathname === "/api/enemy-metadata") {
            const metadata = await readEnemyTypeData();
            sendJson(res, 200, metadata);
            return;
        }

        if (req.method === "GET" && pathname.startsWith("/api/enemies/") && pathname.endsWith("/image")) {
            const idPart = pathname.replace("/api/enemies/", "").replace("/image", "");
            const id = sanitizeId(idPart);
            if (!id) return sendJson(res, 400, { error: "Invalid enemy id." });
            const existing = await readEnemyById(id);
            const relativeProjectPath = String(existing.data?.img || "").replace(/\\/g, "/").replace(/^\/+/, "");
            if (!relativeProjectPath) {
                sendText(res, 404, "Not Found");
                return;
            }
            const filePath = path.normalize(path.join(PROJECT_ROOT, relativeProjectPath));
            if (!filePath.startsWith(PROJECT_ROOT)) {
                sendText(res, 403, "Forbidden");
                return;
            }
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                sendText(res, 404, "Not Found");
                return;
            }
            const content = await fsp.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = getContentTypeByExt(ext);
            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": content.length,
                "Cache-Control": "no-store"
            });
            res.end(content);
            return;
        }

        if (req.method === "POST" && /^\/api\/levels\/[^/]+\/scenes$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/scenes$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });

            const nextSceneNumber = (Array.isArray(levelEntry.scenes) ? levelEntry.scenes.length : 0) + 1;
            const fallbackBackground = String(levelEntry.backgroundImages && levelEntry.backgroundImages[0] ? levelEntry.backgroundImages[0] : "");
            const nextScene = normalizeLevelRound({
                enemy: null,
                background: fallbackBackground,
                backgroundImageName: `level_${levelId}_scene_${nextSceneNumber}`,
                type: "fight"
            }, fallbackBackground);
            if (!Array.isArray(levelEntry.scenes)) levelEntry.scenes = [];
            levelEntry.scenes.push(nextScene);
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 201, { ok: true, levelId, sceneIndex: levelEntry.scenes.length - 1, scene: nextScene });
        }

        if (req.method === "PUT" && /^\/api\/levels\/[^/]+\/scenes\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/scenes\/([^/]+)$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const sceneIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
                return sendJson(res, 400, { error: "Invalid scene index." });
            }
            const payload = await readRequestBody(req);
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.scenes) || !levelEntry.scenes[sceneIndex]) {
                return sendJson(res, 404, { error: `scene '${sceneIndex}' not found in level '${levelId}'.` });
            }
            const scene = levelEntry.scenes[sceneIndex];
            const validSellableIds = await getAllSellableItemIds();

            if (Object.prototype.hasOwnProperty.call(payload, "type")) {
                const rawType = String(payload.type || "fight").trim().toLowerCase();
                scene.type = rawType === "cutscene" || rawType === "vendor" || rawType === "fight"
                    ? rawType
                    : (rawType === "event" ? "cutscene" : "fight");
            }
            if (Object.prototype.hasOwnProperty.call(payload, "enemy")) {
                const nextEnemy = payload.enemy;
                scene.enemy = nextEnemy === null || String(nextEnemy).trim() === "" ? null : String(nextEnemy).trim();
            }
            if (Object.prototype.hasOwnProperty.call(payload, "cutsceneVideo")) {
                const nextVideo = String(payload.cutsceneVideo || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
                scene.cutsceneVideo = nextVideo || null;
            }
            if (Object.prototype.hasOwnProperty.call(payload, "vendorItems")) {
                const nextVendorItems = Array.isArray(payload.vendorItems) ? payload.vendorItems : [];
                scene.vendorItems = Array.from(new Set(
                    nextVendorItems
                        .map(entry => sanitizeId(entry))
                        .filter(entry => entry && validSellableIds.has(entry))
                ));
            }
            if (Object.prototype.hasOwnProperty.call(payload, "backgroundImageName")) {
                scene.backgroundImageName = sanitizeImageBaseName(payload.backgroundImageName, scene.backgroundImageName || `level_${levelId}_scene_${sceneIndex + 1}`);
            }
            if (Object.prototype.hasOwnProperty.call(payload, "background")) {
                const nextBackground = String(payload.background || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
                if (nextBackground) {
                    scene.background = nextBackground;
                    if (!scene.backgroundImageName) {
                        scene.backgroundImageName = path.posix.parse(nextBackground).name || `level_${levelId}_scene_${sceneIndex + 1}`;
                    }
                    if (!Array.isArray(levelEntry.backgroundImages)) levelEntry.backgroundImages = [];
                    if (!levelEntry.backgroundImages.includes(nextBackground)) {
                        levelEntry.backgroundImages.push(nextBackground);
                    }
                }
            }

            const effectiveType = String(scene.type || "fight").trim().toLowerCase();
            if (effectiveType === "vendor") {
                scene.enemy = null;
                scene.cutsceneVideo = null;
                if (!Array.isArray(scene.vendorItems) || scene.vendorItems.length <= 0) {
                    return sendJson(res, 400, { error: "Vendor scenes require at least one selected item." });
                }
            } else if (effectiveType === "cutscene") {
                scene.enemy = null;
                scene.vendorItems = [];
                if (!scene.cutsceneVideo || !String(scene.cutsceneVideo).trim()) {
                    return sendJson(res, 400, { error: "Cutscene scenes require a selected video." });
                }
            } else {
                scene.vendorItems = [];
                scene.cutsceneVideo = null;
            }

            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 200, { ok: true, levelId, sceneIndex, scene });
        }

        if (req.method === "DELETE" && /^\/api\/levels\/[^/]+\/scenes\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/scenes\/([^/]+)$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const sceneIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
                return sendJson(res, 400, { error: "Invalid scene index." });
            }
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.scenes) || !levelEntry.scenes[sceneIndex]) {
                return sendJson(res, 404, { error: `scene '${sceneIndex}' not found in level '${levelId}'.` });
            }
            if (levelEntry.scenes.length <= 1) {
                return sendJson(res, 400, { error: "A level must have at least 1 scene." });
            }
            levelEntry.scenes.splice(sceneIndex, 1);
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 200, { ok: true, levelId, deletedSceneIndex: sceneIndex, sceneCount: levelEntry.scenes.length });
        }

        if (req.method === "PUT" && pathname.startsWith("/api/enemies/")) {
            const id = sanitizeId(pathname.replace("/api/enemies/", ""));
            if (!id) return sendJson(res, 400, { error: "Invalid enemy id." });
            const existing = await readEnemyById(id);
            const payload = await readRequestBody(req);
            const metadata = await readEnemyTypeData();
            const requestedName = String(payload?.name || "").trim();
            const requestedIdBase = sanitizeId(requestedName);
            let nextId = id;
            if (requestedIdBase && requestedIdBase !== id) {
                nextId = getUniqueEnemyIdWithIgnore(requestedIdBase, id);
            }

            let nextEnemyDir = path.join(ENEMY_ROOT, id);
            if (nextId !== id) {
                const oldEnemyDir = path.join(ENEMY_ROOT, id);
                nextEnemyDir = path.join(ENEMY_ROOT, nextId);
                if (fs.existsSync(nextEnemyDir)) {
                    return sendJson(res, 409, { error: `Enemy id '${nextId}' already exists.` });
                }
                await movePathSafe(oldEnemyDir, nextEnemyDir);

                const oldDataPath = path.join(nextEnemyDir, `${id}_data.js`);
                const newDataPath = path.join(nextEnemyDir, `${nextId}_data.js`);
                if (fs.existsSync(oldDataPath)) {
                    await movePathSafe(oldDataPath, newDataPath);
                }

                const oldImageDir = path.join(nextEnemyDir, `${id}_images`);
                const newImageDir = path.join(nextEnemyDir, `${nextId}_images`);
                if (fs.existsSync(oldImageDir)) {
                    await movePathSafe(oldImageDir, newImageDir);
                } else if (!fs.existsSync(newImageDir)) {
                    await fsp.mkdir(newImageDir, { recursive: true });
                }

                if (fs.existsSync(newImageDir)) {
                    const imageEntries = await fsp.readdir(newImageDir, { withFileTypes: true });
                    for (const entry of imageEntries) {
                        if (!entry.isFile()) continue;
                        const ext = path.extname(entry.name).toLowerCase();
                        if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) continue;
                        const desiredName = `${nextId}${ext}`;
                        if (entry.name === desiredName) continue;
                        const fromPath = path.join(newImageDir, entry.name);
                        const toPath = path.join(newImageDir, desiredName);
                        if (fs.existsSync(toPath)) {
                            await fsp.unlink(fromPath);
                        } else {
                            await movePathSafe(fromPath, toPath);
                        }
                    }
                }
            }

            const nextDataPath = path.join(nextEnemyDir, `${nextId}_data.js`);
            const nextConstName = makeConstName(nextId);
            const imageDir = path.join(nextEnemyDir, `${nextId}_images`);
            let imageExt = ".png";
            if (fs.existsSync(imageDir)) {
                const imageEntries = await fsp.readdir(imageDir, { withFileTypes: true });
                const firstImage = imageEntries.find(entry => entry.isFile() && ALLOWED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
                if (firstImage) imageExt = path.extname(firstImage.name).toLowerCase() || ".png";
            }
            const nextImgPath = `entity/enemy_class/${nextId}/${nextId}_images/${nextId}${imageExt}`;
            const normalized = normalizeEnemyPayload(nextId, { ...existing.data, ...payload, img: nextImgPath }, existing.data, metadata);
            await fsp.writeFile(nextDataPath, formatEnemyModule(nextConstName, normalized), "utf8");
            await updateIndexFile();
            sendJson(res, 200, { ok: true, id: nextId, oldId: id, renamed: nextId !== id });
            return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/api/enemies/")) {
            const id = sanitizeId(pathname.replace("/api/enemies/", ""));
            if (!id) return sendJson(res, 400, { error: "Invalid enemy id." });
            const enemyDir = path.join(ENEMY_ROOT, id);
            if (!fs.existsSync(enemyDir) || !fs.statSync(enemyDir).isDirectory()) {
                return sendJson(res, 404, { error: `Enemy '${id}' not found.` });
            }
            await fsp.rm(enemyDir, { recursive: true, force: true });
            await updateIndexFile();
            sendJson(res, 200, { ok: true, id, deleted: true });
            return;
        }

        if (req.method === "POST" && pathname.startsWith("/api/enemies/") && pathname.endsWith("/image")) {
            const idPart = pathname.replace("/api/enemies/", "").replace("/image", "");
            const id = sanitizeId(idPart);
            if (!id) return sendJson(res, 400, { error: "Invalid enemy id." });
            const existing = await readEnemyById(id);
            const payload = await readRequestBody(req);
            const dataBase64 = String(payload.dataBase64 || "");
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const originalName = sanitizeFilename(payload.filename || `${id}.png`);
            const extension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const imageDir = path.join(ENEMY_ROOT, id, `${id}_images`);
            await fsp.mkdir(imageDir, { recursive: true });
            const fileName = `${id}${extension}`;
            const targetPath = path.join(imageDir, fileName);

            const imageEntries = await fsp.readdir(imageDir, { withFileTypes: true });
            for (const entry of imageEntries) {
                if (!entry.isFile()) continue;
                const entryExt = path.extname(entry.name).toLowerCase();
                if (!ALLOWED_IMAGE_EXTENSIONS.has(entryExt)) continue;
                if (entry.name === fileName) continue;
                await fsp.unlink(path.join(imageDir, entry.name));
            }

            const binary = Buffer.from(dataBase64, "base64");
            const compressedResult = await tinyPngApi.compressEnemyImageWithFallback(binary, extension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextImgPath = `entity/enemy_class/${id}/${id}_images/${fileName}`;
            const metadata = await readEnemyTypeData();
            const normalized = normalizeEnemyPayload(id, { ...existing.data, img: nextImgPath }, existing.data, metadata);
            await fsp.writeFile(existing.filePath, formatEnemyModule(existing.constName, normalized), "utf8");
            sendJson(res, 200, {
                ok: true,
                id,
                img: nextImgPath,
                imageSizeBytes: compressedResult.buffer.length,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts
                }
            });
            return;
        }

        if (req.method === "POST" && /^\/api\/levels\/[^/]+\/scenes\/[^/]+\/background$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/scenes\/([^/]+)\/background$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const sceneIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
                return sendJson(res, 400, { error: "Invalid scene index." });
            }

            const payload = await readRequestBody(req);
            const dataBase64 = String(payload.dataBase64 || "");
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.scenes) || !levelEntry.scenes[sceneIndex]) {
                return sendJson(res, 404, { error: `scene '${sceneIndex}' not found in level '${levelId}'.` });
            }

            const originalName = sanitizeFilename(payload.filename || `level_${levelId}_scene_${sceneIndex + 1}.png`);
            const extension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const scene = levelEntry.scenes[sceneIndex];
            const existingBackgroundPath = String(scene.background || "").replace(/\\/g, "/").replace(/^\/+/, "");
            const existingDir = existingBackgroundPath ? path.posix.dirname(existingBackgroundPath) : "";
            const fallbackDir = `level/level_background/level_${levelId}`;
            const targetRelativeDir = existingDir && existingDir !== "." ? existingDir : fallbackDir;
            const targetDir = path.normalize(path.join(PROJECT_ROOT, targetRelativeDir));
            if (!targetDir.startsWith(PROJECT_ROOT)) {
                return sendJson(res, 403, { error: "Invalid target directory." });
            }
            await fsp.mkdir(targetDir, { recursive: true });

            const preferredBaseName = sanitizeImageBaseName(
                payload.backgroundImageName,
                scene.backgroundImageName || `level_${levelId}_scene_${sceneIndex + 1}`
            );
            const fileName = ensureUniqueFileName({
                dirPath: targetDir,
                preferredBaseName,
                extension
            });
            const targetPath = path.join(targetDir, fileName);
            const binary = Buffer.from(dataBase64, "base64");
            const normalizedResult = await tinyPngApi.normalizeBackgroundImageDimensions(binary, extension);
            const compressedResult = await tinyPngApi.compressLevelImageWithTarget(normalizedResult.buffer, extension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextBackground = path.posix.join(targetRelativeDir.replace(/\\/g, "/"), fileName);
            scene.background = nextBackground;
            scene.backgroundImageName = path.posix.parse(fileName).name;
            if (!Array.isArray(levelEntry.backgroundImages)) levelEntry.backgroundImages = [];
            if (!levelEntry.backgroundImages.includes(nextBackground)) {
                levelEntry.backgroundImages.push(nextBackground);
            }

            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            sendJson(res, 200, {
                ok: true,
                levelId,
                sceneIndex,
                background: nextBackground,
                backgroundImageName: scene.backgroundImageName,
                compression: {
                    enabled: tinyPngApi.isEnabled(),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length,
                    attemptsUsed: compressedResult.attemptsUsed,
                    maxAttempts: compressedResult.maxAttempts,
                    reductionPercent: compressedResult.reductionPercent,
                    targetReductionPercent: compressedResult.targetReductionPercent
                },
                normalizedDimensions: {
                    width: tinyPngApi.backgroundTargetWidth,
                    height: tinyPngApi.backgroundTargetHeight,
                    applied: normalizedResult.normalized,
                    reason: normalizedResult.reason
                }
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/enemies") {
            const payload = await readRequestBody(req);
            const id = getUniqueEnemyId(payload.name || payload.id);
            const filePath = getEnemyFilePath(id);

            const dirPath = path.join(ENEMY_ROOT, id);
            const imageDir = path.join(dirPath, `${id}_images`);
            await fsp.mkdir(imageDir, { recursive: true });

            const constName = makeConstName(id);
            const metadata = await readEnemyTypeData();
            const data = normalizeEnemyPayload(id, payload, null, metadata);
            await fsp.writeFile(filePath, formatEnemyModule(constName, data), "utf8");
            await updateIndexFile();

            sendJson(res, 201, { ok: true, id });
            return;
        }

        const served = await serveStatic(req, res, pathname);
        if (!served) sendText(res, 404, "Not Found");
    } catch (error) {
        sendJson(res, 500, { error: error.message || "Unexpected error." });
    }
});

if (IS_WATCH_SUPERVISOR) {
    startWatchSupervisor();
} else {
    server.listen(PORT, HOST, () => {
        const boundUrl = `http://${HOST}:${PORT}`;
        const localIpv4Url = `http://127.0.0.1:${PORT}`;
        const localhostUrl = `http://localhost:${PORT}`;
        console.log(`Enemy editor running at ${boundUrl}`);
        console.log(`Open in browser: ${localhostUrl} or ${localIpv4Url}`);
        console.log("This editor writes directly to enemy data files in the project.");
    });
}



