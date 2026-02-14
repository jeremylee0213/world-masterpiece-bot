#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "public", "masterpieces-data.js");

function hasKorean(text) {
  return /[가-힣]/.test(String(text || ""));
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function translateToKorean(text, cache) {
  const source = normalizeText(text);
  if (!source) {
    return "";
  }

  if (cache.has(source)) {
    return cache.get(source);
  }

  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=" +
    encodeURIComponent(source);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "world-masterpiece-bot/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const translated = Array.isArray(json?.[0])
      ? json[0]
          .map((chunk) => (Array.isArray(chunk) ? chunk[0] : ""))
          .join("")
      : "";

    const value = normalizeText(translated);
    cache.set(source, value);
    return value;
  } catch {
    cache.set(source, source);
    return source;
  }
}

function loadMasterpieces() {
  const code = readFileSync(DATA_FILE, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const list = Array.isArray(sandbox.window.__MASTERPIECES_LOCAL__) ? sandbox.window.__MASTERPIECES_LOCAL__ : [];
  return list;
}

async function main() {
  const list = loadMasterpieces();
  const cache = new Map();

  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];

    const currentTitleKo = normalizeText(item.titleKo);
    const currentArtistKo = normalizeText(item.artistKo);

    if (!hasKorean(currentTitleKo)) {
      const sourceTitle = normalizeText(item.titleEn || item.titleKo);
      const translatedTitle = await translateToKorean(sourceTitle, cache);
      item.titleKo = hasKorean(translatedTitle) ? translatedTitle : `작품 ${index + 1}`;
    } else {
      item.titleKo = currentTitleKo;
    }

    if (!hasKorean(currentArtistKo)) {
      const sourceArtist = normalizeText(item.artistEn || item.artistKo);
      const translatedArtist = await translateToKorean(sourceArtist, cache);

      if (hasKorean(translatedArtist)) {
        item.artistKo = translatedArtist;
      } else if (/unknown/i.test(sourceArtist)) {
        item.artistKo = "작가 미상";
      } else {
        item.artistKo = `작가 ${index + 1}`;
      }
    } else {
      item.artistKo = currentArtistKo;
    }

    if ((index + 1) % 10 === 0 || index === list.length - 1) {
      console.log(`[ko] ${index + 1}/${list.length} processed`);
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  const output = `window.__MASTERPIECES_LOCAL__ = ${JSON.stringify(list, null, 2)};\n`;
  await fs.writeFile(DATA_FILE, output, "utf8");
  console.log("[ko] done:", DATA_FILE);
}

main().catch((error) => {
  console.error("[ko] failed:", error.message);
  process.exit(1);
});
