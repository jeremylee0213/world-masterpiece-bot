const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const REMOTE_IMAGE_TIMEOUT_MS = 9000;
const MAX_IMAGE_CANDIDATES = 8;
const MAX_IMAGE_CACHE_ITEMS = 120;
const imageCache = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TEXT_MODELS = ["gemini-3-pro-preview", "gemini-3-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-2.5-flash"];
const GEMINI_IMAGE_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-nanobanana-pro",
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation"
];
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";

function isAllowedImageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host.endsWith(".wikimedia.org") || host.endsWith(".wikipedia.org") || host === "images.weserv.nl";
}

function normalizeImageCandidates(rawCandidates) {
  const unique = new Set();
  const candidates = [];

  for (const raw of rawCandidates) {
    const value = String(raw || "").trim();
    if (!value) {
      continue;
    }

    let urlObj;
    try {
      urlObj = new URL(value);
    } catch {
      continue;
    }

    if (urlObj.protocol !== "https:") {
      continue;
    }

    if (!isAllowedImageHost(urlObj.hostname)) {
      continue;
    }

    const normalized = urlObj.toString();
    if (unique.has(normalized)) {
      continue;
    }

    unique.add(normalized);
    candidates.push(normalized);

    if (candidates.length >= MAX_IMAGE_CANDIDATES) {
      break;
    }
  }

  return candidates;
}

function putImageCache(url, payload) {
  if (imageCache.has(url)) {
    imageCache.delete(url);
  }

  imageCache.set(url, payload);

  if (imageCache.size > MAX_IMAGE_CACHE_ITEMS) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) {
      imageCache.delete(oldestKey);
    }
  }
}

async function fetchRemoteImage(remoteUrl) {
  const cached = imageCache.get(remoteUrl);
  if (cached) {
    return cached;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REMOTE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(remoteUrl, {
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        "User-Agent": "NanobananaPromptStudio/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`이미지 응답 실패 (${response.status})`);
    }

    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.startsWith("image/")) {
      throw new Error("이미지 MIME 타입이 아닙니다.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const payload = {
      contentType: contentType.split(";")[0] || "image/jpeg",
      body: Buffer.from(arrayBuffer)
    };

    putImageCache(remoteUrl, payload);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  let contents = "";

  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    // .env 파일이 없으면 무시한다.
    return;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readHeaderValue(req, headerName) {
  const raw = req.headers[headerName];
  if (Array.isArray(raw)) {
    return String(raw[0] || "").trim();
  }
  return String(raw || "").trim();
}

function getServerPromptApiKey() {
  return String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
}

function getServerImageApiKey() {
  return String(
    process.env.GOOGLE_IMAGE_API_KEY ||
      process.env.NANOBANANA_IMAGE_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ""
  ).trim();
}

function getPromptApiKeyFromHeaders(req) {
  return readHeaderValue(req, "x-google-api-key") || readHeaderValue(req, "x-google-prompt-api-key");
}

function getImageApiKeyFromHeaders(req) {
  return readHeaderValue(req, "x-google-api-key") || readHeaderValue(req, "x-google-image-api-key");
}

function isLikelyGoogleApiKey(key) {
  return /^AIza[0-9A-Za-z_-]{16,}$/.test(String(key || "").trim());
}

function resolvePromptApiKey(req, body) {
  const bodyKey = String(
    body?.promptApiKey ||
      body?.apiKey ||
      body?.geminiPromptApiKey ||
      ""
  ).trim();
  return bodyKey || getPromptApiKeyFromHeaders(req) || getServerPromptApiKey();
}

function resolveImageApiKey(req, body) {
  const bodyKey = String(body?.imageApiKey || body?.apiKey || "").trim();
  return bodyKey || getImageApiKeyFromHeaders(req) || getServerImageApiKey();
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  const body = Buffer.isBuffer(text) ? text : Buffer.from(String(text));
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": body.length
  });
  res.end(body);
}

async function readJsonBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("요청 본문이 너무 큽니다.");
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("JSON 형식이 올바르지 않습니다.");
  }
}

function buildInstruction({ language, input }) {
  const languageHint = language === "en" ? "English" : "Korean";

  const systemInstruction = [
    "You are Nanobanana Prompt Architect.",
    "You are a senior art director who remixes classical paintings into character-centric image prompts.",
    "The user now provides simple controls: masterpiece, character conversion, and background conversion.",
    "Preserve the source painting's recognizable composition DNA while transforming subject and background.",
    "If qualityDirective exists in render_preferences, include it verbatim in FINAL_PROMPT.",
    "Use precise visual language for image generation models.",
    "Avoid vague wording. Keep output easy for beginners.",
    `Write every section in ${languageHint}.`,
    "Output exactly with this structure:",
    "[FINAL_PROMPT]",
    "one single line only, copy-ready image prompt, no line breaks",
    "",
    "[COMPONENT_MAP]",
    "- Source DNA: ...",
    "- Subject reinterpretation: ...",
    "- Composition and camera: ...",
    "- Color and lighting: ...",
    "- Texture and brushwork: ...",
    "- Mood and narrative: ...",
    "- Constraints: ...",
    "",
    "[QUICK_VARIANTS]",
    "1) Stable: conservative, source-faithful variant",
    "2) Balanced: middle-ground variant",
    "3) Experimental: bold reinterpretation variant"
  ].join("\n");

  const userInstruction = [
    "Design a high-quality remix prompt from this JSON.",
    "Prioritize a single-line image-generation prompt with strong visual clarity.",
    "Focus on character conversion and background conversion directives from user input.",
    "Use beginner-friendly but specific wording.",
    "Honor qualityDirective exactly when provided.",
    "Always output exactly three quick variants with labels Stable, Balanced, Experimental.",
    "If a field is empty, make a reasonable creative choice.",
    "Respect the ratio exactly as written.",
    "JSON:",
    JSON.stringify(input, null, 2)
  ].join("\n");

  return { systemInstruction, userInstruction };
}

function uniqueValues(values) {
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const item = String(value || "").trim();
    if (!item || seen.has(item)) {
      continue;
    }

    seen.add(item);
    result.push(item);
  }

  return result;
}

function sortGeminiModels(models) {
  const rank = new Map(GEMINI_TEXT_MODELS.map((model, index) => [model, index]));

  return models
    .filter((model, index, array) => model && array.indexOf(model) === index)
    .sort((a, b) => {
      const aRank = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
      const bRank = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.localeCompare(b);
    });
}

function extractGeminiText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function extractGeminiInlineImage(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inlineData = part?.inlineData || part?.inline_data;
      if (!inlineData?.data) {
        continue;
      }

      return {
        mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
        data: inlineData.data
      };
    }
  }
  return null;
}

async function requestGemini({ model, task, payload, apiKey }) {
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:${task}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let json;

  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  return { ok: response.ok, status: response.status, json, raw, model, task };
}

function buildPromptModelCandidates(requestedModel) {
  return uniqueValues([requestedModel, ...GEMINI_TEXT_MODELS]);
}

function buildImageModelCandidates(requestedModel) {
  const requested = String(requestedModel || "").trim() || DEFAULT_IMAGE_MODEL;
  return uniqueValues([requested, ...GEMINI_IMAGE_MODELS]);
}

function isModelUnavailableError(status, message) {
  const lower = String(message || "").toLowerCase();
  return (
    status === 404 ||
    lower.includes("not found") ||
    lower.includes("not supported") ||
    lower.includes("unknown model")
  );
}

function mapGeminiErrorMessage(message, statusCode) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("api key not valid") || lower.includes("invalid api key")) {
    return "Gemini API 키가 유효하지 않습니다. Google AI Studio에서 발급한 AIza... 키인지, 키 제한에서 Generative Language API 사용이 허용되어 있는지 확인해 주세요.";
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("not enabled") ||
    lower.includes("has not been used") ||
    lower.includes("api_key_service_blocked")
  ) {
    return "Gemini API 권한 오류입니다. 해당 키에서 Generative Language API를 활성화하고, 키 제한(HTTP referrer/IP/API 제한)을 확인해 주세요.";
  }

  if (lower.includes("quota") || lower.includes("rate limit")) {
    return "Gemini API 할당량/요청 제한에 도달했습니다. 잠시 후 다시 시도하거나 프로젝트 사용량 제한을 확인해 주세요.";
  }

  if (isModelUnavailableError(statusCode, raw)) {
    return "선택한 Gemini 모델이 현재 키/버전에서 지원되지 않습니다. 기본 모델 또는 다른 프리뷰 모델로 다시 시도해 주세요.";
  }

  return raw || `Gemini 요청 실패 (${statusCode || "unknown"})`;
}

async function generatePromptWithGemini({ model, systemInstruction, userInstruction, apiKey }) {
  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userInstruction }]
      }
    ],
    generationConfig: {
      temperature: 0.45
    }
  };

  const modelCandidates = buildPromptModelCandidates(model);
  let lastError = "Gemini 요청 실패";

  for (const candidate of modelCandidates) {
    const result = await requestGemini({
      model: candidate,
      task: "generateContent",
      payload,
      apiKey
    });

    if (result.ok) {
      const text = extractGeminiText(result.json);
      if (!text) {
        lastError = "Gemini 응답에서 텍스트를 추출하지 못했습니다.";
        continue;
      }

      return {
        text,
        endpoint: `gemini:${candidate}:generateContent`
      };
    }

    const message = result.json?.error?.message || `Gemini 요청 실패 (${result.status})`;
    lastError = mapGeminiErrorMessage(message, result.status);

    if (!isModelUnavailableError(result.status, message)) {
      break;
    }
  }

  throw new Error(lastError);
}

async function generateImageWithGemini({ imageModel, prompt, aspectRatio, qualityDirective, apiKey }) {
  const composedPrompt = [
    String(prompt || "").trim(),
    "",
    `Aspect ratio: ${String(aspectRatio || "3:4")}`,
    String(qualityDirective || "").trim()
  ]
    .filter(Boolean)
    .join("\n");

  let lastError = "이미지를 생성하지 못했습니다.";

  for (const model of buildImageModelCandidates(imageModel)) {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: composedPrompt }]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    };

    const result = await requestGemini({
      model,
      task: "generateContent",
      payload,
      apiKey
    });

    if (!result.ok) {
      const message = result.json?.error?.message || `Gemini 이미지 요청 실패 (${result.status})`;
      lastError = mapGeminiErrorMessage(message, result.status);
      continue;
    }

    const image = extractGeminiInlineImage(result.json);
    if (!image?.data) {
      lastError = "Gemini 응답에서 이미지 데이터를 찾지 못했습니다.";
      continue;
    }

    return {
      endpoint: `gemini:${model}:generateContent`,
      model,
      imageDataUrl: `data:${image.mimeType};base64,${image.data}`
    };
  }

  throw new Error(lastError);
}

function getFallbackPromptModels() {
  return GEMINI_TEXT_MODELS;
}

async function fetchGeminiModels(apiKey) {
  const endpoint = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, { method: "GET" });
  const raw = await response.text();
  let json;

  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error?.message || `Gemini 모델 조회 실패 (${response.status})`;
    throw new Error(mapGeminiErrorMessage(message, response.status));
  }

  const models = Array.isArray(json?.models) ? json.models : [];
  const available = models
    .filter((entry) => Array.isArray(entry?.supportedGenerationMethods) && entry.supportedGenerationMethods.includes("generateContent"))
    .map((entry) => String(entry?.name || "").replace(/^models\//, "").trim())
    .filter((name) => name.startsWith("gemini-"));

  if (available.length === 0) {
    throw new Error("Gemini 모델 응답이 비어 있습니다.");
  }

  return uniqueValues(sortGeminiModels(available));
}

async function fetchModels(apiKey) {
  if (!apiKey) {
    return getFallbackPromptModels();
  }

  try {
    return await fetchGeminiModels(apiKey);
  } catch {
    return getFallbackPromptModels();
  }
}

async function handleApi(req, res, urlObj) {
  const serverPromptApiKey = getServerPromptApiKey();
  const serverImageApiKey = getServerImageApiKey();

  if (urlObj.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      hasServerPromptApiKey: Boolean(serverPromptApiKey),
      hasServerImageApiKey: Boolean(serverImageApiKey)
    });
    return true;
  }

  if (urlObj.pathname === "/api/models" && req.method === "GET") {
    const requestApiKey = resolvePromptApiKey(req, {});
    const strictMode = urlObj.searchParams.get("strict") === "1";

    if (strictMode && !requestApiKey) {
      sendJson(res, 400, { error: "Gemini API 키가 없습니다." });
      return true;
    }

    if (strictMode && !isLikelyGoogleApiKey(requestApiKey)) {
      sendJson(res, 400, { error: "Gemini API 키 형식이 올바르지 않습니다. AIza... 형식 키를 입력해 주세요." });
      return true;
    }

    try {
      const models = strictMode ? await fetchGeminiModels(requestApiKey) : await fetchModels(requestApiKey);
      sendJson(res, 200, { models });
    } catch (error) {
      sendJson(res, 502, {
        error: error.message || "모델 목록 조회 중 오류가 발생했습니다."
      });
    }

    return true;
  }

  if (urlObj.pathname === "/api/image-proxy" && req.method === "GET") {
    const candidates = normalizeImageCandidates([
      ...urlObj.searchParams.getAll("u"),
      ...urlObj.searchParams.getAll("url")
    ]);

    if (candidates.length === 0) {
      sendJson(res, 400, {
        error: "이미지 URL 후보가 없습니다."
      });
      return true;
    }

    for (const candidate of candidates) {
      try {
        const image = await fetchRemoteImage(candidate);
        res.writeHead(200, {
          "Content-Type": image.contentType,
          "Content-Length": image.body.length,
          "Cache-Control": "public, max-age=86400"
        });
        res.end(image.body);
        return true;
      } catch {
        // 다음 후보로 재시도
      }
    }

    sendText(res, 404, "", "text/plain; charset=utf-8");
    return true;
  }

  if (urlObj.pathname === "/api/generate" && req.method === "POST") {
    let body = {};

    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "요청 본문(JSON)이 올바르지 않습니다." });
      return true;
    }

    const apiKey = resolvePromptApiKey(req, body);
    if (!apiKey) {
      sendJson(res, 400, {
        error: "Gemini API 키가 없습니다. 먼저 키를 입력해 주세요."
      });
      return true;
    }

    if (!isLikelyGoogleApiKey(apiKey)) {
      sendJson(res, 400, {
        error: "Gemini API 키 형식이 올바르지 않습니다. AIza... 형식 키를 입력해 주세요."
      });
      return true;
    }

    try {
      const model = String(body?.model || "").trim();

      if (!model) {
        sendJson(res, 400, { error: "모델을 선택해 주세요." });
        return true;
      }

      const input = {
        source: {
          masterpiece: body?.masterpiece || "",
          artist: body?.artist || "",
          customSubject: body?.customSubject || "",
          eraFilter: body?.eraFilter || ""
        },
        user_style_edits: {
          subjectStyle: body?.subjectStyle || "",
          backgroundStyle: body?.backgroundStyle || "",
          colorLighting: body?.colorLighting || "",
          textureBrushwork: body?.textureBrushwork || "",
          moodStory: body?.moodStory || "",
          compositionCamera: body?.compositionCamera || "",
          symbolism: body?.symbolism || "",
          negatives: body?.negatives || "",
          palette: body?.palette || "",
          compositionTemplate: body?.compositionTemplate || "",
          symbolismLibrary: body?.symbolismLibrary || "",
          moodMatrix: body?.moodMatrix || "",
          medium: body?.medium || "",
          preserveElements: Array.isArray(body?.preserveElements) ? body.preserveElements : []
        },
        historical_accuracy: {
          costume: body?.historicalAccuracy?.costume || "",
          architecture: body?.historicalAccuracy?.architecture || "",
          props: body?.historicalAccuracy?.props || ""
        },
        render_preferences: {
          reinterpretationLevel: Number(body?.reinterpretationLevel || 55),
          aspectRatio: body?.aspectRatio || "3:4",
          language: body?.language || "en",
          qualityDirective: body?.qualityDirective || ""
        }
      };

      const { systemInstruction, userInstruction } = buildInstruction({
        language: input.render_preferences.language,
        input
      });

      const result = await generatePromptWithGemini({
        model,
        systemInstruction,
        userInstruction,
        apiKey
      });

      sendJson(res, 200, {
        ok: true,
        endpoint: result.endpoint,
        prompt: result.text
      });
    } catch (error) {
      sendJson(res, 502, {
        error: error.message || "프롬프트 생성에 실패했습니다."
      });
    }

    return true;
  }

  if (urlObj.pathname === "/api/generate-image" && req.method === "POST") {
    let body = {};

    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "요청 본문(JSON)이 올바르지 않습니다." });
      return true;
    }

    const apiKey = resolveImageApiKey(req, body);
    if (!apiKey) {
      sendJson(res, 400, {
        error: "Gemini API 키가 없습니다. 상단 입력칸에 키를 입력해 주세요."
      });
      return true;
    }

    if (!isLikelyGoogleApiKey(apiKey)) {
      sendJson(res, 400, {
        error: "Gemini API 키 형식이 올바르지 않습니다. AIza... 형식 키를 입력해 주세요."
      });
      return true;
    }

    const prompt = String(body?.prompt || "").trim();
    if (!prompt) {
      sendJson(res, 400, {
        error: "이미지 생성용 프롬프트가 비어 있습니다."
      });
      return true;
    }

    try {
      const result = await generateImageWithGemini({
        imageModel: body?.imageModel || DEFAULT_IMAGE_MODEL,
        prompt,
        aspectRatio: body?.aspectRatio || "3:4",
        qualityDirective: body?.qualityDirective || "",
        apiKey
      });

      sendJson(res, 200, {
        ok: true,
        endpoint: result.endpoint,
        model: result.model,
        imageDataUrl: result.imageDataUrl
      });
    } catch (error) {
      sendJson(res, 502, {
        error: error.message || "이미지 생성에 실패했습니다."
      });
    }

    return true;
  }

  return false;
}

async function serveStatic(req, res, urlObj) {
  const requestedPath = urlObj.pathname === "/" ? "/index.html" : urlObj.pathname;
  const normalizedPath = path
    .normalize(requestedPath)
    .replace(/^([.][.][/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const cacheControl =
      extension === ".html" || extension === ".css" || extension === ".js"
        ? "no-store, max-age=0"
        : "public, max-age=86400";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Cache-Control": cacheControl
    });
    res.end(data);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const urlObj = new URL(req.url, `http://${host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-google-api-key, x-google-prompt-api-key, x-google-image-api-key"
    });
    res.end();
    return;
  }

  try {
    const handled = await handleApi(req, res, urlObj);

    if (handled) {
      return;
    }

    await serveStatic(req, res, urlObj);
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "서버 오류가 발생했습니다."
    });
  }
});

server.listen(PORT, () => {
  console.log(`Nanobanana Prompt Studio running on http://localhost:${PORT}`);
});
