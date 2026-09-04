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
  dialog: document.querySelector("#detailDialog"),
  closeDialog: document.querySelector("#closeDialog"),
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
  readmeCache: new Map()
};

const CATEGORY_RULES = [
  { id: "learning", label: "学習・AI", icon: "✦", words: ["reinforcement", "learning", "ppo", "sac", "td3", "rl-", "acrobot", "cartpole"] },
  { id: "control", label: "制御・ロボット", icon: "⚙", words: ["reaction-wheel", "control", "robot", "waypoint", "copter", "boat", "ackermann", "pendulum"] },
  { id: "sensing", label: "センサ・組込み", icon: "⌁", words: ["esp32", "m5", "xiao", "arduino", "pico", "gnss", "imu", "bno", "realsense", "t265", "vl53", "sensor"] },
  { id: "vision", label: "画像・映像", icon: "◉", words: ["camera", "video", "marker", "mediapipe", "vision", "image"] },
  { id: "web", label: "Web・ツール", icon: "◇", words: ["web", "viewer", "tool", "builder", "inspector", "diagnostic", "toolkit", "frontend"] }
];

function normalizedRepoText(repo) {
  return [repo.name, repo.description, repo.language, ...(repo.topics || [])].filter(Boolean).join(" ").toLowerCase();
}

function categoryOf(repo) {
  const text = normalizedRepoText(repo);
  const hit = CATEGORY_RULES.find(rule => rule.words.some(word => text.includes(word)));
  return hit || { id: "other", label: "その他", icon: "◆" };
}

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function formatDate(value) {
  if (!value) return "不明";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function relativeDate(value) {
  if (!value) return "";
  const diffDays = Math.round((new Date(value) - new Date()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });
  if (Math.abs(diffDays) < 31) return rtf.format(diffDays, "day");
  return formatDate(value);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", ...(options.headers || {}) }, ...options });
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

function renderFilters() {
  const categories = [{ id: "all", label: "すべて", icon: "☰" }, ...CATEGORY_RULES, { id: "other", label: "その他", icon: "◆" }];
  els.filters.innerHTML = categories.map(cat => `
    <button class="chip" type="button" data-category="${cat.id}" aria-pressed="${state.category === cat.id}">${cat.icon} ${cat.label}</button>
  `).join("");
}

function matches(repo) {
  if (state.category !== "all" && categoryOf(repo).id !== state.category) return false;
  if (!state.query) return true;
  const summary = state.summaries[repo.name];
  const haystack = [normalizedRepoText(repo), summary?.title, summary?.summary, ...(summary?.technologies || []), ...(summary?.categories || [])]
    .filter(Boolean).join(" ").toLowerCase();
  return state.query.split(/\s+/).every(token => haystack.includes(token));
}

function sorted(repos) {
  return [...repos].sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "ja", { numeric: true, sensitivity: "base" });
    if (state.sort === "stars") return (b.stargazers_count || 0) - (a.stargazers_count || 0) || new Date(b.pushed_at) - new Date(a.pushed_at);
    return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
  });
}

function fallbackDescription(repo) {
  if (repo.description) return repo.description;
  const words = repo.name.replace(/[-_]+/g, " ").replace(/\b\d{4} \d{1,2} \d{1,2}\b/g, "").trim();
  return words ? `${words} に関する公開記録。選択するとREADMEを確認します。` : "選択するとREADMEを確認します。";
}

function renderRepos() {
  const visible = sorted(state.repos.filter(matches));
  els.count.textContent = `${visible.length} / ${state.repos.length} RECORDS`;
  els.empty.hidden = visible.length > 0;
  els.grid.hidden = visible.length === 0;

  els.grid.innerHTML = visible.map((repo, index) => {
    const category = categoryOf(repo);
    const summary = state.summaries[repo.name];
    const desc = summary?.summary || fallbackDescription(repo);
    const ai = Boolean(summary?.summary);
    return `
      <button class="repo-card" type="button" data-repo="${esc(repo.name)}" aria-label="${esc(repo.name)} の概要を見る">
        <div class="repo-card__top">
          <span class="repo-card__category">${category.icon} ${esc(category.label)}</span>
          <span class="repo-card__status ${ai ? "ai" : ""}" title="${ai ? "Copilot解析済み" : "README参照"}"></span>
        </div>
        <h3>${esc(summary?.title || repo.name)}</h3>
        <p class="repo-card__desc">${esc(desc)}</p>
        <div class="repo-card__foot">
          <span>No.${String(index + 1).padStart(3, "0")}</span>
          <span>${esc(repo.language || "—")} · ${esc(relativeDate(repo.pushed_at))}</span>
        </div>
      </button>`;
  }).join("");
}

function cleanMarkdown(markdown) {
  return markdown
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
  const namePattern = new RegExp(`^${repo.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
  const withoutTitle = text.replace(namePattern, "");
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
    repo.language && `主言語 ${repo.language}`,
    `更新 ${formatDate(repo.pushed_at)}`,
    `★ ${repo.stargazers_count || 0}`,
    repo.fork ? "Fork" : "Original",
    repo.archived ? "Archive" : null,
    summary?.status ? `状態 ${summary.status}` : null
  ].filter(Boolean);
  els.detailMeta.innerHTML = items.map(item => `<span class="meta-pill">${esc(item)}</span>`).join("");
}

function renderFeatures(features = []) {
  const list = features.filter(Boolean).slice(0, 6);
  els.featureSection.hidden = list.length === 0;
  els.featureList.innerHTML = list.map(item => `<li>${esc(item)}</li>`).join("");
}

function renderTech(repo, summary) {
  const tech = [...new Set([...(summary?.technologies || []), ...(repo.topics || []), repo.language].filter(Boolean))].slice(0, 14);
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
  }, 9);
}

async function openDetail(repo) {
  const summary = state.summaries[repo.name];
  const index = sorted(state.repos).findIndex(item => item.id === repo.id) + 1;
  els.detailNumber.textContent = `RECORD No.${String(Math.max(index, 1)).padStart(3, "0")}`;
  els.detailTitle.textContent = summary?.title || repo.name;
  els.detailRepo.textContent = `${OWNER}/${repo.name}`;
  els.repoLink.href = repo.html_url;
  els.pagesLink.hidden = !repo.homepage;
  if (repo.homepage) els.pagesLink.href = repo.homepage;
  setMeta(repo, summary);
  renderFeatures(summary?.features || []);
  renderTech(repo, summary);
  els.summarySource.textContent = summary?.summary ? `COPILOT ANALYSIS · ${formatDate(summary.generatedAt)}` : "README / REPOSITORY METADATA";

  els.keeperText.textContent = "記録を確認しています…";
  els.dialog.showModal();

  if (summary?.summary) {
    const text = summary.detail || summary.summary;
    typeKeeperText(`「${text}」`);
    return;
  }

  const readme = await fetchReadme(repo);
  const excerpt = readme ? usefulReadmeExcerpt(readme, repo) : fallbackDescription(repo);
  typeKeeperText(`「${excerpt}」`);
}

function bindEvents() {
  els.search.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    renderRepos();
  });
  els.sort.addEventListener("change", event => {
    state.sort = event.target.value;
    renderRepos();
  });
  els.filters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    renderRepos();
  });
  els.grid.addEventListener("click", event => {
    const card = event.target.closest("[data-repo]");
    if (!card) return;
    const repo = state.repos.find(item => item.name === card.dataset.repo);
    if (repo) openDetail(repo);
  });
  els.closeDialog.addEventListener("click", () => els.dialog.close());
  els.dialog.addEventListener("click", event => {
    if (event.target === els.dialog) els.dialog.close();
  });
  els.clear.addEventListener("click", () => {
    state.category = "all";
    state.query = "";
    els.search.value = "";
    renderFilters();
    renderRepos();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement !== els.search && !els.dialog.open) {
      event.preventDefault();
      els.search.focus();
    }
  });
}

function renderSkeletons() {
  els.grid.innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton" aria-hidden="true"></div>`).join("");
}

async function init() {
  renderFilters();
  renderSkeletons();
  bindEvents();
  try {
    const [repos, summaries] = await Promise.all([fetchRepos(), fetchSummaries()]);
    state.repos = repos;
    state.summaries = summaries;
    const aiCount = repos.filter(repo => summaries[repo.name]?.summary).length;
    els.noticeText.textContent = `${repos.length}件の公開記録を確認。うち${aiCount}件はCopilotの案内付き。`;
    renderRepos();
  } catch (error) {
    els.notice.classList.add("is-error");
    els.noticeText.textContent = `GitHubから帳簿を取得できませんでした: ${error.message}`;
    els.grid.innerHTML = "";
    els.count.textContent = "0 RECORDS";
  }
}

init();
