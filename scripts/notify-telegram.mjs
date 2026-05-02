import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const updatesPath = join(rootDir, "public", "data", "updates.json");

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const siteUrl = process.env.SITE_URL || process.env.GITHUB_PAGES_URL || "";
const maxItems = Number(process.env.TELEGRAM_MAX_ITEMS || 5);
const minScore = Number(process.env.TELEGRAM_MIN_SCORE || 55);

async function main() {
  if (!token || !chatId) {
    console.log("Telegram secrets are not set. Skipping notification.");
    return;
  }

  const data = JSON.parse(await readFile(updatesPath, "utf8"));
  const updates = data.updates
    .filter((item) => Number(item.score) >= minScore)
    .slice(0, maxItems);

  if (!updates.length) {
    console.log(`No updates above score ${minScore}. Skipping notification.`);
    return;
  }

  const message = buildMessage(data, updates);
  await sendTelegram(message);
  console.log(`Sent Telegram digest with ${updates.length} updates.`);
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
