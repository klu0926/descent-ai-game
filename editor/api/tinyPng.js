const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const tinify = require("tinify");

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

function parseReductionPercent(input, fallback) {
    const numeric = Number.parseFloat(String(input || "").trim());
    if (!Number.isFinite(numeric)) return fallback;
    if (numeric < 1 || numeric > 95) return fallback;
    return numeric;
}

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

function createTinyPngApi({ editorEnvFile }) {
    const TINIFY_API_KEY = String(
        process.env.TINIFY_API_KEY ||
        process.env.TINYPNG_API_KEY ||
        readEnvKeyFromFile(editorEnvFile, "TINIFY_API_KEY") ||
        readEnvKeyFromFile(editorEnvFile, "TINYPNG_API_KEY") ||
        ""
    ).trim();
    const LEVEL_IMAGE_TARGET_REDUCTION_PERCENT = parseReductionPercent(
        process.env.LEVEL_IMAGE_TARGET_REDUCTION_PERCENT ||
        readEnvKeyFromFile(editorEnvFile, "LEVEL_IMAGE_TARGET_REDUCTION_PERCENT"),
        75
    );
    const TINIFY_REQUEST_TIMEOUT_MS = 20000;
    const LARGE_BACKGROUND_THRESHOLD_BYTES = 3 * 1024 * 1024;
    const BACKGROUND_TARGET_WIDTH = 768;
    const BACKGROUND_TARGET_HEIGHT = 512;
    let tinifyConfigured = false;
    let tinifyLoggedMissingKey = false;

    function isEnabled() {
        return Boolean(TINIFY_API_KEY);
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
                `$inPath = '${psInputPath}'`,
                `$outPath = '${psOutputPath}'`,
                `$targetW = ${Number(targetWidth) || BACKGROUND_TARGET_WIDTH}`,
                `$targetH = ${Number(targetHeight) || BACKGROUND_TARGET_HEIGHT}`,
                "$img = [System.Drawing.Image]::FromFile($inPath)",
                "try {",
                "  $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)",
                "  try {",
                "    $gfx = [System.Drawing.Graphics]::FromImage($bmp)",
                "    try {",
                "      $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
                "      $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality",
                "      $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality",
                "      $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality",
                "      $gfx.DrawImage($img, 0, 0, $targetW, $targetH)",
                `      $bmp.Save($outPath, ${psFormat})`,
                "    } finally { $gfx.Dispose() }",
                "  } finally { $bmp.Dispose() }",
                "} finally { $img.Dispose() }"
            ].join("; ");
            await runPowerShellCommand(commandText);
            const result = await fsp.readFile(outputPath);
            return result && result.length > 0 ? result : inputBuffer;
        } finally {
            try { await fsp.rm(tempRoot, { recursive: true, force: true }); } catch (_) {}
        }
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

    return {
        isEnabled,
        tinifyApiKey: TINIFY_API_KEY,
        backgroundTargetWidth: BACKGROUND_TARGET_WIDTH,
        backgroundTargetHeight: BACKGROUND_TARGET_HEIGHT,
        levelImageTargetReductionPercent: LEVEL_IMAGE_TARGET_REDUCTION_PERCENT,
        compressImageWithTinify,
        compressEnemyImageWithFallback,
        compressLevelImageWithTarget,
        normalizeBackgroundImageDimensions
    };
}

module.exports = {
    createTinyPngApi
};
