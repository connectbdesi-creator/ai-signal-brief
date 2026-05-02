import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputPath = join(rootDir, "public", "data", "updates.json");

const feeds = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", sourceScore: 18, type: "official" },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", sourceScore: 16, type: "official" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", sourceScore: 16, type: "official" },
  { name: "Google Research", url: "https://research.google/blog/rss/", sourceScore: 15, type: "research" },
  { name: "Meta Newsroom", url: "https://about.fb.com/feed/", sourceScore: 12, type: "official" },
  { name: "Microsoft AI", url: "https://blogs.microsoft.com/ai/feed/", sourceScore: 14, type: "official" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", sourceScore: 14, type: "official" },
  { name: "NVIDIA AI", url: "https://blogs.nvidia.com/blog/category/deep-learning/feed/", sourceScore: 12, type: "official" },
  { name: "AWS Machine Learning", url: "https://aws.amazon.com/blogs/machine-learning/feed/", sourceScore: 12, type: "official" },
  { name: "Berkeley AI Research", url: "https://bair.berkeley.edu/blog/feed.xml", sourceScore: 12, type: "research" },
  { name: "MIT News AI", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", sourceScore: 10, type: "research" },
  { name: "Planet AI", url: "https://planet-ai.net/rss.xml", sourceScore: 11, type: "aggregator" },
  { name: "Machine Brief", url: "https://www.machinebrief.com/rss.xml", sourceScore: 10, type: "newsletter" },
  { name: "The Decoder", url: "https://the-decoder.com/feed/", sourceScore: 9, type: "press" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", sourceScore: 9, type: "press" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", sourceScore: 9, type: "press" },
  { name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", sourceScore: 9, type: "press" },
  { name: "Google News AI", url: "https://news.google.com/rss/search?q=(artificial%20intelligence%20OR%20OpenAI%20OR%20Anthropic%20OR%20Gemini%20OR%20LLM)%20when%3A2d&hl=en-US&gl=US&ceid=US:en", sourceScore: 8, type: "news" },
  { name: "The Gradient", url: "https://thegradient.pub/rss/", sourceScore: 7, type: "analysis" },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", sourceScore: 7, type: "analysis" },
  { name: "Reddit MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss", sourceScore: 4, type: "community" },
  { name: "Reddit LocalLLaMA", url: "https://www.reddit.com/r/LocalLLaMA/.rss", sourceScore: 4, type: "community" },
  { name: "Reddit Artificial", url: "https://www.reddit.com/r/artificial/.rss", sourceScore: 3, type: "community" }
];

const highSignalTerms = [
  ["launch", 18],
  ["launched", 18],
  ["launches", 18],
  ["release", 16],
  ["released", 16],
  ["introducing", 18],
  ["announces", 14],
  ["unveils", 15],
  ["model", 12],
  ["frontier", 12],
  ["reasoning", 10],
  ["multimodal", 10],
  ["agent", 9],
  ["agents", 9],
  ["api", 8],
  ["open source", 12],
  ["open-source", 12],
  ["benchmark", 8],
  ["safety", 8],
  ["policy", 7],
  ["regulation", 7],
  ["chip", 7],
  ["compute", 7],
  ["funding", 6],
  ["acquires", 8],
  ["partnership", 6]
];

const modelTerms = [
  "gpt",
  "o3",
  "o4",
  "claude",
  "gemini",
  "llama",
  "mistral",
  "mixtral",
  "grok",
  "deepseek",
  "qwen",
  "command",
  "phi",
  "sora",
  "imagen",
  "veo",
  "stable diffusion",
  "flux",
  "midjourney"
];

const aiContextTerms = [
  "ai",
  "artificial intelligence",
  "llm",
  "large language",
  "machine learning",
  "foundation model",
  "generative",
  "neural",
  "robotics",
  "agi"
];

const categories = [
  {
    id: "model_launch",
    label: "Model Launch",
    terms: ["introducing", "launch", "release", "unveil", "new model", "frontier model", "reasoning model"]
  },
  {
    id: "product_update",
    label: "Product Update",
    terms: ["api", "app", "chatgpt", "claude", "gemini", "copilot", "agent", "tool", "platform", "developer"]
  },
  {
    id: "research",
    label: "Research",
    terms: ["paper", "research", "benchmark", "evaluation", "dataset", "training", "inference", "architecture"]
  },
  {
    id: "safety_policy",
    label: "Safety and Policy",
    terms: ["safety", "policy", "regulation", "governance", "copyright", "risk", "security", "alignment"]
  },
  {
    id: "business",
    label: "Business",
    terms: ["funding", "partnership", "acquisition", "revenue", "valuation", "deal", "enterprise"]
  }
];

async function main() {
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const failures = [];
  const allItems = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      if (result.value.error) failures.push(result.value.error);
    } else {
      failures.push(result.reason?.message ?? String(result.reason));
    }
  }

  const deduped = dedupeItems(allItems);
  const scored = capBySource(deduped
    .map(enrichItem)
    .filter(shouldKeepItem)
    .sort(sortByFreshness)
    .slice(0, 180), 14)
    .slice(0, 120);

  const latestUpdates = capBySource(scored
    .filter((item) => ageHours(item.publishedAt) <= 24)
    .sort(sortByFreshness), 8)
    .slice(0, 48);

  const archive = capBySource(scored
    .filter((item) => ageHours(item.publishedAt) > 24)
    .sort(sortByFreshness), 10)
    .slice(0, 72);

  const weeklyHighlights = capBySource(scored
    .filter((item) => ageHours(item.publishedAt) <= 168 && item.score >= 70)
    .sort((a, b) => b.score - a.score || sortByFreshness(a, b)), 2)
    .slice(0, 7);

  const payload = {
    generatedAt: new Date().toISOString(),
    refreshCadence: "Every 2 hours via GitHub Actions",
    count: latestUpdates.length,
    totalCount: scored.length,
    archiveCount: archive.length,
    weeklyHighlightCount: weeklyHighlights.length,
    sources: feeds.map(({ name, url, type }) => ({ name, url, type })),
    fetchWarnings: failures.slice(0, 8),
    updates: latestUpdates,
    archive,
    weeklyHighlights,
    allUpdates: scored
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${latestUpdates.length} latest updates, ${archive.length} archived updates, and ${weeklyHighlights.length} weekly highlights to ${outputPath}`);
  if (failures.length) {
    console.warn(`Feed warnings: ${failures.length}`);
    failures.slice(0, 8).forEach((warning) => console.warn(`- ${warning}`));
  }
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "AI Signal Brief/1.0 (+https://github.com/)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    });

    if (!response.ok) {
      return { items: [], error: `${feed.name}: HTTP ${response.status}` };
    }

    const xml = await response.text();
    return { items: parseFeed(xml, feed) };
  } catch (error) {
    return { items: [], error: `${feed.name}: ${error.message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeed(xml, feed) {
  const itemBlocks = extractBlocks(xml, "item");
  const entryBlocks = extractBlocks(xml, "entry");
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  return blocks.map((block) => {
    const title = cleanText(readTag(block, "title"));
    const link = normalizeLink(readTag(block, "link") || readAtomLink(block));
    const publishedAt = parseDate(
      readTag(block, "pubDate") ||
        readTag(block, "published") ||
        readTag(block, "updated") ||
        readTag(block, "dc:date")
    );
    const summary = cleanText(
      readTag(block, "description") ||
        readTag(block, "summary") ||
        readTag(block, "content:encoded") ||
        readTag(block, "content")
    );

    return {
      id: stableId(`${feed.name}-${title}-${link}`),
      title,
      url: link,
      source: feed.name,
      sourceType: feed.type,
      sourceScore: feed.sourceScore,
      publishedAt,
      rawSummary: summary
    };
  }).filter((item) => item.title && item.url);
}

function extractBlocks(xml, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[\\s\\S]*?<\\/${escapeRegExp(tagName)}>`, "gi");
  return xml.match(pattern) ?? [];
}

function readTag(block, tagName) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXml(stripCdata(match[1])) : "";
}

function readAtomLink(block) {
  const match = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeXml(match[1]) : "";
}

function normalizeLink(link) {
  return cleanText(link).replace(/^<!\[CDATA\[|\]\]>$/g, "");
}

function parseDate(value) {
  const date = value ? new Date(cleanText(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function enrichItem(item) {
  const combined = `${item.title} ${item.rawSummary}`.toLowerCase();
  const category = pickCategory(combined);
  const recencyScore = scoreRecency(item.publishedAt);
  const keywordScore = scoreTerms(combined, highSignalTerms);
  const modelScore = modelTerms.some((term) => combined.includes(term)) ? 14 : 0;
  const aiScore = aiContextTerms.some((term) => combined.includes(term)) ? 8 : -14;
  const score = Math.max(0, item.sourceScore + recencyScore + keywordScore + modelScore + aiScore);
  const signals = buildSignals(item, category, combined, score);

  return {
    id: item.id,
    title: item.title,
    summary: summarize(item.rawSummary || item.title),
    whatsImportant: signals,
    category: category.label,
    score,
    source: item.source,
    sourceType: item.sourceType,
    publishedAt: item.publishedAt,
    url: item.url
  };
}

function shouldKeepItem(item) {
  const thresholds = {
    official: 30,
    research: 36,
    newsletter: 50,
    press: 42,
    news: 48,
    analysis: 42,
    aggregator: 46,
    community: 72
  };
  const text = `${item.title} ${item.summary} ${item.whatsImportant}`.toLowerCase();
  const threshold = thresholds[item.sourceType] ?? 45;

  if (item.sourceType === "community") {
    const communitySignal = [
      "release",
      "launched",
      "launch",
      "paper",
      "benchmark",
      "model",
      "open source",
      "open-source",
      "weights",
      "reasoning",
      "api"
    ].some((term) => text.includes(term));
    const lowSignal = [
      "help",
      "beginner",
      "what should i",
      "how do i",
      "career",
      "job",
      "hiring",
      "course",
      "meme",
      "daily thread"
    ].some((term) => text.includes(term));

    return communitySignal && !lowSignal && item.score >= threshold;
  }

  return item.score >= threshold;
}

function capBySource(items, limit) {
  const counts = new Map();
  const capped = [];

  for (const item of items) {
    const count = counts.get(item.source) ?? 0;
    if (count >= limit) continue;
    counts.set(item.source, count + 1);
    capped.push(item);
  }

  return capped;
}

function pickCategory(text) {
  let best = categories[1];
  let bestCount = -1;

  for (const category of categories) {
    const count = category.terms.filter((term) => text.includes(term)).length;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }

  return best;
}

function scoreRecency(publishedAt) {
  const hours = ageHours(publishedAt);
  if (hours <= 24) return 22;
  if (hours <= 72) return 16;
  if (hours <= 168) return 10;
  if (hours <= 336) return 5;
  return 0;
}

function ageHours(publishedAt) {
  return Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);
}

function sortByFreshness(a, b) {
  return new Date(b.publishedAt) - new Date(a.publishedAt);
}

function scoreTerms(text, terms) {
  return terms.reduce((total, [term, value]) => total + (text.includes(term) ? value : 0), 0);
}

function buildSignals(item, category, text, score) {
  const signals = [];

  if (category.id === "model_launch") {
    signals.push("Likely affects model choice, product roadmaps, or pricing decisions.");
  } else if (category.id === "research") {
    signals.push("Worth tracking because research shifts can become product capabilities quickly.");
  } else if (category.id === "safety_policy") {
    signals.push("Could change how teams deploy, govern, or evaluate AI systems.");
  } else if (category.id === "business") {
    signals.push("Signals market direction, partnerships, compute access, or competitive pressure.");
  } else {
    signals.push("Potentially useful for builders because it changes tools, APIs, or workflows.");
  }

  if (modelTerms.some((term) => text.includes(term))) {
    signals.push("Mentions a major model family or model platform.");
  }

  if (item.sourceType === "official") {
    signals.push("Comes from an official source, so treat it as primary information.");
  }

  if (score >= 80) {
    signals.push("Ranked high by the importance filter.");
  }

  return signals.slice(0, 3).join(" ");
}

function summarize(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return "No summary was provided by the source feed.";
  if (cleaned.length <= 340) return cleaned;
  return `${cleaned.slice(0, 337).trim()}...`;
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = normalizeDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function normalizeDedupeKey(item) {
  try {
    const url = new URL(item.url);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}

function cleanText(value) {
  return decodeXml(stripHtml(stripCdata(value ?? "")))
    .replace(/\s+/g, " ")
    .trim();
}

function stripCdata(value) {
  return String(value).replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(value) {
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stableId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `u_${(hash >>> 0).toString(16)}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
