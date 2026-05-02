const state = {
  data: null,
  filter: "all",
  query: ""
};

const elements = {
  lastUpdated: document.querySelector("#last-updated"),
  updateCount: document.querySelector("#update-count"),
  sourceCount: document.querySelector("#source-count"),
  resultCount: document.querySelector("#result-count"),
  updates: document.querySelector("#updates"),
  sources: document.querySelector("#sources"),
  emptyState: document.querySelector("#empty-state"),
  search: document.querySelector("#search"),
  segments: [...document.querySelectorAll(".segment")]
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

  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      elements.segments.forEach((segment) => segment.classList.toggle("active", segment === button));
      renderUpdates();
    });
  });
}

async function loadUpdates() {
  try {
    const response = await fetch(`data/updates.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    renderShell();
    renderUpdates();
  } catch (error) {
    elements.lastUpdated.textContent = "Could not load updates";
    elements.updates.innerHTML = `<div class="empty-state">Update data is not available yet. Run <code>npm run fetch</code> once locally or trigger the GitHub Action.</div>`;
    console.error(error);
  }
}

function renderShell() {
  const generatedAt = new Date(state.data.generatedAt);
  elements.lastUpdated.textContent = `Updated ${formatRelative(generatedAt)}`;
  elements.updateCount.textContent = state.data.count ?? state.data.updates.length;
  elements.sourceCount.textContent = state.data.sources.length;
  elements.sources.innerHTML = state.data.sources
    .map((source) => `
      <div class="source">
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a>
        <small>${escapeHtml(source.type)}</small>
      </div>
    `)
    .join("");
}

function renderUpdates() {
  if (!state.data) return;

  const filtered = state.data.updates.filter((item) => {
    const matchesFilter = state.filter === "all" || item.category === state.filter;
    const haystack = `${item.title} ${item.summary} ${item.whatsImportant} ${item.source}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesFilter && matchesQuery;
  });

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
        <span>${formatRelative(new Date(item.publishedAt))}</span>
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
    </article>
  `;
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
