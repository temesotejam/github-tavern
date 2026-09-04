(() => {
  const OWNER = "temesotejam";
  const grid = document.querySelector("#repoGrid");
  if (!grid) return;

  const cache = new Map();
  const queued = new Set();
  const queue = [];
  let active = 0;
  const CONCURRENCY = 6;

  function cleanMarkdown(markdown = "") {
    return String(markdown)
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/```[^]*?```/g, " ")
      .replace(/<picture[^]*?<\/picture>/gi, " ")
      .replace(/<img[^>]*>/gi, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/\|/g, " ")
      .replace(/[\*_`~]/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shortPreview(markdown, repoName) {
    let text = cleanMarkdown(markdown);
    if (!text) return "";

    const escaped = repoName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, "i"), "").trim();

    const noisePrefixes = [
      "build status", "license", "contents", "table of contents", "目次", "badge", "author"
    ];
    const sentences = text
      .split(/(?<=[。！？.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 18)
      .filter(s => !noisePrefixes.some(prefix => s.toLowerCase().startsWith(prefix)));

    let preview = sentences[0] || text.slice(0, 140);
    if (preview.length > 105) {
      const cut = preview.slice(0, 105);
      const boundary = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("、"), cut.lastIndexOf(" "));
      preview = `${cut.slice(0, boundary > 55 ? boundary : 105).trim()}…`;
    }
    return preview;
  }

  async function fetchRaw(repoName, branch, filename) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(OWNER)}/${encodeURIComponent(repoName)}/${encodeURIComponent(branch)}/${filename}`;
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return "";
    return response.text();
  }

  async function readReadme(repoName) {
    if (cache.has(repoName)) return cache.get(repoName);

    const attempts = [
      ["main", "README.md"],
      ["master", "README.md"],
      ["main", "README.MD"],
      ["master", "README.MD"],
      ["main", "readme.md"],
      ["master", "readme.md"]
    ];

    for (const [branch, filename] of attempts) {
      try {
        const markdown = await fetchRaw(repoName, branch, filename);
        if (markdown) {
          const result = shortPreview(markdown, repoName);
          cache.set(repoName, result);
          return result;
        }
      } catch {
        // Try the next common README location.
      }
    }

    cache.set(repoName, "");
    return "";
  }

  function updateCard(repoName, text) {
    if (!text) return;
    const cards = grid.querySelectorAll(".repo-card[data-repo]");
    for (const card of cards) {
      if (card.dataset.repo !== repoName) continue;
      if (card.querySelector(".repo-card__status.ai")) return;
      const desc = card.querySelector(".repo-card__desc");
      if (!desc) return;
      desc.textContent = text;
      desc.title = text;
      desc.dataset.source = "readme-preview";
      const lamp = card.querySelector(".repo-card__status");
      if (lamp) lamp.title = "READMEから自動生成した短い説明";
      return;
    }
  }

  function pump() {
    while (active < CONCURRENCY && queue.length) {
      const repoName = queue.shift();
      active += 1;
      readReadme(repoName)
        .then(text => updateCard(repoName, text))
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  }

  function enqueueCards() {
    const cards = grid.querySelectorAll(".repo-card[data-repo]");
    for (const card of cards) {
      if (card.querySelector(".repo-card__status.ai")) continue;
      const repoName = card.dataset.repo;
      if (!repoName) continue;
      if (cache.has(repoName)) {
        updateCard(repoName, cache.get(repoName));
        continue;
      }
      if (queued.has(repoName)) continue;
      queued.add(repoName);
      queue.push(repoName);
    }
    pump();
  }

  const observer = new MutationObserver(enqueueCards);
  observer.observe(grid, { childList: true });
  enqueueCards();
})();