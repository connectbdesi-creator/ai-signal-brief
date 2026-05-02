# AI Signal Brief

A free-tier AI updates site that refreshes every 2 hours, filters the most important items, and breaks each update into:

1. Title
2. Summary
3. What's Important

## Why this setup

- **Hosting:** GitHub Pages, free for public repositories.
- **Scheduler:** GitHub Actions, runs every 2 hours.
- **Backend:** None. The action fetches RSS feeds and writes `public/data/updates.json`.
- **Filtering:** Free heuristic scoring, so there is no paid AI API key required.

## Local preview

```bash
npm run fetch
npm run serve
```

Open `http://localhost:4173`.

## Deploy on GitHub Pages

1. Create a new public GitHub repository.
2. Push this project to the repository's `main` branch.
3. In GitHub, open **Settings > Pages**.
4. Set **Build and deployment** to **GitHub Actions**.
5. Run the **Update AI Brief** workflow once from the Actions tab.

After that, GitHub Actions refreshes the site every 2 hours.

## Tuning importance

Edit `scripts/fetch-updates.mjs`:

- Add or remove feeds in `feeds`.
- Change keyword weights in `highSignalTerms`.
- Adjust categories in `categories`.
- Change the final limit in `.slice(0, 36)`.

## Optional upgrade

The current version stays free by avoiding paid summarization. If you later want more human-quality summaries, add a free-tier LLM provider or a paid API inside `scripts/fetch-updates.mjs`, store the API key as a GitHub Actions secret, and keep the static hosting model unchanged.
