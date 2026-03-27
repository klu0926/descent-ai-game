const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");
const tinify = require("tinify");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = 8787;
const CHILD_ENV_FLAG = "ENEMY_EDITOR_CHILD";
const DISABLE_WATCH_FLAG = "--no-watch";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENEMY_ROOT = path.join(PROJECT_ROOT, "entity", "enemy_class");
const INDEX_FILE = path.join(ENEMY_ROOT, "index.js");
const ENEMY_TYPE_DATA_FILE = path.join(ENEMY_ROOT, "enemy_type_data.js");
const PUBLIC_ROOT = path.join(__dirname, "public");
const EDITOR_ENV_FILE = path.join(__dirname, ".env");
const IS_WATCH_SUPERVISOR = !process.env[CHILD_ENV_FLAG] && !process.argv.includes(DISABLE_WATCH_FLAG);
const LIVE_RELOAD_EXTENSIONS = new Set([".css", ".js", ".html"]);

const liveReloadClients = new Set();
let liveReloadKeepAliveTimer = null;
let liveReloadWatcher = null;

const FIELD_ORDER = ["name", "img", "type", "size", "levels", "hp", "atk", "def", "crit", "dodge", "aim", "exp", "desc"];
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
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
let tinifyConfigured = false;
let tinifyLoggedMissingKey = false;

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
        return { buffer: inputBuffer, compressed: false, reason: "unsupported_extension" };
    }
    if (!configureTinifyIfNeeded()) {
        return { buffer: inputBuffer, compressed: false, reason: "missing_api_key" };
    }
    try {
        const optimized = await tinify.fromBuffer(inputBuffer).toBuffer();
        if (!optimized || optimized.length === 0) {
            return { buffer: inputBuffer, compressed: false, reason: "empty_result" };
        }
        if (optimized.length >= inputBuffer.length) {
            return { buffer: inputBuffer, compressed: false, reason: "not_smaller" };
        }
        return { buffer: optimized, compressed: true, reason: "ok" };
    } catch (error) {
        console.warn(`[image] TinyPNG compression skipped: ${error.message}`);
        return { buffer: inputBuffer, compressed: false, reason: "tinify_error" };
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

async function readEnemyTypeData() {
    const fallback = {
        enemyTypeOptions: ["monster", "warrior", "mage", "archer", "rogue", "paladin", "spirit", "hunter"],
        enemySizeToPx: { s: 150, m: 220, l: 300, xl: 400 },
        enemySizeOptions: ["s", "m", "l", "xl"],
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
    const watchTargets = [__filename, PUBLIC_ROOT, ENEMY_ROOT, ENEMY_TYPE_DATA_FILE];
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
                    id: enemy.id,
                    constName: enemy.constName,
                    filePath: path.relative(PROJECT_ROOT, enemy.filePath).replace(/\\/g, "/"),
                    parseError: enemy.parseError || null,
                    ...enemy.data
                }))
            });
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
            const compressedResult = await compressImageWithTinify(binary, extension);
            await fsp.writeFile(targetPath, compressedResult.buffer);

            const nextImgPath = `entity/enemy_class/${id}/${id}_images/${fileName}`;
            const metadata = await readEnemyTypeData();
            const normalized = normalizeEnemyPayload(id, { ...existing.data, img: nextImgPath }, existing.data, metadata);
            await fsp.writeFile(existing.filePath, formatEnemyModule(existing.constName, normalized), "utf8");
            sendJson(res, 200, {
                ok: true,
                id,
                img: nextImgPath,
                compression: {
                    enabled: Boolean(TINIFY_API_KEY),
                    compressed: compressedResult.compressed,
                    reason: compressedResult.reason,
                    originalBytes: binary.length,
                    savedBytes: compressedResult.buffer.length
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



