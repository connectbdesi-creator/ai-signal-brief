const state = {
  data: null,
  view: "latest",
  filter: "all",
  query: "",
  isRefreshing: false,
  shareResetTimer: null,
  statusResetTimer: null,
  knownIds: new Set()
};

const elements = {
  lastUpdated: document.querySelector("#last-updated"),
  statusPulse: document.querySelector("#status-pulse"),
  refreshButton: document.querySelector("#refresh-button"),
  shareButton: document.querySelector("#share-button"),
  updateCount: document.querySelector("#update-count"),
  archiveCount: document.querySelector("#archive-count"),
  highlightMetricCount: document.querySelector("#highlight-metric-count"),
  weeklyCount: document.querySelector("#weekly-count"),
  weeklyHighlights: document.querySelector("#weekly-highlights"),
  feedTitle: document.querySelector("#feed-title"),
  resultCount: document.querySelector("#result-count"),
  updates: document.querySelector("#updates"),
  emptyState: document.querySelector("#empty-state"),
  search: document.querySelector("#search"),
  filterSegments: [...document.querySelectorAll("[data-filter]")],
  viewSegments: [...document.querySelectorAll("[data-view]")]
};

init();

async function init() {
  bindEvents();
  await loadUpdates();
  setInterval(() => loadUpdates({ silent: true }), 10 * 60 * 1000);
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderUpdates();
  });

  elements.refreshButton.addEventListener("click", () => loadUpdates({ manual: true }));
  elements.shareButton.addEventListener("click", copyShareLink);

  elements.filterSegments.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      elements.filterSegments.forEach((segment) => segment.classList.toggle("active", segment === button));
      renderUpdates();
    });
  });

  elements.viewSegments.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      elements.viewSegments.forEach((segment) => segment.classList.toggle("active", segment === button));
      renderUpdates();
    });
  });
}

async function copyShareLink() {
  const url = window.location.href.split("#")[0];

  try {
    await navigator.clipboard.writeText(url);
    elements.shareButton.textContent = "Link copied";
  } catch {
    elements.shareButton.textContent = "Copy this URL";
  }

  clearTimeout(state.shareResetTimer);
  state.shareResetTimer = setTimeout(() => {
    elements.shareButton.textContent = "Copy Share Link";
  }, 2200);
}

async function loadUpdates(options = {}) {
  if (state.isRefreshing) return;

  const { manual = false, silent = false } = options;
  const previousGeneratedAt = state.data?.generatedAt ?? null;
  const previousIds = new Set(state.knownIds);

  try {
    state.isRefreshing = true;
    setRefreshingUI(true);

    const response = await fetch(`data/updates.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const fresh = normalizeData(await response.json());
    state.data = fresh;
    state.knownIds = collectIds(fresh);

    renderShell();
    renderWeeklyHighlights();
    renderUpdates();

    if (manual) {
      const newCount = countNewIds(state.knownIds, previousIds);
      const sameSnapshot = previousGeneratedAt === fresh.generatedAt;
      if (newCount > 0) {
        flashStatus(`+${newCount} new since last refresh`);
      } else if (sameSnapshot) {
        flashStatus("Already up to date");
      } else {
        flashStatus("Refreshed");
      }
    }
  } catch (error) {
    if (!silent) {
      elements.lastUpdated.textContent = "Could not load updates";
      elements.updates.innerHTML = `<div class="empty-state">Update data is not available yet. Run <code>npm run fetch</code> once locally or trigger the GitHub Action.</div>`;
    }
    console.error(error);
  } finally {
    state.isRefreshing = false;
    setRefreshingUI(false);
  }
}

function setRefreshingUI(busy) {
  elements.refreshButton.disabled = busy;
  elements.refreshButton.classList.toggle("spinning", busy);
  elements.refreshButton.querySelector("span").textContent = busy ? "Checking" : "Refresh";
}

function flashStatus(text) {
  if (!state.data) return;
  const restore = formatLastUpdatedText(state.data.generatedAt);
  elements.lastUpdated.textContent = text;
  clearTimeout(state.statusResetTimer);
  state.statusResetTimer = setTimeout(() => {
    elements.lastUpdated.textContent = restore;
  }, 2500);
}

function collectIds(data) {
  const ids = new Set();
  for (const item of data.updates) ids.add(item.id);
  for (const item of data.archive) ids.add(item.id);
  for (const item of data.weeklyHighlights) ids.add(item.id);
  return ids;
}

function countNewIds(current, previous) {
  if (previous.size === 0) return 0;
  let count = 0;
  for (const id of current) if (!previous.has(id)) count += 1;
  return count;
}

function normalizeData(data) {
  const updates = [...(data.updates ?? [])].sort(sortByFreshness);
  const archive = [...(data.archive ?? [])].sort(sortByFreshness);
  const weeklyHighlights = [...(data.weeklyHighlights ?? updates.slice(0, 5))]
    .sort((a, b) => Number(b.score) - Number(a.score) || sortByFreshness(a, b));

  return {
    ...data,
    updates,
    archive,
    weeklyHighlights
  };
}

function renderShell() {
  elements.lastUpdated.textContent = formatLastUpdatedText(state.data.generatedAt);
  elements.statusPulse.classList.toggle("stale", isStale(state.data.generatedAt));
  elements.updateCount.textContent = state.data.updates.length;
  elements.archiveCount.textContent = state.data.archive.length;
  elements.highlightMetricCount.textContent = state.data.weeklyHighlights.length;
  elements.weeklyCount.textContent = `${state.data.weeklyHighlights.length} major`;
}

function formatLastUpdatedText(generatedAt) {
  const date = new Date(generatedAt);
  return `Cloud sync ${formatRelative(date)}`;
}

function isStale(generatedAt) {
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs > 3 * 60 * 60 * 1000;
}

function renderWeeklyHighlights() {
  const highlights = state.data.weeklyHighlights.slice(0, 4);

  if (!highlights.length) {
    elements.weeklyHighlights.innerHTML = `<div class="empty-state">No major weekly highlights yet.</div>`;
    return;
  }

  elements.weeklyHighlights.innerHTML = highlights.map((item, index) => `
    <article class="highlight-card">
      <div class="rank">${index + 1}</div>
      <div>
        <div class="card-meta compact">
          <span class="tag">${escapeHtml(item.category)}</span>
          <span>${escapeHtml(item.source)}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${formatRelative(new Date(item.publishedAt))}</span>
        </div>
        <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.whatsImportant)}</p>
        <a class="compact-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Read more &rarr;</a>
      </div>
    </article>
  `).join("");
}

function renderUpdates() {
  if (!state.data) return;

  const list = state.view === "archive" ? state.data.archive : state.data.updates;
  const filtered = list.filter((item) => {
    const matchesFilter = state.filter === "all" || item.category === state.filter;
    const haystack = `${item.title} ${item.summary} ${item.whatsImportant} ${item.source}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesFilter && matchesQuery;
  }).sort(sortByFreshness);

  elements.feedTitle.textContent = state.view === "archive"
    ? "Archive: Older Than 24 Hours"
    : "Latest Important Updates";
  elements.resultCount.textContent = `${filtered.length} shown`;
  elements.emptyState.hidden = filtered.length > 0;
  elements.updates.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(item) {
  return `
    <article class="update-card">
      <div class="card-meta">
        <span class="tag">${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.source)}</span>
        <span class="dot" aria-hidden="true"></span>
        <time datetime="${escapeHtml(item.publishedAt)}">${formatRelative(new Date(item.publishedAt))}</time>
        <span class="dot" aria-hidden="true"></span>
        <span class="score">Score ${Math.round(item.score)}</span>
      </div>
      <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
      <div class="brief-grid">
        <div class="brief-block">
          <strong>Summary</strong>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <div class="brief-block important">
          <strong>What's important</strong>
          <p>${escapeHtml(item.whatsImportant)}</p>
        </div>
      </div>
      <div class="card-actions">
        <a class="read-more" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Read source &rarr;</a>
      </div>
    </article>
  `;
}

function sortByFreshness(a, b) {
  return new Date(b.publishedAt) - new Date(a.publishedAt);
}

function formatRelative(date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
