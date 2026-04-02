const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { URL } = require("url");
const tinify = require("tinify");

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
const LEVEL_DATA_FILE = path.join(PROJECT_ROOT, "level", "level.js");
const ITEMS_ROOT = path.join(PROJECT_ROOT, "items");
const ITEM_CLASS_ROOT = path.join(ITEMS_ROOT, "consumable");
const GEAR_CLASS_ROOT = path.join(ITEMS_ROOT, "gears");
const ITEMS_IMAGE_DIR = path.join(ITEMS_ROOT, "items_images");
const GEARS_IMAGE_DIR = path.join(ITEMS_ROOT, "gear_images");
const GAME_DATA_FILE = path.join(PROJECT_ROOT, "data", "data.js");
const PUBLIC_ROOT = path.join(__dirname, "public");
const EDITOR_ENV_FILE = path.join(__dirname, ".env");
const IS_WATCH_SUPERVISOR = !process.env[CHILD_ENV_FLAG] && !process.argv.includes(DISABLE_WATCH_FLAG);
const LIVE_RELOAD_EXTENSIONS = new Set([".css", ".js", ".html"]);

const liveReloadClients = new Set();
let liveReloadKeepAliveTimer = null;
let liveReloadWatcher = null;

const FIELD_ORDER = ["name", "img", "type", "size", "levels", "hp", "atk", "def", "crit", "dodge", "aim", "exp", "desc"];
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const ITEM_TYPE_OPTIONS = ["consumable", "material", "quest", "misc"];
const CONSUMABLE_TYPE_OPTIONS = ["healing", "buff", "utility", "none"];
const GEAR_TYPE_OPTIONS = ["weapon", "armor", "accessory"];
const GEAR_SLOT_OPTIONS = ["helmet", "body", "shoes", "hands", "weapon", "relic"];

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
function readEnvKeyFromFile(filePath, keyName) {
    try {
        if (!fs.existsSync(filePath)) return "";
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split(/\r?\n/);
        for (const rawLine of lines) {
            const line = String(rawLine || "").trim();
            if (!line || line.startsWith("#")) continue;
            const eqIndex = line.indexOf("=");
            if (eqIndex < 0) continue;
            const name = line.slice(0, eqIndex).trim();
            if (name !== keyName) continue;
            const valueRaw = line.slice(eqIndex + 1).trim();
            if (
                (valueRaw.startsWith("\"") && valueRaw.endsWith("\"")) ||
                (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
            ) {
                return valueRaw.slice(1, -1).trim();
            }
            return valueRaw;
        }
        return "";
    } catch (_) {
        return "";
    }
}
const TINIFY_API_KEY = String(
    process.env.TINIFY_API_KEY ||
    process.env.TINYPNG_API_KEY ||
    readEnvKeyFromFile(EDITOR_ENV_FILE, "TINIFY_API_KEY") ||
    readEnvKeyFromFile(EDITOR_ENV_FILE, "TINYPNG_API_KEY") ||
    ""
).trim();
function parseReductionPercent(input, fallback) {
    const numeric = Number.parseFloat(String(input || "").trim());
    if (!Number.isFinite(numeric)) return fallback;
    if (numeric < 1 || numeric > 95) return fallback;
    return numeric;
}
const LEVEL_IMAGE_TARGET_REDUCTION_PERCENT = parseReductionPercent(
    process.env.LEVEL_IMAGE_TARGET_REDUCTION_PERCENT ||
    readEnvKeyFromFile(EDITOR_ENV_FILE, "LEVEL_IMAGE_TARGET_REDUCTION_PERCENT"),
    75
);
const TINIFY_REQUEST_TIMEOUT_MS = 20000;
const LARGE_BACKGROUND_THRESHOLD_BYTES = 3 * 1024 * 1024;
const BACKGROUND_TARGET_WIDTH = 768;
const BACKGROUND_TARGET_HEIGHT = 512;
let tinifyConfigured = false;
let tinifyLoggedMissingKey = false;

function withTimeout(promise, timeoutMs, label = "operation") {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label}_timeout`));
        }, timeoutMs);
        Promise.resolve(promise)
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
    res.writeHead(status, {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function getContentTypeByExt(ext) {
    const normalized = String(ext || "").toLowerCase();
    if (normalized === ".html") return "text/html; charset=utf-8";
    if (normalized === ".js") return "application/javascript; charset=utf-8";
    if (normalized === ".css") return "text/css; charset=utf-8";
    if (normalized === ".png") return "image/png";
    if (normalized === ".jpg" || normalized === ".jpeg") return "image/jpeg";
    if (normalized === ".gif") return "image/gif";
    if (normalized === ".webp") return "image/webp";
    if (normalized === ".svg") return "image/svg+xml";
    return "application/octet-stream";
}

function sanitizeId(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function toPascalCase(input) {
    return String(input)
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join("");
}

function makeConstName(enemyId) {
    return `${toPascalCase(enemyId)}_ENEMY`.toUpperCase();
}

function getEnemyFilePath(enemyId) {
    return path.join(ENEMY_ROOT, enemyId, `${enemyId}_data.js`);
}

function sanitizeFilename(input) {
    const value = String(input || "");
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function configureTinifyIfNeeded() {
    if (tinifyConfigured) return Boolean(tinify.key);
    tinifyConfigured = true;
    if (TINIFY_API_KEY) {
        tinify.key = TINIFY_API_KEY;
        return true;
    }
    if (!tinifyLoggedMissingKey) {
        console.warn("[image] TinyPNG disabled: set TINIFY_API_KEY to enable upload compression.");
        tinifyLoggedMissingKey = true;
    }
    return false;
}

async function compressImageWithTinify(inputBuffer, extension) {
    const normalizedExt = String(extension || "").toLowerCase();
    const compressible = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    if (!compressible.has(normalizedExt)) {
        return { buffer: inputBuffer, compressed: false, reason: "unsupported_extension", attemptsUsed: 0, maxAttempts: 1 };
    }
    if (!configureTinifyIfNeeded()) {
        return { buffer: inputBuffer, compressed: false, reason: "missing_api_key", attemptsUsed: 0, maxAttempts: 1 };
    }
    try {
        const optimized = await withTimeout(
            tinify.fromBuffer(inputBuffer).toBuffer(),
            TINIFY_REQUEST_TIMEOUT_MS,
            "tinify"
        );
        if (!optimized || optimized.length === 0) {
            return { buffer: inputBuffer, compressed: false, reason: "empty_result", attemptsUsed: 1, maxAttempts: 1 };
        }
        if (optimized.length >= inputBuffer.length) {
            return { buffer: inputBuffer, compressed: false, reason: "not_smaller", attemptsUsed: 1, maxAttempts: 1 };
        }
        return { buffer: optimized, compressed: true, reason: "ok", attemptsUsed: 1, maxAttempts: 1 };
    } catch (error) {
        if (String(error && error.message || "").includes("tinify_timeout")) {
            console.warn("[image] TinyPNG compression timed out; using original image.");
            return { buffer: inputBuffer, compressed: false, reason: "tinify_timeout", attemptsUsed: 1, maxAttempts: 1 };
        }
        console.warn(`[image] TinyPNG compression skipped: ${error.message}`);
        return { buffer: inputBuffer, compressed: false, reason: "tinify_error", attemptsUsed: 1, maxAttempts: 1 };
    }
}

async function compressEnemyImageWithFallback(inputBuffer, extension) {
    const baseResult = await compressImageWithTinify(inputBuffer, extension);
    const initialSize = inputBuffer.length;
    let bestBuffer = baseResult.buffer;
    let bestReason = baseResult.reason;
    let attemptsUsed = Number.isFinite(baseResult.attemptsUsed) ? baseResult.attemptsUsed : 0;
    const maxAttempts = 2;

    const normalizedExt = String(extension || "").toLowerCase();
    const compressible = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    const shouldTryResize =
        TINIFY_API_KEY &&
        compressible.has(normalizedExt) &&
        bestReason === "not_smaller" &&
        initialSize > 150 * 1024;

    if (shouldTryResize) {
        attemptsUsed += 1;
        try {
            const resized = await withTimeout(
                tinify
                    .fromBuffer(inputBuffer)
                    .resize({
                        method: "fit",
                        width: 1024,
                        height: 1024
                    })
                    .toBuffer(),
                TINIFY_REQUEST_TIMEOUT_MS,
                "tinify_enemy_resize"
            );
            if (resized && resized.length > 0 && resized.length < bestBuffer.length) {
                bestBuffer = resized;
                bestReason = "resize_1024x1024";
            }
        } catch (error) {
            if (String(error && error.message || "").includes("tinify_enemy_resize_timeout")) {
                console.warn("[image] TinyPNG enemy resize timed out; keeping original result.");
            } else {
                console.warn(`[image] TinyPNG enemy resize fallback skipped: ${error.message}`);
            }
        }
    }

    return {
        buffer: bestBuffer,
        compressed: bestBuffer.length < initialSize,
        reason: bestReason,
        attemptsUsed,
        maxAttempts
    };
}

function calculateReductionPercent(originalBytes, finalBytes) {
    const original = Number(originalBytes) || 0;
    const finalSize = Number(finalBytes) || 0;
    if (original <= 0 || finalSize >= original) return 0;
    return Math.round(((original - finalSize) / original) * 1000) / 10;
}

async function compressLevelImageWithTarget(inputBuffer, extension) {
    const baseResult = await compressImageWithTinify(inputBuffer, extension);
    const initialSize = inputBuffer.length;
    let bestBuffer = baseResult.buffer;
    let bestReason = baseResult.reason;
    let attemptsUsed = Number.isFinite(baseResult.attemptsUsed) ? baseResult.attemptsUsed : 0;
    const maxAttempts = initialSize > LARGE_BACKGROUND_THRESHOLD_BYTES ? 3 : 2;

    const targetBytes = Math.floor(initialSize * (1 - (LEVEL_IMAGE_TARGET_REDUCTION_PERCENT / 100)));
    if (
        !TINIFY_API_KEY ||
        targetBytes <= 0 ||
        bestBuffer.length <= targetBytes
    ) {
        return {
            ...baseResult,
            targetReductionPercent: LEVEL_IMAGE_TARGET_REDUCTION_PERCENT,
            reductionPercent: calculateReductionPercent(initialSize, bestBuffer.length),
            attemptsUsed,
            maxAttempts
        };
    }

    const normalizedExt = String(extension || "").toLowerCase();
    const compressible = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    if (!compressible.has(normalizedExt)) {
        return {
            ...baseResult,
            targetReductionPercent: LEVEL_IMAGE_TARGET_REDUCTION_PERCENT,
            reductionPercent: calculateReductionPercent(initialSize, bestBuffer.length),
            attemptsUsed,
            maxAttempts
        };
    }

    // Background images: 2 attempts by default; up to 3 when source image is very large.
    const resizeCandidates = [
        { width: 1600, height: 900 },
        { width: 1280, height: 720 }
    ];
    const allowedResizeAttempts = Math.max(0, maxAttempts - 1);

    for (const candidate of resizeCandidates.slice(0, allowedResizeAttempts)) {
        attemptsUsed += 1;
        try {
            const resized = await withTimeout(
                tinify
                    .fromBuffer(inputBuffer)
                    .resize({
                        method: "fit",
                        width: candidate.width,
                        height: candidate.height
                    })
                    .toBuffer(),
                TINIFY_REQUEST_TIMEOUT_MS,
                "tinify_resize"
            );
            if (!resized || resized.length <= 0) continue;
            if (resized.length < bestBuffer.length) {
                bestBuffer = resized;
                bestReason = `resize_${candidate.width}x${candidate.height}`;
            }
            if (bestBuffer.length <= targetBytes) break;
        } catch (error) {
            if (String(error && error.message || "").includes("tinify_resize_timeout")) {
                console.warn("[image] TinyPNG resize timed out; stopping extra resize attempts.");
                break;
            }
            console.warn(`[image] TinyPNG resize fallback skipped: ${error.message}`);
        }
    }

    return {
        buffer: bestBuffer,
        compressed: bestBuffer.length < initialSize,
        reason: bestReason,
        targetReductionPercent: LEVEL_IMAGE_TARGET_REDUCTION_PERCENT,
        reductionPercent: calculateReductionPercent(initialSize, bestBuffer.length),
        attemptsUsed,
        maxAttempts
    };
}

async function normalizeBackgroundImageDimensions(inputBuffer, extension) {
    const normalizedExt = String(extension || "").toLowerCase();
    const compressible = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    if (!compressible.has(normalizedExt)) {
        return { buffer: inputBuffer, normalized: false, reason: "unsupported_extension" };
    }
    let workingBuffer = inputBuffer;
    let tinifyReason = "missing_api_key";
    if (configureTinifyIfNeeded()) {
        try {
            const resized = await withTimeout(
                tinify
                    .fromBuffer(inputBuffer)
                    .resize({
                        method: "cover",
                        width: BACKGROUND_TARGET_WIDTH,
                        height: BACKGROUND_TARGET_HEIGHT
                    })
                    .toBuffer(),
                TINIFY_REQUEST_TIMEOUT_MS,
                "tinify_background_normalize"
            );
            if (resized && resized.length > 0) {
                workingBuffer = resized;
                tinifyReason = "ok";
            } else {
                tinifyReason = "empty_result";
            }
        } catch (error) {
            if (String(error && error.message || "").includes("tinify_background_normalize_timeout")) {
                console.warn("[image] Background normalize timed out; using local resize fallback.");
                tinifyReason = "normalize_timeout";
            } else {
                console.warn(`[image] Background normalize skipped: ${error.message}`);
                tinifyReason = "normalize_error";
            }
        }
    }

    try {
        const forced = await forceImageToExactDimensionsWithPowerShell(
            workingBuffer,
            normalizedExt,
            BACKGROUND_TARGET_WIDTH,
            BACKGROUND_TARGET_HEIGHT
        );
        if (forced && forced.length > 0) {
            return {
                buffer: forced,
                normalized: true,
                reason: tinifyReason === "ok" ? "ok+local_exact" : `local_exact:${tinifyReason}`
            };
        }
        return { buffer: workingBuffer, normalized: tinifyReason === "ok", reason: tinifyReason };
    } catch (error) {
        console.warn(`[image] Local exact resize failed: ${error.message}`);
        return { buffer: workingBuffer, normalized: tinifyReason === "ok", reason: `${tinifyReason}|local_resize_failed` };
    }
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

async function forceImageToExactDimensionsWithPowerShell(inputBuffer, extension, targetWidth, targetHeight) {
    const normalizedExt = String(extension || "").toLowerCase();
    const outputFormat = normalizedExt === ".png" ? "png" : (normalizedExt === ".jpg" || normalizedExt === ".jpeg" ? "jpeg" : "");
    if (!outputFormat) return inputBuffer;

    const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "bg-resize-"));
    const inputPath = path.join(tempRoot, `input${normalizedExt}`);
    const outputPath = path.join(tempRoot, `output${normalizedExt}`);
    try {
        await fsp.writeFile(inputPath, inputBuffer);
        const psInputPath = escapePowerShellSingleQuoted(inputPath);
        const psOutputPath = escapePowerShellSingleQuoted(outputPath);
        const psFormat = outputFormat === "png" ? "[System.Drawing.Imaging.ImageFormat]::Png" : "[System.Drawing.Imaging.ImageFormat]::Jpeg";
        const commandText = [
            "$ErrorActionPreference = 'Stop'",
            "Add-Type -AssemblyName System.Drawing",
            `$srcPath = '${psInputPath}'`,
            `$dstPath = '${psOutputPath}'`,
            `$targetW = ${Number(targetWidth) || BACKGROUND_TARGET_WIDTH}`,
            `$targetH = ${Number(targetHeight) || BACKGROUND_TARGET_HEIGHT}`,
            "$img = [System.Drawing.Image]::FromFile($srcPath)",
            "try {",
            "  $bitmap = New-Object System.Drawing.Bitmap($targetW, $targetH)",
            "  try {",
            "    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
            "    try {",
            "      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality",
            "      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
            "      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality",
            "      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality",
            "      $srcRatio = [double]$img.Width / [double]$img.Height",
            "      $dstRatio = [double]$targetW / [double]$targetH",
            "      if ($srcRatio -gt $dstRatio) {",
            "        $cropH = $img.Height",
            "        $cropW = [int][Math]::Round($cropH * $dstRatio)",
            "        $cropX = [int][Math]::Round(($img.Width - $cropW) / 2)",
            "        $cropY = 0",
            "      } else {",
            "        $cropW = $img.Width",
            "        $cropH = [int][Math]::Round($cropW / $dstRatio)",
            "        $cropX = 0",
            "        $cropY = [int][Math]::Round(($img.Height - $cropH) / 2)",
            "      }",
            "      if ($cropW -lt 1) { $cropW = 1 }",
            "      if ($cropH -lt 1) { $cropH = 1 }",
            "      $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)",
            "      $dstRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)",
            "      $graphics.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)",
            "    } finally {",
            "      if ($graphics) { $graphics.Dispose() }",
            "    }",
            `    $bitmap.Save($dstPath, ${psFormat})`,
            "  } finally {",
            "    if ($bitmap) { $bitmap.Dispose() }",
            "  }",
            "} finally {",
            "  if ($img) { $img.Dispose() }",
            "}"
        ].join("; ");
        await runPowerShellCommand(commandText);
        return await fsp.readFile(outputPath);
    } finally {
        await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
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
        levels: ["all"],
        hp: 50,
        atk: 8,
        def: 4,
        crit: 2,
        dodge: 2,
        aim: 2,
        exp: 12,
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
    if (normalized === "turn" || normalized === "round" || normalized === "once") return normalized;
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
    return {
        id: sanitizeId(source.id || base.id || source.name || "item"),
        name: String(source.name || base.name || "New Item").trim(),
        itemType: ITEM_TYPE_OPTIONS.includes(String(source.itemType || base.itemType || "").trim())
            ? String(source.itemType || base.itemType).trim()
            : "consumable",
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
    const baseStats = evalLiteral(parseAssignedLiteral(content, "this.baseStats"));
    const levelUpGrowth = evalLiteral(parseAssignedLiteral(content, "this.levelUpGrowth"));

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
        baseStats,
        levelUpGrowth
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
    const nextGrowth = { ...(existing.levelUpGrowth || {}) };

    if (source.baseStats && typeof source.baseStats === "object") {
        ["hp", "atk", "def", "crit", "dodge", "aim"].forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source.baseStats, key)) {
                nextBase[key] = toIntStat(source.baseStats[key], nextBase[key] || 0);
            }
        });
    }
    if (source.levelUpGrowth && typeof source.levelUpGrowth === "object") {
        ["hp", "atk", "def", "crit", "dodge", "aim"].forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source.levelUpGrowth, key)) {
                nextGrowth[key] = toIntStat(source.levelUpGrowth[key], nextGrowth[key] || 0);
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
        baseStats: nextBase,
        levelUpGrowth: nextGrowth
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
    updated = replaceAssignment(updated, "this.baseStats", JSON.stringify(nextData.baseStats || {}, null, 8));
    updated = replaceAssignment(updated, "this.levelUpGrowth", JSON.stringify(nextData.levelUpGrowth || {}, null, 8));
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

function normalizeLevelRound(round, fallbackBackground = "") {
    const source = round && typeof round === "object" ? round : {};
    const rawType = String(source.type || "fight").trim().toLowerCase();
    const normalizedType = rawType === "event" || rawType === "vendor" ? rawType : "fight";
    const enemyValue = source.enemy === null || typeof source.enemy === "undefined"
        ? null
        : String(source.enemy);
    const vendorItemsRaw = Array.isArray(source.vendorItems) ? source.vendorItems : [];
    const vendorItems = Array.from(new Set(
        vendorItemsRaw
            .map(entry => sanitizeId(entry))
            .filter(Boolean)
    ));
    const backgroundPath = String(source.background || fallbackBackground);
    const parsedBackgroundName = path.posix.parse(backgroundPath).name;
    const backgroundImageName = String(source.backgroundImageName || parsedBackgroundName || "").trim();
    return {
        enemy: enemyValue,
        vendorItems,
        background: backgroundPath,
        backgroundImageName,
        type: normalizedType
    };
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
    const roundsRaw = Array.isArray(source.rounds) ? source.rounds : [];
    const rounds = roundsRaw.length > 0
        ? roundsRaw.map(round => normalizeLevelRound(round, fallbackBackground))
        : [normalizeLevelRound({}, fallbackBackground)];
    return {
        id,
        name,
        backgroundImages,
        rounds
    };
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
        const rounds = Array.isArray(level.rounds) ? level.rounds : [];
        rounds.forEach((round, roundIndex) => {
            if (normalizeProjectRelativeFilePath(round && round.background) === normalizedPath) {
                usage.push({
                    levelId: toSafeLevelNumber(level && level.id, 1),
                    round: roundIndex + 1
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
        const rounds = Array.isArray(level.rounds) ? level.rounds : [];
        rounds.forEach((round, roundIndex) => {
            const entry = ensureEntry(levelId, round && round.background);
            if (!entry) return;
            entry.usedBy.push({
                levelId,
                round: roundIndex + 1
            });
            if (round && String(round.backgroundImageName || "").trim()) {
                entry.backgroundImageName = String(round.backgroundImageName).trim();
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
        const rounds = Array.isArray(level.rounds) ? level.rounds : [];
        rounds.forEach(round => {
            if (!round || typeof round !== "object") return;
            if (normalizeProjectRelativeFilePath(round.background) === normalizedOldPath) {
                round.background = normalizedNewPath;
                if (nextName) round.backgroundImageName = nextName;
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
        enemySizeOptions: ["s", "m", "l", "xl", "2xl"],
        enemyLevelOptions: ["all", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    };

    try {
        const content = await fsp.readFile(ENEMY_TYPE_DATA_FILE, "utf8");
        const enemyTypeOptions = parseExportLiteral(content, "ENEMY_TYPE_OPTIONS");
        const enemySizeToPx = parseExportLiteral(content, "ENEMY_SIZE_TO_PX");
        const rawEnemySizeOptions = parseExportLiteral(content, "ENEMY_SIZE_OPTIONS");
        const rawEnemyLevelOptions = parseExportLiteral(content, "ENEMY_LEVEL_OPTIONS");
        const enemySizeOptions = Array.isArray(rawEnemySizeOptions)
            ? rawEnemySizeOptions
            : Object.keys(enemySizeToPx);
        const enemyLevelOptions = Array.isArray(rawEnemyLevelOptions)
            ? rawEnemyLevelOptions
            : fallback.enemyLevelOptions;
        return {
            enemyTypeOptions: Array.isArray(enemyTypeOptions) ? enemyTypeOptions : fallback.enemyTypeOptions,
            enemySizeToPx: enemySizeToPx && typeof enemySizeToPx === "object" ? enemySizeToPx : fallback.enemySizeToPx,
            enemySizeOptions: Array.isArray(enemySizeOptions) ? enemySizeOptions : fallback.enemySizeOptions,
            enemyLevelOptions: Array.isArray(enemyLevelOptions) ? enemyLevelOptions : fallback.enemyLevelOptions
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
        if (key === "levels") return;
        if (["hp", "atk", "def", "crit", "dodge", "aim", "exp"].includes(key)) {
            const parsed = Number(merged[key]);
            normalized[key] = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
            return;
        }
        normalized[key] = String(merged[key] ?? "");
    });

    const levelOptions = metadata && Array.isArray(metadata.enemyLevelOptions)
        ? metadata.enemyLevelOptions
        : ["all"];
    const rawLevels = Array.isArray(merged.levels) ? merged.levels : [merged.levels];
    const normalizedLevels = rawLevels
        .map(entry => (typeof entry === "number" ? entry : String(entry || "").trim()))
        .filter(entry => entry !== "" && entry !== null && entry !== undefined)
        .map(entry => (entry === "all" ? "all" : Number(entry)))
        .filter(entry => entry === "all" || Number.isFinite(entry));
    const dedupedLevels = Array.from(new Set(normalizedLevels));
    const validLevels = dedupedLevels.filter(entry => levelOptions.includes(entry));
    if (validLevels.includes("all")) normalized.levels = ["all"];
    else normalized.levels = validLevels.length > 0 ? validLevels : ["all"];

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
            if (!configureTinifyIfNeeded()) {
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
            const compressedResult = await compressImageWithTinify(binary, extension);
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
                    enabled: Boolean(TINIFY_API_KEY),
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
            const compressedResult = await compressImageWithTinify(binary, extension);
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
                    enabled: Boolean(TINIFY_API_KEY),
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
            const normalizedResult = await normalizeBackgroundImageDimensions(binary, sourceExtension);
            const compressedResult = await compressLevelImageWithTarget(normalizedResult.buffer, sourceExtension);
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
                    enabled: Boolean(TINIFY_API_KEY),
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
                    width: BACKGROUND_TARGET_WIDTH,
                    height: BACKGROUND_TARGET_HEIGHT,
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
            const normalizedResult = await normalizeBackgroundImageDimensions(binary, sourceExtension);
            const compressedResult = await compressLevelImageWithTarget(normalizedResult.buffer, sourceExtension);
            await fsp.writeFile(targetAbsolute, compressedResult.buffer);
            sendJson(res, 200, {
                ok: true,
                background: targetBackground,
                compression: {
                    enabled: Boolean(TINIFY_API_KEY),
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
                    width: BACKGROUND_TARGET_WIDTH,
                    height: BACKGROUND_TARGET_HEIGHT,
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
                    error: "Background is in use by one or more rounds.",
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

        if (req.method === "POST" && /^\/api\/levels\/[^/]+\/rounds$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/rounds$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });

            const nextRoundNumber = (Array.isArray(levelEntry.rounds) ? levelEntry.rounds.length : 0) + 1;
            const fallbackBackground = String(levelEntry.backgroundImages && levelEntry.backgroundImages[0] ? levelEntry.backgroundImages[0] : "");
            const nextRound = normalizeLevelRound({
                enemy: null,
                background: fallbackBackground,
                backgroundImageName: `level_${levelId}_round_${nextRoundNumber}`,
                type: "fight"
            }, fallbackBackground);
            if (!Array.isArray(levelEntry.rounds)) levelEntry.rounds = [];
            levelEntry.rounds.push(nextRound);
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 201, { ok: true, levelId, roundIndex: levelEntry.rounds.length - 1, round: nextRound });
        }

        if (req.method === "PUT" && /^\/api\/levels\/[^/]+\/rounds\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/rounds\/([^/]+)$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const roundIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(roundIndex) || roundIndex < 0) {
                return sendJson(res, 400, { error: "Invalid round index." });
            }
            const payload = await readRequestBody(req);
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.rounds) || !levelEntry.rounds[roundIndex]) {
                return sendJson(res, 404, { error: `Round '${roundIndex}' not found in level '${levelId}'.` });
            }
            const round = levelEntry.rounds[roundIndex];
            const validSellableIds = await getAllSellableItemIds();

            if (Object.prototype.hasOwnProperty.call(payload, "type")) {
                const rawType = String(payload.type || "fight").trim().toLowerCase();
                round.type = rawType === "event" || rawType === "vendor" ? rawType : "fight";
            }
            if (Object.prototype.hasOwnProperty.call(payload, "enemy")) {
                const nextEnemy = payload.enemy;
                round.enemy = nextEnemy === null || String(nextEnemy).trim() === "" ? null : String(nextEnemy).trim();
            }
            if (Object.prototype.hasOwnProperty.call(payload, "vendorItems")) {
                const nextVendorItems = Array.isArray(payload.vendorItems) ? payload.vendorItems : [];
                round.vendorItems = Array.from(new Set(
                    nextVendorItems
                        .map(entry => sanitizeId(entry))
                        .filter(entry => entry && validSellableIds.has(entry))
                ));
            }
            if (Object.prototype.hasOwnProperty.call(payload, "backgroundImageName")) {
                round.backgroundImageName = sanitizeImageBaseName(payload.backgroundImageName, round.backgroundImageName || `level_${levelId}_round_${roundIndex + 1}`);
            }
            if (Object.prototype.hasOwnProperty.call(payload, "background")) {
                const nextBackground = String(payload.background || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
                if (nextBackground) {
                    round.background = nextBackground;
                    if (!round.backgroundImageName) {
                        round.backgroundImageName = path.posix.parse(nextBackground).name || `level_${levelId}_round_${roundIndex + 1}`;
                    }
                    if (!Array.isArray(levelEntry.backgroundImages)) levelEntry.backgroundImages = [];
                    if (!levelEntry.backgroundImages.includes(nextBackground)) {
                        levelEntry.backgroundImages.push(nextBackground);
                    }
                }
            }

            const effectiveType = String(round.type || "fight").trim().toLowerCase();
            if (effectiveType === "vendor") {
                round.enemy = null;
                if (!Array.isArray(round.vendorItems) || round.vendorItems.length <= 0) {
                    return sendJson(res, 400, { error: "Vendor rounds require at least one selected item." });
                }
            } else {
                round.vendorItems = [];
            }

            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 200, { ok: true, levelId, roundIndex, round });
        }

        if (req.method === "DELETE" && /^\/api\/levels\/[^/]+\/rounds\/[^/]+$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/rounds\/([^/]+)$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const roundIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(roundIndex) || roundIndex < 0) {
                return sendJson(res, 400, { error: "Invalid round index." });
            }
            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.rounds) || !levelEntry.rounds[roundIndex]) {
                return sendJson(res, 404, { error: `Round '${roundIndex}' not found in level '${levelId}'.` });
            }
            if (levelEntry.rounds.length <= 1) {
                return sendJson(res, 400, { error: "A level must have at least 1 round." });
            }
            levelEntry.rounds.splice(roundIndex, 1);
            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            return sendJson(res, 200, { ok: true, levelId, deletedRoundIndex: roundIndex, roundCount: levelEntry.rounds.length });
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
            const compressedResult = await compressEnemyImageWithFallback(binary, extension);
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
                    enabled: Boolean(TINIFY_API_KEY),
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

        if (req.method === "POST" && /^\/api\/levels\/[^/]+\/rounds\/[^/]+\/background$/.test(pathname)) {
            const match = pathname.match(/^\/api\/levels\/([^/]+)\/rounds\/([^/]+)\/background$/);
            const levelId = toSafeLevelNumber(match && match[1], NaN);
            const roundIndex = Number(match && match[2]);
            if (!Number.isFinite(levelId) || levelId <= 0) {
                return sendJson(res, 400, { error: "Invalid level id." });
            }
            if (!Number.isInteger(roundIndex) || roundIndex < 0) {
                return sendJson(res, 400, { error: "Invalid round index." });
            }

            const payload = await readRequestBody(req);
            const dataBase64 = String(payload.dataBase64 || "");
            if (!dataBase64) return sendJson(res, 400, { error: "Missing image file data." });

            const levelData = await readLevelsData();
            const levelEntry = levelData.levels.find(entry => entry.id === levelId);
            if (!levelEntry) return sendJson(res, 404, { error: `Level '${levelId}' not found.` });
            if (!Array.isArray(levelEntry.rounds) || !levelEntry.rounds[roundIndex]) {
                return sendJson(res, 404, { error: `Round '${roundIndex}' not found in level '${levelId}'.` });
            }

            const originalName = sanitizeFilename(payload.filename || `level_${levelId}_round_${roundIndex + 1}.png`);
            const extension = path.extname(originalName).toLowerCase() || ".png";
            if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
                return sendJson(res, 400, { error: "Unsupported image format." });
            }

            const round = levelEntry.rounds[roundIndex];
            const existingBackgroundPath = String(round.background || "").replace(/\\/g, "/").replace(/^\/+/, "");
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
                round.backgroundImageName || `level_${levelId}_round_${roundIndex + 1}`
            );
            const fileName = ensureUniqueFileName({
                dirPath: targetDir,
                preferredBaseName,
                extension
            });
            const targetPath = path.join(targetDir, fileName);
            const binary = Buffer.from(dataBase64, "base64");
            const normalizedResult = await normalizeBackgroundImageDimensions(binary, extension);
            const compressedResult = await compressLevelImageWithTarget(normalizedResult.buffer, extension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextBackground = path.posix.join(targetRelativeDir.replace(/\\/g, "/"), fileName);
            round.background = nextBackground;
            round.backgroundImageName = path.posix.parse(fileName).name;
            if (!Array.isArray(levelEntry.backgroundImages)) levelEntry.backgroundImages = [];
            if (!levelEntry.backgroundImages.includes(nextBackground)) {
                levelEntry.backgroundImages.push(nextBackground);
            }

            await writeLevelsData(levelData.levels, levelData.defaultLevelId);
            sendJson(res, 200, {
                ok: true,
                levelId,
                roundIndex,
                background: nextBackground,
                backgroundImageName: round.backgroundImageName,
                compression: {
                    enabled: Boolean(TINIFY_API_KEY),
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
                    width: BACKGROUND_TARGET_WIDTH,
                    height: BACKGROUND_TARGET_HEIGHT,
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



