// ===== STORAGE SHIM =====
// When this file is opened directly (file:// or a plain webpage) instead of
// being loaded as an installed extension, `chrome.storage` does not exist and
// the whole script would otherwise throw immediately, leaving a blank page.
// This shim provides a drop-in localStorage-backed replacement so the page
// still works for quick local previews. Inside the real extension, the real
// chrome.storage.local API is untouched and used as-is.
if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
  const LS_PREFIX = "designtab_";
  window.chrome = window.chrome || {};
  chrome.storage = {
    local: {
      get(keys, callback) {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : keys ? [keys] : Object.keys(localStorage)
          .filter((k) => k.startsWith(LS_PREFIX))
          .map((k) => k.slice(LS_PREFIX.length));
        keyList.forEach((key) => {
          const raw = localStorage.getItem(LS_PREFIX + key);
          if (raw !== null) {
            try { result[key] = JSON.parse(raw); } catch { result[key] = raw; }
          }
        });
        callback(result);
      },
      set(items, callback) {
        Object.entries(items).forEach(([key, value]) => {
          localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
        });
        if (callback) callback();
      },
      remove(keys, callback) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((key) => localStorage.removeItem(LS_PREFIX + key));
        if (callback) callback();
      },
    },
  };
  console.warn("DesignTab: running outside the extension context — using localStorage fallback for storage.");
}

// ===== DOM ELEMENTS =====
const bgOverlay = document.getElementById("bg-overlay");
const shortcutContainer = document.getElementById("shortcut-container");
const addBtn = document.getElementById("add-btn");
const bgCustomizeBtn = document.getElementById("bg-customize-btn");
const fileInput = document.getElementById("file-input");
const categorySections = document.getElementById("category-sections");

// Modals
const addModalOverlay = document.getElementById("add-modal-overlay");
const bgModalOverlay = document.getElementById("bg-modal-overlay");
const modalCloseAdd = document.getElementById("modal-close-add");
const modalCloseBg = document.getElementById("modal-close-bg");
const btnCancelAdd = document.getElementById("btn-cancel-add");
const btnSaveAdd = document.getElementById("btn-save-add");
const shortcutNameInput = document.getElementById("shortcut-name");
const shortcutUrlInput = document.getElementById("shortcut-url");
const shortcutCategorySelect = document.getElementById("shortcut-category");
const cselWrap = document.getElementById("csel-wrap");
const cselTrigger = document.getElementById("csel-trigger");
const cselSelIcon = document.getElementById("csel-sel-icon");
const cselSelText = document.getElementById("csel-sel-text");
const cselOptions = document.querySelectorAll(".csel-option");

const customCategoryWrap = document.getElementById("custom-category-wrap");
const customCategoryNameInput = document.getElementById("custom-category-name");
const autoDetectBadge = document.getElementById("auto-detect-badge");

// BG options
const bgUploadBtn = document.getElementById("bg-upload-btn");
const bgUrlBtn = document.getElementById("bg-url-btn");
const bgPexelsBtn = document.getElementById("bg-pexels-btn");
const bgPicsumBtn = document.getElementById("bg-picsum-btn");
const bgResetBtn = document.getElementById("bg-reset-btn");
const bgUrlInputWrap = document.getElementById("bg-url-input-wrap");
const bgUrlInput = document.getElementById("bg-url-input");
const bgUrlApply = document.getElementById("bg-url-apply");

// Picsum elements (free, no API key required)
const picsumGalleryWrap = document.getElementById("picsum-gallery-wrap");
const picsumGrid = document.getElementById("picsum-grid");
const picsumLoading = document.getElementById("picsum-loading");
const picsumLoadMore = document.getElementById("picsum-load-more");
let picsumPage = 1;
let picsumLoading_ = false;

// Pexels elements
const pexelsGalleryWrap = document.getElementById("pexels-gallery-wrap");
const pexelsSearchInput = document.getElementById("pexels-search-input");
const pexelsGrid = document.getElementById("pexels-grid");
const pexelsLoading = document.getElementById("pexels-loading");
const pexelsLoadMore = document.getElementById("pexels-load-more");
const pexelsChips = document.getElementById("pexels-chips");

// Context Menu
const contextMenu = document.getElementById("context-menu");
const ctxEdit = document.getElementById("ctx-edit");
const ctxDelete = document.getElementById("ctx-delete");
const ctxMoveUp = document.getElementById("ctx-move-up");
const ctxMoveDown = document.getElementById("ctx-move-down");

// Global Labels Toggle (bottom-left toggle button)
const lgtSwitch = document.getElementById("lgt-switch");
const globalLabelText = document.getElementById("global-label-text");
let labelsVisible = true;

// Auto-change DOM elements
const bgAutoNewtabBtn = document.getElementById("bg-auto-newtab-btn");
const bgTimerBtn = document.getElementById("bg-timer-btn");
const autoNewtabIndicator = document.getElementById("auto-newtab-indicator");
const timerIndicator = document.getElementById("timer-indicator");

// ===== STATE =====
let activeContextIndex = -1;
let activeContextSource = "top";
let editMode = false;
let editIndex = -1;
let editSource = "top";

// Drag & Drop
let dragSrcIndex = null;
let dragSrcCategory = null; // "top" or category name

// ===== PEXELS API CONFIG =====
const PEXELS_API_KEY = "zgtWMxBq6MxxvNCHYwbKqJsfMzi086aO1ImX61aeHpIJ69fAAvgnWE8c";
let pexelsPage = 1;
let pexelsQuery = "nature";
let pexelsLoading_ = false;
let timerInterval = null;

// ===== DEFAULT SHORTCUTS (top bar) =====
const DEFAULT_SHORTCUTS = [
  { name: "Google", url: "https://www.google.com" },
  { name: "YouTube", url: "https://www.youtube.com" },
  { name: "Gmail", url: "https://mail.google.com" },
];

// ===== DEFAULT CATEGORY GROUPS (bottom-right sections, shown on first run) =====
const DEFAULT_CATEGORY_LINKS = {
  "Google": [
    { name: "Google", url: "https://www.google.com" },
    { name: "Gmail", url: "https://mail.google.com" },
    { name: "YouTube", url: "https://www.youtube.com" },
    { name: "Drive", url: "https://drive.google.com" },
    { name: "Maps", url: "https://maps.google.com" },
  ],
  "AI Tools": [
    { name: "ChatGPT", url: "https://chat.openai.com" },
    { name: "Claude", url: "https://claude.ai" },
    { name: "Gemini", url: "https://gemini.google.com" },
    { name: "Perplexity", url: "https://www.perplexity.ai" },
    { name: "Copilot", url: "https://copilot.microsoft.com" },
    { name: "Grok", url: "https://grok.com" },
    { name: "DeepSeek", url: "https://www.deepseek.com" },
  ],
};

// ===== AUTO-DETECT CATEGORY DATABASE =====
const SITE_CATEGORIES = {
  // Design
  figma: "Design", dribbble: "Design", behance: "Design", adobe: "Design",
  sketch: "Design", framer: "Design", invisionapp: "Design", zeplin: "Design",
  canva: "Design", coolors: "Design", unsplash: "Design", pexels: "Design",
  colorhunt: "Design", fontpair: "Design", webflow: "Design", squarespace: "Design",
  awwwards: "Design", csszengarden: "Design", uimovement: "Design", lottiefiles: "Design",
  spline: "Design", rive: "Design", principles: "Design",

  // Coding
  github: "Coding", gitlab: "Coding", stackoverflow: "Coding", codepen: "Coding",
  codesandbox: "Coding", vercel: "Coding", netlify: "Coding", heroku: "Coding",
  npmjs: "Coding", replit: "Coding", leetcode: "Coding", hackerrank: "Coding",
  bitbucket: "Coding", dev: "Coding", hashnode: "Coding", medium: "Coding",
  codeforces: "Coding", atcoder: "Coding", jsfiddle: "Coding", glitch: "Coding",
  railway: "Coding", render: "Coding", supabase: "Coding", firebase: "Coding",
  digitalocean: "Coding", aws: "Coding", azure: "Coding", cloudflare: "Coding",
  mongodb: "Coding", postgresql: "Coding",

  // Icons
  flaticon: "Icons", icons8: "Icons", iconify: "Icons", iconfinder: "Icons",
  fontawesome: "Icons", heroicons: "Icons", phosphoricons: "Icons", remixicon: "Icons",
  tabler: "Icons", lucide: "Icons", svgrepo: "Icons", iconmonstr: "Icons",
  simpleicons: "Icons", boxicons: "Icons", ionicons: "Icons",

  // Social
  twitter: "Social", x: "Social", facebook: "Social", instagram: "Social",
  linkedin: "Social", reddit: "Social", discord: "Social", telegram: "Social",
  whatsapp: "Social", snapchat: "Social", pinterest: "Social", tumblr: "Social",
  tiktok: "Social", mastodon: "Social", threads: "Social",

  // Productivity
  notion: "Productivity", trello: "Productivity", jira: "Productivity",
  slack: "Productivity", zoom: "Productivity", meet: "Productivity",
  asana: "Productivity", todoist: "Productivity", clickup: "Productivity",
  airtable: "Productivity", evernote: "Productivity", obsidian: "Productivity",
  miro: "Productivity", confluence: "Productivity", basecamp: "Productivity",

  // Entertainment
  youtube: "Entertainment", netflix: "Entertainment", spotify: "Entertainment",
  twitch: "Entertainment", primevideo: "Entertainment", disneyplus: "Entertainment",
  hulu: "Entertainment", crunchyroll: "Entertainment", soundcloud: "Entertainment",
  deezer: "Entertainment", vimeo: "Entertainment", dailymotion: "Entertainment",

  //games
  chess: "Games", lichess: "Games", chesscom: "Games",

  // AI Tools
  openai: "AI Tools", chatgpt: "AI Tools", claude: "AI Tools", anthropic: "AI Tools",
  gemini: "AI Tools", perplexity: "AI Tools", copilot: "AI Tools", grok: "AI Tools",
  deepseek: "AI Tools", "meta.ai": "AI Tools", huggingface: "AI Tools", midjourney: "AI Tools",
  poe: "AI Tools", character: "AI Tools", groq: "AI Tools", mistral: "AI Tools",
};

function autoDetectCategory(url) {
  try {
    let formatted = url.trim();
    if (!formatted.includes("://")) formatted = "https://" + formatted;
    const hostname = new URL(formatted).hostname.replace("www.", "").toLowerCase();
    // Try exact domain match
    for (const [key, cat] of Object.entries(SITE_CATEGORIES)) {
      if (hostname === key + ".com" || hostname === key + ".io" ||
          hostname === key + ".org" || hostname === key + ".net" ||
          hostname.startsWith(key + ".") || hostname === key) {
        return cat;
      }
    }
    // Partial match (domain contains keyword)
    for (const [key, cat] of Object.entries(SITE_CATEGORIES)) {
      if (hostname.includes(key)) return cat;
    }
  } catch {}
  return null; // unknown
}

// ===== CATEGORY METADATA =====
const CATEGORY_META = {
  Design:        { emoji: "🎨", color: "#a78bfa", colorLight: "#7c3aed", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
  Coding:        { emoji: "💻", color: "#60a5fa", colorLight: "#2563eb", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)"  },
  Icons:         { emoji: "🔷", color: "#34d399", colorLight: "#059669", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  },
  Social:        { emoji: "🌐", color: "#f472b6", colorLight: "#db2777", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.3)" },
  Productivity:  { emoji: "✅", color: "#fbbf24", colorLight: "#b45309", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  Entertainment: { emoji: "🎬", color: "#f87171", colorLight: "#dc2626", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
  "Google":      { emoji: "🔍", color: "#4285F4", colorLight: "#1a56db", bg: "rgba(66,133,244,0.12)",  border: "rgba(66,133,244,0.3)"  },
  "AI Tools":    { emoji: "🤖", color: "#22d3ee", colorLight: "#0e7490", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)"  },
};

function getCategoryMeta(cat, light) {
  if (CATEGORY_META[cat]) {
    const m = CATEGORY_META[cat];
    return { ...m, color: light ? m.colorLight : m.color };
  }
  // Renamed or custom groups fall back to a hash-derived hue. Dark mode
  // wants a bright pastel; light mode needs much lower lightness or the
  // text disappears against the light glass panel.
  const hues = [30, 60, 200, 280, 320, 180, 140];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash += cat.charCodeAt(i);
  const h = hues[hash % hues.length];
  const l = light ? 34 : 65;
  const s = light ? 80 : 70;
  return {
    emoji: "⭐",
    color: `hsl(${h},${s}%,${l}%)`,
    bg: `hsla(${h},70%,55%,0.12)`,
    border: `hsla(${h},70%,55%,0.3)`,
  };
}

// ===== GLOBAL LABEL TOGGLE =====
function updateGlobalLabelUI() {
  if (labelsVisible) {
    globalLabelText.textContent = "LABELS ON";
    lgtSwitch.setAttribute("aria-checked", "true");
  } else {
    globalLabelText.textContent = "LABELS OFF";
    lgtSwitch.setAttribute("aria-checked", "false");
  }
}

function applyLabelsToDOM() {
  document.querySelectorAll(".tile-label").forEach((el) => {
    el.classList.toggle("tile-label-hidden", !labelsVisible);
  });
}

lgtSwitch.addEventListener("click", () => {
  labelsVisible = !labelsVisible;
  chrome.storage.local.set({ labelsVisible });
  updateGlobalLabelUI();
  applyLabelsToDOM();
  showToast(labelsVisible ? "Labels shown" : "Labels hidden");
});

// ===== LIGHT / DARK THEME TOGGLE =====
const themeSwitch = document.getElementById("theme-switch");
const themeLabelText = document.getElementById("theme-label-text");
let lightMode = false;

function applyTheme() {
  document.body.classList.toggle("light-mode", lightMode);
  themeSwitch.setAttribute("aria-checked", lightMode ? "true" : "false");
  themeLabelText.textContent = lightMode ? "LIGHT" : "DARK";
}

themeSwitch.addEventListener("click", () => {
  lightMode = !lightMode;
  chrome.storage.local.set({ lightMode });
  applyTheme();
  showToast(lightMode ? "Light mode on" : "Dark mode on");
  // Category title colors are theme-aware (see getCategoryMeta) since
  // they're set as inline styles — CSS alone can't retint them.
  chrome.storage.local.get(["categoryLinks"], (data) => {
    if (data.categoryLinks) renderAllCategories(data.categoryLinks);
  });
});

// ===== INITIALIZATION =====
function init() {
  chrome.storage.local.get(["customBg", "links", "categoryLinks", "autoNewTab", "bgTimer", "labelsVisible", "lightMode"], (data) => {
    labelsVisible = data.labelsVisible !== false;
    updateGlobalLabelUI();

    lightMode = !!data.lightMode;
    applyTheme();

    if (data.autoNewTab) { bgAutoNewtabBtn.classList.add("active"); autoNewtabIndicator.classList.add("on"); }
    if (data.bgTimer) { bgTimerBtn.classList.add("active"); timerIndicator.classList.add("on"); startBgTimer(); }

    if (data.autoNewTab) fetchRandomPexelsWallpaper();
    else if (data.customBg) bgOverlay.style.backgroundImage = `url(${data.customBg})`;
    else bgOverlay.style.backgroundColor = "#0a0a0f";

    const links = data.links || DEFAULT_SHORTCUTS;
    renderShortcuts(links);

    // First run (categoryLinks key never saved before) → seed default groups.
    // Once the user saves anything (even an empty object after deleting all),
    // we respect their choice and stop reseeding.
    if (data.categoryLinks === undefined) {
      chrome.storage.local.set({ categoryLinks: DEFAULT_CATEGORY_LINKS }, () => {
        renderAllCategories(DEFAULT_CATEGORY_LINKS);
      });
    } else {
      renderAllCategories(data.categoryLinks || {});
    }
  });
}

// ===== FETCH RANDOM PEXELS WALLPAPER =====
const RANDOM_CATEGORIES_LIST = ["technology dark","coding setup","circuit board","server room","cybersecurity","abstract technology","dark minimal desktop","neon technology","programming code","data center","futuristic city","digital network","space universe","dark architecture","geometric abstract"];

async function fetchRandomPexelsWallpaper() {
  try {
    const randomCat = RANDOM_CATEGORIES_LIST[Math.floor(Math.random() * RANDOM_CATEGORIES_LIST.length)];
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomCat)}&orientation=landscape&per_page=15&page=${randomPage}`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);
    const data = await response.json();
    const photos = data.photos || [];
    if (photos.length > 0) {
      const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
      const hdUrl = randomPhoto.src.landscape || randomPhoto.src.large2x || randomPhoto.src.original;
      chrome.storage.local.set({ customBg: hdUrl }, () => { bgOverlay.style.backgroundImage = `url(${hdUrl})`; });
    }
  } catch (error) {
    console.error("Auto Pexels fetch error:", error);
    chrome.storage.local.get(["customBg"], (d) => {
      if (d.customBg) bgOverlay.style.backgroundImage = `url(${d.customBg})`;
      else bgOverlay.style.backgroundColor = "#0a0a0f";
    });
  }
}

// ===== RENDER TOP BAR SHORTCUTS =====
function renderShortcuts(links) {
  shortcutContainer.innerHTML = "";
  links.forEach((link, index) => {
    const tile = createTile(link, index, "top");
    tile.setAttribute("draggable", "true");
    setupTopBarDrag(tile, index);
    shortcutContainer.appendChild(tile);
  });

  // Drop zone at end of top bar
  shortcutContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    const afterEl = getDragAfterElement(shortcutContainer, e.clientX, ".tile-wrapper");
    const dragging = shortcutContainer.querySelector(".dragging");
    if (dragging) {
      if (!afterEl) shortcutContainer.appendChild(dragging);
      else shortcutContainer.insertBefore(dragging, afterEl);
    }
  });

  refreshBookmarksPanel();
}

// ===== RENDER ALL CATEGORY SECTIONS =====
function renderAllCategories(categoryLinks) {
  chrome.storage.local.get(["pinnedCategories", "categoryColors"], (data) => {
    const pinned = data.pinnedCategories || [];
    const colors = data.categoryColors || {};
    buildCategorySections(categoryLinks, pinned, colors);
  });
}

// hsl(h,s%,l%) -> #rrggbb, so the native <input type="color"> swatch (which
// only accepts hex) can show the current auto-generated color as a starting point.
function colorToHex(color) {
  if (color.startsWith("#")) return color;
  const m = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!m) return "#ffffff";
  let [h, s, l] = [+m[1], +m[2] / 100, +m[3] / 100];
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function buildCategorySections(categoryLinks, pinned, colors) {
  categorySections.innerHTML = "";
  const cats = Object.keys(categoryLinks);
  if (cats.length === 0) { refreshBookmarksPanel(); return; }

  cats.forEach((cat) => {
    const links = categoryLinks[cat];
    if (!links || links.length === 0) return;
    const meta = getCategoryMeta(cat, lightMode);
    const isPinned = pinned.includes(cat);
    const customColor = colors[cat];
    const titleColor = customColor || meta.color;

    const section = document.createElement("div");
    section.className = "cat-section" + (isPinned ? " pinned" : "");
    section.setAttribute("data-category", cat);

    const header = document.createElement("div");
    header.className = "cat-header";

    const emoji = document.createElement("span");
    emoji.className = "cat-emoji";
    emoji.textContent = meta.emoji;

    const title = document.createElement("span");
    title.className = "cat-title";
    title.style.color = titleColor;
    title.textContent = cat;
    title.title = "Click to rename";

    const actions = document.createElement("div");
    actions.className = "cat-actions";
    actions.innerHTML = `
      <label class="cat-action-btn cat-color-btn${customColor ? " active" : ""}" title="Custom title color (double-click to reset)" style="color:${titleColor}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>
        <input type="color" class="cat-color-input" value="${colorToHex(titleColor)}" tabindex="-1" />
      </label>
      <button class="cat-action-btn cat-pin-btn${isPinned ? " active" : ""}" title="${isPinned ? "Unpin (allow collapse)" : "Pin (keep always open)"}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="${isPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 9 M8 9 L16 9 L18 13 L6 13 Z M12 13 L12 22"></path></svg>
      </button>
      <button class="cat-action-btn cat-rename-btn" title="Rename group">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
      </button>
      <button class="cat-action-btn cat-delete-btn" title="Delete group">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;

    header.appendChild(emoji);
    header.appendChild(title);
    header.appendChild(actions);
    section.appendChild(header);

    const collapse = document.createElement("div");
    collapse.className = "cat-collapse";

    const grid = document.createElement("div");
    grid.className = "cat-grid";
    grid.setAttribute("data-category", cat);

    links.forEach((link, index) => {
      const tile = createTile(link, index, cat);
      tile.setAttribute("draggable", "true");
      setupCategoryDrag(tile, index, cat, grid);
      grid.appendChild(tile);
    });

    // Dragover for the grid container
    grid.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (dragSrcCategory !== cat) return; // only same-category
      const afterEl = getDragAfterElement(grid, e.clientX, ".tile-wrapper");
      const dragging = grid.querySelector(".dragging");
      if (dragging) {
        if (!afterEl) grid.appendChild(dragging);
        else grid.insertBefore(dragging, afterEl);
      }
      grid.classList.add("drag-over");
    });
    grid.addEventListener("dragleave", (e) => {
      if (!grid.contains(e.relatedTarget)) grid.classList.remove("drag-over");
    });
    grid.addEventListener("drop", (e) => {
      e.preventDefault();
      grid.classList.remove("drag-over");
      if (dragSrcCategory !== cat) return;
      // Get new order from DOM
      const newOrder = [...grid.querySelectorAll(".tile-wrapper")].map((el) => {
        return parseInt(el.getAttribute("data-orig-index"));
      });
      chrome.storage.local.get(["categoryLinks"], (res) => {
        const categoryLinks = res.categoryLinks || {};
        const oldLinks = categoryLinks[cat] || [];
        const reordered = newOrder.map((i) => oldLinks[i]).filter(Boolean);
        categoryLinks[cat] = reordered;
        chrome.storage.local.set({ categoryLinks }, () => {
          renderAllCategories(categoryLinks);
          showToast("Order saved!");
        });
      });
    });

    collapse.appendChild(grid);
    section.appendChild(collapse);
    categorySections.appendChild(section);
  });

  refreshBookmarksPanel();
}

// ===== DRAG AFTER ELEMENT HELPER =====
function getDragAfterElement(container, x, selector) {
  const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ===== TOP BAR DRAG =====
function setupTopBarDrag(tileWrapper, index) {
  tileWrapper.addEventListener("dragstart", (e) => {
    dragSrcIndex = index;
    dragSrcCategory = "top";
    tileWrapper.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
  });
  tileWrapper.addEventListener("dragend", () => {
    tileWrapper.classList.remove("dragging");
    // Persist new top-bar order
    const newOrder = [...shortcutContainer.querySelectorAll(".tile-wrapper")].map((el) =>
      parseInt(el.getAttribute("data-orig-index"))
    );
    chrome.storage.local.get(["links"], (res) => {
      const links = res.links || DEFAULT_SHORTCUTS;
      const reordered = newOrder.map((i) => links[i]).filter(Boolean);
      chrome.storage.local.set({ links: reordered }, () => {
        renderShortcuts(reordered);
      });
    });
  });
}

// ===== CATEGORY DRAG =====
function setupCategoryDrag(tileWrapper, index, cat, grid) {
  tileWrapper.addEventListener("dragstart", (e) => {
    dragSrcIndex = index;
    dragSrcCategory = cat;
    tileWrapper.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  tileWrapper.addEventListener("dragend", () => {
    tileWrapper.classList.remove("dragging");
    document.querySelectorAll(".cat-grid").forEach((g) => g.classList.remove("drag-over"));
  });
}

// ===== CREATE SHORTCUT TILE =====
function createTile(link, index, source) {
  const wrapper = document.createElement("div");
  wrapper.className = "tile-wrapper";
  wrapper.setAttribute("data-orig-index", index); // track original index for reorder

  const tile = document.createElement("button");
  tile.className = "shortcut-tile";
  const displayName = link.name || getDomainName(link.url);
  tile.setAttribute("data-name", displayName);
  tile.setAttribute("aria-label", displayName);

  // Data used by the global hover-preview card (see setupTilePreview)
  wrapper.dataset.previewName = displayName;
  wrapper.dataset.previewUrl = link.url;

  const icon = document.createElement("img");
  icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=64`;
  icon.alt = displayName;
  icon.onerror = () => {
    icon.style.display = "none";
    tile.textContent = displayName.charAt(0).toUpperCase();
    tile.style.fontSize = "16px";
    tile.style.fontWeight = "700";
    tile.style.color = "#333";
  };
  tile.appendChild(icon);

  const label = document.createElement("span");
  label.className = "tile-label" + (!labelsVisible ? " tile-label-hidden" : "");
  label.textContent = displayName;
  wrapper.appendChild(tile);
  wrapper.appendChild(label);

  // Left click: navigate
  tile.addEventListener("click", (e) => {
    if (e.button === 0) window.location.href = link.url;
  });

  // Right click: context menu
  tile.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeContextIndex = index;
    activeContextSource = source;
    showContextMenu(e.clientX, e.clientY, source, index);
  });

  return wrapper;
}

// ===== HELPER: Extract domain name =====
function getDomainName(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "").split(".")[0];
  } catch { return url; }
}

// ===== TOAST NOTIFICATION =====
function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// ===== AUTO-DETECT CATEGORY ON URL INPUT =====
let detectDebounce = null;
shortcutUrlInput.addEventListener("input", () => {
  clearTimeout(detectDebounce);
  detectDebounce = setTimeout(() => {
    const url = shortcutUrlInput.value.trim();
    if (url.length < 3) return;
    const detected = autoDetectCategory(url);
    if (detected) {
      // Only auto-fill if user hasn't manually changed it
      const currentVal = shortcutCategorySelect.value;
      // If it's still default (empty or same auto-detected), auto-fill
      if (!editMode || currentVal === "" || currentVal === detected) {
        setCategory(detected);
        autoDetectBadge.textContent = `Auto-detected: ${detected}`;
        autoDetectBadge.style.display = "flex";
      } else {
        // Already manually set, just show hint
        autoDetectBadge.textContent = `Suggested: ${detected}`;
        autoDetectBadge.style.display = "flex";
      }
    } else {
      autoDetectBadge.style.display = "none";
    }
  }, 400);
});

function setCategory(cat) {
  const known = ["Design", "Coding", "Icons", "Social", "Productivity", "Entertainment"];
  if (known.includes(cat)) {
    syncCustomSelectUI(cat);
  } else {
    syncCustomSelectUI("Custom");
    customCategoryNameInput.value = cat;
  }
}

// ===== CATEGORY SELECT (Custom UI) =====
cselTrigger.addEventListener("click", () => {
  cselWrap.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!cselWrap.contains(e.target)) {
    cselWrap.classList.remove("open");
  }
});

cselOptions.forEach(opt => {
  opt.addEventListener("click", () => {
    const val = opt.getAttribute("data-value");
    syncCustomSelectUI(val);
    cselWrap.classList.remove("open");
  });
});

function syncCustomSelectUI(val) {
  // Try to find exact known option
  let activeOpt = document.querySelector(`.csel-option[data-value="${val}"]`);
  
  // If it's a completely custom name that isn't empty, handle as Custom
  if (!activeOpt && val !== "") {
    activeOpt = document.querySelector('.csel-option[data-value="Custom"]');
    shortcutCategorySelect.value = "Custom";
    customCategoryWrap.style.display = "block";
    customCategoryNameInput.value = val;
  } else {
    shortcutCategorySelect.value = val || "";
    customCategoryWrap.style.display = val === "Custom" ? "block" : "none";
  }

  // Update visual UI
  cselOptions.forEach(o => o.classList.remove("csel-active"));
  if (activeOpt) {
    activeOpt.classList.add("csel-active");
    cselSelIcon.className = `fa-solid ${activeOpt.getAttribute("data-icon")} csel-sel-icon`;
    cselSelText.textContent = activeOpt.getAttribute("data-label");
  } else {
    // Fallback to None
    const defaultOpt = document.querySelector('.csel-option[data-value=""]');
    if (defaultOpt) defaultOpt.classList.add("csel-active");
    cselSelIcon.className = `fa-solid fa-minus csel-sel-icon`;
    cselSelText.textContent = "None (Top Bar)";
  }

  // Hide auto-detect badge on manual intervention
  autoDetectBadge.textContent = "";
  autoDetectBadge.style.display = "none";
}

// ===== ADD SHORTCUT MODAL =====
addBtn.addEventListener("click", () => {
  editMode = false;
  editIndex = -1;
  editSource = "top";
  shortcutNameInput.value = "";
  shortcutUrlInput.value = "";
  shortcutCategorySelect.value = "";
  syncCustomSelectUI("");
  customCategoryWrap.style.display = "none";
  customCategoryNameInput.value = "";
  autoDetectBadge.style.display = "none";
  document.querySelector("#add-modal-overlay .modal-header h3").textContent = "Add Shortcut";
  btnSaveAdd.textContent = "Add";
  openModal(addModalOverlay);
  setTimeout(() => shortcutNameInput.focus(), 100);
});

function openModal(overlay) {
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeModal(overlay) {
  overlay.classList.remove("active");
  setTimeout(() => (overlay.style.display = "none"), 300);
}

modalCloseAdd.addEventListener("click", () => closeModal(addModalOverlay));
btnCancelAdd.addEventListener("click", () => closeModal(addModalOverlay));

// Save shortcut
btnSaveAdd.addEventListener("click", () => {
  let url = shortcutUrlInput.value.trim();
  const name = shortcutNameInput.value.trim();
  let category = shortcutCategorySelect.value;

  if (!url) {
    shortcutUrlInput.style.borderColor = "rgba(239, 68, 68, 0.6)";
    shortcutUrlInput.focus();
    setTimeout(() => (shortcutUrlInput.style.borderColor = ""), 2000);
    return;
  }
  if (!url.includes("://")) url = "https://" + url;

  if (category === "Custom") {
    const cname = customCategoryNameInput.value.trim();
    if (!cname) {
      customCategoryNameInput.style.borderColor = "rgba(239, 68, 68, 0.6)";
      customCategoryNameInput.focus();
      setTimeout(() => (customCategoryNameInput.style.borderColor = ""), 2000);
      return;
    }
    category = cname;
  }

  const displayName = name || getDomainName(url);

  chrome.storage.local.get(["links", "categoryLinks"], (res) => {
    const links = res.links || DEFAULT_SHORTCUTS;
    const categoryLinks = res.categoryLinks || {};

    if (category === "") {
      // Top bar
      if (editMode && editSource === "top" && editIndex >= 0) {
        links[editIndex] = { name: displayName, url };
        showToast("Shortcut updated!");
      } else {
        links.push({ name: displayName, url });
        showToast("Shortcut added to top bar!");
      }
      chrome.storage.local.set({ links }, () => { renderShortcuts(links); closeModal(addModalOverlay); });
    } else {
      if (!categoryLinks[category]) categoryLinks[category] = [];
      if (editMode && editSource === category && editIndex >= 0) {
        categoryLinks[category][editIndex] = { name: displayName, url };
        showToast("Shortcut updated!");
      } else {
        categoryLinks[category].push({ name: displayName, url });
        showToast(`Added to "${category}"!`);
      }
      chrome.storage.local.set({ categoryLinks }, () => { renderAllCategories(categoryLinks); closeModal(addModalOverlay); });
    }
  });
});

shortcutUrlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSaveAdd.click(); });
shortcutNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") shortcutUrlInput.focus(); });

// ===== CONTEXT MENU =====
function showContextMenu(x, y, source, index) {
  // Show/hide move options based on context
  const isTopBar = source === "top";
  ctxMoveUp.style.display = "flex";
  ctxMoveDown.style.display = "flex";
  ctxMoveUp.querySelector("span").textContent = isTopBar ? "Move Left" : "Move Up";
  ctxMoveDown.querySelector("span").textContent = isTopBar ? "Move Right" : "Move Down";

  contextMenu.style.display = "block";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
  if (rect.bottom > window.innerHeight) contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
}

document.addEventListener("click", () => (contextMenu.style.display = "none"));

// Edit shortcut
ctxEdit.addEventListener("click", () => {
  contextMenu.style.display = "none";
  const src = activeContextSource;
  const idx = activeContextIndex;
  if (src === "top") {
    chrome.storage.local.get(["links"], (res) => {
      const link = (res.links || DEFAULT_SHORTCUTS)[idx];
      if (link) populateEditModal(link, idx, "top", "");
    });
  } else {
    chrome.storage.local.get(["categoryLinks"], (res) => {
      const link = ((res.categoryLinks || {})[src] || [])[idx];
      if (link) populateEditModal(link, idx, src, src);
    });
  }
});

function populateEditModal(link, idx, source, category) {
  editMode = true;
  editIndex = idx;
  editSource = source;
  shortcutNameInput.value = link.name || "";
  shortcutUrlInput.value = link.url || "";
  shortcutCategorySelect.value = category || "";
  syncCustomSelectUI(category || "");
  customCategoryWrap.style.display = "none";
  autoDetectBadge.style.display = "none";
  document.querySelector("#add-modal-overlay .modal-header h3").textContent = "Edit Shortcut";
  btnSaveAdd.textContent = "Save";
  openModal(addModalOverlay);
  setTimeout(() => shortcutNameInput.focus(), 100);
}

// Move Up / Left
ctxMoveUp.addEventListener("click", () => {
  contextMenu.style.display = "none";
  const src = activeContextSource;
  const idx = activeContextIndex;
  if (idx === 0) return;
  if (src === "top") {
    chrome.storage.local.get(["links"], (res) => {
      const links = res.links || DEFAULT_SHORTCUTS;
      [links[idx - 1], links[idx]] = [links[idx], links[idx - 1]];
      chrome.storage.local.set({ links }, () => { renderShortcuts(links); showToast("Moved!"); });
    });
  } else {
    chrome.storage.local.get(["categoryLinks"], (res) => {
      const cl = res.categoryLinks || {};
      const arr = cl[src] || [];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      cl[src] = arr;
      chrome.storage.local.set({ categoryLinks: cl }, () => { renderAllCategories(cl); showToast("Moved!"); });
    });
  }
});

// Move Down / Right
ctxMoveDown.addEventListener("click", () => {
  contextMenu.style.display = "none";
  const src = activeContextSource;
  const idx = activeContextIndex;
  if (src === "top") {
    chrome.storage.local.get(["links"], (res) => {
      const links = res.links || DEFAULT_SHORTCUTS;
      if (idx >= links.length - 1) return;
      [links[idx + 1], links[idx]] = [links[idx], links[idx + 1]];
      chrome.storage.local.set({ links }, () => { renderShortcuts(links); showToast("Moved!"); });
    });
  } else {
    chrome.storage.local.get(["categoryLinks"], (res) => {
      const cl = res.categoryLinks || {};
      const arr = cl[src] || [];
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      cl[src] = arr;
      chrome.storage.local.set({ categoryLinks: cl }, () => { renderAllCategories(cl); showToast("Moved!"); });
    });
  }
});

// Delete shortcut
ctxDelete.addEventListener("click", () => {
  contextMenu.style.display = "none";
  const src = activeContextSource;
  const idx = activeContextIndex;
  if (src === "top") {
    chrome.storage.local.get(["links"], (res) => {
      const links = res.links || DEFAULT_SHORTCUTS;
      links.splice(idx, 1);
      chrome.storage.local.set({ links }, () => { renderShortcuts(links); showToast("Removed"); });
    });
  } else {
    chrome.storage.local.get(["categoryLinks"], (res) => {
      const cl = res.categoryLinks || {};
      if (cl[src]) {
        cl[src].splice(idx, 1);
        if (cl[src].length === 0) delete cl[src];
      }
      chrome.storage.local.set({ categoryLinks: cl }, () => { renderAllCategories(cl); showToast("Removed"); });
    });
  }
});

// ===== BG_CUSTOMIZE MODAL =====
bgCustomizeBtn.addEventListener("click", () => {
  bgUrlInputWrap.style.display = "none";
  pexelsGalleryWrap.style.display = "none";
  picsumGalleryWrap.style.display = "none";
  document.querySelector(".modal-bg").classList.remove("modal-expanded");
  openModal(bgModalOverlay);
});
modalCloseBg.addEventListener("click", () => {
  document.querySelector(".modal-bg").classList.remove("modal-expanded");
  closeModal(bgModalOverlay);
});
addModalOverlay.addEventListener("click", (e) => { if (e.target === addModalOverlay) closeModal(addModalOverlay); });
bgModalOverlay.addEventListener("click", (e) => {
  if (e.target === bgModalOverlay) {
    document.querySelector(".modal-bg").classList.remove("modal-expanded");
    closeModal(bgModalOverlay);
  }
});

bgUploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast("Image too large! Max 5MB."); return; }
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result;
    chrome.storage.local.set({ customBg: base64 }, () => {
      bgOverlay.style.backgroundImage = `url(${base64})`;
      closeModal(bgModalOverlay); showToast("Background changed!");
    });
  };
  reader.readAsDataURL(file);
  fileInput.value = "";
});

bgUrlBtn.addEventListener("click", () => {
  pexelsGalleryWrap.style.display = "none";
  picsumGalleryWrap.style.display = "none";
  document.querySelector(".modal-bg").classList.remove("modal-expanded");
  bgUrlInputWrap.style.display = bgUrlInputWrap.style.display === "none" ? "block" : "none";
  if (bgUrlInputWrap.style.display === "block") setTimeout(() => bgUrlInput.focus(), 100);
});
bgUrlApply.addEventListener("click", () => {
  const url = bgUrlInput.value.trim();
  if (!url) return;
  const testImg = new Image();
  testImg.onload = () => {
    chrome.storage.local.set({ customBg: url }, () => {
      bgOverlay.style.backgroundImage = `url(${url})`;
      document.querySelector(".modal-bg").classList.remove("modal-expanded");
      closeModal(bgModalOverlay); showToast("Background changed!"); bgUrlInput.value = "";
    });
  };
  testImg.onerror = () => showToast("Failed to load image. Check the URL.");
  testImg.src = url;
});
bgUrlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") bgUrlApply.click(); });

// ===== PEXELS =====
bgPexelsBtn.addEventListener("click", () => {
  bgUrlInputWrap.style.display = "none";
  picsumGalleryWrap.style.display = "none";
  const isVisible = pexelsGalleryWrap.style.display !== "none";
  if (isVisible) {
    pexelsGalleryWrap.style.display = "none";
    document.querySelector(".modal-bg").classList.remove("modal-expanded");
  } else {
    pexelsGalleryWrap.style.display = "block";
    document.querySelector(".modal-bg").classList.add("modal-expanded");
    if (pexelsGrid.children.length === 0) { pexelsPage = 1; pexelsQuery = "nature"; fetchPexelsImages(pexelsQuery, pexelsPage, false); }
    setTimeout(() => pexelsSearchInput.focus(), 100);
  }
});

let pexelsDebounce = null;
pexelsSearchInput.addEventListener("input", () => {
  clearTimeout(pexelsDebounce);
  pexelsDebounce = setTimeout(() => {
    const query = pexelsSearchInput.value.trim();
    if (query.length >= 2) {
      pexelsQuery = query; pexelsPage = 1;
      document.querySelectorAll(".pexels-chip").forEach((c) => c.classList.remove("active"));
      fetchPexelsImages(pexelsQuery, pexelsPage, false);
    }
  }, 500);
});
pexelsSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(pexelsDebounce);
    const query = pexelsSearchInput.value.trim();
    if (query.length >= 1) {
      pexelsQuery = query; pexelsPage = 1;
      document.querySelectorAll(".pexels-chip").forEach((c) => c.classList.remove("active"));
      fetchPexelsImages(pexelsQuery, pexelsPage, false);
    }
  }
});
pexelsChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".pexels-chip");
  if (!chip) return;
  document.querySelectorAll(".pexels-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  pexelsQuery = chip.dataset.query; pexelsPage = 1;
  pexelsSearchInput.value = "";
  fetchPexelsImages(pexelsQuery, pexelsPage, false);
});
pexelsLoadMore.addEventListener("click", () => { pexelsPage++; fetchPexelsImages(pexelsQuery, pexelsPage, true); });

async function fetchPexelsImages(query, page, append) {
  if (pexelsLoading_) return;
  pexelsLoading_ = true;
  pexelsLoading.style.display = "flex";
  pexelsLoadMore.style.display = "none";
  if (!append) pexelsGrid.innerHTML = "";
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=12&page=${page}`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);
    const data = await response.json();
    const photos = data.photos || [];
    if (photos.length === 0 && !append) pexelsGrid.innerHTML = '<div class="pexels-empty">No wallpapers found.</div>';
    photos.forEach((photo) => {
      const card = document.createElement("div");
      card.className = "pexels-card";
      card.title = `${photo.photographer} — Click to apply`;
      const img = document.createElement("img");
      img.src = photo.src.medium; img.alt = photo.alt || "Wallpaper"; img.loading = "lazy";
      const overlay = document.createElement("div");
      overlay.className = "pexels-card-overlay";
      overlay.innerHTML = `<span class="pexels-card-photographer">📷 ${photo.photographer}</span><span class="pexels-card-apply">Apply</span>`;
      card.appendChild(img); card.appendChild(overlay);
      card.addEventListener("click", () => {
        const hdUrl = photo.src.landscape || photo.src.large2x || photo.src.original;
        showToast("Applying wallpaper...");
        chrome.storage.local.set({ customBg: hdUrl }, () => {
          bgOverlay.style.backgroundImage = `url(${hdUrl})`;
          document.querySelector(".modal-bg").classList.remove("modal-expanded");
          closeModal(bgModalOverlay);
          setTimeout(() => showToast("Background changed!"), 500);
        });
      });
      pexelsGrid.appendChild(card);
    });
    if (data.next_page) pexelsLoadMore.style.display = "block";
  } catch (error) {
    console.error("Pexels fetch error:", error);
    if (!append) pexelsGrid.innerHTML = '<div class="pexels-empty">Failed to load wallpapers.</div>';
    showToast("Failed to fetch wallpapers.");
  } finally {
    pexelsLoading_ = false;
    pexelsLoading.style.display = "none";
  }
}

// ===== PICSUM (free, no API key required) =====
bgPicsumBtn.addEventListener("click", () => {
  bgUrlInputWrap.style.display = "none";
  pexelsGalleryWrap.style.display = "none";
  document.querySelector(".modal-bg").classList.remove("modal-expanded");
  const isVisible = picsumGalleryWrap.style.display !== "none";
  if (isVisible) {
    picsumGalleryWrap.style.display = "none";
  } else {
    picsumGalleryWrap.style.display = "block";
    document.querySelector(".modal-bg").classList.add("modal-expanded");
    if (picsumGrid.children.length === 0) { picsumPage = 1; fetchPicsumImages(picsumPage, false); }
  }
});

picsumLoadMore.addEventListener("click", () => { picsumPage++; fetchPicsumImages(picsumPage, true); });

async function fetchPicsumImages(page, append) {
  if (picsumLoading_) return;
  picsumLoading_ = true;
  picsumLoading.style.display = "flex";
  picsumLoadMore.style.display = "none";
  if (!append) picsumGrid.innerHTML = "";
  try {
    // picsum.photos is a free, keyless placeholder-photo service.
    const response = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=12`);
    if (!response.ok) throw new Error(`Picsum API error: ${response.status}`);
    const photos = await response.json();
    if (photos.length === 0 && !append) picsumGrid.innerHTML = '<div class="pexels-empty">No wallpapers found.</div>';
    photos.forEach((photo) => {
      const thumbUrl = `https://picsum.photos/id/${photo.id}/500/300`;
      const hdUrl = `https://picsum.photos/id/${photo.id}/1920/1080`;
      const card = document.createElement("div");
      card.className = "pexels-card";
      card.title = `${photo.author} — Click to apply`;
      const img = document.createElement("img");
      img.src = thumbUrl; img.alt = photo.author || "Wallpaper"; img.loading = "lazy";
      const overlay = document.createElement("div");
      overlay.className = "pexels-card-overlay";
      overlay.innerHTML = `<span class="pexels-card-photographer">📷 ${photo.author}</span><span class="pexels-card-apply">Apply</span>`;
      card.appendChild(img); card.appendChild(overlay);
      card.addEventListener("click", () => {
        showToast("Applying wallpaper...");
        chrome.storage.local.set({ customBg: hdUrl }, () => {
          bgOverlay.style.backgroundImage = `url(${hdUrl})`;
          document.querySelector(".modal-bg").classList.remove("modal-expanded");
          closeModal(bgModalOverlay);
          setTimeout(() => showToast("Background changed!"), 500);
        });
      });
      picsumGrid.appendChild(card);
    });
    picsumLoadMore.style.display = "block";
  } catch (error) {
    console.error("Picsum fetch error:", error);
    if (!append) picsumGrid.innerHTML = '<div class="pexels-empty">Failed to load wallpapers.</div>';
    showToast("Failed to fetch wallpapers.");
  } finally {
    picsumLoading_ = false;
    picsumLoading.style.display = "none";
  }
}

// ===== AUTO (NEW TAB) TOGGLE =====
bgAutoNewtabBtn.addEventListener("click", () => {
  chrome.storage.local.get(["autoNewTab"], (data) => {
    const newState = !data.autoNewTab;
    chrome.storage.local.set({ autoNewTab: newState }, () => {
      if (newState) { bgAutoNewtabBtn.classList.add("active"); autoNewtabIndicator.classList.add("on"); showToast("Auto wallpaper ON!"); fetchRandomPexelsWallpaper(); }
      else { bgAutoNewtabBtn.classList.remove("active"); autoNewtabIndicator.classList.remove("on"); showToast("Auto wallpaper OFF"); }
    });
  });
});

// ===== TIMER TOGGLE =====
function startBgTimer() { if (timerInterval) clearInterval(timerInterval); timerInterval = setInterval(() => fetchRandomPexelsWallpaper(), 2 * 60 * 1000); }
function stopBgTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

bgTimerBtn.addEventListener("click", () => {
  chrome.storage.local.get(["bgTimer"], (data) => {
    const newState = !data.bgTimer;
    chrome.storage.local.set({ bgTimer: newState }, () => {
      if (newState) { bgTimerBtn.classList.add("active"); timerIndicator.classList.add("on"); startBgTimer(); showToast("Timer ON!"); fetchRandomPexelsWallpaper(); }
      else { bgTimerBtn.classList.remove("active"); timerIndicator.classList.remove("on"); stopBgTimer(); showToast("Timer OFF"); }
    });
  });
});

bgResetBtn.addEventListener("click", () => {
  stopBgTimer();
  chrome.storage.local.remove(["customBg", "autoNewTab", "bgTimer"], () => {
    bgOverlay.style.backgroundImage = "none"; bgOverlay.style.backgroundColor = "#0a0a0f";
    bgAutoNewtabBtn.classList.remove("active"); autoNewtabIndicator.classList.remove("on");
    bgTimerBtn.classList.remove("active"); timerIndicator.classList.remove("on");
    document.querySelector(".modal-bg").classList.remove("modal-expanded");
    closeModal(bgModalOverlay); showToast("Background reset to default");
  });
});

// ===== ALL-BOOKMARKS PANEL (left edge) =====
const bookmarksPanel = document.getElementById("bookmarks-panel");
const bookmarksTabHandle = document.getElementById("bookmarks-tab-handle");
const bookmarksTabCount = document.getElementById("bookmarks-tab-count");
const bookmarksPanelTotal = document.getElementById("bookmarks-panel-total");
const bookmarksPanelList = document.getElementById("bookmarks-panel-list");
const bookmarksSearchInput = document.getElementById("bookmarks-search-input");

let allBookmarksCache = [];

function refreshBookmarksPanel() {
  chrome.storage.local.get(["links", "categoryLinks"], (data) => {
    const topLinks = (data.links || DEFAULT_SHORTCUTS).map((l) => ({ ...l, group: "Top Bar" }));
    const categoryLinks = data.categoryLinks || {};
    const grouped = Object.entries(categoryLinks).flatMap(([cat, links]) =>
      (links || []).map((l) => ({ ...l, group: cat }))
    );
    allBookmarksCache = [...topLinks, ...grouped];

    bookmarksTabCount.textContent = allBookmarksCache.length;
    bookmarksPanelTotal.textContent = allBookmarksCache.length;
    renderBookmarksList(bookmarksSearchInput.value.trim().toLowerCase());
  });
}

function renderBookmarksList(filter) {
  bookmarksPanelList.innerHTML = "";
  const items = filter
    ? allBookmarksCache.filter((b) => {
        const name = (b.name || getDomainName(b.url)).toLowerCase();
        return name.includes(filter) || (b.url || "").toLowerCase().includes(filter) || b.group.toLowerCase().includes(filter);
      })
    : allBookmarksCache;

  if (items.length === 0) {
    bookmarksPanelList.innerHTML = `<div class="bookmarks-panel-empty">${allBookmarksCache.length === 0 ? "No bookmarks yet." : "No matches."}</div>`;
    return;
  }

  items.forEach((b) => {
    const name = b.name || getDomainName(b.url);
    const row = document.createElement("a");
    row.className = "bookmark-row";
    row.href = b.url;

    const icon = document.createElement("img");
    icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(b.url)}&sz=64`;
    icon.alt = "";
    icon.loading = "lazy";
    icon.onerror = () => { icon.style.display = "none"; };

    const text = document.createElement("div");
    text.className = "bookmark-row-text";
    text.innerHTML = `<span class="bookmark-row-name"></span><span class="bookmark-row-group"></span>`;
    text.querySelector(".bookmark-row-name").textContent = name;
    text.querySelector(".bookmark-row-group").textContent = b.group;

    row.appendChild(icon);
    row.appendChild(text);
    bookmarksPanelList.appendChild(row);
  });
}

bookmarksSearchInput.addEventListener("input", () => {
  renderBookmarksList(bookmarksSearchInput.value.trim().toLowerCase());
});

// Touch devices: no real hover, so tapping the handle toggles the panel
bookmarksTabHandle.addEventListener("click", (e) => {
  if (window.matchMedia("(hover: none)").matches) {
    e.preventDefault();
    bookmarksPanel.classList.toggle("expanded");
  }
});
document.addEventListener("click", (e) => {
  if (bookmarksPanel.classList.contains("expanded") && !bookmarksPanel.contains(e.target)) {
    bookmarksPanel.classList.remove("expanded");
  }
});

// ===== ESCAPE KEY =====
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal(addModalOverlay);
    document.querySelector(".modal-bg").classList.remove("modal-expanded");
    closeModal(bgModalOverlay);
    contextMenu.style.display = "none";
  }
});

// ===== GLOBAL TILE HOVER-PREVIEW (name + large brand icon) =====
function setupTilePreview() {
  const preview = document.getElementById("tile-preview");
  const previewImg = document.getElementById("tile-preview-img");
  const previewName = document.getElementById("tile-preview-name");
  const previewUrl = document.getElementById("tile-preview-url");

  let showTimer = null;
  let currentWrapper = null;

  function faviconUrlFor(pageUrl) {
    // Google's favicon service is reliable and fast for virtually any domain —
    // unlike live-screenshot services, it isn't blocked by sites that run
    // bot/CAPTCHA protection (Cloudflare, Turnstile, etc.), which was showing
    // "verifying you are human" pages instead of the real site.
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(pageUrl)}&sz=128`;
  }

  function positionPreview(wrapper) {
    const rect = wrapper.getBoundingClientRect();
    preview.style.visibility = "hidden";
    preview.classList.add("tile-preview-visible");
    const pRect = preview.getBoundingClientRect();
    preview.classList.remove("tile-preview-visible");
    preview.style.visibility = "";

    let left = rect.left + rect.width / 2 - pRect.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pRect.width - 10));

    let top = rect.top - pRect.height - 14;
    let arrowBelow = false;
    if (top < 8) {
      top = rect.bottom + 14;
      arrowBelow = true;
    }

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
    preview.classList.toggle("tile-preview-flip", arrowBelow);

    const arrowLeft = rect.left + rect.width / 2 - left;
    preview.querySelector(".tile-preview-arrow").style.left = `${arrowLeft}px`;
  }

  function showPreview(wrapper) {
    currentWrapper = wrapper;
    const name = wrapper.dataset.previewName || "";
    const url = wrapper.dataset.previewUrl || "";
    if (!url) return;

    previewName.textContent = name;
    try { previewUrl.textContent = new URL(url).hostname.replace(/^www\./, ""); }
    catch { previewUrl.textContent = url; }

    // Gradient tint derived from the name so each brand card feels distinct
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    const shotEl = preview.querySelector(".tile-preview-shot");
    shotEl.style.background =
      `linear-gradient(135deg, hsla(${hue},70%,55%,0.28), hsla(${(hue + 50) % 360},70%,55%,0.28))`;
    shotEl.setAttribute("data-fallback-letter", (name.charAt(0) || "?").toUpperCase());

    previewImg.src = faviconUrlFor(url);
    preview.classList.remove("tile-preview-error");
    positionPreview(wrapper);
    preview.classList.add("tile-preview-visible");
  }

  previewImg.addEventListener("error", () => {
    preview.classList.add("tile-preview-error");
  });

  function hidePreview() {
    clearTimeout(showTimer);
    preview.classList.remove("tile-preview-visible", "tile-preview-error");
    currentWrapper = null;
  }

  document.addEventListener("mouseover", (e) => {
    const wrapper = e.target.closest(".tile-wrapper");
    if (!wrapper || wrapper === currentWrapper) return;
    if (contextMenu.style.display === "block") return; // don't fight the context menu
    clearTimeout(showTimer);
    preview.classList.remove("tile-preview-error");
    showTimer = setTimeout(() => showPreview(wrapper), 320);
  });

  document.addEventListener("mouseout", (e) => {
    const wrapper = e.target.closest(".tile-wrapper");
    if (!wrapper) return;
    if (e.relatedTarget && wrapper.contains(e.relatedTarget)) return;
    hidePreview();
  });

  // Hide on scroll/drag/click so it never sits stale over a moved tile
  document.addEventListener("dragstart", hidePreview);
  shortcutContainer.addEventListener("scroll", hidePreview);
  categorySections.addEventListener("scroll", hidePreview);
  window.addEventListener("blur", hidePreview);
}

// Touch devices have no real :hover, so tapping a group's header
// toggles it open/closed instead (see the (hover: none) rules in CSS).
categorySections.addEventListener("click", (e) => {
  if (e.target.closest(".cat-color-btn")) { e.stopPropagation(); return; } // let the native color picker open

  const pinBtn = e.target.closest(".cat-pin-btn");
  if (pinBtn) { e.stopPropagation(); togglePinCategory(pinBtn.closest(".cat-section").dataset.category); return; }

  const renameBtn = e.target.closest(".cat-rename-btn");
  if (renameBtn) { e.stopPropagation(); startRenameCategory(renameBtn.closest(".cat-section")); return; }

  const deleteBtn = e.target.closest(".cat-delete-btn");
  if (deleteBtn) { e.stopPropagation(); deleteCategory(deleteBtn.closest(".cat-section").dataset.category); return; }

  const title = e.target.closest(".cat-title");
  if (title) { startRenameCategory(title.closest(".cat-section")); return; }

  const header = e.target.closest(".cat-header");
  if (header && window.matchMedia("(hover: none)").matches) {
    header.closest(".cat-section")?.classList.toggle("expanded");
  }
});

// Live preview while dragging the picker (before it's committed)
categorySections.addEventListener("input", (e) => {
  const colorInput = e.target.closest(".cat-color-input");
  if (!colorInput) return;
  const section = colorInput.closest(".cat-section");
  const titleEl = section.querySelector(".cat-title, .cat-title-input");
  if (titleEl) titleEl.style.color = colorInput.value;
  const btn = colorInput.closest(".cat-color-btn");
  if (btn) btn.style.color = colorInput.value;
});

// Persist once the picker is closed / value finalized
categorySections.addEventListener("change", (e) => {
  const colorInput = e.target.closest(".cat-color-input");
  if (!colorInput) return;
  const cat = colorInput.closest(".cat-section").dataset.category;
  chrome.storage.local.get(["categoryColors"], (data) => {
    const colors = data.categoryColors || {};
    colors[cat] = colorInput.value;
    chrome.storage.local.set({ categoryColors: colors }, () => {
      colorInput.closest(".cat-color-btn")?.classList.add("active");
      showToast("Group color updated!");
    });
  });
});

// Double-click the swatch to reset back to the auto-generated color
categorySections.addEventListener("dblclick", (e) => {
  const btn = e.target.closest(".cat-color-btn");
  if (!btn) return;
  e.preventDefault();
  const cat = btn.closest(".cat-section").dataset.category;
  chrome.storage.local.get(["categoryColors", "categoryLinks"], (data) => {
    const colors = data.categoryColors || {};
    if (!colors[cat]) return;
    delete colors[cat];
    chrome.storage.local.set({ categoryColors: colors }, () => {
      renderAllCategories(data.categoryLinks || {});
      showToast("Reset to default color");
    });
  });
});

function togglePinCategory(cat) {
  chrome.storage.local.get(["pinnedCategories"], (data) => {
    let pinned = data.pinnedCategories || [];
    const isPinned = pinned.includes(cat);
    pinned = isPinned ? pinned.filter((c) => c !== cat) : [...pinned, cat];
    chrome.storage.local.set({ pinnedCategories: pinned }, () => {
      const section = categorySections.querySelector(`.cat-section[data-category="${CSS.escape(cat)}"]`);
      if (section) {
        section.classList.toggle("pinned", !isPinned);
        const btn = section.querySelector(".cat-pin-btn");
        btn.classList.toggle("active", !isPinned);
        btn.title = !isPinned ? "Unpin (allow collapse)" : "Pin (keep always open)";
        btn.querySelector("svg").setAttribute("fill", !isPinned ? "currentColor" : "none");
      }
      showToast(!isPinned ? "Group pinned open!" : "Group unpinned");
    });
  });
}

function startRenameCategory(section) {
  const oldName = section.dataset.category;
  const titleEl = section.querySelector(".cat-title");
  if (section.querySelector(".cat-title-input")) return; // already editing

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cat-title-input";
  input.value = oldName;
  input.maxLength = 30;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
      input.replaceWith(titleEl); // revert, no change
      return;
    }
    renameCategory(oldName, newName);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { done = true; input.replaceWith(titleEl); }
  });
  input.addEventListener("blur", commit);
}

function renameCategory(oldName, newName) {
  chrome.storage.local.get(["categoryLinks", "pinnedCategories", "categoryColors"], (data) => {
    const categoryLinks = data.categoryLinks || {};
    if (!categoryLinks[oldName]) return;

    const collision = Object.keys(categoryLinks).some((c) => c.toLowerCase() === newName.toLowerCase() && c !== oldName);
    if (collision) {
      showToast(`A group named "${newName}" already exists`);
      renderAllCategories(categoryLinks); // revert visual edit state
      return;
    }

    const reordered = {};
    Object.entries(categoryLinks).forEach(([cat, links]) => {
      reordered[cat === oldName ? newName : cat] = links;
    });

    const pinned = (data.pinnedCategories || []).map((c) => (c === oldName ? newName : c));

    const colors = { ...(data.categoryColors || {}) };
    if (colors[oldName] !== undefined) {
      colors[newName] = colors[oldName];
      delete colors[oldName];
    }

    chrome.storage.local.set({ categoryLinks: reordered, pinnedCategories: pinned, categoryColors: colors }, () => {
      renderAllCategories(reordered);
      showToast("Group renamed!");
    });
  });
}

function deleteCategory(cat) {
  chrome.storage.local.get(["categoryLinks"], (data) => {
    const categoryLinks = data.categoryLinks || {};
    const count = (categoryLinks[cat] || []).length;
    if (!confirm(`Delete the "${cat}" group and its ${count} shortcut${count === 1 ? "" : "s"}?`)) return;

    delete categoryLinks[cat];
    chrome.storage.local.get(["pinnedCategories", "categoryColors"], (pd) => {
      const pinned = (pd.pinnedCategories || []).filter((c) => c !== cat);
      const colors = { ...(pd.categoryColors || {}) };
      delete colors[cat];
      chrome.storage.local.set({ categoryLinks, pinnedCategories: pinned, categoryColors: colors }, () => {
        renderAllCategories(categoryLinks);
        showToast("Group deleted");
      });
    });
  });
}
setupTilePreview();

// ===== INITIALIZE =====
init();