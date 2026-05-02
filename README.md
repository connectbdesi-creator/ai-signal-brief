# AI Signal Brief

A free-tier AI updates site that refreshes every 2 hours, filters the most important items, and breaks each update into:

1. Title
2. Summary
3. What's Important

The homepage is split into:

- **Latest:** important updates from the last 24 hours, sorted newest first.
- **Archive:** important updates older than 24 hours.
- **Weekly Highlights:** the highest-scoring major AI updates from the last 7 days.

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

The site includes a **Refresh** button for reloading the latest published data and a **Run cloud refresh** link that opens the GitHub workflow page for a manual cloud-side refresh.

## Telegram notifications

The workflow can send a Telegram digest after every successful refresh and deploy. It only runs when the required GitHub Secrets exist.

1. In Telegram, open `@BotFather`.
2. Send `/newbot` and follow the prompts.
3. Copy the bot token.
4. Start a chat with your new bot and send any message to it.
5. Open this URL in a browser, replacing `YOUR_TOKEN`:

```text
https://api.telegram.org/botYOUR_TOKEN/getUpdates
```

6. Find your numeric `chat.id` in the JSON response.
7. In GitHub, open **Settings > Secrets and variables > Actions > New repository secret**.
8. Add these secrets:

```text
TELEGRAM_BOT_TOKEN=your bot token
TELEGRAM_CHAT_ID=your chat id
```

The notification script sends the top 5 updates with score 55 or higher. You can tune it with optional workflow environment variables:

```text
TELEGRAM_MAX_ITEMS=5
TELEGRAM_MIN_SCORE=55
```

## Tuning importance

Edit `scripts/fetch-updates.mjs`:

- Add or remove feeds in `feeds`.
- Change keyword weights in `highSignalTerms`.
- Adjust categories in `categories`.
- Change the final limit in `.slice(0, 36)`.

## Optional upgrade

The current version stays free by avoiding paid summarization. If you later want more human-quality summaries, add a free-tier LLM provider or a paid API inside `scripts/fetch-updates.mjs`, store the API key as a GitHub Actions secret, and keep the static hosting model unchanged.
