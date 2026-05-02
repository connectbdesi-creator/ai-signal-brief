import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const updatesPath = join(rootDir, "public", "data", "updates.json");
const sentStatePath = join(rootDir, "data", "telegram-sent.json");

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const siteUrl = process.env.SITE_URL || process.env.GITHUB_PAGES_URL || "";
const maxItems = Number(process.env.TELEGRAM_MAX_ITEMS || 5);
const minScore = Number(process.env.TELEGRAM_MIN_SCORE || 55);
const sentHistoryCap = Number(process.env.TELEGRAM_SENT_CAP || 1000);

async function main() {
  if (!token || !chatId) {
    console.log("Telegram secrets are not set. Skipping notification.");
    return;
  }

  const data = JSON.parse(await readFile(updatesPath, "utf8"));
  const sentState = await loadSentState();
  const sentIds = new Set(sentState.entries.map((entry) => entry.id));

  const candidates = data.updates
    .filter((item) => Number(item.score) >= minScore)
    .filter((item) => !sentIds.has(item.id))
    .slice(0, maxItems);

  if (!candidates.length) {
    console.log(`No new updates above score ${minScore}. Skipping notification.`);
    return;
  }

  const message = buildMessage(data, candidates);
  await sendTelegram(message);
  console.log(`Sent Telegram digest with ${candidates.length} new updates.`);

  const now = new Date().toISOString();
  const appended = [
    ...sentState.entries,
    ...candidates.map((item) => ({ id: item.id, sentAt: now, title: item.title }))
  ];
  const trimmed = appended
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    .slice(0, sentHistoryCap);

  await saveSentState({ updatedAt: now, entries: trimmed });
}

async function loadSentState() {
  try {
    const raw = await readFile(sentStatePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt ?? null,
      entries: Array.isArray(parsed.entries) ? parsed.entries : []
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { updatedAt: null, entries: [] };
  }
}

async function saveSentState(state) {
  await mkdir(dirname(sentStatePath), { recursive: true });
  await writeFile(sentStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function buildMessage(data, updates) {
  const generatedAt = new Date(data.generatedAt).toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.TZ || "UTC"
  });

  const items = updates.map((item, index) => {
    const title = escapeHtml(item.title);
    const summary = trimForTelegram(item.summary, 260);
    const importance = trimForTelegram(item.whatsImportant, 260);
    const url = escapeHtml(item.url);

    return [
      `<b>${index + 1}. ${title}</b>`,
      `<b>Summary:</b> ${escapeHtml(summary)}`,
      `<b>What's Important:</b> ${escapeHtml(importance)}`,
      `<a href="${url}">Read source</a>`
    ].join("\n");
  });

  const footer = siteUrl
    ? `\n\n<a href="${escapeHtml(siteUrl)}">Open full AI brief</a>`
    : "";

  return [
    "<b>AI Signal Brief</b>",
    `Updated ${escapeHtml(generatedAt)}`,
    "",
    ...items.join("\n\n").split("\n"),
    footer
  ].join("\n").slice(0, 4000);
}

async function sendTelegram(text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed: HTTP ${response.status} ${body}`);
  }
}

function trimForTelegram(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
