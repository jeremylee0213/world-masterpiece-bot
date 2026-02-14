#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "artworks");
const DATA_FILE = path.join(ROOT, "public", "masterpieces-data.js");

const TARGET_TOTAL = 100;
const STYLE_PRESET_COUNT = 3;
const TARGET_DOWNLOADED = TARGET_TOTAL - STYLE_PRESET_COUNT;
const REQUEST_TIMEOUT_MS = 10000;

const USER_AGENT = "world-masterpiece-bot/1.0 (local asset builder)";

const PRIORITY_WORKS = [
  { pageTitle: "Mona Lisa", titleKo: "모나리자", artistKo: "레오나르도 다 빈치", artistEn: "Leonardo da Vinci", category: "classic" },
  { pageTitle: "The Last Supper (Leonardo)", titleKo: "최후의 만찬", artistKo: "레오나르도 다 빈치", artistEn: "Leonardo da Vinci", category: "classic" },
  { pageTitle: "The School of Athens", titleKo: "아테네 학당", artistKo: "라파엘로", artistEn: "Raphael", category: "classic" },
  { pageTitle: "The Creation of Adam", titleKo: "아담의 창조", artistKo: "미켈란젤로", artistEn: "Michelangelo", category: "classic" },
  { pageTitle: "The Birth of Venus", titleKo: "비너스의 탄생", artistKo: "산드로 보티첼리", artistEn: "Sandro Botticelli", category: "classic" },
  { pageTitle: "Primavera (Botticelli)", titleKo: "봄", artistKo: "산드로 보티첼리", artistEn: "Sandro Botticelli", category: "classic" },
  { pageTitle: "The Arnolfini Portrait", titleKo: "아르놀피니 부부의 초상", artistKo: "얀 반 에이크", artistEn: "Jan van Eyck", category: "classic" },
  { pageTitle: "Las Meninas", titleKo: "시녀들", artistKo: "디에고 벨라스케스", artistEn: "Diego Velazquez", category: "classic" },
  { pageTitle: "The Night Watch", titleKo: "야경", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "Girl with a Pearl Earring", titleKo: "진주 귀걸이를 한 소녀", artistKo: "요하네스 페르메이르", artistEn: "Johannes Vermeer", category: "classic" },
  { pageTitle: "The Milkmaid (Vermeer)", titleKo: "우유 따르는 여인", artistKo: "요하네스 페르메이르", artistEn: "Johannes Vermeer", category: "classic" },
  { pageTitle: "View of Delft", titleKo: "델프트 풍경", artistKo: "요하네스 페르메이르", artistEn: "Johannes Vermeer", category: "classic" },
  { pageTitle: "The Art of Painting", titleKo: "회화의 기술", artistKo: "요하네스 페르메이르", artistEn: "Johannes Vermeer", category: "classic" },
  { pageTitle: "The Garden of Earthly Delights", titleKo: "쾌락의 정원", artistKo: "히에로니무스 보스", artistEn: "Hieronymus Bosch", category: "classic" },
  { pageTitle: "The Tower of Babel (Bruegel)", titleKo: "바벨탑", artistKo: "피터르 브뤼헐", artistEn: "Pieter Bruegel the Elder", category: "classic" },
  { pageTitle: "Netherlandish Proverbs", titleKo: "네덜란드 속담", artistKo: "피터르 브뤼헐", artistEn: "Pieter Bruegel the Elder", category: "classic" },
  { pageTitle: "The Hunters in the Snow", titleKo: "눈 속의 사냥꾼", artistKo: "피터르 브뤼헐", artistEn: "Pieter Bruegel the Elder", category: "classic" },
  { pageTitle: "The Peasant Wedding", titleKo: "농민의 결혼식", artistKo: "피터르 브뤼헐", artistEn: "Pieter Bruegel the Elder", category: "classic" },
  { pageTitle: "The Calling of St Matthew", titleKo: "성 마태오의 소명", artistKo: "카라바조", artistEn: "Caravaggio", category: "classic" },
  { pageTitle: "The Entombment of Christ (Caravaggio)", titleKo: "그리스도의 매장", artistKo: "카라바조", artistEn: "Caravaggio", category: "classic" },
  { pageTitle: "Judith Beheading Holofernes", titleKo: "유디트의 홀로페르네스 참수", artistKo: "카라바조", artistEn: "Caravaggio", category: "classic" },
  { pageTitle: "Judith Slaying Holofernes (Artemisia Gentileschi, Florence)", titleKo: "유디트와 홀로페르네스", artistKo: "아르테미시아 젠틸레스키", artistEn: "Artemisia Gentileschi", category: "classic" },
  { pageTitle: "Liberty Leading the People", titleKo: "민중을 이끄는 자유의 여신", artistKo: "외젠 들라크루아", artistEn: "Eugene Delacroix", category: "classic" },
  { pageTitle: "The Raft of the Medusa", titleKo: "메두사호의 뗏목", artistKo: "테오도르 제리코", artistEn: "Theodore Gericault", category: "classic" },
  { pageTitle: "The Third of May 1808", titleKo: "1808년 5월 3일", artistKo: "프란시스코 고야", artistEn: "Francisco Goya", category: "classic" },
  { pageTitle: "Saturn Devouring His Son", titleKo: "아들을 잡아먹는 사투르누스", artistKo: "프란시스코 고야", artistEn: "Francisco Goya", category: "classic" },
  { pageTitle: "The Nude Maja", titleKo: "옷을 벗은 마하", artistKo: "프란시스코 고야", artistEn: "Francisco Goya", category: "classic" },
  { pageTitle: "The Clothed Maja", titleKo: "옷을 입은 마하", artistKo: "프란시스코 고야", artistEn: "Francisco Goya", category: "classic" },
  { pageTitle: "Wanderer above the Sea of Fog", titleKo: "안개 바다 위의 방랑자", artistKo: "카스파르 다비드 프리드리히", artistEn: "Caspar David Friedrich", category: "classic" },
  { pageTitle: "The Sea of Ice", titleKo: "얼음바다", artistKo: "카스파르 다비드 프리드리히", artistEn: "Caspar David Friedrich", category: "classic" },
  { pageTitle: "The Hay Wain", titleKo: "건초마차", artistKo: "존 컨스터블", artistEn: "John Constable", category: "classic" },
  { pageTitle: "The Fighting Temeraire", titleKo: "전함 테메레르", artistKo: "J. M. W. 터너", artistEn: "J. M. W. Turner", category: "classic" },
  { pageTitle: "Rain, Steam and Speed – The Great Western Railway", titleKo: "비, 증기, 속도", artistKo: "J. M. W. 터너", artistEn: "J. M. W. Turner", category: "classic" },
  { pageTitle: "The Swing (Fragonard)", titleKo: "그네", artistKo: "장 오노레 프라고나르", artistEn: "Jean-Honore Fragonard", category: "classic" },
  { pageTitle: "The Oath of the Horatii", titleKo: "호라티우스 형제의 맹세", artistKo: "자크 루이 다비드", artistEn: "Jacques-Louis David", category: "classic" },
  { pageTitle: "The Death of Marat", titleKo: "마라의 죽음", artistKo: "자크 루이 다비드", artistEn: "Jacques-Louis David", category: "classic" },
  { pageTitle: "Napoleon Crossing the Alps", titleKo: "알프스를 넘는 나폴레옹", artistKo: "자크 루이 다비드", artistEn: "Jacques-Louis David", category: "classic" },
  { pageTitle: "The Nightmare", titleKo: "악몽", artistKo: "헨리 퓨즐리", artistEn: "Henry Fuseli", category: "classic" },
  { pageTitle: "The Great Wave off Kanagawa", titleKo: "가나가와 앞바다의 큰 파도", artistKo: "가쓰시카 호쿠사이", artistEn: "Katsushika Hokusai", category: "pop" },
  { pageTitle: "Fine Wind, Clear Morning", titleKo: "가이후 카이세이", artistKo: "가쓰시카 호쿠사이", artistEn: "Katsushika Hokusai", category: "pop" },
  { pageTitle: "Sudden Shower over Shin-Ohashi bridge and Atake", titleKo: "신오하시 다리와 아타케의 소나기", artistKo: "우타가와 히로시게", artistEn: "Utagawa Hiroshige", category: "pop" },
  { pageTitle: "Plum Park in Kameido", titleKo: "가메이도 매화원", artistKo: "우타가와 히로시게", artistEn: "Utagawa Hiroshige", category: "pop" },
  { pageTitle: "Impression, Sunrise", titleKo: "인상, 해돋이", artistKo: "클로드 모네", artistEn: "Claude Monet", category: "impression" },
  { pageTitle: "Water Lilies (Monet series)", titleKo: "수련", artistKo: "클로드 모네", artistEn: "Claude Monet", category: "impression" },
  { pageTitle: "Woman with a Parasol - Madame Monet and Her Son", titleKo: "양산을 든 여인", artistKo: "클로드 모네", artistEn: "Claude Monet", category: "impression" },
  { pageTitle: "The Starry Night", titleKo: "별이 빛나는 밤", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Sunflowers (Van Gogh series)", titleKo: "해바라기", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "The Potato Eaters", titleKo: "감자 먹는 사람들", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "The Bedroom", titleKo: "아를의 침실", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Cafe Terrace at Night", titleKo: "밤의 카페 테라스", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Wheatfield with Crows", titleKo: "까마귀가 있는 밀밭", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Irises (painting)", titleKo: "붓꽃", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Almond Blossoms", titleKo: "아몬드 꽃", artistKo: "빈센트 반 고흐", artistEn: "Vincent van Gogh", category: "impression" },
  { pageTitle: "Olympia (Manet)", titleKo: "올랭피아", artistKo: "에두아르 마네", artistEn: "Edouard Manet", category: "impression" },
  { pageTitle: "A Bar at the Folies-Bergere", titleKo: "폴리 베르제르의 바", artistKo: "에두아르 마네", artistEn: "Edouard Manet", category: "impression" },
  { pageTitle: "Luncheon of the Boating Party", titleKo: "뱃놀이하는 사람들의 점심식사", artistKo: "피에르 오귀스트 르누아르", artistEn: "Pierre-Auguste Renoir", category: "impression" },
  { pageTitle: "Bal du moulin de la Galette", titleKo: "물랭 드 라 갈레트의 무도회", artistKo: "피에르 오귀스트 르누아르", artistEn: "Pierre-Auguste Renoir", category: "impression" },
  { pageTitle: "Dance at Le Moulin de la Galette", titleKo: "물랭 드 라 갈레트의 춤", artistKo: "피에르 오귀스트 르누아르", artistEn: "Pierre-Auguste Renoir", category: "impression" },
  { pageTitle: "The Gleaners", titleKo: "이삭 줍는 여인들", artistKo: "장 프랑수아 밀레", artistEn: "Jean-Francois Millet", category: "impression" },
  { pageTitle: "The Angelus (painting)", titleKo: "만종", artistKo: "장 프랑수아 밀레", artistEn: "Jean-Francois Millet", category: "impression" },
  { pageTitle: "A Sunday Afternoon on the Island of La Grande Jatte", titleKo: "그랑드 자트 섬의 일요일 오후", artistKo: "조르주 쇠라", artistEn: "Georges Seurat", category: "impression" },
  { pageTitle: "Bathers at Asnieres", titleKo: "아니에르에서의 물놀이", artistKo: "조르주 쇠라", artistEn: "Georges Seurat", category: "impression" },
  { pageTitle: "The Circus (Seurat)", titleKo: "서커스", artistKo: "조르주 쇠라", artistEn: "Georges Seurat", category: "impression" },
  { pageTitle: "The Card Players", titleKo: "카드 놀이 하는 사람들", artistKo: "폴 세잔", artistEn: "Paul Cezanne", category: "impression" },
  { pageTitle: "Mont Sainte-Victoire (Cezanne)", titleKo: "생트 빅투아르 산", artistKo: "폴 세잔", artistEn: "Paul Cezanne", category: "impression" },
  { pageTitle: "The Scream", titleKo: "절규", artistKo: "에드바르 뭉크", artistEn: "Edvard Munch", category: "modern" },
  { pageTitle: "The Kiss (Klimt)", titleKo: "키스", artistKo: "구스타프 클림트", artistEn: "Gustav Klimt", category: "modern" },
  { pageTitle: "Judith and the Head of Holofernes", titleKo: "유디트", artistKo: "구스타프 클림트", artistEn: "Gustav Klimt", category: "modern" },
  { pageTitle: "Death and Life", titleKo: "죽음과 삶", artistKo: "구스타프 클림트", artistEn: "Gustav Klimt", category: "modern" },
  { pageTitle: "The Sleeping Gypsy", titleKo: "잠자는 집시", artistKo: "앙리 루소", artistEn: "Henri Rousseau", category: "modern" },
  { pageTitle: "Whistler's Mother", titleKo: "휘슬러의 어머니", artistKo: "제임스 맥닐 휘슬러", artistEn: "James McNeill Whistler", category: "modern" },
  { pageTitle: "Ophelia (painting)", titleKo: "오필리아", artistKo: "존 에버렛 밀레이", artistEn: "John Everett Millais", category: "modern" },
  { pageTitle: "Flaming June", titleKo: "불타는 6월", artistKo: "프레더릭 레이턴", artistEn: "Frederic Leighton", category: "modern" },
  { pageTitle: "The Lady of Shalott (painting)", titleKo: "셜롯의 여인", artistKo: "존 윌리엄 워터하우스", artistEn: "John William Waterhouse", category: "modern" },
  { pageTitle: "The Soul of the Rose", titleKo: "장미의 영혼", artistKo: "존 윌리엄 워터하우스", artistEn: "John William Waterhouse", category: "modern" },
  { pageTitle: "The Last Day of Pompeii (painting)", titleKo: "폼페이 최후의 날", artistKo: "카를 브률로프", artistEn: "Karl Bryullov", category: "modern" },
  { pageTitle: "The Ninth Wave", titleKo: "아홉 번째 파도", artistKo: "이반 아이바조프스키", artistEn: "Ivan Aivazovsky", category: "modern" },
  { pageTitle: "Barge Haulers on the Volga", titleKo: "볼가강의 배 끄는 인부들", artistKo: "일리야 레핀", artistEn: "Ilya Repin", category: "modern" },
  { pageTitle: "Morning in a Pine Forest", titleKo: "소나무 숲의 아침", artistKo: "이반 시시킨", artistEn: "Ivan Shishkin", category: "modern" },
  { pageTitle: "Bogatyrs (Vasnetsov)", titleKo: "용사들", artistKo: "빅토르 바스네초프", artistEn: "Viktor Vasnetsov", category: "modern" },
  { pageTitle: "Girl with Peaches", titleKo: "복숭아를 든 소녀", artistKo: "발렌틴 세로프", artistEn: "Valentin Serov", category: "modern" },
  { pageTitle: "The Return of the Prodigal Son (Rembrandt)", titleKo: "탕자의 귀환", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "Self-Portrait with Two Circles", titleKo: "두 개의 원이 있는 자화상", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "The Anatomy Lesson of Dr. Nicolaes Tulp", titleKo: "툴프 박사의 해부학 강의", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "The Jewish Bride (painting)", titleKo: "유대인 신부", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "The Storm on the Sea of Galilee", titleKo: "갈릴리 바다의 폭풍", artistKo: "렘브란트", artistEn: "Rembrandt", category: "classic" },
  { pageTitle: "Venus of Urbino", titleKo: "우르비노의 비너스", artistKo: "티치아노", artistEn: "Titian", category: "classic" },
  { pageTitle: "Bacchus and Ariadne", titleKo: "바쿠스와 아리아드네", artistKo: "티치아노", artistEn: "Titian", category: "classic" },
  { pageTitle: "Assumption of the Virgin (Titian)", titleKo: "성모 승천", artistKo: "티치아노", artistEn: "Titian", category: "classic" },
  { pageTitle: "The Sleeping Venus", titleKo: "잠자는 비너스", artistKo: "조르조네", artistEn: "Giorgione", category: "classic" },
  { pageTitle: "The Ambassadors (Holbein)", titleKo: "대사들", artistKo: "한스 홀바인", artistEn: "Hans Holbein the Younger", category: "classic" }
];

const MAX_PRIORITY_DOWNLOADS = 36;

const COMMONS_FILLERS = [
  { categoryTitle: "Category:Paintings_by_Rembrandt", category: "classic" },
  { categoryTitle: "Category:Paintings_by_Sandro_Botticelli", category: "classic" },
  { categoryTitle: "Category:Paintings_by_Peter_Paul_Rubens", category: "classic" },
  { categoryTitle: "Category:Paintings_by_Johannes_Vermeer", category: "classic" },
  { categoryTitle: "Category:Ukiyo-e", category: "pop" },
  { categoryTitle: "Category:Paintings_by_Edgar_Degas", category: "impression" },
  { categoryTitle: "Category:Paintings_by_Claude_Monet", category: "impression" },
  { categoryTitle: "Category:Paintings_by_Vincent_van_Gogh", category: "impression" },
  { categoryTitle: "Category:Paintings_by_Pierre-Auguste_Renoir", category: "impression" },
  { categoryTitle: "Category:Paintings_by_John_William_Waterhouse", category: "modern" },
  { categoryTitle: "Category:Paintings_by_William-Adolphe_Bouguereau", category: "modern" },
  { categoryTitle: "Category:PD-Art (PD-old)", category: "classic" },
  { categoryTitle: "Category:PD-Art (PD-old-100)", category: "classic" }
];

const STYLE_PRESETS = [
  {
    id: "style-andy-warhol",
    titleKo: "앤디 워홀 스타일 가이드",
    titleEn: "Andy Warhol Style Guide",
    artistKo: "앤디 워홀",
    artistEn: "Andy Warhol",
    category: "pop",
    cardTitle: "ANDY WARHOL",
    cardSubtitle: "스타일 프리셋\n(저작권 보호용 가이드 카드)",
    colorA: "#ff4d4d",
    colorB: "#ffd43b"
  },
  {
    id: "style-kian84",
    titleKo: "기안84 스타일 가이드",
    titleEn: "Kian84 Style Guide",
    artistKo: "기안84",
    artistEn: "Kian84",
    category: "modern",
    cardTitle: "KIAN84",
    cardSubtitle: "스타일 프리셋\n(저작권 보호용 가이드 카드)",
    colorA: "#0ea5e9",
    colorB: "#22c55e"
  },
  {
    id: "style-lee-jung-seob",
    titleKo: "이중섭 스타일 가이드",
    titleEn: "Lee Jung-seob Style Guide",
    artistKo: "이중섭",
    artistEn: "Lee Jung-seob",
    category: "modern",
    cardTitle: "LEE JUNG-SEOB",
    cardSubtitle: "스타일 프리셋\n(저작권 보호용 가이드 카드)",
    colorA: "#7c3aed",
    colorB: "#f97316"
  }
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toDisplayTitle(pageTitle) {
  return String(pageTitle || "").replace(/_/g, " ").trim();
}

function titleLooksLikeArtwork(description) {
  const lower = String(description || "").toLowerCase();
  return /(painting|fresco|altarpiece|triptych|woodblock|print|etching|oil on|tempera)/.test(lower);
}

function parseArtistFromDescription(description) {
  const raw = String(description || "");
  const match = raw.match(/\b(?:painting|fresco|woodblock print|print|etching|altarpiece|triptych)\s+by\s+([^,.;]+)/i);
  if (!match) {
    return "";
  }
  return String(match[1] || "").trim();
}

async function fetchWithRetry(url, retries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json,text/plain,*/*"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const waitMs = 250 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError || new Error("network request failed");
}

async function fetchJson(url) {
  const res = await fetchWithRetry(url, 3);
  return res.json();
}

async function fetchPageSummary(pageTitle) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  return fetchJson(url);
}

async function fetchPageImageUrl(pageTitle) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}` +
    "&prop=pageimages&pithumbsize=1400&format=json&origin=*";
  const json = await fetchJson(url);
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0] || {};
  return String(page?.thumbnail?.source || "").trim();
}

async function fetchKoTitle(pageTitle) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}` +
    "&prop=langlinks&lllang=ko&lllimit=1&format=json&origin=*";
  const json = await fetchJson(url);
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0] || {};
  const langlinks = Array.isArray(page?.langlinks) ? page.langlinks : [];
  if (!langlinks.length) {
    return "";
  }
  return String(langlinks[0]["*"] || "").trim();
}

function stripHtml(raw) {
  return String(raw || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeMetadataText(raw, maxLength = 120) {
  let value = stripHtml(raw)
    .replace(/title QS:[\\s\\S]*$/i, "")
    .replace(/label QS:[\\s\\S]*$/i, "")
    .replace(/\\s{2,}/g, " ")
    .trim();

  if (!value) {
    return "";
  }

  if (value.length > maxLength) {
    value = `${value.slice(0, maxLength).trim()}...`;
  }

  return value;
}

async function fetchCommonsFileBatch(categoryTitle, continueTokens = {}) {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categoryTitle,
    gcmtype: "file",
    gcmlimit: "50",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1200",
    format: "json"
  });

  if (continueTokens.gcmcontinue) {
    params.set("gcmcontinue", continueTokens.gcmcontinue);
    params.set("continue", continueTokens.continue || "gcmcontinue||");
  }

  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const json = await fetchJson(url);
  const pages = Object.values(json?.query?.pages || {});
  const nextToken = {
    gcmcontinue: String(json?.continue?.gcmcontinue || "").trim(),
    continue: String(json?.continue?.continue || "").trim()
  };
  return { pages, nextToken };
}

async function downloadToFile(url, filepath) {
  let lastError = null;

  for (let attempt = 1; attempt <= 1; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const declaredLength = Number(res.headers.get("content-length") || "0");
      if (declaredLength > 18 * 1024 * 1024) {
        throw new Error("file too large");
      }

      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > 18 * 1024 * 1024) {
        throw new Error("file too large");
      }

      await fs.writeFile(filepath, data);
      clearTimeout(timeoutId);
      return;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const waitMs = 250 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError || new Error("download failed");
}

async function createStyleCardSvg({ filepath, title, subtitle, colorA, colorB }) {
  const svg = [
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"900\" viewBox=\"0 0 1200 900\">",
    "  <defs>",
    `    <linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">`,
    `      <stop offset=\"0%\" stop-color=\"${colorA}\"/>`,
    `      <stop offset=\"100%\" stop-color=\"${colorB}\"/>`,
    "    </linearGradient>",
    "    <pattern id=\"dots\" width=\"28\" height=\"28\" patternUnits=\"userSpaceOnUse\">",
    "      <circle cx=\"4\" cy=\"4\" r=\"2\" fill=\"rgba(255,255,255,0.28)\"/>",
    "    </pattern>",
    "  </defs>",
    "  <rect width=\"1200\" height=\"900\" fill=\"url(#g)\"/>",
    "  <rect width=\"1200\" height=\"900\" fill=\"url(#dots)\"/>",
    "  <rect x=\"78\" y=\"78\" width=\"1044\" height=\"744\" rx=\"24\" fill=\"rgba(0,0,0,0.18)\" stroke=\"rgba(255,255,255,0.44)\" stroke-width=\"3\"/>",
    `  <text x=\"110\" y=\"300\" fill=\"#ffffff\" font-size=\"88\" font-family=\"Pretendard, Arial, sans-serif\" font-weight=\"800\">${title}</text>`,
    `  <text x=\"110\" y=\"390\" fill=\"rgba(255,255,255,0.95)\" font-size=\"42\" font-family=\"Pretendard, Arial, sans-serif\" font-weight=\"600\">${subtitle.split("\\n").join(" ")}</text>`,
    "  <text x=\"110\" y=\"770\" fill=\"rgba(255,255,255,0.85)\" font-size=\"28\" font-family=\"Pretendard, Arial, sans-serif\">Local preset card (no remote image dependency)</text>",
    "</svg>"
  ].join("\n");

  await fs.writeFile(filepath, svg, "utf8");
}

function toArtworkEntry({ id, titleKo, titleEn, artistKo, artistEn, category, imagePath }) {
  return {
    id,
    titleKo,
    titleEn,
    artistKo,
    artistEn,
    category,
    imageUrl: imagePath
  };
}

function toJsFileContent(entries) {
  const json = JSON.stringify(entries, null, 2);
  return `window.__MASTERPIECES_LOCAL__ = ${json};\n`;
}

async function buildDownloadedEntry(spec, usedIds, usedPages) {
  const pageTitle = String(spec.pageTitle || "").trim();
  if (!pageTitle) {
    return null;
  }

  const pageKey = pageTitle.toLowerCase();
  if (usedPages.has(pageKey)) {
    return null;
  }

  let summary;
  try {
    summary = await fetchPageSummary(pageTitle);
  } catch {
    return null;
  }

  const normalizedTitleEn = String(summary?.title || toDisplayTitle(pageTitle)).trim();
  const description = String(summary?.description || "").trim();

  if (!titleLooksLikeArtwork(description)) {
    return null;
  }

  let imageSource = "";
  try {
    imageSource = await fetchPageImageUrl(pageTitle);
  } catch {
    imageSource = "";
  }

  if (!imageSource) {
    imageSource = String(summary?.thumbnail?.source || summary?.originalimage?.source || "").trim();
  }

  if (!imageSource) {
    return null;
  }

  let id = slugify(spec.id || pageTitle);
  if (!id) {
    return null;
  }

  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${slugify(spec.id || pageTitle)}-${suffix}`;
    suffix += 1;
  }

  const finalPath = path.join(OUT_DIR, `${id}.jpg`);

  try {
    await downloadToFile(imageSource, finalPath);
  } catch {
    await fs.rm(finalPath, { force: true });
    return null;
  }

  let titleKo = String(spec.titleKo || "").trim();
  if (!titleKo) {
    try {
      titleKo = await fetchKoTitle(pageTitle);
    } catch {
      titleKo = "";
    }
  }
  if (!titleKo) {
    titleKo = normalizedTitleEn;
  }

  const inferredArtistEn = parseArtistFromDescription(description);
  const artistEn = String(spec.artistEn || inferredArtistEn || "Unknown").trim();
  const artistKo = String(spec.artistKo || artistEn || "작가 미상").trim();

  usedIds.add(id);
  usedPages.add(pageKey);

  return toArtworkEntry({
    id,
    titleKo,
    titleEn: normalizedTitleEn,
    artistKo,
    artistEn,
    category: String(spec.category || "classic"),
    imagePath: `./assets/artworks/${id}.jpg`
  });
}

async function buildCommonsDownloadedEntry(source, page, usedIds) {
  const imageInfo = page?.imageinfo?.[0];
  if (!imageInfo) {
    return null;
  }

  const mime = String(imageInfo?.mime || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    return null;
  }

  const extMetadata = imageInfo?.extmetadata || {};
  const license = stripHtml(extMetadata?.LicenseShortName?.value || "");
  if (license && !/(public domain|cc0)/i.test(license)) {
    return null;
  }

  const sourceUrl = String(imageInfo?.thumburl || "").trim();
  if (!sourceUrl) {
    return null;
  }

  const fileTitle = String(page?.title || "").replace(/^File:/, "").trim();
  if (/\.(tif|tiff|pdf|svg)$/i.test(fileTitle)) {
    return null;
  }
  let id = slugify(fileTitle);
  if (!id) {
    return null;
  }

  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${slugify(fileTitle)}-${suffix}`;
    suffix += 1;
  }

  const finalPath = path.join(OUT_DIR, `${id}.jpg`);

  try {
    await downloadToFile(sourceUrl, finalPath);
  } catch {
    await fs.rm(finalPath, { force: true });
    return null;
  }

  const objectName = sanitizeMetadataText(extMetadata?.ObjectName?.value || "", 120);
  const artistRaw = sanitizeMetadataText(extMetadata?.Artist?.value || "", 80);
  const fallbackTitle = toDisplayTitle(fileTitle.replace(/\.[a-z0-9]+$/i, ""));
  const titleEn = objectName || fallbackTitle;
  const artistEn = artistRaw || "Unknown";

  usedIds.add(id);

  return toArtworkEntry({
    id,
    titleKo: titleEn,
    titleEn,
    artistKo: artistEn,
    artistEn,
    category: source.category,
    imagePath: `./assets/artworks/${id}.jpg`
  });
}

async function buildStylePresetEntries() {
  const entries = [];

  for (const preset of STYLE_PRESETS) {
    const filepath = path.join(OUT_DIR, `${preset.id}.svg`);
    await createStyleCardSvg({
      filepath,
      title: preset.cardTitle,
      subtitle: preset.cardSubtitle,
      colorA: preset.colorA,
      colorB: preset.colorB
    });

    entries.push(
      toArtworkEntry({
        id: preset.id,
        titleKo: preset.titleKo,
        titleEn: preset.titleEn,
        artistKo: preset.artistKo,
        artistEn: preset.artistEn,
        category: preset.category,
        imagePath: `./assets/artworks/${preset.id}.svg`
      })
    );
  }

  return entries;
}

async function main() {
  console.log("[build] local artwork build started");

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const usedIds = new Set();
  const usedPages = new Set();
  const downloadedEntries = [];
  const commonsSeenFiles = new Set();

  for (const spec of PRIORITY_WORKS) {
    if (downloadedEntries.length >= MAX_PRIORITY_DOWNLOADS || downloadedEntries.length >= TARGET_DOWNLOADED) {
      break;
    }

    const entry = await buildDownloadedEntry(spec, usedIds, usedPages);
    if (!entry) {
      continue;
    }

    downloadedEntries.push(entry);
    console.log(`[build] downloaded ${downloadedEntries.length}/${TARGET_DOWNLOADED}: ${entry.titleEn}`);
  }

  for (const source of COMMONS_FILLERS) {
    if (downloadedEntries.length >= TARGET_DOWNLOADED) {
      break;
    }

    let continueToken = { gcmcontinue: "", continue: "" };
    let guard = 0;

    while (downloadedEntries.length < TARGET_DOWNLOADED) {
      if (guard > 50) {
        break;
      }
      guard += 1;

      let pages = [];
      try {
        const batch = await fetchCommonsFileBatch(source.categoryTitle, continueToken);
        pages = batch.pages;
        continueToken = batch.nextToken;
      } catch {
        pages = [];
        continueToken = { gcmcontinue: "", continue: "" };
      }

      if (!pages.length) {
        break;
      }

      for (const page of pages) {
        if (downloadedEntries.length >= TARGET_DOWNLOADED) {
          break;
        }

        const fileKey = String(page?.title || "").toLowerCase();
        if (!fileKey || commonsSeenFiles.has(fileKey)) {
          continue;
        }
        commonsSeenFiles.add(fileKey);

        const entry = await buildCommonsDownloadedEntry(source, page, usedIds);
        if (!entry) {
          continue;
        }

        downloadedEntries.push(entry);
        console.log(`[build] downloaded ${downloadedEntries.length}/${TARGET_DOWNLOADED}: ${entry.titleEn}`);
      }

      if (!continueToken.gcmcontinue) {
        break;
      }
    }
  }

  if (downloadedEntries.length < TARGET_DOWNLOADED) {
    throw new Error(`다운로드된 작품 수 부족: ${downloadedEntries.length}/${TARGET_DOWNLOADED}`);
  }

  const styleEntries = await buildStylePresetEntries();
  if (styleEntries.length !== STYLE_PRESET_COUNT) {
    throw new Error(`스타일 프리셋 개수 오류: ${styleEntries.length}`);
  }

  const finalEntries = [...downloadedEntries, ...styleEntries].slice(0, TARGET_TOTAL);

  if (finalEntries.length !== TARGET_TOTAL) {
    throw new Error(`최종 작품 수 오류: ${finalEntries.length}/${TARGET_TOTAL}`);
  }

  await fs.writeFile(DATA_FILE, toJsFileContent(finalEntries), "utf8");

  const countByCategory = finalEntries.reduce((acc, item) => {
    const key = item.category || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log("[build] completed");
  console.log(`[build] output: ${DATA_FILE}`);
  console.log(`[build] total entries: ${finalEntries.length}`);
  console.log(`[build] category split: ${JSON.stringify(countByCategory)}`);
}

main().catch((error) => {
  console.error("[build] failed:", error.message);
  process.exit(1);
});
