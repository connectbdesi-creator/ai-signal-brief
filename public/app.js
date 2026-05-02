const state = {
  data: null,
  view: "latest",
  filter: "all",
  query: "",
  isRefreshing: false,
  shareResetTimer: null
};

const elements = {
  lastUpdated: document.querySelector("#last-updated"),
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
  setInterval(loadUpdates, 10 * 60 * 1000);
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderUpdates();
  });

  elements.refreshButton.addEventListener("click", async () => {
    await loadUpdates({ manual: true });
  });

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
    elements.shareButton.textContent = "Link Copied";
  } catch {
    elements.shareButton.textContent = "Copy this page URL";
  }

  clearTimeout(state.shareResetTimer);
  state.shareResetTimer = setTimeout(() => {
    elements.shareButton.textContent = "Copy Share Link";
  }, 2200);
}

async function loadUpdates(options = {}) {
  if (state.isRefreshing) return;

  try {
    state.isRefreshing = true;
    elements.refreshButton.disabled = true;
    elements.refreshButton.classList.add("spinning");
    elements.refreshButton.querySelector("span").textContent = "Checking";
    if (options.manual) elements.lastUpdated.textContent = "Checking for fresh data...";

    const response = await fetch(`data/updates.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = normalizeData(await response.json());
    renderShell();
    renderWeeklyHighlights();
    renderUpdates();
  } catch (error) {
    elements.lastUpdated.textContent = "Could not load updates";
    elements.updates.innerHTML = `<div class="empty-state">Update data is not available yet. Run <code>npm run fetch</code> once locally or trigger the GitHub Action.</div>`;
    console.error(error);
  } finally {
    state.isRefreshing = false;
    elements.refreshButton.disabled = false;
    elements.refreshButton.classList.remove("spinning");
    elements.refreshButton.querySelector("span").textContent = "Refresh";
  }
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
  const generatedAt = new Date(state.data.generatedAt);
  elements.lastUpdated.textContent = `Updated ${formatRelative(generatedAt)}`;
  elements.updateCount.textContent = state.data.updates.length;
  elements.archiveCount.textContent = state.data.archive.length;
  elements.highlightMetricCount.textContent = state.data.weeklyHighlights.length;
  elements.weeklyCount.textContent = `${state.data.weeklyHighlights.length} major`;
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
          <span>${formatRelative(new Date(item.publishedAt))}</span>
        </div>
        <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.whatsImportant)}</p>
        <a class="read-more compact-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Read More</a>
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
        <time datetime="${escapeHtml(item.publishedAt)}">${formatRelative(new Date(item.publishedAt))}</time>
        <span class="score">Score ${Math.round(item.score)}</span>
      </div>
      <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
      <div class="brief-grid">
        <div class="brief-block">
          <strong>Summary</strong>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <div class="brief-block important">
          <strong>What's Important</strong>
          <p>${escapeHtml(item.whatsImportant)}</p>
        </div>
      </div>
      <div class="card-actions">
        <a class="read-more" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Read More</a>
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
