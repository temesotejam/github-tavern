import fs from "node:fs";
import path from "node:path";

const OWNER = process.env.TAVERN_OWNER || "temesotejam";
const TOKEN = process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";
const DATA_FILE = path.resolve("data/public-pages.json");
const CONCURRENCY = 10;
const PROBE_TIMEOUT_MS = 7000;

const apiHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "github-tavern-public-page-checker",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
};

async function apiRequest(url) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function listRepos() {
  const repos = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await apiRequest(`${API}/users/${OWNER}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter(repo => !repo.private && !repo.archived && !repo.disabled);
}

function normalizePublicUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" || host === "0.0.0.0" || host === "::1" ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isPlainGitHubRepositoryUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length <= 2;
  } catch {
    return false;
  }
}

function githubPagesCandidate(repo) {
  if (repo.name.toLowerCase() === `${OWNER.toLowerCase()}.github.io`) {
    return `https://${OWNER}.github.io/`;
  }
  return `https://${OWNER}.github.io/${encodeURIComponent(repo.name)}/`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: "follow", ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function usableStatus(status) {
  return status >= 200 && status < 400;
}

async function probeOnce(url) {
  const headers = { "User-Agent": "github-tavern-public-page-checker" };
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD", headers });
    if (usableStatus(head.status)) {
      return { url: normalizePublicUrl(head.url) || url, status: head.status };
    }
    if (![403, 405, 501].includes(head.status)) return null;
  } catch {
    // Some sites reject or mishandle HEAD. Fall through to a tiny GET.
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-0" }
    });
    const result = usableStatus(response.status)
      ? { url: normalizePublicUrl(response.url) || url, status: response.status }
      : null;
    if (response.body) await response.body.cancel().catch(() => {});
    return result;
  } catch {
    return null;
  }
}

async function probe(url) {
  let result = await probeOnce(url);
  if (result) return result;
  await new Promise(resolve => setTimeout(resolve, 250));
  result = await probeOnce(url);
  return result;
}

async function detectPublicPage(repo) {
  const candidates = [];
  const homepage = normalizePublicUrl(repo.homepage);
  if (homepage && !isPlainGitHubRepositoryUrl(homepage)) {
    candidates.push({ url: homepage, source: "homepage" });
  }

  const pagesUrl = githubPagesCandidate(repo);
  if (!candidates.some(candidate => candidate.url.replace(/\/$/, "") === pagesUrl.replace(/\/$/, ""))) {
    candidates.push({ url: pagesUrl, source: "github-pages" });
  }

  for (const candidate of candidates) {
    const result = await probe(candidate.url);
    if (result) {
      return {
        url: result.url,
        source: candidate.source,
        status: result.status
      };
    }
  }
  return null;
}

function readPrevious() {
  if (!fs.existsSync(DATA_FILE)) return { schemaVersion: 1, pages: {} };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { schemaVersion: 1, pages: {} };
  }
}

const repos = await listRepos();
const pages = {};
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= repos.length) return;
    const repo = repos[index];
    const page = await detectPublicPage(repo);
    if (page) {
      pages[repo.name] = page;
      console.log(`FOUND ${repo.name}: ${page.url} (${page.source}, ${page.status})`);
    } else {
      console.log(`NONE  ${repo.name}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, repos.length || 1) }, () => worker()));

const sortedPages = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
const previous = readPrevious();
const previousComparable = JSON.stringify(previous.pages || {});
const nextComparable = JSON.stringify(sortedPages);

console.log(`Public repositories checked: ${repos.length}`);
console.log(`Verified public pages: ${Object.keys(sortedPages).length}`);

if (previousComparable === nextComparable && Number(previous.repositoryCount || 0) === repos.length) {
  console.log("No public page changes.");
  process.exit(0);
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repositoryCount: repos.length,
  pageCount: Object.keys(sortedPages).length,
  pages: sortedPages
};

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.writeFileSync(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Updated ${DATA_FILE}.`);
