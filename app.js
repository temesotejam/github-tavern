const OWNER = "temesotejam";
const API = "https://api.github.com";
const SUMMARY_URL = "./data/summaries.json";

const els = {
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"),
  filters: document.querySelector("#categoryFilters"),
  grid: document.querySelector("#repoGrid"),
  count: document.querySelector("#repoCount"),
  notice: document.querySelector("#notice"),
  noticeText: document.querySelector("#noticeText"),
  empty: document.querySelector("#emptyState"),
  clear: document.querySelector("#clearFilters"),
  locationTag: document.querySelector("#locationTag"),
  dialog: document.querySelector("#detailDialog"),
  closeDialog: document.querySelector("#closeDialog"),
  confirmStage: document.querySelector("#confirmStage"),
  confirmCategory: document.querySelector("#confirmCategory"),
  confirmText: document.querySelector("#confirmText"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmYes: document.querySelector("#confirmYes"),
  confirmNo: document.querySelector("#confirmNo"),
  detailStage: document.querySelector("#detailStage"),
  detailBreadcrumb: document.querySelector("#detailBreadcrumb"),
  detailNumber: document.querySelector("#detailNumber"),
  detailTitle: document.querySelector("#detailTitle"),
  detailRepo: document.querySelector("#detailRepo"),
  keeperText: document.querySelector("#keeperText"),
  detailMeta: document.querySelector("#detailMeta"),
  featureSection: document.querySelector("#featureSection"),
  featureList: document.querySelector("#featureList"),
  techSection: document.querySelector("#techSection"),
  techList: document.querySelector("#techList"),
  repoLink: document.querySelector("#repoLink"),
  pagesLink: document.querySelector("#pagesLink"),
  summarySource: document.querySelector("#summarySource")
};

const state = {
  repos: [],
  summaries: {},
  category: "all",
  query: "",
  sort: "updated",
  selectedRow: 0,
  pendingRepo: null,
  readmeCache: new Map()
};

const CATEGORY_RULES = [
  {
    id: "learning",
    label: "学習・AI",
    words: ["reinforcement", "learning", "ppo", "sac", "td3", "acrobot", "cartpole", "強化学習", "機械学習", " ai "]
  },
  {
    id: "control",
    label: "制御・ロボット",
    words: ["reaction-wheel", "control", "robot", "waypoint", "copter", "boat", "ackermann", "pendulum", "制御", "ロボティクス", "航法", "振り子", "船舶"]
  },
  {
    id: "sensing",
    label: "センサ・組込み",
    words: ["esp32", "m5", "xiao", "arduino", "pico", "gnss", "imu", "bno", "realsense", "t265", "vl53", "sensor", "センサ", "組込み", "マイコン"]
  },
  {
    id: "vision",
    label: "画像・映像",
    words: ["camera", "video", "marker", "mediapipe", "vision", "image", "映像", "画像", "カメラ", "動画"]
  },
  {
    id: "web",
    label: "Web・ツール",
    words: [" web", "web-", "viewer", "tool", "builder", "inspector", "diagnostic", "toolkit", "frontend", "ブラウザ", "静的サイト", "webアプリ"]
  }
];

const ALL_CATEGORY = { id: "all", label: "すべて" };
const OTHER_CATEGORY = { id: "other", label: "その他" };

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[ch]));
}

function formatDate(value) {
  if (!value) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function relativeDate(value) {
  if (!value) return "";
  const diffDays = Math.round((new Date(value) - new Date()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });
  if (Math.abs(diffDays) < 31) return rtf.format(diffDays, "day");
  return formatDate(value);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchRepos() {
  const all = [];
  for (let page = 1; page <= 4; page += 1) {
    const batch = await fetchJson(`${API}/users/${OWNER}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter(repo => !repo.private);
}

async function fetchSummaries() {
  try {
    const response = await fetch(`${SUMMARY_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return {};
    const data = await response.json();
    return data.repositories || {};
  } catch {
    return {};
  }
}

function summaryFor(repo) {
  return state.summaries[repo.name] || null;
}

function normalizedRepoText(repo) {
  const summary = summaryFor(repo);
  return [
    repo.name,
    repo.description,
    repo.language,
    ...(repo.topics || []),
    summary?.title,
    summary?.summary,
    summary?.detail,
    ...(summary?.technologies || []),
    ...(summary?.categories || [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function categoryOf(repo) {
  const text = ` ${normalizedRepoText(repo)} `;
  const hit = CATEGORY_RULES.find(rule => rule.words.some(word => text.includes(word)));
  return hit || OTHER_CATEGORY;
}

function categoryById(id) {
  if (id === "all") return ALL_CATEGORY;
  if (id === "other") return OTHER_CATEGORY;
  return CATEGORY_RULES.find(category => category.id === id) || ALL_CATEGORY;
}

function applyTheme(categoryId) {
  const category = categoryById(categoryId);
  document.body.dataset.theme = category.id;
  els.locationTag.textContent = `ARCHIVE / ${category.label.toUpperCase()}`;
}

function renderFilters() {
  const categories = [ALL_CATEGORY, ...CATEGORY_RULES, OTHER_CATEGORY];
  els.filters.innerHTML = categories.map((category, index) => `
    <button class="category-tab" type="button" data-category="${category.id}" aria-pressed="${state.category === category.id}">
      <span class="category-tab__no">${String(index).padStart(2, "0")}</span>
      <span class="category-tab__label">${esc(category.label)}</span>
    </button>
  `).join("");
}

function matches(repo) {
  if (state.category !== "all" && categoryOf(repo).id !== state.category) return false;
  if (!state.query) return true;
  const haystack = normalizedRepoText(repo);
  return state.query.split(/\s+/).filter(Boolean).every(token => haystack.includes(token));
}

function sorted(repos) {
  return [...repos].sort((a, b) => {
    if (state.sort === "name") {
      return a.name.localeCompare(b.name, "ja", { numeric: true, sensitivity: "base" });
    }
    if (state.sort === "stars") {
      return (b.stargazers_count || 0) - (a.stargazers_count || 0)
        || new Date(b.pushed_at) - new Date(a.pushed_at);
    }
    return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
  });
}

function visibleRepos() {
  return sorted(state.repos.filter(matches));
}

function fallbackDescription(repo) {
  if (repo.description) return repo.description;
  const words = repo.name.replace(/[-_]+/g, " ").replace(/\b\d{4} \d{1,2} \d{1,2}\b/g, "").trim();
  return words ? `${words} に関する公開記録。` : "詳細資料が少ない公開記録。";
}

function renderRepos() {
  const visible = visibleRepos();
  state.selectedRow = Math.max(0, Math.min(state.selectedRow, Math.max(visible.length - 1, 0)));

  els.count.textContent = `${visible.length} / ${state.repos.length} RECORDS`;
  els.empty.hidden = visible.length > 0;
  els.grid.hidden = visible.length === 0;

  els.grid.innerHTML = visible.map((repo, index) => {
    const summary = summaryFor(repo);
    const desc = summary?.summary || fallbackDescription(repo);
    const title = summary?.title || repo.name;
    const category = categoryOf(repo);
    const selected = index === state.selectedRow;

    return `
      <button class="record-row${selected ? " is-selected" : "}" type="button" role="option"
        aria-selected="${selected}" data-repo="${esc(repo.name)}" data-index="${index}">
        <span class="record-no">
          <span class="record-pointer" aria-hidden="true">☞</span>
          <span>${String(index + 1).padStart(2, "0")}</span>
        </span>
        <span class="record-main">
          <span class="record-titleline">
            <span class="record-title">${esc(title)}</span>
            <span class="record-repo">${esc(repo.name)}</span>
          </span>
          <span class="record-summary">${esc(desc)}</span>
        </span>
        <span class="record-side">
          <span class="ai-mark">${summary?.summary ? "COPILOT" : "RAW"}</span>
          <strong>${esc(category.label)}</strong>
          <span>${esc(repo.language || "—")} / ${esc(relativeDate(repo.pushed_at))}</span>
        </span>
      </button>`;
  }).join("");
}

function setSelectedRow(index, { focus = false } = {}) {
  const rows = [...els.grid.querySelectorAll(".record-row")];
  if (!rows.length) return;

  state.selectedRow = Math.max(0, Math.min(index, rows.length - 1));
  rows.forEach((row, i) => {
    const selected = i === state.selectedRow;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-selected", String(selected));
  });

  const current = rows[state.selectedRow];
  current.scrollIntoView({ block: "nearest" });
  if (focus) current.focus({ preventScroll: true });
}

function cleanMarkdown(markdown) {
  return String(markdown || "")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/```[^]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_`~|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function usefulReadmeExcerpt(markdown, repo) {
  const text = cleanMarkdown(markdown);
  if (!text) return fallbackDescription(repo);
  const escapedName = repo.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutTitle = text.replace(new RegExp(`^${escapedName}\\s*`, "i"), "");
  const sentence = withoutTitle.match(/^.{45,360}?(?:。|\.\s|！|!\s|？|\?\s)/)?.[0] || withoutTitle.slice(0, 280);
  return sentence.trim() || fallbackDescription(repo);
}

async function fetchReadme(repo) {
  if (state.readmeCache.has(repo.name)) return state.readmeCache.get(repo.name);
  try {
    const response = await fetch(`${API}/repos/${OWNER}/${encodeURIComponent(repo.name)}/readme`, {
      headers: { Accept: "application/vnd.github.raw+json" }
    });
    if (!response.ok) throw new Error("README not found");
    const text = await response.text();
    state.readmeCache.set(repo.name, text);
    return text;
  } catch {
    state.readmeCache.set(repo.name, "");
    return "";
  }
}

function setMeta(repo, summary) {
  const items = [
    repo.language && `LANG ${repo.language}`,
    `UPDATED ${formatDate(repo.pushed_at)}`,
    `STAR ${repo.stargazers_count || 0}`,
    repo.fork ? "FORK" : "ORIGINAL",
    repo.archived ? "ARCHIVED" : null,
    summary?.status ? `STATUS ${summary.status}` : null,
    summary?.confidence ? `CONF ${summary.confidence.toUpperCase()}` : null
  ].filter(Boolean);
  els.detailMeta.innerHTML = items.map(item => `<span class="meta-pill">${esc(item)}</span>`).join("");
}

function renderFeatures(features = []) {
  const list = features.filter(Boolean).slice(0, 6);
  els.featureSection.hidden = list.length === 0;
  els.featureList.innerHTML = list.map(item => `<li>${esc(item)}</li>`).join("");
}

function renderTech(repo, summary) {
  const tech = [...new Set([
    ...(summary?.technologies || []),
    ...(repo.topics || []),
    repo.language
  ].filter(Boolean))].slice(0, 14);
  els.techSection.hidden = tech.length === 0;
  els.techList.innerHTML = tech.map(item => `<span class="tag">${esc(item)}</span>`).join("");
}

let typingTimer = null;
function typeKeeperText(text) {
  clearInterval(typingTimer);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.keeperText.textContent = text;
    return;
  }

  els.keeperText.textContent = "";
  let i = 0;
  typingTimer = setInterval(() => {
    i += 2;
    els.keeperText.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(typingTimer);
  }, 10);
}

function openPrompt(repo) {
  const summary = summaryFor(repo);
  const category = categoryOf(repo);
  state.pendingRepo = repo;
  applyTheme(category.id);

  els.confirmCategory.textContent = `ARCHIVE / ${category.label}`;
  els.confirmTitle.textContent = summary?.title || repo.name;

  if (summary?.confidence === "low") {
    els.confirmText.textContent = `「${summary?.title || repo.name}か。資料は少ないが、確認できる範囲の記録はある。」`;
  } else {
    els.confirmText.textContent = `「${summary?.title || repo.name}か。記録は揃ってる。中身を見ていくか？」`;
  }

  els.confirmStage.hidden = false;
  els.detailStage.hidden = true;
  if (!els.dialog.open) els.dialog.showModal();
  requestAnimationFrame(() => els.confirmYes.focus());
}

async function showDetail(repo) {
  const summary = summaryFor(repo);
  const category = categoryOf(repo);
  const index = sorted(state.repos).findIndex(item => item.id === repo.id) + 1;

  els.confirmStage.hidden = true;
  els.detailStage.hidden = false;
  els.detailBreadcrumb.textContent = `ARCHIVE / ${category.label} / RECORD`;
  els.detailNumber.textContent = `RECORD No.${String(Math.max(index, 1)).padStart(3, "0")}`;
  els.detailTitle.textContent = summary?.title || repo.name;
  els.detailRepo.textContent = `${OWNER}/${repo.name}`;
  els.repoLink.href = repo.html_url;
  els.pagesLink.hidden = !repo.homepage;
  if (repo.homepage) els.pagesLink.href = repo.homepage;

  setMeta(repo, summary);
  renderFeatures(summary?.features || []);
  renderTech(repo, summary);
  els.summarySource.textContent = summary?.summary
    ? `COPILOT ANALYSIS / ${formatDate(summary.generatedAt)}`
    : "README / REPOSITORY METADATA";

  els.keeperText.textContent = "記録を照合しています…";

  if (summary?.summary) {
    const text = summary.detail || summary.summary;
    typeKeeperText(`「${text}」`);
    return;
  }

  const readme = await fetchReadme(repo);
  const excerpt = readme ? usefulReadmeExcerpt(readme, repo) : fallbackDescription(repo);
  typeKeeperText(`「${excerpt}」`);
}

function closeArchive() {
  clearInterval(typingTimer);
  state.pendingRepo = null;
  if (els.dialog.open) els.dialog.close();
  applyTheme(state.category);
}

function openSelectedRecord() {
  const visible = visibleRepos();
  const repo = visible[state.selectedRow];
  if (repo) openPrompt(repo);
}

function bindEvents() {
  els.search.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    state.selectedRow = 0;
    renderRepos();
  });

  els.sort.addEventListener("change", event => {
    state.sort = event.target.value;
    state.selectedRow = 0;
    renderRepos();
  });

  els.filters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    state.selectedRow = 0;
    applyTheme(state.category);
    renderFilters();
    renderRepos();
  });

  els.grid.addEventListener("mousemove", event => {
    const row = event.target.closest(".record-row");
    if (!row) return;
    setSelectedRow(Number(row.dataset.index));
  });

  els.grid.addEventListener("focusin", event => {
    const row = event.target.closest(".record-row");
    if (!row) return;
    setSelectedRow(Number(row.dataset.index));
  });

  els.grid.addEventListener("click", event => {
    const row = event.target.closest("[data-repo]");
    if (!row) return;
    const repo = state.repos.find(item => item.name === row.dataset.repo);
    if (repo) openPrompt(repo);
  });

  els.confirmYes.addEventListener("click", () => {
    if (state.pendingRepo) showDetail(state.pendingRepo);
  });
  els.confirmNo.addEventListener("click", closeArchive);
  els.closeDialog.addEventListener("click", closeArchive);

  els.dialog.addEventListener("click", event => {
    if (event.target === els.dialog) closeArchive();
  });

  els.clear.addEventListener("click", () => {
    state.category = "all";
    state.query = "";
    state.selectedRow = 0;
    els.search.value = "";
    applyTheme("all");
    renderFilters();
    renderRepos();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && els.dialog.open) {
      event.preventDefault();
      closeArchive();
      return;
    }

    if (els.dialog.open) return;

    const interactive = document.activeElement === els.search || document.activeElement === els.sort;

    if (event.key === "/" && document.activeElement !== els.search) {
      event.preventDefault();
      els.search.focus();
      return;
    }

    if (interactive) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedRow(state.selectedRow + 1, { focus: true });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedRow(state.selectedRow - 1, { focus: true });
    } else if (event.key === "Enter") {
      event.preventDefault();
      openSelectedRecord();
    }
  });
}

function renderSkeletons() {
  els.grid.innerHTML = Array.from({ length: 8 }, () => `<div class="loading-row" aria-hidden="true"></div>`).join("");
}

async function init() {
  applyTheme("all");
  renderFilters();
  renderSkeletons();
  bindEvents();

  try {
    const [repos, summaries] = await Promise.all([fetchRepos(), fetchSummaries()]);
    state.repos = repos;
    state.summaries = summaries;
    const aiCount = repos.filter(repo => summaries[repo.name]?.summary).length;
    els.noticeText.textContent = `${repos.length}件の公開記録を確認 / COPILOT解析 ${aiCount}件`;
    renderRepos();
  } catch (error) {
    els.notice.classList.add("is-error");
    els.noticeText.textContent = `GitHubから記録を取得できませんでした: ${error.message}`;
    els.grid.innerHTML = "";
    els.count.textContent = "0 RECORDS";
  }
}

init();
